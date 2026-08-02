// ─────────────────────────────────────────────────────────────────────────────
// Proxy de IA para Sinapsis (Cloudflare Worker)
// El navegador llama aquí SIN clave; el Worker agrega la clave de DeepSeek
// (secreto DEEPSEEK_API_KEY, invisible para el público) y reenvía.
//
// Protecciones:
//  - Solo POST con JSON y solo desde los orígenes permitidos (CORS estricto).
//  - Solo modelos deepseek-* y tope de max_tokens (nadie usa tu saldo para otra cosa).
//  - Límite de peticiones por IP por minuto (mejor esfuerzo, en memoria).
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = [
    // Firebase Hosting — URL oficial desde 2026-07-26 (site nuevo del mismo proyecto)
    'https://sinapsisred.web.app',
    // Site original: sigue vivo para quien tenga el link viejo
    'https://red-egresados-65a1a.web.app',
    'https://red-egresados-65a1a.firebaseapp.com',
    // GitHub Pages: se mantiene durante la transición, quitar cuando Pages se apague
    'https://fonseca707.github.io',
    'http://localhost:8642',
    'http://127.0.0.1:8642'
];
const MAX_TOKENS_CAP = 1500;
const RATE_LIMIT_PER_MIN = 20;

// ── TTS (audio de los listening) ─────────────────────────────────────────────
// Genera el audio UNA vez, desde el admin; el estudiante reproduce el archivo ya
// subido a Storage. Por eso esta ruta es cara y va cerrada al superadmin.
const TTS_MODELO = 'gemini-3.1-flash-tts-preview';
const TTS_MAX_CHARS = 6000;          // ~4-5 min de audio; un documento de examen cabe de sobra
const TTS_LIMITE_POR_HORA = 40;      // freno de saldo, aunque la clave del admin se filtre
const SUPERADMIN_EMAIL = 'juanda.fonsecag@gmail.com';
const FIREBASE_API_KEY = 'AIzaSyBoVTqroZ7zR-3a5QGy5CzK19a4422t0Rg'; // pública (va en el cliente)
const VOCES_VALIDAS = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Leda', 'Enceladus', 'Orus',
    'Aoede', 'Algieba', 'Despina', 'Achernar', 'Alnilam', 'Sulafat'];

const ttsHits = new Map(); // email -> {count, windowStart}

const hits = new Map(); // ip -> {count, windowStart} (por instancia; mejor esfuerzo)

function corsHeaders(origin) {
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        // Sin esto el navegador OCULTA la cabecera al JS aunque el Worker la
        // mande: la duración del clip llegaba siempre vacía y el estudio tenía
        // que decodificar el audio entero para medirla.
        'Access-Control-Expose-Headers': 'X-Duracion-Aprox-Seg',
        'Access-Control-Max-Age': '86400'
    };
}

function rateLimited(ip) {
    const now = Date.now();
    const entry = hits.get(ip);
    if (!entry || now - entry.windowStart > 60_000) {
        hits.set(ip, { count: 1, windowStart: now });
        if (hits.size > 5000) hits.clear(); // no crecer sin límite
        return false;
    }
    entry.count++;
    return entry.count > RATE_LIMIT_PER_MIN;
}

// ── Utilidades TTS ───────────────────────────────────────────────────────────

// Gemini devuelve PCM crudo (24 kHz, 16 bits, mono). El navegador no reproduce
// PCM suelto: hay que anteponerle la cabecera WAV de 44 bytes.
function pcmAWav(pcm, sampleRate = 24000, canales = 1, bitsPorMuestra = 16) {
    const bytesPorMuestra = bitsPorMuestra / 8;
    const alineacion = canales * bytesPorMuestra;
    const wav = new Uint8Array(44 + pcm.length);
    const vista = new DataView(wav.buffer);
    const texto = (pos, s) => { for (let i = 0; i < s.length; i++) wav[pos + i] = s.charCodeAt(i); };

    texto(0, 'RIFF');
    vista.setUint32(4, 36 + pcm.length, true);
    texto(8, 'WAVEfmt ');
    vista.setUint32(16, 16, true);              // tamaño del bloque fmt
    vista.setUint16(20, 1, true);               // PCM sin comprimir
    vista.setUint16(22, canales, true);
    vista.setUint32(24, sampleRate, true);
    vista.setUint32(28, sampleRate * alineacion, true);
    vista.setUint16(32, alineacion, true);
    vista.setUint16(34, bitsPorMuestra, true);
    texto(36, 'data');
    vista.setUint32(40, pcm.length, true);
    wav.set(pcm, 44);
    return wav;
}

// Busca el audio en la respuesta de Gemini SIN casarse con una ruta concreta.
// Por qué: la API devolvió `interaction.output_audio.data` cuando se escribió
// esto y hoy devuelve `steps[].content[]` con `mime_type` + `data`; clavar una
// ruta hace que un cambio del proveedor se vea como "no vino audio" cuando el
// audio sí vino y hasta se pagó. Se recorre el objeto y se toma el primer par
// {mime_type de audio, data} que aparezca, sea cual sea su profundidad.
// El `rate` sale del propio mime_type (audio/L16;codec=pcm;rate=24000), porque
// la cabecera WAV que se antepone tiene que declarar la tasa real o el audio
// suena grave o agudo.
function extraerAudioGemini(datos) {
    let hallazgo = null;
    const RUIDO = /^(text|application\/json)/i;

    const visitar = (nodo) => {
        if (hallazgo || !nodo || typeof nodo !== 'object') return;
        if (Array.isArray(nodo)) { nodo.forEach(visitar); return; }

        const mime = nodo.mime_type || nodo.mimeType || '';
        const data = nodo.data || nodo.audio_data || nodo.bytes_base64_encoded;
        if (typeof data === 'string' && data.length > 100 && (String(mime).startsWith('audio') || (!mime && !RUIDO.test(mime)))) {
            if (String(mime).startsWith('audio') || !mime) {
                const m = /rate=(\d+)/.exec(String(mime));
                hallazgo = { data, rate: m ? Number(m[1]) : 24000 };
                return;
            }
        }
        Object.values(nodo).forEach(visitar);
    };

    // Rutas conocidas primero (más barato y sin ambigüedad), luego el barrido.
    const directas = [
        datos?.interaction?.output_audio?.data,
        datos?.candidates?.[0]?.content?.parts?.[0]?.inline_data?.data,
        datos?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data
    ];
    for (const d of directas) if (typeof d === 'string' && d.length > 100) return { data: d, rate: 24000 };

    visitar(datos);
    return hallazgo;
}

function base64ABytes(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}

// Valida el ID token contra Google (sin criptografía a mano) y devuelve
// {uid, email, emailVerified, anonimo, idToken} o null. Base de todo gate.
//
// `anonimo` importa: el modo invitado del sitio entra con Anonymous Auth, así
// que "tiene sesión" NO significa "tiene cuenta". Un anónimo es un visitante de
// paso sin colegio posible, y todo lo que cuesta plata se le cierra.
// Se reconoce por no traer NINGÚN proveedor: los de correo o Google siempre
// traen al menos uno. Mirar solo el email no basta (un usuario de Google puede
// no exponerlo).
async function lookupUsuario(request) {
    const cabecera = request.headers.get('Authorization') || '';
    if (!cabecera.startsWith('Bearer ')) return null;
    const respuesta = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: cabecera.slice(7) })
        }
    );
    if (!respuesta.ok) return null;
    const datos = await respuesta.json();
    const usuario = (datos.users || [])[0];
    if (!usuario || !usuario.localId) return null;
    return {
        uid: usuario.localId,
        email: usuario.email || '',
        emailVerified: usuario.emailVerified === true,
        anonimo: !(usuario.providerUserInfo || []).length,
        idToken: cabecera.slice(7)
    };
}

// Superadmin = correo EXACTO y verificado, el mismo criterio de firestore.rules
// (por prefijo era regalable: Auth acepta cualquier dominio sin verificar).
function esSuperadmin(usuario) {
    return !!usuario && usuario.email === SUPERADMIN_EMAIL && usuario.emailVerified;
}

async function superadminAutenticado(request) {
    const usuario = await lookupUsuario(request);
    return esSuperadmin(usuario) ? usuario.email : null;
}

// ── Gate duro de módulos pagados (TOEFL / DELF) ──────────────────────────────
// El gate de UI de preparacion.html se salta desde la consola, y `toefl-data.js`
// es estático y descargable: lo defendible NO es el banco de preguntas sino la
// EXPERIENCIA CALIFICADA, que es la que cuesta plata. Por eso la calificación de
// writing vive en su propia ruta, exige sesión y comprueba aquí —server-side—
// que el colegio del alumno tenga el módulo activo.
//
// ⚠️ EL DEFAULT ES «NADA», y esto es una decisión de negocio, no un detalle
// (2026-08-02). Hasta hoy, quien no tenía colegio se trataba como del LCP y
// heredaba TOEFL+DELF: cualquier persona del mundo con un correo obtenía
// gratis lo que se le va a cobrar a los colegios. Ahora:
//   sin cuenta real → no; sin colegio → no; colegio sin el módulo activo → no.
// Se verificó antes de voltearlo que los 68 perfiles existentes ya tienen
// `school: 'LCP'` escrito, así que nadie pierde acceso por el cambio.
// La paridad con el cliente (shared.js getModulosUsuario) sigue siendo
// deliberada: las dos capas dicen lo mismo, la de aquí es la que manda.
const MODULOS_VALIDOS = ['toefl', 'delf'];
const PROJECT_ID = 'red-egresados-65a1a';
const APP_ID = '1:874010522484:web:28881821d110defd3b7221';
const CALIFICACIONES_POR_HORA = 30;      // freno de saldo por alumno

const calificaHits = new Map(); // uid -> {count, windowStart}

// 🔴 SE LEE CON EL TOKEN DEL PROPIO USUARIO, no con la API key desnuda.
// Esto costó cinco días de caída silenciosa (28-jul → 2-ago): `alumni` era de
// lectura pública cuando se escribió el gate, el commit `292b403` la cerró a
// `request.auth != null` para tapar el volcado del directorio por REST, y desde
// entonces Firestore le respondía 403 al Worker. Como un gate no debe caerse
// abierto, eso se convertía en un 503 y NADIE podía calificar.
// Con el token del usuario la lectura pasa la regla y además el Worker nunca
// ve más de lo que el propio usuario ya puede ver. `colegios` sigue siendo
// público, pero va por el mismo camino: un solo modo de leer, no dos.
async function leerDocDeUsuario(ruta, idToken) {
    const base = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
    // El appId lleva ':' y hay que escaparlo: sin encodear, Firestore lee el
    // segmento como un método custom (:commit, :runQuery) y responde 400.
    const url = `${base}/artifacts/${encodeURIComponent(APP_ID)}/public/data/${ruta}`;
    const respuesta = await fetch(url, {
        headers: idToken
            ? { 'Authorization': `Bearer ${idToken}` }
            : { 'x-goog-api-key': FIREBASE_API_KEY }
    });
    if (respuesta.status === 404) return null;             // 404 = no existe (caso válido)
    // Cualquier OTRO fallo (500/429/503...) NO es "no existe": si se trata igual que 404,
    // moduloHabilitado sigue de largo con el default true y el gate cae ABIERTO ante un
    // error de Firestore. Debe reventar aquí para que el catch de moduloHabilitado lo
    // capture y responda motivo:'firestore' (503), no un 403 silencioso ni un true falso.
    if (!respuesta.ok) throw new Error(`firestore ${respuesta.status}`);
    return (await respuesta.json())?.fields || null;
}

// Decide si el alumno puede usar la calificadora de ESE módulo.
// Devuelve {ok, school, motivo}. Ante un fallo de red de Firestore NO se abre la
// puerta: se responde que no, porque un gate que se cae abierto no es un gate.
// Suspendido = fuera de todo lo que cuesta plata. El corte del navegador (cierra
// la sesión al entrar) se puede saltar desde la consola; este no, porque el token
// se verifica contra Firebase y el perfil se lee aquí. Devuelve true solo si
// consta que está suspendido: un fallo de lectura no puede dejar fuera a alguien
// legítimo (para eso están los otros gates, que sí caen cerrados).
async function estaSuspendido(usuario) {
    try {
        const perfil = await leerDocDeUsuario(`alumni/${encodeURIComponent(usuario.uid)}`, usuario.idToken);
        return perfil?.accountStatus?.stringValue === 'suspendido';
    } catch (e) { return false; }
}

async function moduloHabilitado(usuario, modulo) {
    try {
        const perfil = await leerDocDeUsuario(`alumni/${encodeURIComponent(usuario.uid)}`, usuario.idToken);
        if (perfil?.accountStatus?.stringValue === 'suspendido') return { ok: false, school: '', motivo: 'suspendido' };
        const school = perfil?.school?.stringValue || '';
        // Sin colegio no hay a quién cobrarle: la red general no incluye los
        // módulos. Es el caso de quien se registró sin código de invitación.
        if (!school) return { ok: false, school: '', motivo: 'sin-colegio' };

        const colegio = await leerDocDeUsuario(`colegios/${encodeURIComponent(school)}`, usuario.idToken);
        // Un colegio sin doc o sin mapa `modulos` no tiene nada contratado.
        // Antes heredaba {toefl,delf} y ese default era el agujero.
        const mapa = colegio?.modulos?.mapValue?.fields;
        if (!mapa) return { ok: false, school, motivo: 'modulo' };
        return { ok: mapa[modulo]?.booleanValue === true, school, motivo: 'modulo' };
    } catch (e) {
        return { ok: false, school: '', motivo: 'firestore' };
    }
}

function calificacionesPasadasDeVueltas(uid) {
    const ahora = Date.now();
    const registro = calificaHits.get(uid);
    if (!registro || ahora - registro.windowStart > 3_600_000) {
        calificaHits.set(uid, { count: 1, windowStart: ahora });
        if (calificaHits.size > 5000) calificaHits.clear();
        return false;
    }
    registro.count++;
    return registro.count > CALIFICACIONES_POR_HORA;
}

function ttsPasadoDeVueltas(email) {
    const ahora = Date.now();
    const registro = ttsHits.get(email);
    if (!registro || ahora - registro.windowStart > 3_600_000) {
        ttsHits.set(email, { count: 1, windowStart: ahora });
        return false;
    }
    registro.count++;
    return registro.count > TTS_LIMITE_POR_HORA;
}

// ── ElevenLabs ───────────────────────────────────────────────────────────────
// Segundo proveedor. Frente a Gemini gana en lo que un examen de listening
// evalúa de verdad: consonantes nítidas y prosodia en frases largas. Y sus
// acentos son VOCES reales (británica, australiana…), no una instrucción de
// texto que el modelo puede ignorar. Devuelve MP3 ya comprimido.
const EL_API = 'https://api.elevenlabs.io/v1';
const EL_MODELO_DIALOGO = 'eleven_v3';
const EL_MODELO_VOZ = 'eleven_multilingual_v2';
const EL_MAX_CHARS_DIALOGO = 2000;   // límite del endpoint de diálogo
const EL_FORMATO = 'mp3_44100_128';

// POST /tts/voces → las voces de la cuenta, con su acento e idioma, para que el
// admin elija por acento en vez de adivinar ids. (Va por POST porque el Worker
// solo acepta POST; no lleva cuerpo.)
async function listarVoces(request, env, origin) {
    const json = (obj, status) => new Response(JSON.stringify(obj),
        { status, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } });

    if (!await superadminAutenticado(request)) return json({ error: 'Solo el superadmin.' }, 403);
    if (!env.ELEVENLABS_API_KEY) return json({ error: 'Falta el secreto ELEVENLABS_API_KEY en el Worker.' }, 503);

    const respuesta = await fetch(`${EL_API}/voices?page_size=100`, {
        headers: { 'xi-api-key': env.ELEVENLABS_API_KEY }
    });
    if (!respuesta.ok) {
        return json({ error: 'No se pudieron leer las voces', status: respuesta.status }, 502);
    }
    const datos = await respuesta.json();
    return json({
        voces: (datos.voices || []).map(v => ({
            id: v.voice_id,
            nombre: v.name,
            acento: v.labels?.accent || '',
            genero: v.labels?.gender || '',
            descripcion: v.labels?.description || ''
        }))
    }, 200);
}

// Reparte el transcript en turnos para el endpoint de diálogo: cada línea
// "Nombre: texto" se convierte en un turno con la voz de ese personaje.
function turnosDeDialogo(texto, voces) {
    const porHablante = new Map(voces.filter(v => v.speaker).map(v => [v.speaker.toLowerCase(), v.voice]));
    const predeterminada = voces[0].voice;
    const turnos = [];
    for (const linea of texto.split('\n')) {
        const limpia = linea.trim();
        if (!limpia) continue;
        const marca = limpia.match(/^([A-Za-zÀ-ÿ0-9 _-]{1,20}):\s*(.+)$/);
        if (marca) {
            turnos.push({
                text: marca[2].trim(),
                voice_id: porHablante.get(marca[1].trim().toLowerCase()) || predeterminada
            });
        } else if (turnos.length) {
            turnos[turnos.length - 1].text += ' ' + limpia; // continuación del turno anterior
        } else {
            turnos.push({ text: limpia, voice_id: predeterminada });
        }
    }
    return turnos;
}

async function generarConElevenLabs({ texto, voces, esDialogo, env, origin }) {
    const json = (obj, status) => new Response(JSON.stringify(obj),
        { status, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } });

    if (!env.ELEVENLABS_API_KEY) {
        return json({ error: 'Falta el secreto ELEVENLABS_API_KEY en el Worker (npx wrangler secret put ELEVENLABS_API_KEY).' }, 503);
    }

    let respuesta;
    if (esDialogo) {
        if (texto.length > EL_MAX_CHARS_DIALOGO) {
            return json({ error: `El diálogo excede ${EL_MAX_CHARS_DIALOGO} caracteres (son ${texto.length}); pártelo en dos clips o acórtalo.` }, 400);
        }
        respuesta = await fetch(`${EL_API}/text-to-dialogue`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'xi-api-key': env.ELEVENLABS_API_KEY },
            body: JSON.stringify({
                inputs: turnosDeDialogo(texto, voces),
                model_id: EL_MODELO_DIALOGO,
                output_format: EL_FORMATO
            })
        });
    } else {
        respuesta = await fetch(`${EL_API}/text-to-speech/${encodeURIComponent(voces[0].voice)}?output_format=${EL_FORMATO}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'xi-api-key': env.ELEVENLABS_API_KEY },
            body: JSON.stringify({ text: texto, model_id: EL_MODELO_VOZ })
        });
    }

    if (!respuesta.ok) {
        const detalle = await respuesta.text();
        return json({ error: 'ElevenLabs falló', status: respuesta.status, detalle: detalle.slice(0, 500) }, 502);
    }

    // Ya viene comprimido: aquí no hay que envolver nada ni comprimir después.
    return new Response(respuesta.body, {
        headers: { ...corsHeaders(origin), 'Content-Type': 'audio/mpeg' }
    });
}

// POST /tts  {proveedor, texto, voces:[{speaker,voice}] | voz, instruccion?}
//   gemini      → audio/wav (PCM envuelto; el cliente lo comprime)
//   elevenlabs  → audio/mpeg (ya comprimido)
async function generarAudio(request, env, origin) {
    const json = (obj, status) => new Response(JSON.stringify(obj),
        { status, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } });

    // Autenticar ANTES que nada: a quien no es el superadmin no se le cuenta
    // siquiera cómo está configurado el Worker.
    const email = await superadminAutenticado(request);
    if (!email) return json({ error: 'Solo el superadmin puede generar audio.' }, 403);
    if (ttsPasadoDeVueltas(email)) {
        return json({ error: `Tope de ${TTS_LIMITE_POR_HORA} generaciones por hora alcanzado.` }, 429);
    }

    let cuerpo;
    try { cuerpo = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }

    const texto = String(cuerpo.texto || '').trim();
    if (!texto) return json({ error: 'Falta el texto a narrar.' }, 400);
    if (texto.length > TTS_MAX_CHARS) {
        return json({ error: `El texto excede ${TTS_MAX_CHARS} caracteres (son ${texto.length}).` }, 400);
    }

    // Una voz (monólogo: radio, anuncio, charla) o varias (diálogo del DELF / TOEFL)
    const pedidas = Array.isArray(cuerpo.voces) && cuerpo.voces.length
        ? cuerpo.voces.map(v => ({ speaker: String(v.speaker || '').trim(), voice: String(v.voice || '') }))
        : [{ voice: String(cuerpo.voz || 'Kore') }];
    if (pedidas.some(v => !v.voice)) return json({ error: 'Falta elegir la voz.' }, 400);

    // ElevenLabs: ids de voz de la cuenta, acento incluido en la voz misma.
    if (String(cuerpo.proveedor || 'gemini') === 'elevenlabs') {
        return generarConElevenLabs({
            texto,
            voces: pedidas,
            esDialogo: pedidas.length > 1 && pedidas.every(v => v.speaker),
            env,
            origin
        });
    }

    // Gemini: nombres de voz de un catálogo cerrado.
    if (!env.GEMINI_API_KEY) {
        return json({ error: 'Falta el secreto GEMINI_API_KEY en el Worker (npx wrangler secret put GEMINI_API_KEY).' }, 503);
    }
    for (const v of pedidas) {
        if (!VOCES_VALIDAS.includes(v.voice)) return json({ error: `Voz no válida: ${v.voice}` }, 400);
    }
    const speechConfig = pedidas.map(v => (v.speaker ? { speaker: v.speaker, voice: v.voice } : { voice: v.voice }));

    // La instrucción de estilo (acento, ritmo) viaja como preámbulo del texto:
    // así se pide "acento británico" o "tono de locutor de radio" sin campos extra.
    const entrada = cuerpo.instruccion ? `${String(cuerpo.instruccion).trim()}\n\n${texto}` : texto;

    const upstream = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify({
            model: TTS_MODELO,
            input: entrada,
            response_format: { type: 'audio' },
            generation_config: { speech_config: speechConfig }
        })
    });

    if (!upstream.ok) {
        const detalle = await upstream.text();
        return json({ error: 'El generador de audio falló', status: upstream.status, detalle: detalle.slice(0, 500) }, 502);
    }

    const datos = await upstream.json();
    const encontrado = extraerAudioGemini(datos);
    if (!encontrado) {
        // Se recortan las cadenas largas: si el audio SÍ vino pero en otra
        // ruta, el volcado sin recortar es un base64 gigante que tapa la pista.
        const mapa = JSON.stringify(datos, (k, v) => (typeof v === 'string' && v.length > 60 ? `«${v.length} chars»` : v));
        return json({ error: 'La respuesta no traía audio', detalle: mapa.slice(0, 800) }, 502);
    }

    const wav = pcmAWav(base64ABytes(encontrado.data), encontrado.rate);
    return new Response(wav, {
        headers: {
            ...corsHeaders(origin),
            'Content-Type': 'audio/wav',
            'Content-Length': String(wav.length),
            'X-Duracion-Aprox-Seg': String(Math.round((wav.length - 44) / (24000 * 2)))
        }
    });
}

// ── Generador de ítems del ICFES ────────────────────────────────────────────
// Ruta aparte de la raíz por dos razones: necesita MUCHOS más tokens que un chat
// de Karla (un ítem con estímulo y 4 justificaciones no cabe en 1500) y, como
// cada llamada cuesta plata, va cerrada al superadmin igual que /tts. La raíz
// sigue con su tope bajo para que nadie la use de API gratis.
const ITEMS_MAX_TOKENS = 6000;
// Contador propio: generar el banco del ICFES son decenas de lotes seguidos y
// compartir el cupo con el TTS dejaba sin audio al estudio (o al revés).
const ITEMS_LIMITE_POR_HORA = 150;
const itemsHits = new Map();

function itemsPasadoDeVueltas(email) {
    const ahora = Date.now();
    const r = itemsHits.get(email);
    if (!r || ahora - r.windowStart > 3_600_000) { itemsHits.set(email, { count: 1, windowStart: ahora }); return false; }
    r.count++;
    return r.count > ITEMS_LIMITE_POR_HORA;
}

async function generarItems(request, env, origin) {
    const json = (obj, status) => new Response(JSON.stringify(obj),
        { status, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } });

    const email = await superadminAutenticado(request);
    if (!email) return json({ error: 'Solo el superadministrador puede generar ítems.' }, 403);
    if (itemsPasadoDeVueltas(email)) return json({ error: 'Demasiadas generaciones seguidas, espera un momento.' }, 429);

    let cuerpo;
    try { cuerpo = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }

    const instruccion = String(cuerpo.instruccion || '').trim();
    if (!instruccion) return json({ error: 'Falta la instrucción de generación.' }, 400);
    if (instruccion.length > 12000) return json({ error: 'La instrucción es demasiado larga.' }, 400);

    const upstream = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}` },
        body: JSON.stringify({
            model: 'deepseek-v4-flash',
            messages: [
                { role: 'system', content: 'Eres un constructor de ítems del examen Saber 11 del ICFES colombiano. Respondes SIEMPRE con JSON válido y nada más: sin explicaciones, sin markdown, sin ```. Escribes en español de Colombia.' },
                { role: 'user', content: instruccion }
            ],
            max_tokens: ITEMS_MAX_TOKENS,
            temperature: 1.0,
            stream: false
        })
    });

    if (!upstream.ok) {
        return json({ error: 'El generador falló', status: upstream.status, detalle: (await upstream.text()).slice(0, 400) }, 502);
    }
    const datos = await upstream.json();
    return json({ texto: datos?.choices?.[0]?.message?.content || '' }, 200);
}

// Reenvía a DeepSeek con los topes del proxy. Común a la raíz (Karla) y a
// /calificar: nadie reutiliza el proxy como API gratis ni sube el tope de tokens.
async function reenviarADeepSeek(body, env, origin) {
    if (!String(body.model || '').startsWith('deepseek')) body.model = 'deepseek-v4-flash';
    body.max_tokens = Math.min(Number(body.max_tokens) || 600, MAX_TOKENS_CAP);
    body.stream = false;

    const upstream = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify(body)
    });

    return new Response(upstream.body, {
        status: upstream.status,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' }
    });
}

// POST /calificar  {modulo:'toefl'|'delf', model, messages, ...}  + Bearer idToken
// El gate duro: sesión válida + módulo activo en el colegio del alumno.
async function calificarEscritura(request, env, origin) {
    const json = (obj, status) => new Response(JSON.stringify(obj),
        { status, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } });

    const usuario = await lookupUsuario(request);
    if (!usuario) {
        return json({
            error: 'Para recibir la calificación de la IA necesitas iniciar sesión.',
            motivo: 'sesion'
        }, 401);
    }
    // El modo invitado entra con Anonymous Auth, así que tener sesión no basta:
    // un visitante de paso no pertenece a ningún colegio y no puede gastar la
    // corrección que se le vende a los colegios.
    if (usuario.anonimo) {
        return json({
            error: 'La corrección con IA es para miembros con cuenta. Crea la tuya para recibirla.',
            motivo: 'invitado'
        }, 401);
    }

    let cuerpo;
    try { cuerpo = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }

    const modulo = String(cuerpo.modulo || '');
    if (!MODULOS_VALIDOS.includes(modulo)) {
        return json({ error: 'Módulo no válido.', motivo: 'modulo-invalido' }, 400);
    }
    delete cuerpo.modulo;   // no viaja a DeepSeek

    if (calificacionesPasadasDeVueltas(usuario.uid)) {
        return json({
            error: `Alcanzaste el tope de ${CALIFICACIONES_POR_HORA} calificaciones por hora. Espera un rato.`,
            motivo: 'tope'
        }, 429);
    }

    // El superadmin pasa siempre: necesita poder probar cualquier módulo aunque
    // su propio colegio lo tenga apagado.
    if (!esSuperadmin(usuario)) {
        const veredicto = await moduloHabilitado(usuario, modulo);
        if (!veredicto.ok) {
            if (veredicto.motivo === 'firestore') {
                return json({
                    error: 'No pudimos verificar tu acceso a este módulo. Intenta de nuevo en un momento.',
                    motivo: 'verificacion'
                }, 503);
            }
            // Sin colegio y colegio sin módulo son cosas distintas para quien
            // lee el mensaje: al primero hay que decirle QUÉ le falta (unirse
            // con el código de su colegio), no que su colegio no pagó.
            if (veredicto.motivo === 'sin-colegio') {
                return json({
                    error: 'Tu cuenta no está vinculada a ningún colegio. La corrección con IA es parte de lo que cada colegio activa para los suyos: pide el código de invitación de tu colegio para acceder.',
                    motivo: 'sin-colegio'
                }, 403);
            }
            return json({
                error: `Tu colegio no tiene activo el módulo de ${modulo.toUpperCase()}. La práctica y la autoevaluación siguen disponibles; la corrección con IA es parte del módulo.`,
                motivo: 'modulo'
            }, 403);
        }
    }

    return reenviarADeepSeek(cuerpo, env, origin);
}

export default {
    async fetch(request, env) {
        const origin = request.headers.get('Origin') || '';
        const allowed = ALLOWED_ORIGINS.includes(origin);

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: allowed ? 204 : 403, headers: allowed ? corsHeaders(origin) : {} });
        }
        if (!allowed) return new Response('Origen no permitido', { status: 403 });
        if (request.method !== 'POST') return new Response('Solo POST', { status: 405, headers: corsHeaders(origin) });

        // Ruta de audio para los listening (cerrada al superadmin, ver generarAudio)
        const ruta = new URL(request.url).pathname;
        if (ruta === '/tts') return generarAudio(request, env, origin);
        if (ruta === '/tts/voces') return listarVoces(request, env, origin);
        if (ruta === '/items') return generarItems(request, env, origin);
        // Calificación de writing: exige sesión + módulo del colegio (gate duro)
        if (ruta === '/calificar') return calificarEscritura(request, env, origin);

        // Karla (la raíz) exige CUENTA REAL desde el 2026-08-02. Antes bastaba
        // con abrir la web: el origen permitido y un freno por IP eran todo, así
        // que cualquier visitante de paso gastaba DeepSeek. La IA de la casa es
        // parte de lo que se le ofrece a los colegios, no un servicio abierto.
        const usuario = await lookupUsuario(request);
        if (!usuario || usuario.anonimo) {
            return new Response(JSON.stringify({
                error: 'Entra con tu cuenta para conversar con Karla.',
                motivo: usuario ? 'invitado' : 'sesion'
            }), { status: 401, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } });
        }
        if (await estaSuspendido(usuario)) {
            return new Response(JSON.stringify({
                error: 'Tu cuenta está suspendida.',
                motivo: 'suspendido'
            }), { status: 403, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } });
        }

        const ip = request.headers.get('CF-Connecting-IP') || 'desconocida';
        if (rateLimited(ip)) {
            return new Response(JSON.stringify({ error: 'Demasiadas peticiones, espera un minuto.' }),
                { status: 429, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } });
        }

        let body;
        try { body = await request.json(); } catch {
            return new Response('JSON inválido', { status: 400, headers: corsHeaders(origin) });
        }

        // Solo modelos DeepSeek y tope de tokens: nadie reutiliza el proxy para otra cosa
        return reenviarADeepSeek(body, env, origin);
    }
};
