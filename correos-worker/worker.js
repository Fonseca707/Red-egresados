// ─────────────────────────────────────────────────────────────────────────────
// Correos automáticos de Sinapsis (Cloudflare Worker + Cron + Resend)
//
// Se despierta solo cada día (cron 9:00 Colombia), lee Firestore por REST
// (lectura pública, sin credenciales) y decide a quién le toca correo HOY.
// Los temporizadores son INDIVIDUALES: cada egresado recibe según SU fecha
// (su registro, su último hito), no todos el mismo día.
//
// CONSENTIMIENTO ESTRICTO (decisión de Juan): solo reciben correo quienes
// marcaron la casilla `newsletterOptIn` al registrarse. Los perfiles antiguos
// que nunca vieron la casilla NO reciben nada hasta que la marquen.
//
// Estado en KV (no en Firestore, porque las rules no permiten escritura sin
// auth): clave `${uid}:${tipo}` = fecha ISO del envío. Evita duplicados.
//
// Correos:
//   bienvenida         → 1 día después de registrarse
//   completar-perfil   → a los 3 y 10 días, si no tiene ruta (>=2 hitos)
//   pulso              → si su hito abierto lleva >1 año sin actualizarse
//                        (se repite máximo 1 vez al año)
//   mensaje-nuevo      → chat sin leer (lo dispara la web, endpoint POST)
//
// INTERRUPTOR MAESTRO: si el estado en KV es "pausado", NADA sale de aquí —
// ni el cron, ni los avisos de mensaje. Se controla desde el panel admin y
// vive en el Worker (no en la web), así que funciona aunque la web esté caída.
// Por seguridad, arranca PAUSADO: hay que encenderlo a propósito.
//
// Endpoints:
//   GET  /estado         → { pausado: bool } (público, lo lee el panel)
//   POST /interruptor    → enciende/pausa (requiere ?clave=PANEL_SECRET)
//   GET  /previsualizar  → qué se enviaría hoy, SIN enviar (para probar)
//   POST /ejecutar       → fuerza la corrida (requiere ?clave=PANEL_SECRET)
//   POST /mensaje-nuevo  → aviso de mensaje (lo llama la web)
// ─────────────────────────────────────────────────────────────────────────────

const DIA = 86400000;
const ORIGENES = ['https://fonseca707.github.io', 'http://localhost:8642'];

// ── Firestore por REST (lectura pública) ─────────────────────────────────────
function valor(v) {
    if (!v) return null;
    if ('stringValue' in v) return v.stringValue;
    if ('integerValue' in v) return Number(v.integerValue);
    if ('booleanValue' in v) return v.booleanValue;
    if ('timestampValue' in v) return v.timestampValue;
    if ('nullValue' in v) return null;
    if ('arrayValue' in v) return (v.arrayValue.values || []).map(valor);
    return null;
}
function campos(f = {}) {
    const o = {};
    for (const [k, v] of Object.entries(f)) o[k] = valor(v);
    return o;
}
function base(env) {
    return `https://firestore.googleapis.com/v1/projects/${env.FIRESTORE_PROJECT}/databases/(default)/documents/artifacts/${encodeURIComponent(env.FIRESTORE_APP_ID)}/public/data`;
}
async function coleccion(url) {
    const docs = [];
    let token = '';
    do {
        const res = await fetch(`${url}?pageSize=300${token ? `&pageToken=${token}` : ''}`);
        if (!res.ok) throw new Error(`Firestore ${res.status}`);
        const data = await res.json();
        for (const d of data.documents || []) {
            docs.push({ _id: d.name.split('/').pop(), ...campos(d.fields) });
        }
        token = data.nextPageToken || '';
    } while (token);
    return docs;
}

// ── Destinatarios válidos ────────────────────────────────────────────────────
const SINTETICOS = ['users.sinapsis.app', 'sinapsis.local'];
function correoDe(a) {
    const e = String(a.contactEmail || a.email || '').toLowerCase().trim();
    if (!e.includes('@')) return '';
    if (SINTETICOS.some(d => e.endsWith('@' + d))) return '';
    if (/example\.com$|prueba/i.test(e)) return '';   // semillas de prueba
    return e;
}
function puedeRecibir(a) {
    return Boolean(a.newsletterOptIn) &&           // consentimiento explícito
        a.accountStatus !== 'suspendido' &&
        correoDe(a);
}
function dias(desde) {
    if (!desde) return null;
    const t = new Date(desde).getTime();
    if (Number.isNaN(t)) return null;
    return Math.floor((Date.now() - t) / DIA);
}

// ── Plantillas ───────────────────────────────────────────────────────────────
function envoltura(env, titulo, cuerpo, cta) {
    return `<!doctype html><html><body style="margin:0;background:#f5f5f4;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="background:#16a34a;border-radius:20px 20px 0 0;padding:28px 32px;">
      <p style="margin:0;color:rgba(255,255,255,.8);font-size:12px;font-weight:700;letter-spacing:2px;">SINAPSIS</p>
      <h1 style="margin:6px 0 0;color:#fff;font-size:24px;">${titulo}</h1>
    </div>
    <div style="background:#fff;border-radius:0 0 20px 20px;padding:32px;color:#374151;font-size:15px;line-height:1.6;">
      ${cuerpo}
      ${cta ? `<p style="margin:28px 0 0;"><a href="${cta.url}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;font-weight:700;padding:13px 26px;border-radius:10px;">${cta.texto}</a></p>` : ''}
      <p style="margin:32px 0 0;padding-top:20px;border-top:1px solid #f3f4f6;color:#9ca3af;font-size:12px;line-height:1.5;">
        Recibes este correo porque aceptaste recibir información de la red de egresados del Liceo Campestre de Pereira.
        Para dejar de recibirlos, desmarca la casilla en <a href="${env.SITIO}/profile.html" style="color:#16a34a;">tu perfil</a>.
      </p>
    </div>
  </div>
</body></html>`;
}

function plantilla(tipo, alum, env, extra = {}) {
    const nombre = (alum.firstName || '').trim() || 'Hola';
    const perfil = `${env.SITIO}/profile.html`;
    if (tipo === 'bienvenida') {
        return {
            asunto: 'Tu lugar en la red de egresados ya está listo',
            html: envoltura(env, `Bienvenido, ${nombre}`, `
                <p>Gracias por unirte a <strong>Sinapsis</strong>, la red de egresados del Liceo Campestre de Pereira.</p>
                <p>La red se sostiene con algo que solo tú puedes contar: <strong>tu ruta</strong>. Del colegio a la universidad, al primer trabajo, a lo que haces hoy. Para un estudiante que está eligiendo carrera, tu camino es el mapa que no tiene.</p>
                <p>Completar tu ruta toma unos minutos.</p>`,
                { url: perfil, texto: 'Completar mi ruta' })
        };
    }
    if (tipo === 'completar-perfil') {
        return {
            asunto: `${nombre}, tu ruta aún está en blanco`,
            html: envoltura(env, 'Tu trayectoria le falta a la red', `
                <p>Tu perfil en Sinapsis está creado, pero todavía no cuenta por dónde has pasado.</p>
                <p>Con agregar dos o tres hitos —dónde estudiaste, dónde trabajas hoy— tu ruta aparece en el directorio y puede orientar a los estudiantes que vienen detrás.</p>`,
                { url: perfil, texto: 'Agregar mis hitos' })
        };
    }
    if (tipo === 'pulso') {
        const donde = [alum._hitoAbierto?.rol, alum._hitoAbierto?.organizacion].filter(Boolean).join(' en ');
        return {
            asunto: donde ? `¿Sigues en ${donde}?` : '¿Sigue actualizada tu ruta?',
            html: envoltura(env, 'Una pregunta rápida', `
                <p>Hola ${nombre}. Hace un año registraste ${donde ? `<strong>${donde}</strong>` : 'tu situación actual'} en tu ruta.</p>
                <p>¿Sigue siendo así? Si cambió algo —nuevo trabajo, grado, un proyecto propio— actualizarlo toma un minuto y mantiene la red viva.</p>`,
                { url: perfil, texto: 'Revisar mi ruta' })
        };
    }
    if (tipo === 'mensaje-nuevo') {
        return {
            asunto: `${extra.deNombre || 'Alguien'} te escribió en Sinapsis`,
            html: envoltura(env, 'Tienes un mensaje sin leer', `
                <p>Hola ${nombre}. <strong>${extra.deNombre || 'Un miembro de la red'}</strong> te escribió en Sinapsis y aún no has leído el mensaje.</p>
                <p>Muchas veces es un estudiante preguntando por tu carrera. Una respuesta corta puede cambiarle la decisión.</p>`,
                { url: `${env.SITIO}/messages.html`, texto: 'Leer el mensaje' })
        };
    }
    return null;
}

// ── Envío por Resend ─────────────────────────────────────────────────────────
// Única puerta de salida: aquí se vuelve a comprobar el interruptor, para que
// ningún camino (cron, /ejecutar, /mensaje-nuevo) pueda saltárselo por error.
async function enviar(env, para, asunto, html) {
    if (await estaPausado(env)) throw new Error('PAUSADO: los correos automáticos están apagados');
    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from: env.REMITENTE,
            to: [para],
            reply_to: env.RESPUESTA_A,
            subject: asunto,
            html
        })
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 120)}`);
    return true;
}

// ── Motor: quién recibe qué hoy ──────────────────────────────────────────────
async function calcular(env) {
    const alumni = await coleccion(`${base(env)}/alumni`);
    const pendientes = [];

    for (const a of alumni) {
        if (!puedeRecibir(a)) continue;
        const antiguedad = dias(a.createdAt);
        const hitos = Number(a.hitosCount) || 0;

        // 1. Bienvenida: al día siguiente de registrarse. Sin ventana de cierre:
        //    los ya registrados (que nunca la recibieron) también la reciben,
        //    y KV garantiza que sea UNA sola vez en la vida.
        if (antiguedad !== null && antiguedad >= 1) {
            pendientes.push({ alum: a, tipo: 'bienvenida', unaVez: true });
        }

        // 2. Completar perfil: desde los 3 días sin ruta. Se reintenta cada 45
        //    días (recordatorio suave, no spam) hasta que agregue sus hitos.
        if (hitos < 2 && antiguedad !== null && antiguedad >= 3) {
            pendientes.push({ alum: a, tipo: 'completar-perfil', repetirCadaDias: 45 });
        }

        // 3. Pulso: hito abierto con más de un año sin actualizar (máx. 1/año)
        if (hitos > 0) {
            try {
                const hs = await coleccion(`${base(env)}/alumni/${a._id}/hitos`);
                const abierto = hs.find(h => h.actual);
                const edad = dias(abierto?.updatedAt);
                if (abierto && edad !== null && edad >= 365) {
                    pendientes.push({ alum: { ...a, _hitoAbierto: abierto }, tipo: 'pulso', repetirCadaDias: 365 });
                }
            } catch {}
        }
    }
    return pendientes;
}

// Tope por corrida: si algo se descontrola, no se queman la cuota ni la
// paciencia de los egresados. El resto queda para el día siguiente.
const MAX_POR_CORRIDA = 60;

// ── Interruptor maestro ──────────────────────────────────────────────────────
const CLAVE_INTERRUPTOR = '_sistema:interruptor';
// Ausencia de valor = PAUSADO (fail-safe: si el KV falla o nunca se configuró,
// no se manda nada). Solo el valor exacto 'activo' habilita los envíos.
async function estaPausado(env) {
    try {
        const v = await env.CORREOS_ESTADO.get(CLAVE_INTERRUPTOR);
        return v !== 'activo';
    } catch {
        return true; // ante cualquier duda, no enviar
    }
}

async function procesar(env, { simular = false } = {}) {
    const pausado = await estaPausado(env);
    // Si está pausado, se calcula igual (para poder previsualizar) pero no sale nada.
    if (pausado && !simular) {
        return { pausado: true, enviados: 0, hechos: [], saltados: [], errores: [],
                 mensaje: 'Correos automáticos PAUSADOS: no se envió nada.' };
    }
    const pendientes = await calcular(env);
    const hechos = [], saltados = [], errores = [];
    const yaHoy = new Set(); // máximo UN correo por persona por corrida

    for (const p of pendientes) {
        if (hechos.length >= MAX_POR_CORRIDA) {
            saltados.push({ clave: `${p.alum._id}:${p.tipo}`, motivo: 'tope de la corrida; se enviará mañana' });
            continue;
        }
        if (yaHoy.has(p.alum._id)) {
            saltados.push({ clave: `${p.alum._id}:${p.tipo}`, motivo: 'ya recibió otro correo hoy' });
            continue;
        }
        const clave = `${p.alum._id}:${p.tipo}${p.sufijo ? ':' + p.sufijo : ''}`;
        const previo = await env.CORREOS_ESTADO.get(clave);
        if (previo) {
            const edad = dias(previo);
            if (p.unaVez || (p.repetirCadaDias && edad !== null && edad < p.repetirCadaDias)) {
                saltados.push({ clave, motivo: `ya enviado ${previo.slice(0, 10)}` });
                continue;
            }
        }
        const msg = plantilla(p.tipo, p.alum, env);
        if (!msg) continue;
        const para = correoDe(p.alum);
        if (simular) {
            hechos.push({ para, tipo: p.tipo, asunto: msg.asunto });
            yaHoy.add(p.alum._id);
            continue;
        }
        try {
            await enviar(env, para, msg.asunto, msg.html);
            await env.CORREOS_ESTADO.put(clave, new Date().toISOString());
            hechos.push({ para, tipo: p.tipo });
            yaHoy.add(p.alum._id);
        } catch (e) {
            errores.push({ para, tipo: p.tipo, error: String(e.message || e) });
        }
    }
    return { simulado: simular, pausado, enviados: hechos.length, hechos, saltados, errores };
}

// ── Entradas ─────────────────────────────────────────────────────────────────
function cors(origen) {
    return {
        'Access-Control-Allow-Origin': ORIGENES.includes(origen) ? origen : ORIGENES[0],
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };
}

export default {
    // Temporizador: corre solo cada día
    async scheduled(event, env, ctx) {
        ctx.waitUntil(procesar(env));
    },

    async fetch(request, env) {
        const url = new URL(request.url);
        const origen = request.headers.get('Origin') || '';
        const headers = { ...cors(origen), 'Content-Type': 'application/json' };

        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origen) });

        // Estado del interruptor (lo consulta el panel admin al abrir)
        if (url.pathname === '/estado') {
            const pausado = await estaPausado(env);
            const desde = await env.CORREOS_ESTADO.get(CLAVE_INTERRUPTOR + ':desde');
            return new Response(JSON.stringify({ pausado, desde: desde || null }), { headers });
        }

        // Interruptor maestro: encender / pausar (protegido con clave)
        if (url.pathname === '/interruptor' && request.method === 'POST') {
            if (url.searchParams.get('clave') !== env.PANEL_SECRET) {
                return new Response(JSON.stringify({ error: 'Clave incorrecta' }), { status: 403, headers });
            }
            const { activar } = await request.json().catch(() => ({}));
            await env.CORREOS_ESTADO.put(CLAVE_INTERRUPTOR, activar ? 'activo' : 'pausado');
            await env.CORREOS_ESTADO.put(CLAVE_INTERRUPTOR + ':desde', new Date().toISOString());
            return new Response(JSON.stringify({ pausado: !activar }), { headers });
        }

        // Previsualizar: qué se enviaría hoy, sin enviar nada
        if (url.pathname === '/previsualizar') {
            const r = await procesar(env, { simular: true });
            return new Response(JSON.stringify(r, null, 2), { headers });
        }

        // Forzar corrida manual (protegida con clave)
        if (url.pathname === '/ejecutar' && request.method === 'POST') {
            if (url.searchParams.get('clave') !== env.PANEL_SECRET) {
                return new Response(JSON.stringify({ error: 'Clave incorrecta' }), { status: 403, headers });
            }
            const r = await procesar(env);
            return new Response(JSON.stringify(r, null, 2), { headers });
        }

        // Aviso de mensaje nuevo (lo llama la web al enviar un chat)
        if (url.pathname === '/mensaje-nuevo' && request.method === 'POST') {
            if (!ORIGENES.includes(origen)) return new Response('Origen no permitido', { status: 403 });
            if (await estaPausado(env)) {
                return new Response(JSON.stringify({ enviado: false, motivo: 'correos automáticos pausados' }), { headers });
            }
            try {
                const { destinatarioUid, deNombre } = await request.json();
                if (!destinatarioUid) return new Response('Falta destinatarioUid', { status: 400, headers });
                const res = await fetch(`${base(env)}/alumni/${destinatarioUid}`);
                if (!res.ok) return new Response('Perfil no encontrado', { status: 404, headers });
                const alum = { _id: destinatarioUid, ...campos((await res.json()).fields) };
                if (!puedeRecibir(alum)) return new Response(JSON.stringify({ enviado: false, motivo: 'sin consentimiento' }), { headers });

                // Máximo un aviso por día por persona (no spamear)
                const clave = `${destinatarioUid}:mensaje-nuevo`;
                const previo = await env.CORREOS_ESTADO.get(clave);
                if (previo && dias(previo) < 1) return new Response(JSON.stringify({ enviado: false, motivo: 'ya avisado hoy' }), { headers });

                const msg = plantilla('mensaje-nuevo', alum, env, { deNombre });
                await enviar(env, correoDe(alum), msg.asunto, msg.html);
                await env.CORREOS_ESTADO.put(clave, new Date().toISOString());
                return new Response(JSON.stringify({ enviado: true }), { headers });
            } catch (e) {
                return new Response(JSON.stringify({ enviado: false, error: String(e.message || e) }), { status: 500, headers });
            }
        }

        return new Response('Sinapsis · correos automáticos', { status: 200, headers: cors(origen) });
    }
};
