// ─────────────────────────────────────────────────────────────────────────────
// Correos automáticos de Sinapsis (Cloudflare Worker + Cron + Gmail API)
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
//   POST /probar         → manda UN correo de prueba a ?para= (requiere clave)
//   POST /mensaje-nuevo  → aviso de mensaje (lo llama la web)
//   POST /radar          → correo del Radar IA a Juan (requiere ?clave=PANEL_SECRET)
// ─────────────────────────────────────────────────────────────────────────────

const DIA = 86400000;

// Único destinatario posible de /radar. Fijo a propósito: ver el comentario del
// endpoint. Cambiarlo por un parámetro convertiría este Worker en un relay abierto
// para quien tenga la clave.
const DESTINO_RADAR = 'juanda.fonsecag@gmail.com';
const ORIGENES = [
    'https://sinapsisred.web.app', // URL oficial desde 2026-07-26
    'https://red-egresados-65a1a.web.app',
    'https://red-egresados-65a1a.firebaseapp.com',
    'https://fonseca707.github.io', // transición, quitar al apagar Pages
    'http://localhost:8642'
];

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
// ─────────────────────────────────────────────────────────────────────────────
// 🔴 Leer Firestore EXIGE sesión desde el 2026-07-29
//
// Este Worker leía `alumni` por REST a pelo. El 28-jul se cerró el directorio
// (`allow read: if request.auth != null`) y desde ese día toda lectura devuelve
// 403 — o sea, **el motor de correos llevaba nueve días muerto y nadie se
// enteró**, porque nunca se había vuelto a llamar a /previsualizar. Es el mismo
// fallo que tuvo el proxy de IA con el mismo cambio de reglas, en otro Worker
// que tampoco se revisó.
//
// Se resuelve con una sesión ANÓNIMA de Identity Toolkit: es exactamente lo que
// hace el modo invitado de la web, cumple `request.auth != null` y no exige
// credenciales nuevas (la apiKey es pública por diseño, va en el cliente).
// El token vive 1 h y se cachea mientras la instancia esté viva.
//
// ⚠️ Lo LIMPIO sería una cuenta de servicio (JWT RS256 + scope datastore), que
// no crearía usuarios anónimos sueltos en Auth. Se deja anotado en el vault: no
// se hizo hoy porque exige que Juan genere la clave en la consola de Firebase.
let _idToken = null, _idTokenExp = 0;
async function idTokenAnonimo(env) {
    if (_idToken && Date.now() < _idTokenExp) return _idToken;
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${env.FIREBASE_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnSecureToken: true })
    });
    if (!res.ok) throw new Error(`No se pudo abrir sesión para leer Firestore (${res.status}). Sin ella, las reglas del directorio devuelven 403 y no hay a quién escribirle.`);
    const j = await res.json();
    _idToken = j.idToken;
    _idTokenExp = Date.now() + (Number(j.expiresIn || 3600) - 300) * 1000;   // 5 min de margen
    return _idToken;
}

async function coleccion(url, env) {
    const docs = [];
    let token = '';
    // `hitos` es de lectura pública, pero `alumni` no: se manda la cabecera
    // siempre, que no estorba, en vez de acordarse de cuál la necesita.
    const auth = env ? { Authorization: `Bearer ${await idTokenAnonimo(env)}` } : {};
    do {
        const res = await fetch(`${url}?pageSize=300${token ? `&pageToken=${token}` : ''}`, { headers: auth });
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
// Escapa datos que vienen del usuario (firstName, hitos, y sobre todo
// extra.deNombre en /mensaje-nuevo, que llega directo del POST del cliente sin
// pasar por Firestore) antes de interpolarlos en asunto/HTML. Sin esto, un
// firstName o deNombre con <script> o comillas rompe la plantilla o inyecta
// HTML en el correo. También quita saltos de línea (inyección de cabeceras en
// el asunto) y trunca para que un nombre absurdamente largo no reviente el layout.
function escaparHTML(s, max = 80) {
    return String(s || '')
        .replace(/[\r\n]+/g, ' ')
        .slice(0, max)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
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
        Recibes este correo porque aceptaste recibir información de la red de egresados de tu colegio.
        Para dejar de recibirlos, desmarca la casilla en <a href="${env.SITIO}/profile.html" style="color:#16a34a;">tu perfil</a>.
      </p>
    </div>
  </div>
</body></html>`;
}

function plantilla(tipo, alum, env, extra = {}) {
    // Sin nombre NO se inventa un saludo: el fallback 'Hola' producia
    // "Te damos la bienvenida, Hola" y "Hola Hola.". Se deja vacio y cada
    // plantilla decide como leerse sin el.
    const nombre = escaparHTML((alum.firstName || '').trim(), 40);
    const perfil = `${env.SITIO}/profile.html`;
    if (tipo === 'bienvenida') {
        return {
            asunto: 'Tu lugar en la red de egresados ya está listo',
            html: envoltura(env, nombre ? `Te damos la bienvenida, ${nombre}` : 'Te damos la bienvenida', `
                <p>Gracias por unirte a <strong>Sinapsis</strong>, la red de egresados de tu colegio.</p>
                <p>La red se sostiene con algo que solo tú puedes contar: <strong>tu ruta</strong>. Del colegio a la universidad, al primer trabajo, a lo que haces hoy. Para un estudiante que está eligiendo carrera, tu camino es el mapa que no tiene.</p>
                <p>Completar tu ruta toma unos minutos.</p>`,
                { url: perfil, texto: 'Completar mi ruta' })
        };
    }
    if (tipo === 'completar-perfil') {
        return {
            asunto: nombre ? `${nombre}, tu ruta aún está en blanco` : 'Tu ruta aún está en blanco',
            html: envoltura(env, 'A la red le falta tu trayectoria', `
                <p>Tu perfil en Sinapsis está creado, pero todavía no cuenta por dónde has pasado.</p>
                <p>Con agregar dos o tres hitos —dónde estudiaste, dónde trabajas hoy— tu ruta aparece en el directorio y puede orientar a los estudiantes que vienen detrás.</p>`,
                { url: perfil, texto: 'Agregar mis hitos' })
        };
    }
    if (tipo === 'pulso') {
        const donde = escaparHTML([alum._hitoAbierto?.rol, alum._hitoAbierto?.organizacion].filter(Boolean).join(' en '), 100);
        return {
            asunto: donde ? `¿Sigues en ${donde}?` : '¿Sigue actualizada tu ruta?',
            html: envoltura(env, 'Una pregunta rápida', `
                <p>Hola${nombre ? ' ' + nombre : ''}. Hace un año registraste ${donde ? `<strong>${donde}</strong>` : 'tu situación actual'} en tu ruta.</p>
                <p>¿Sigue siendo así? Si cambió algo —nuevo trabajo, grado, un proyecto propio— actualizarlo toma un minuto y mantiene la red viva.</p>`,
                { url: perfil, texto: 'Revisar mi ruta' })
        };
    }
    if (tipo === 'mensaje-nuevo') {
        const deNombre = escaparHTML(extra.deNombre, 80);
        return {
            asunto: `${deNombre || 'Alguien'} te escribió en Sinapsis`,
            html: envoltura(env, 'Tienes un mensaje sin leer', `
                <p>Hola${nombre ? ' ' + nombre : ''}. <strong>${deNombre || 'Un miembro de la red'}</strong> te escribió en Sinapsis y aún no has leído el mensaje.</p>
                <p>Muchas veces es un estudiante preguntando por tu carrera. Una respuesta corta puede cambiarle la decisión.</p>`,
                { url: `${env.SITIO}/messages.html`, texto: 'Leer el mensaje' })
        };
    }
    return null;
}

// ── Envío por Gmail API (OAuth2) ─────────────────────────────────────────────
// Por qué la API HTTP y no SMTP: esto corre en un Cloudflare Worker, y los
// Workers no pueden abrir conexiones SMTP. Por eso una "contraseña de
// aplicación" de Gmail NO sirve aquí — hace falta OAuth2 sobre HTTPS.
//
// Se autentica con un refresh_token de larga vida (secreto del Worker) que se
// canjea por un access_token de 1 hora, cacheado mientras la instancia viva.
// Se eligió Gmail sobre Resend porque Resend exige un dominio propio verificado
// (con `onboarding@resend.dev` solo se puede escribir al dueño de la cuenta),
// y Sinapsis todavía vive en `.web.app`, que no admite registros DNS.

let _tokenCache = { valor: '', expira: 0 };

async function accessToken(env) {
    if (_tokenCache.valor && Date.now() < _tokenCache.expira) return _tokenCache.valor;
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: env.GMAIL_CLIENT_ID,
            client_secret: env.GMAIL_CLIENT_SECRET,
            refresh_token: env.GMAIL_REFRESH_TOKEN,
            grant_type: 'refresh_token'
        })
    });
    if (!res.ok) {
        // `invalid_grant` = el refresh token murió. Causas reales: la app OAuth
        // quedó en modo "Testing" (Google los caduca a los 7 días), cambió la
        // contraseña de la cuenta, se revocó el acceso, o pasaron 6 meses sin
        // usarse. Solución: volver a autorizar y re-subir GMAIL_REFRESH_TOKEN.
        throw new Error(`OAuth ${res.status}: ${(await res.text()).slice(0, 160)}`);
    }
    const d = await res.json();
    _tokenCache = { valor: d.access_token, expira: Date.now() + (d.expires_in - 60) * 1000 };
    return d.access_token;
}

// base64 sobre UTF-8. `btoa()` a secas rompe con tildes (solo maneja latin1),
// así que se pasa por TextEncoder primero. Los correos van en español y los
// nombres de los egresados llevan acentos: sin esto llegan con caracteres rotos.
function b64(texto) {
    const bytes = new TextEncoder().encode(texto);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin);
}
const b64url = t => b64(t).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// El asunto se codifica en RFC 2047 y el cuerpo va en base64 partido a 76
// columnas, como manda MIME (una sola línea kilométrica la rechazan algunos
// servidores intermedios).
// ⚠️ La línea EN BLANCO entre cabeceras y cuerpo es obligatoria en MIME: es lo
// único que le dice al servidor dónde terminan las cabeceras. Antes todo iba en
// un solo array con `.filter(Boolean)` al final —puesto ahí para quitar el
// Reply-To cuando no lo hay— y ese filtro se llevaba también la cadena vacía del
// separador. Resultado: el base64 del cuerpo quedaba pegado como si fuera otra
// cabecera y **Gmail entregaba los correos con el asunto correcto y el cuerpo
// vacío**. Se descubrió el 2026-08-07 con el Radar IA. Por eso ahora el filtro
// solo toca las cabeceras y el separador se pone aparte, donde nadie lo pisa.
function mime({ de, para, responderA, asunto, html }) {
    const cabeceras = [
        `From: ${de}`,
        `To: ${para}`,
        responderA ? `Reply-To: ${responderA}` : '',
        `Subject: =?UTF-8?B?${b64(asunto)}?=`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset="UTF-8"',
        'Content-Transfer-Encoding: base64'
    ].filter(Boolean);
    const cuerpo = b64(html).replace(/(.{76})/g, '$1\r\n');
    return cabeceras.join('\r\n') + '\r\n\r\n' + cuerpo;
}

// ── Plantilla del Radar IA ───────────────────────────────────────────────────
// Registro editorial (elegido por Juan el 2026-08-07 sobre otras dos propuestas):
// titulares en serif, mucho aire, y la cifra del cambio como protagonista. Se lee
// como una carta breve, no como un panel de control.
//
// Todo va en tablas con estilos en línea porque los clientes de correo no
// entienden flexbox ni hojas de estilo externas, y Gmail borra los <style>.
const RADAR_TONOS = {
    precio:  { color: '#2d6a4f', etiqueta: 'MÁS BARATO' },
    calidad: { color: '#1e4d78', etiqueta: 'MEJOR CALIDAD' },
    cambio:  { color: '#b4501e', etiqueta: 'YA LO USAS' }
};

// El respaldo en texto plano: feo pero legible. Solo se usa si el schedule manda
// `cuerpo` en vez de `hallazgos[]`.
function radarTextoPlano(cuerpo) {
    return `<div style="font-family:Georgia,serif;font-size:16px;line-height:1.7;`
        + `color:#1a1a1a;max-width:600px;white-space:pre-wrap">${escaparHTML(cuerpo, 40000)}</div>`;
}

function plantillaRadar({ fecha, titular, veredicto, hallazgos = [], tendencia, descartado, nota }) {
    const esc = (t, max = 4000) => escaparHTML(t, max);

    const bloques = hallazgos.map(h => {
        const tono = RADAR_TONOS[h.tipo] || RADAR_TONOS.cambio;
        // La cifra solo aparece si la hay: un hallazgo sin número no debe dejar un
        // hueco tipográfico donde debería estar el protagonista del bloque.
        const cifra = h.cifra ? `
            <tr><td style="padding:18px 0 0">
                <div style="font-family:Georgia,'Times New Roman',serif;font-size:42px;line-height:1.1;color:${tono.color}">${esc(h.cifra, 40)}</div>
                ${h.cifraPie ? `<div style="font-size:15px;color:#6b6b6b;padding-top:6px">${esc(h.cifraPie, 120)}</div>` : ''}
            </td></tr>` : '';
        return `
        <tr><td style="padding:44px 0 0">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="font-size:12px;letter-spacing:1.5px;color:${tono.color};text-transform:uppercase">${tono.etiqueta}</td></tr>
                <tr><td style="font-family:Georgia,'Times New Roman',serif;font-size:21px;color:#1a1a1a;padding-top:8px">${esc(h.proveedor, 120)}</td></tr>
                ${cifra}
                <tr><td style="font-size:16px;line-height:1.7;color:#3d3d3d;padding-top:16px">${esc(h.texto, 3000)}</td></tr>
                ${h.fuente ? `<tr><td style="padding-top:14px"><a href="${esc(h.fuente, 500)}" style="font-size:14px;color:${tono.color};text-decoration:none;border-bottom:1px solid ${tono.color}33">Ver la fuente</a></td></tr>` : ''}
            </table>
        </td></tr>`;
    }).join('');

    const cola = (titulo, texto) => texto ? `
        <tr><td style="padding:40px 0 0">
            <div style="font-size:12px;letter-spacing:1.5px;color:#8a8a8a;text-transform:uppercase">${titulo}</div>
            <div style="font-size:15px;line-height:1.7;color:#6b6b6b;padding-top:10px">${esc(texto, 3000)}</div>
        </td></tr>` : '';

    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#faf9f7;margin:0;padding:0">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #eae7e1">
<tr><td style="padding:44px 44px 52px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

    <tr><td style="font-family:Georgia,'Times New Roman',serif;font-size:17px;color:#1a1a1a">Radar IA</td></tr>
    <tr><td style="font-size:14px;color:#8a8a8a;padding-top:4px">${esc(fecha, 60)}</td></tr>

    <tr><td style="padding:40px 0 0">
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:29px;line-height:1.3;color:#1a1a1a">${esc(titular, 300)}</div>
        <div style="width:64px;height:2px;background:#1a1a1a;margin-top:18px"></div>
    </td></tr>

    ${veredicto ? `<tr><td style="font-size:17px;line-height:1.7;color:#3d3d3d;padding:24px 0 0">${esc(veredicto, 1500)}</td></tr>` : ''}

    ${bloques}
    ${cola('Tendencia', tendencia)}
    ${cola('Evaluado y descartado', descartado)}

    <tr><td style="padding:44px 0 0">
        <div style="border-top:1px solid #eae7e1;padding-top:16px;font-size:13px;color:#a0a0a0">
            ${nota ? `Nota completa en el vault: ${esc(nota, 200)}<br>` : ''}Radar IA &middot; todos los días a las 7:00
        </div>
    </td></tr>

</table>
</td></tr>
</table>
</td></tr>
</table>`;
}

// Única puerta de salida: aquí se vuelve a comprobar el interruptor, para que
// ningún camino (cron, /ejecutar, /mensaje-nuevo) pueda saltárselo por error.
async function enviar(env, para, asunto, html) {
    if (await estaPausado(env)) throw new Error('PAUSADO: los correos automáticos están apagados');
    return enviarSinComprobar(env, para, asunto, html);
}

// El envío en crudo. SOLO lo llaman `enviar()` (que comprueba el interruptor)
// y `/probar` (que exige PANEL_SECRET y manda a UNA dirección escrita a mano).
// La excepción de /probar no regala poder a nadie: quien tiene PANEL_SECRET ya
// puede encender el interruptor y lanzar una corrida entera.
async function enviarSinComprobar(env, para, asunto, html) {
    const token = await accessToken(env);
    const raw = b64url(mime({ de: env.REMITENTE, para, responderA: env.RESPUESTA_A, asunto, html }));
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw })
    });
    if (!res.ok) throw new Error(`Gmail ${res.status}: ${(await res.text()).slice(0, 160)}`);
    return true;
}

// ── Motor: quién recibe qué hoy ──────────────────────────────────────────────
async function calcular(env) {
    const alumni = await coleccion(`${base(env)}/alumni`, env);
    const pendientes = [];

    for (const a of alumni) {
        if (!puedeRecibir(a)) continue;
        const antiguedad = dias(a.createdAt);
        const hitos = Number(a.hitosCount) || 0;
        // ⚠️ Los profesores del colegio reciben la bienvenida, pero NADA que
        // hable de trayectoria: «completa tu ruta» y el «pulso» de hito abierto
        // dan por hecho una vida de egresado que ellos no tienen aquí. Es el
        // mismo error que Karla contando a la red entera: no falla, miente.
        const esProfesor = a.tipo === 'profesor';

        // 1. Bienvenida: al día siguiente de registrarse. Sin ventana de cierre:
        //    los ya registrados (que nunca la recibieron) también la reciben,
        //    y KV garantiza que sea UNA sola vez en la vida.
        if (antiguedad !== null && antiguedad >= 1) {
            pendientes.push({ alum: a, tipo: 'bienvenida', unaVez: true });
        }

        // 2. Completar perfil: desde los 3 días sin ruta. Se reintenta cada 45
        //    días (recordatorio suave, no spam) hasta que agregue sus hitos.
        if (!esProfesor && hitos < 2 && antiguedad !== null && antiguedad >= 3) {
            pendientes.push({ alum: a, tipo: 'completar-perfil', repetirCadaDias: 45 });
        }

        // 3. Pulso: hito abierto con más de un año sin actualizar (máx. 1/año)
        if (!esProfesor && hitos > 0) {
            try {
                const hs = await coleccion(`${base(env)}/alumni/${a._id}/hitos`, env);
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
// Clave del panel: preferir cabecera (Authorization: Bearer o X-Panel-Secret)
// sobre query string, porque el query string queda en logs de Cloudflare y en
// el historial del navegador. Se mantiene el fallback a ?clave= de forma
// TRANSITORIA mientras se despliega admin-correos.js (que ya manda cabecera);
// quitar el fallback una vez confirmado el despliegue del panel.
function claveDelPanel(request, url) {
    const auth = request.headers.get('Authorization') || '';
    if (auth.startsWith('Bearer ')) return auth.slice(7);
    const cabecera = request.headers.get('X-Panel-Secret');
    if (cabecera) return cabecera;
    return url.searchParams.get('clave') || ''; // transitorio, ver comentario arriba
}

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
            if (claveDelPanel(request, url) !== env.PANEL_SECRET) {
                return new Response(JSON.stringify({ error: 'Clave incorrecta' }), { status: 403, headers });
            }
            const { activar } = await request.json().catch(() => ({}));
            await env.CORREOS_ESTADO.put(CLAVE_INTERRUPTOR, activar ? 'activo' : 'pausado');
            await env.CORREOS_ESTADO.put(CLAVE_INTERRUPTOR + ':desde', new Date().toISOString());
            return new Response(JSON.stringify({ pausado: !activar }), { headers });
        }

        // Previsualizar: qué se enviaría hoy, sin enviar nada.
        // CRÍTICO (antes era público): devolvía hechos:[{para:<email real>,...}] sin
        // ninguna autenticación, así que cualquiera con curl obtenía nombre y correo
        // de los 68 egresados. Ahora exige la misma clave que /ejecutar, y por
        // defecto SOLO devuelve conteos por tipo; el detalle con correos/nombres
        // solo sale si además se pide ?detalle=1 (autenticado igual).
        if (url.pathname === '/previsualizar') {
            if (claveDelPanel(request, url) !== env.PANEL_SECRET) {
                return new Response(JSON.stringify({ error: 'Clave incorrecta' }), { status: 403, headers });
            }
            const r = await procesar(env, { simular: true });
            const conteos = (r.hechos || []).reduce((acc, h) => { acc[h.tipo] = (acc[h.tipo] || 0) + 1; return acc; }, {});
            const detalle = url.searchParams.get('detalle') === '1';
            const cuerpo = { ...r, conteos, hechos: detalle ? r.hechos : undefined };
            return new Response(JSON.stringify(cuerpo, null, 2), { headers });
        }

        // Probar el envío de verdad SIN despertar a nadie: manda un único correo
        // a la dirección que se le pase, funciona estando pausado y no toca el KV
        // (así que no marca a nadie como "ya avisado"). Sirve para comprobar que
        // las credenciales de Gmail siguen vivas sin arriesgar la lista.
        //   POST /probar?clave=...&para=alguien@ejemplo.com
        if (url.pathname === '/probar' && request.method === 'POST') {
            if (claveDelPanel(request, url) !== env.PANEL_SECRET) {
                return new Response(JSON.stringify({ error: 'Clave incorrecta' }), { status: 403, headers });
            }
            const para = url.searchParams.get('para') || '';
            if (!para.includes('@')) return new Response(JSON.stringify({ error: 'Falta ?para=' }), { status: 400, headers });
            // ?tipo= manda la PLANTILLA REAL, tal y como le llegará a un
            // egresado, en vez del correo de salud. Es la única forma de
            // revisar la redacción sin escribirle a nadie: hasta ahora el
            // chequeo decía «funciona», que no es lo mismo que «está bien
            // escrito». Los datos son de ejemplo y no tocan el KV.
            const tipo = url.searchParams.get('tipo') || '';
            try {
                if (tipo) {
                    const ejemplo = {
                        firstName: url.searchParams.get('nombre') || 'María',
                        _hitoAbierto: { rol: 'Analista de datos', organizacion: 'Bancolombia' }
                    };
                    const p = plantilla(tipo, ejemplo, env, { deNombre: 'Andrés Gómez' });
                    if (!p) return new Response(JSON.stringify({ error: `Tipo desconocido: ${tipo}` }), { status: 400, headers });
                    await enviarSinComprobar(env, para, `[PRUEBA · ${tipo}] ${p.asunto}`, p.html);
                    return new Response(JSON.stringify({ enviado: true, para, tipo, asunto: p.asunto }), { headers });
                }
                await enviarSinComprobar(env, para, 'Prueba de Sinapsis (envío por Gmail)',
                    envoltura(env, 'Funciona', `
                        <p>Si estás leyendo esto, el Worker de correos de Sinapsis ya sabe enviar por la API de Gmail.</p>
                        <p>Este correo salió de una prueba manual: <strong>el interruptor sigue como estaba</strong> y a los egresados no les llegó nada.</p>`,
                        { url: env.SITIO, texto: 'Abrir Sinapsis' }));
                return new Response(JSON.stringify({ enviado: true, para }), { headers });
            } catch (e) {
                return new Response(JSON.stringify({ enviado: false, error: String(e.message || e) }), { status: 500, headers });
            }
        }

        // Correo del Radar IA (el schedule diario de novedades de IA que corre en
        // la nube y escribe en el vault de Obsidian). Vive aquí y no en un Worker
        // propio porque las credenciales de Gmail ya están puestas en este: montar
        // otro obligaría a regenerar el refresh token.
        //
        // NO pasa por el interruptor maestro a propósito: ese interruptor protege a
        // los egresados, y esto va a UNA dirección fija que no depende de Sinapsis.
        // El destinatario está quemado en el código (no se acepta ?para=), así que
        // ni con la clave se puede usar esto para mandarle correo a un tercero.
        //
        // Llave PROPIA (`RADAR_SECRET`), no `PANEL_SECRET`: el schedule que llama a
        // esto corre desatendido en la nube, y con la clave del panel podría además
        // encender el interruptor y disparar la corrida a los 68 egresados. Su llave
        // solo abre esta puerta.
        //   POST /radar?clave=...  body: ver plantillaRadar() para la forma del JSON.
        //   Se acepta `cuerpo` en texto plano como respaldo (se ve pobre, es para
        //   pruebas rápidas y para que un fallo del formato no deje a Juan sin aviso).
        if (url.pathname === '/radar' && request.method === 'POST') {
            if (!env.RADAR_SECRET || claveDelPanel(request, url) !== env.RADAR_SECRET) {
                return new Response(JSON.stringify({ error: 'Clave incorrecta' }), { status: 403, headers });
            }
            const datos = await request.json().catch(() => ({}));
            if (!datos.asunto || (!datos.hallazgos?.length && !datos.cuerpo)) {
                return new Response(JSON.stringify({ error: 'Falta el asunto, o hallazgos[] / cuerpo' }), { status: 400, headers });
            }
            try {
                const html = datos.hallazgos?.length ? plantillaRadar(datos) : radarTextoPlano(datos.cuerpo);
                await enviarSinComprobar(env, DESTINO_RADAR, String(datos.asunto), html);
                return new Response(JSON.stringify({ enviado: true, para: DESTINO_RADAR }), { headers });
            } catch (e) {
                return new Response(JSON.stringify({ enviado: false, error: String(e.message || e) }), { status: 500, headers });
            }
        }

        // Forzar corrida manual (protegida con clave)
        if (url.pathname === '/ejecutar' && request.method === 'POST') {
            if (claveDelPanel(request, url) !== env.PANEL_SECRET) {
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
