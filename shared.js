// shared.js — Cargar DESPUÉS de los scripts firebase-*-compat.js

const firebaseConfig = {
    apiKey: "AIzaSyBoVTqroZ7zR-3a5QGy5CzK19a4422t0Rg",
    authDomain: "red-egresados-65a1a.firebaseapp.com",
    projectId: "red-egresados-65a1a",
    storageBucket: "red-egresados-65a1a.firebasestorage.app",
    messagingSenderId: "874010522484",
    appId: "1:874010522484:web:28881821d110defd3b7221",
    measurementId: "G-85C6M45M7N"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
/*
  Analytics QUITADO el 2026-07-29. Se cargaba `firebase-analytics-compat` en las 11
  páginas y se inicializaba aquí, pero:
   1. NADIE lo usaba — ni un `logEvent` en todo el repo, así que no había "evidencia de
      uso para la investigación": solo el evento automático de vista de página.
   2. Ese SDK lanzaba `ReferenceError: process is not defined` DENTRO de una promesa en
      cada visita, así que este `try/catch` no lo atrapaba (un throw asíncrono no pasa
      por aquí). Era el único error que quedaba en la consola de producción.
  El `measurementId` sigue en la config de arriba: si algún día se quiere Analytics de
  verdad, se repone con el SDK MODULAR (`getAnalytics`/`logEvent`), no con el compat, y
  midiendo eventos concretos en vez de cargarlo "por si acaso".
*/
const auth = firebase.auth();
const db = firebase.firestore();

// ─────────────────────────────────────────────────────────────────────────────
// MEDIDOR DE LECTURAS DE FIRESTORE
// ─────────────────────────────────────────────────────────────────────────────
// Por qué existe (2026-08-01, Juan): «las lecturas son muy altas y solo yo uso
// Sinapsis». Leyendo el código se ven candidatos —la portada trae los 68
// perfiles completos, las noticias se piden dos veces, no hay caché entre
// páginas— pero NINGUNO explica un número desproporcionado con un solo usuario.
// Optimizar sin medir sería repetir el error del audio: dos rondas de solución
// sobre un problema que nadie había medido.
//
// Se envuelven los PROTOTIPOS de Firestore, no las 19 llamadas del repo: así
// queda contado todo —incluido lo de admin-*.js y lo que se escriba mañana— sin
// que nadie tenga que acordarse de instrumentarlo.
//
// El contador vive en sessionStorage porque el problema es de NAVEGACIÓN: son
// 11 HTML sueltos, y lo que hay que ver es cuánto cuesta ir de la portada al
// directorio y de ahí a un perfil, no cada página por separado.
//
// Se activa con `?lecturas=1` (queda encendido el resto de la sesión) y se apaga
// con `?lecturas=0`. Apagado no envuelve nada: cero coste para el usuario normal.
const MEDIDOR_CLAVE = 'sinapsis_medidor_lecturas';
const medidorLecturas = {
    activo: false,
    registros: [],

    arrancar() {
        const url = new URLSearchParams(location.search).get('lecturas');
        if (url === '0') { sessionStorage.removeItem(MEDIDOR_CLAVE); sessionStorage.removeItem(MEDIDOR_CLAVE + '_datos'); return; }
        if (url === '1') sessionStorage.setItem(MEDIDOR_CLAVE, '1');
        if (sessionStorage.getItem(MEDIDOR_CLAVE) !== '1') return;

        this.activo = true;
        try { this.registros = JSON.parse(sessionStorage.getItem(MEDIDOR_CLAVE + '_datos')) || []; } catch { this.registros = []; }
        this.envolver();
        // El panel necesita el DOM; el medidor tiene que estar antes de la
        // primera lectura, que ocurre mucho antes de DOMContentLoaded.
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => this.pintar());
        else this.pintar();
    },

    // De la traza sale QUIÉN pidió la lectura. Sin esto sabríamos que se leyó
    // `alumni` siete veces, pero no desde dónde — que es lo que hay que arreglar.
    //
    // ⚠️ La primera versión devolvía `tl.nuevo` / `$h.nuevo` en TODAS: `nuevo` es
    // el nombre de este propio wrapper y `tl`/`$h` son las clases minificadas del
    // SDK compat. Se estaba leyendo el medidor a sí mismo. Ahora el filtro es por
    // ARCHIVO —solo cuentan los del repo— en vez de por nombre de función, que es
    // lo único que el minificado no puede disfrazar.
    origen() {
        const lineas = (new Error().stack || '').split('\n');
        for (const l of lineas) {
            const arch = l.match(/\/([a-z0-9-]+\.(?:js|html)):(\d+):/i);
            if (!arch) continue;
            const fichero = arch[1].toLowerCase();
            if (fichero.startsWith('firebase-') || fichero === 'shared.js') continue;  // SDK y este medidor
            const m = l.match(/at\s+(?:async\s+)?([A-Za-z0-9_$.<>]+)\s/);
            return `${m && m[1] !== 'new' ? m[1] : 'anónima'} (${arch[1]}:${arch[2]})`;
        }
        // Todo el stack es de shared.js: la pidió una de sus funciones de carga.
        for (const l of lineas.slice(2)) {
            const m = l.match(/at\s+(?:async\s+)?([A-Za-z0-9_$.]*(?:load|fetch|get|save)[A-Za-z0-9_$.]*)\s/i);
            if (m && !/medidor/i.test(m[1])) return m[1] + ' (shared.js)';
        }
        return '?';
    },

    anotar(ruta, docs, tipo, desdeCache) {
        this.registros.push({
            pagina: location.pathname.split('/').pop() || 'index.html',
            ruta, docs, tipo,
            cache: !!desdeCache,
            origen: this.origen(),
            t: Date.now()
        });
        try { sessionStorage.setItem(MEDIDOR_CLAVE + '_datos', JSON.stringify(this.registros.slice(-500))); } catch {}
        this.pintar();
    },

    envolver() {
        const F = firebase.firestore;
        const medidor = this;
        // CollectionReference hereda de Query, así que envolver Query.get cubre
        // colecciones y consultas con where/orderBy/limit de una vez.
        const envolverGet = (Clase, tipo) => {
            if (!Clase?.prototype?.get || Clase.prototype.get._medido) return;
            const original = Clase.prototype.get;
            const nuevo = async function (...args) {
                const r = await original.apply(this, args);
                medidor.anotar(medidor.rutaDe(this, r), medidor.cobradas(r), tipo, r.metadata?.fromCache);
                return r;
            };
            nuevo._medido = true;
            Clase.prototype.get = nuevo;
        };
        envolverGet(F.Query, 'consulta');
        envolverGet(F.DocumentReference, 'documento');

        // onSnapshot cobra los documentos de la primera entrega y luego uno por
        // cada cambio. Un listener olvidado es una fuga que no se ve.
        [F.Query, F.DocumentReference].forEach(Clase => {
            if (!Clase?.prototype?.onSnapshot || Clase.prototype.onSnapshot._medido) return;
            const original = Clase.prototype.onSnapshot;
            const ruta = this.rutaDe.bind(this);
            const nuevo = function (...args) {
                const r = ruta(this);
                const envolverCb = cb => typeof cb !== 'function' ? cb : (snap, ...resto) => {
                    medidor.anotar(medidor.rutaDe(this, snap) || r, medidor.cobradas(snap), 'listener', snap?.metadata?.fromCache);
                    return cb(snap, ...resto);
                };
                // onSnapshot acepta (cb) o ({next,error}) y opcionalmente opciones antes.
                const nuevos = args.map(a => typeof a === 'function' ? envolverCb(a)
                    : (a && typeof a.next === 'function' ? { ...a, next: envolverCb(a.next) } : a));
                return original.apply(this, nuevos);
            };
            nuevo._medido = true;
            Clase.prototype.onSnapshot = nuevo;
        });
    },

    // Lo que Firestore FACTURA, que no es lo mismo que lo que devuelve:
    //  · un `get` de documento inexistente se cobra igual, como 1 lectura;
    //  · una consulta sin resultados tiene un mínimo de 1 lectura.
    // La v1 los contaba como 0 y por eso las 9 llamadas a `privado/{id}` salían
    // gratis en el informe cuando en la factura no lo son.
    cobradas(r) {
        if (r?.docs) return Math.max(1, r.docs.length);
        return 1;
    },

    // Ruta legible y AGRUPABLE: los ids concretos se sustituyen por {id}, si no
    // "hitos de 40 personas" saldrían como 40 rutas distintas y no se vería que
    // son el mismo patrón repetido.
    //
    // ⚠️ En la v1, 250 de 821 documentos salieron como `?`: una Query construida
    // con where/orderBy NO expone `.path` en el SDK compat (lo guarda en internos
    // minificados que cambian entre versiones). La ruta fiable sale del RESULTADO
    // —`docs[0].ref.parent.path`—, que es dato público del snapshot y no depende
    // de cómo esté hecho el SDK por dentro.
    rutaDe(ref, snap) {
        const bruta =
            snap?.docs?.[0]?.ref?.parent?.path            // consulta con resultados
            || snap?.ref?.path                            // documento suelto
            || ref?.path                                  // colección sin filtros
            || ref?._delegate?._query?.path?.segments?.join('/')
            || ref?._query?.path?.canonicalString?.()
            || '';
        const limpia = String(bruta)
            .replace(/^artifacts\/[^/]+\//, '')
            .replace(/public\/data\//, '')
            .split('/')
            .map((seg, i) => (i % 2 === 1 ? '{id}' : seg))
            .join('/');
        // Si ni así se sabe, al menos que se diga cuántos documentos trajo: un
        // "?" mudo es lo que hizo inútil el 30% del primer informe.
        return limpia || `? (${snap?.docs ? snap.docs.length + ' docs' : 'doc suelto'})`;
    },

    // Resumen por colección: lo que se mira primero es qué colección se lleva
    // los documentos, no la lista cronológica.
    resumen() {
        const por = {};
        for (const r of this.registros) {
            const k = r.ruta;
            por[k] ||= { ruta: k, llamadas: 0, docs: 0, cache: 0, paginas: new Set(), origenes: {} };
            por[k].llamadas++;
            por[k].docs += r.docs;
            if (r.cache) por[k].cache++;
            por[k].paginas.add(r.pagina);
            por[k].origenes[r.origen] = (por[k].origenes[r.origen] || 0) + 1;
        }
        return Object.values(por).sort((a, b) => b.docs - a.docs);
    },

    total() { return this.registros.reduce((n, r) => n + r.docs, 0); },

    reiniciar() {
        this.registros = [];
        sessionStorage.removeItem(MEDIDOR_CLAVE + '_datos');
        this.pintar();
    },

    // Vuelca al portapapeles lo que hace falta para diagnosticar sin pedirle a
    // Juan que interprete nada: total, tabla por colección y quién la pidió.
    async copiar() {
        const lineas = [
            `LECTURAS DE FIRESTORE — ${this.total()} documentos en ${this.registros.length} llamadas`,
            `Páginas visitadas: ${[...new Set(this.registros.map(r => r.pagina))].join(' → ')}`,
            ''
        ];
        for (const r of this.resumen()) {
            lineas.push(`${String(r.docs).padStart(5)} docs · ${String(r.llamadas).padStart(3)} llamadas · ${r.ruta}`
                + (r.cache ? ` · ${r.cache} desde caché` : ''));
            for (const [o, n] of Object.entries(r.origenes).sort((a, b) => b[1] - a[1])) {
                lineas.push(`               ${n}× ${o}`);
            }
        }
        const texto = lineas.join('\n');
        try { await navigator.clipboard.writeText(texto); } catch {}
        console.log(texto);
        return texto;
    },

    pintar() {
        if (!this.activo) return;
        let caja = document.getElementById('medidor-lecturas');
        if (!caja) {
            if (!document.body) return;
            caja = document.createElement('div');
            caja.id = 'medidor-lecturas';
            caja.style.cssText = 'position:fixed;bottom:8px;right:8px;z-index:99999;background:#111;color:#e5e5e5;'
                + 'font:12px/1.45 ui-monospace,monospace;padding:10px 12px;border-radius:10px;max-width:min(92vw,460px);'
                + 'max-height:60vh;overflow:auto;box-shadow:0 8px 24px rgba(0,0,0,.4)';
            document.body.appendChild(caja);
        }
        const filas = this.resumen().slice(0, 12).map(r =>
            `<tr><td style="text-align:right;padding-right:8px;color:#fbbf24">${r.docs}</td>`
            + `<td style="text-align:right;padding-right:8px;color:#9ca3af">${r.llamadas}×</td>`
            + `<td style="word-break:break-all">${r.ruta}</td></tr>`).join('');
        caja.innerHTML = `
            <div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline;margin-bottom:6px">
                <b style="color:#fff">${this.total()} lecturas</b>
                <span style="color:#9ca3af">${this.registros.length} llamadas</span>
            </div>
            <table style="border-collapse:collapse;width:100%">${filas}</table>
            <div style="margin-top:8px;display:flex;gap:10px;flex-wrap:wrap">
                <a href="#" onclick="medidorLecturas.copiar();return false" style="color:#60a5fa">copiar informe</a>
                <a href="#" onclick="medidorLecturas.reiniciar();return false" style="color:#60a5fa">reiniciar</a>
                <a href="?lecturas=0" style="color:#f87171">apagar</a>
            </div>
            <div style="margin-top:4px;color:#6b7280">acumulado de toda la navegación, no de esta página</div>`;
    }
};
medidorLecturas.arrancar();

const _appId = "1:874010522484:web:28881821d110defd3b7221";
const artifactsRoot = db.collection('artifacts').doc(_appId);
const alumniCollection = artifactsRoot.collection('public').doc('data').collection('alumni');
const adminsCollection = artifactsRoot.collection('admins');
const usernamesCollection = artifactsRoot.collection('usernames');
const newsCollection = artifactsRoot.collection('public').doc('data').collection('news');
const organizationsCollection = artifactsRoot.collection('public').doc('data').collection('organizaciones');
const colegiosCollection = artifactsRoot.collection('public').doc('data').collection('colegios');
// Banco de tests de práctica (TOEFL/DELF). Lectura pública (practicar no exige
// sesión, como hoy en JS); escritura solo superadmin (gestión). El contenido
// completo del test va en el campo `content`. Los arrays JS de *-data.js pasan
// a ser SEMILLA + RESPALDO: si esta colección está vacía, el motor usa el JS.
const examTestsCollection = artifactsRoot.collection('public').doc('data').collection('examTests');
const codigosCollection = artifactsRoot.collection('public').doc('data').collection('codigos');
// Veto de reingreso: uid de usuarios eliminados por la administracion. Existe
// porque el cliente NO puede borrar una cuenta de Firebase Auth (hace falta el
// Admin SDK), asi que sin esto un usuario eliminado volvia a entrar y el
// onboarding le recreaba el perfil. Las reglas la consultan en el create de
// alumni; solo el superadmin escribe aqui.
const bloqueadosCollection = artifactsRoot.collection('public').doc('data').collection('bloqueados');
// Banco de ÍTEMS sueltos (ICFES). A diferencia de examTests, que guarda tests
// monolíticos, aquí la unidad es la pregunta: el entrenamiento por competencia
// pide "15 ítems de lc_global que este alumno no haya visto", y eso exige ítems
// consultables uno a uno. Lectura pública como examTests; escritura, superadmin.
const examItemsCollection = artifactsRoot.collection('public').doc('data').collection('examItems');
// Los textos de Lectura Crítica van aparte porque un mismo texto alimenta 3-5
// preguntas: embebido se duplicaría, y una sesión podría mostrar el mismo texto
// tres veces como si fueran cosas distintas.
const examStimuliCollection = artifactsRoot.collection('public').doc('data').collection('examStimuli');
const hitosCollection = (uid) => alumniCollection.doc(uid).collection('hitos');
// Contacto PRIVADO del egresado (teléfono y correo de contacto). Vive fuera del
// documento público alumni/{uid} porque ese documento se lee (y se LISTA) desde
// el directorio: dejar ahí el teléfono equivalía a publicar la agenda entera de
// la red. Aquí solo entran MIEMBROS con cuenta real (las reglas rechazan al
// invitado anónimo), el dueño y el superadmin.
const contactoPrivadoDoc = (uid) => alumniCollection.doc(uid).collection('privado').doc('contacto');
// Resultados de práctica de idiomas (TOEFL/DELF). Subcolección del alumno, como
// los hitos, PERO privada: son datos personales del estudiante (progreso), así
// que las reglas solo dejan leerlos al dueño y a los admins de su colegio.
const examResultsCollection = (uid) => alumniCollection.doc(uid).collection('examResults');
// Intentos ítem por ítem (ICFES). Privada como examResults: es progreso personal
// del estudiante. Alimenta tres cosas a la vez — no repetirle ítems ya vistos,
// diagnosticar su competencia más floja, y el reporte agregado para el colegio.
const itemAttemptsCollection = (uid) => alumniCollection.doc(uid).collection('itemAttempts');
const userChatsCollection = (uid) => artifactsRoot.collection('users').doc(uid).collection('chats');
const userChatMessagesCollection = (uid, chatId) => userChatsCollection(uid).doc(chatId).collection('messages');

const DEFAULT_SCHOOL = 'LCP';
// Mínimo eliminatorio oficial del DELF B1 (nouveau format 2020): 5/25 por épreuve
// (ver docs/delf-b1-formato). Única fuente de verdad: delf-practice.js:270,281,439,449
// debería importar esta constante en vez de tener el 5 repetido a mano (no lo edito,
// es de otro agente — reportado como pendiente).
const DELF_MINIMO_ELIMINATORIO = 5;
// Proxy de IA (Cloudflare Worker): el navegador nunca ve la clave de DeepSeek.
// Código del Worker en proxy-ia/; la clave vive como secreto en Cloudflare.
const SINAPSIS_IA_PROXY = 'https://sinapsis-ia.sinapsis-lcp.workers.dev';

// Worker de correos (código en correos-worker/): cron diario + aviso de mensaje.
// El Worker verifica el consentimiento (newsletterOptIn) antes de enviar nada.
const SINAPSIS_CORREOS = 'https://sinapsis-correos.sinapsis-lcp.workers.dev';
async function avisarMensajePorCorreo(destinatarioUid, deNombre) {
    try {
        await fetch(`${SINAPSIS_CORREOS}/mensaje-nuevo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ destinatarioUid, deNombre })
        });
    } catch (e) { /* el aviso es best-effort: nunca debe romper el chat */ }
}
const USERNAME_AUTH_DOMAIN = 'users.sinapsis.app';
const LEGACY_USERNAME_AUTH_DOMAIN = 'sinapsis.local';
const STATUS = { TRABAJANDO:'trabajando', ESTUDIANDO:'estudiando', TRABAJANDO_ESTUDIANDO:'trabajando-estudiando', EMPRENDIENDO:'emprendiendo', PROFESOR:'profesor', SIN_DEFINIR:'sin-definir' };
const ACCOUNT_STATUS = { ACTIVO:'activo', SUSPENDIDO:'suspendido' };
const DIRECTORY_PAGE_SIZE = 12;

function sanitizeHTML(str) { const d=document.createElement('div'); d.textContent=String(str??''); return d.innerHTML; }
function debounce(fn, delay=300) { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), delay); }; }
function isValidLinkedInUrl(url) { if(!url) return false; const n=url.startsWith('http')?url:`https://${url}`; try{const u=new URL(n);return u.hostname.includes('linkedin.com');}catch{return false;} }
function normalizeLinkedInUrl(url) { if(!url) return ''; return url.startsWith('http')?url:`https://${url}`; }
function isValidPhone(phone) { const d=String(phone||'').replace(/[^0-9+]/g,''); return d.replace(/\+/g,'').length>=7; }
function hasValidFirstName(v) { return String(v||'').trim().length>=2; }
function normalizeUsername(value) {
    return String(value || '').trim().toLowerCase().replace(/^@+/, '');
}
function isValidUsername(value) {
    return /^[a-z0-9._-]{3,30}$/.test(normalizeUsername(value));
}
function isEmailIdentity(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}
function syntheticEmailForUsername(username) {
    return `${normalizeUsername(username)}@${USERNAME_AUTH_DOMAIN}`;
}
function usernameFromSyntheticEmail(email) {
    const clean = String(email || '').toLowerCase().trim();
    const domains = [USERNAME_AUTH_DOMAIN, LEGACY_USERNAME_AUTH_DOMAIN];
    const domain = domains.find((item) => clean.endsWith(`@${item}`));
    return domain ? clean.slice(0, -domain.length - 1) : '';
}
function authEmailForIdentity(identity) {
    const clean = String(identity || '').trim();
    return isEmailIdentity(clean) ? clean.toLowerCase() : syntheticEmailForUsername(clean);
}
async function resolveAuthEmail(identity) {
    const clean = String(identity || '').trim();
    if (isEmailIdentity(clean)) return clean.toLowerCase();
    const username = normalizeUsername(clean);
    if (!isValidUsername(username)) throw new Error('Ingresa un usuario valido de 3 a 30 caracteres.');
    const doc = await usernamesCollection.doc(username).get();
    return doc.exists ? (doc.data().authEmail || syntheticEmailForUsername(username)) : syntheticEmailForUsername(username);
}
async function reserveUsername(username, uid, authEmail, extra = {}) {
    const clean = normalizeUsername(username);
    if (!isValidUsername(clean)) throw new Error('El usuario debe tener entre 3 y 30 caracteres y solo usar letras, numeros, punto, guion o guion bajo.');
    const ref = usernamesCollection.doc(clean);
    await db.runTransaction(async (transaction) => {
        const existing = await transaction.get(ref);
        if (existing.exists && existing.data().uid !== uid) {
            throw new Error('Ese usuario ya esta en uso.');
        }
        transaction.set(ref, {
            uid,
            username: clean,
            authEmail,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            ...extra
        }, { merge: true });
    });
    return clean;
}
function getSecondaryAuth() {
    const existing = firebase.apps.find(app => app.name === 'admin-user-creator');
    const app = existing || firebase.initializeApp(firebaseConfig, 'admin-user-creator');
    return firebase.auth(app);
}
function formatStatusLabel(status) {
    const m={trabajando:'Trabajando',estudiando:'Estudiando','trabajando-estudiando':'Trabajando y estudiando',emprendiendo:'Emprendiendo',profesor:'Profesor'};
    return m[String(status||'').trim().toLowerCase()]||'Sin definir';
}
function formatChatTime(ts) { if(!ts||typeof ts.toDate!=='function') return ''; return ts.toDate().toLocaleString('es-CO',{hour:'2-digit',minute:'2-digit'}); }
function formatNewsDate(ts) { if(!ts||typeof ts.toDate!=='function') return 'Reciente'; return ts.toDate().toLocaleDateString('es-CO',{day:'2-digit',month:'short'}); }
function buildAvatarUrl(name='Usuario') {
    const p=['9333ea','2563eb','db2777','0d9488','ea580c','4f46e5','16a34a','0891b2'];
    const s=String(name||'Usuario').toLowerCase().trim(); let h=0;
    for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${p[h%p.length]}&color=fff`;
}
function hasProfileValue(value, placeholders = []) {
    if (Array.isArray(value)) return value.map(v => String(v || '').trim()).filter(Boolean).length > 0;
    const clean = String(value || '').trim();
    if (!clean) return false;
    return !placeholders.map(p => String(p).toLowerCase()).includes(clean.toLowerCase());
}
function getProfileCompletenessScore(user = {}) {
    // El teléfono ya NO viaja en el listado del directorio (vive en el doc
    // privado alumni/{uid}/privado/contacto). Si el objeto que llega no trae
    // la clave `phone`, el dato simplemente NO SE CONOCE: se saca del cálculo
    // (ni suma ni resta) en vez de contarlo como faltante. Sin esto, la
    // completitud de los 68 egresados bajaba de golpe un ~5% el día del cambio
    // y el ranking del directorio se movía por un dato que ya no se transmite.
    // En el perfil propio sí llega (loadProfile lo trae del doc privado), así
    // que ahí sigue contando igual que antes.
    const conocePhone = Object.prototype.hasOwnProperty.call(user, 'phone');
    const checks = [
        [user.firstName, 6],
        [user.lastName, 6],
        [user.username, 5],
        [user.email, 4],
        [user.role, 8, ['Sin rol']],
        [user.status, 6, ['sin-definir']],
        [user.year, 7, ['---']],
        [user.location, 7, ['Ubicacion no disponible', 'Ubicación no disponible', 'UbicaciÃ³n no disponible']],
        [user.fullStudies, 9, ['No especificado']],
        [user.area, 7, ['General', 'No especificado']],
        [user.bio, 10, ['Sin biografia disponible.', 'Sin biografía disponible.', 'Sin biografÃ­a disponible.']],
        [user.expectations, 7, ['No especificadas.', 'No especificadas']],
        [user.skills, 8],
        [isValidLinkedInUrl(user.linkedin) ? user.linkedin : '', 5],
        [user.photoURL, 5],
        [Number(user.hitosCount) > 0 ? 'ruta' : '', 8],
        [Number(user.hitosCount) >= 3 ? 'ruta-completa' : '', 6]
    ];
    if (conocePhone) checks.push([isValidPhone(user.phone) ? user.phone : '', 5]);
    const total = checks.reduce((sum, item) => sum + item[1], 0);
    const earned = checks.reduce((sum, [value, weight, placeholders]) => (
        sum + (hasProfileValue(value, placeholders || []) ? weight : 0)
    ), 0);
    return Math.round((earned / total) * 100);
}
function rankAlumniForDirectory(items = []) {
    return [...items].map((item) => {
        const completeness = Number.isFinite(item.profileCompleteness)
            ? item.profileCompleteness
            : getProfileCompletenessScore(item);
        const weight = 1 + (completeness / 100) * 5;
        return {
            item: { ...item, profileCompleteness: completeness },
            key: Math.pow(Math.random(), 1 / weight),
            fallback: Math.random()
        };
    }).sort((a, b) => (b.key - a.key) || (b.fallback - a.fallback)).map(entry => entry.item);
}

// ===== MULTI-TENANT (colegios, códigos de invitación, módulos) =====
// Regla dura: el tag de colegio NUNCA se autodeclara — nace del código de
// invitación (las reglas de Firestore validan código→colegio en la escritura).
// Sin código, el registro cae en la red general (LCP mientras sea el único
// colegio). Los módulos pagados (TOEFL/DELF) se activan por colegio en su doc;
// si el colegio no tiene doc aplican los módulos por defecto (la era LCP).
const MODULOS_DEFAULT = { toefl: true, delf: true };
async function loadColegios() {
    try { const s = await colegiosCollection.get(); return s.docs.map(d => ({ id: d.id, ...d.data() })); }
    catch (e) { return []; }
}
async function getColegio(id) {
    if (!id) return null;
    try { const d = await colegiosCollection.doc(String(id).trim()).get(); return d.exists ? { id: d.id, ...d.data() } : null; }
    catch (e) { return null; }
}
// Valida un código de invitación. Devuelve { codigo, colegioId, colegio } o null.
// La validación definitiva la hacen las reglas de Firestore al escribir el perfil;
// esto solo decide qué mostrar en el registro.
async function validarCodigoInvitacion(codigo) {
    const clean = String(codigo || '').trim();
    if (!clean) return null;
    try {
        const doc = await codigosCollection.doc(clean).get();
        if (!doc.exists || doc.data().activo !== true) return null;
        const colegioId = doc.data().colegioId || '';
        if (!colegioId) return null;
        return { codigo: clean, colegioId, colegio: await getColegio(colegioId) };
    } catch (e) { return null; }
}
// Módulos disponibles para el usuario actual según su colegio (invitados y
// usuarios sin tag ven los módulos por defecto).
async function getModulosUsuario() {
    const school = (esMiembro() && state.profile?.school) ? state.profile.school : DEFAULT_SCHOOL;
    const colegio = await getColegio(school);
    return (colegio && colegio.modulos) ? { ...MODULOS_DEFAULT, ...colegio.modulos } : { ...MODULOS_DEFAULT };
}
// Filtra novedades según la audiencia: 'todos' para cualquiera; las dirigidas
// a un colegio solo las ve quien tiene ese tag (los invitados ven solo 'todos').
function newsVisiblesParaUsuario(items = []) {
    const school = (esMiembro() && state.profile?.school) ? state.profile.school : '';
    return items.filter(n => (n.audiencia || 'todos') === 'todos' || n.audiencia === school);
}

// ===== TRAYECTORIA (Sinapsis: hitos + organizaciones) =====
// Cada egresado es una secuencia de hitos; la "ruta" (línea de tiempo) emerge de ellos.
// Las organizaciones se normalizan en una colección propia para poder agregar datos por institución.
const HITO_TYPES = {
    colegio:        { label: 'Colegio',            icon: 'ph-graduation-cap' },
    educacion:      { label: 'Educación superior', icon: 'ph-student' },
    practica:       { label: 'Práctica / Pasantía',icon: 'ph-briefcase' },
    empleo:         { label: 'Empleo',             icon: 'ph-buildings' },
    emprendimiento: { label: 'Emprendimiento',     icon: 'ph-rocket-launch' },
    logro:          { label: 'Logro',              icon: 'ph-trophy' }
};
function hitoTypeInfo(tipo) { return HITO_TYPES[tipo] || { label: 'Hito', icon: 'ph-flag' }; }
function slugifyOrgName(name) {
    return String(name || '').trim().toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}
async function upsertOrganization(nombre, tipo = 'otro') {
    const clean = String(nombre || '').trim();
    const slug = slugifyOrgName(clean);
    if (!slug) return null;
    try {
        await organizationsCollection.doc(slug).set({
            nombre: clean, tipo,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } catch (e) { /* la org normalizada es best-effort; el hito guarda el nombre igual */ }
    return slug;
}
async function loadOrganizations() {
    try {
        const snap = await organizationsCollection.get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) { return []; }
}
function fillOrgDatalist(datalistId, orgs) {
    const dl = document.getElementById(datalistId);
    if (!dl) return;
    dl.innerHTML = orgs.map(o => `<option value="${sanitizeHTML(o.nombre)}"></option>`).join('');
}
function sortHitos(hitos = []) {
    return [...hitos].sort((a, b) => {
        const ay = Number(a.anioInicio) || 0, by = Number(b.anioInicio) || 0;
        if (ay !== by) return ay - by;
        return (a.actual ? 1 : 0) - (b.actual ? 1 : 0);
    });
}
// La portada gastaba 27 documentos en 9 llamadas pintando las rutas destacadas,
// y las repetía enteras al volver a ella. Se cachea por uid durante la sesión;
// cualquier escritura bajo `alumni/` la tira (ver invalidarCacheAlumni), así que
// añadir o editar un hito se ve al instante.
async function loadHitos(uid) {
    if (!uid) return [];
    const cache = _cacheLeer(HITOS_CACHE, uid);
    if (cache) return cache;
    try {
        const snap = await hitosCollection(uid).get();
        const hitos = sortHitos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        _cacheEscribir(HITOS_CACHE, hitos, uid);
        return hitos;
    } catch (e) { return []; }
}
async function saveHito(uid, hito, hitoId = null) {
    const payload = {
        tipo: hito.tipo || 'logro',
        organizacion: String(hito.organizacion || '').trim(),
        organizacionId: hito.organizacionId || slugifyOrgName(hito.organizacion) || '',
        rol: String(hito.rol || '').trim(),
        anioInicio: hito.anioInicio ? Number(hito.anioInicio) : null,
        anioFin: hito.actual ? null : (hito.anioFin ? Number(hito.anioFin) : null),
        actual: Boolean(hito.actual),
        descripcion: String(hito.descripcion || '').trim(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    const col = hitosCollection(uid);
    if (hitoId) { await col.doc(hitoId).set(payload, { merge: true }); return hitoId; }
    payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    const ref = await col.add(payload);
    return ref.id;
}
async function deleteHito(uid, hitoId) { await hitosCollection(uid).doc(hitoId).delete(); }

// ── Banco de tests en Firestore ──────────────────────────────────────────────
// Devuelve los tests activos de un examen, reconstruidos con la MISMA forma que
// los objetos de *-data.js (test.reading/test.writing o test.ce/test.pe), para
// que los motores no cambien su forma de acceso. Si falla o está vacío: [].
async function loadExamTests(exam) {
    try {
        const snap = await examTestsCollection.where('exam', '==', exam).get();
        return snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(x => x.active !== false)
            .map(x => ({ id: x.id, name: x.name, level: x.level || null, ...(x.content || {}) }));
    } catch (e) { return []; }
}
// Siembra Firestore desde los arrays JS (create-if-missing, idempotente). Solo
// tiene efecto para el superadmin (las reglas rechazan el resto). Devuelve
// cuántos tests nuevos escribió.
async function seedExamTests(sourceTests, exam) {
    let creados = 0;
    for (const t of (sourceTests || [])) {
        try {
            const ref = examTestsCollection.doc(t.id);
            if ((await ref.get()).exists) continue;
            const { id, name, level, ...content } = t;
            await ref.set({
                exam, name: name || id, level: level || null, school: '', active: true,
                content,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            creados++;
        } catch (e) { /* seguir con los demás */ }
    }
    return creados;
}

// ── Resultados de práctica de idiomas ────────────────────────────────────────
// Persiste un intento en el perfil del alumno. Best-effort: la práctica es
// PÚBLICA (no exige sesión), así que solo se guarda en Firestore si hay un
// usuario real logueado (nunca en modo invitado). Si falla, la práctica no se
// rompe: el intento igual quedó en el localStorage del motor.
async function saveExamResult(entry) {
    try {
        if (!esMiembro()) return; // invitado anónimo: el intento solo queda en su localStorage
        await examResultsCollection(state.user.uid).add({
            exam: String(entry.exam || ''),        // 'TOEFL' | 'DELF'
            section: String(entry.section || ''),  // 'reading'|'writing'|'ce'|'pe'
            score: Number(entry.score ?? 0),       // banda 1-6 (TOEFL) o puntos /25 (DELF)
            scale: String(entry.scale || ''),      // '/6' | '/25'
            summary: String(entry.summary || ''),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) { /* best-effort: nunca romper el flujo de práctica */ }
}
async function loadExamResults(uid) {
    if (!uid) return [];
    try {
        const snap = await examResultsCollection(uid).orderBy('createdAt', 'desc').limit(50).get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) { return []; }
}
// Render compartido (admin ve el de un alumno; el estudiante verá el suyo).
const EXAM_SECTION_LABEL = {
    reading: 'Reading', writing: 'Writing',
    ce: 'Compréhension écrite', pe: 'Production écrite'
};
// Equivalencia oficial ETS: banda 1–6 del TOEFL 2026 → nivel MCER/CEFR.
// (6→C2 · 5–5.5→C1 · 4–4.5→B2 · 3–3.5→B1 · 2–2.5→A2 · 1–1.5→A1)
function bandToCEFR(band) {
    const b = Number(band) || 0;
    if (b >= 6) return 'C2';
    if (b >= 5) return 'C1';
    if (b >= 4) return 'B2';
    if (b >= 3) return 'B1';
    if (b >= 2) return 'A2';
    return 'A1';
}
function _examFecha(r) {
    try {
        const d = r.createdAt?.toDate ? r.createdAt.toDate() : (r.createdAt ? new Date(r.createdAt) : null);
        return d ? d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
    } catch (e) { return ''; }
}
// Resumen COMBINADO por examen (opcional, no obliga a hacer todas las
// secciones): toma el intento más reciente de cada sección y, para el TOEFL,
// estima un nivel global + CEFR. Es fiel al score report real pero se arma con
// lo que el estudiante haya practicado, aunque sea una sola sección.
function _examSummaryHTML(exam, rows) {
    const last = {}; // rows vienen ordenados desc por fecha → el primero de cada sección es el más reciente
    rows.forEach(r => { if (last[r.section] === undefined) last[r.section] = Number(r.score) || 0; });
    if (exam === 'DELF') {
        const ce = last.ce, pe = last.pe;
        const partes = [];
        if (ce !== undefined) partes.push(`CE <strong>${ce}</strong>/25`);
        if (pe !== undefined) partes.push(`PE <strong>${pe}</strong>/25`);
        const hechas = [ce, pe].filter(v => v !== undefined);
        const total = hechas.reduce((a, v) => a + v, 0);
        const max = hechas.length * 25;
        return `
            <div class="rounded-control bg-purple-50 border border-purple-100 px-3 py-2 mb-2">
                <p class="text-micro font-medio uppercase tracking-widest text-purple-600 mb-0.5">DELF B1 · nivel objetivo B1 (MCER)</p>
                <p class="text-sm text-purple-900">${partes.join(' · ') || 'Sin secciones'}${max ? ` · <strong>${Math.round(total * 10) / 10}/${max}</strong>` : ''}</p>
            </div>`;
    }
    // TOEFL
    const secs = ['reading', 'writing'].filter(s => last[s] !== undefined);
    const partes = secs.map(s => `${EXAM_SECTION_LABEL[s]} <strong>${last[s]}</strong> (${bandToCEFR(last[s])})`);
    const global = secs.length ? Math.round((secs.reduce((a, s) => a + last[s], 0) / secs.length) * 2) / 2 : null;
    return `
        <div class="rounded-control bg-blue-50 border border-blue-100 px-3 py-2 mb-2">
            <p class="text-micro font-medio uppercase tracking-widest text-blue-600 mb-0.5">TOEFL · escala 1–6 (MCER)</p>
            <p class="text-sm text-blue-900">${partes.join(' · ') || 'Sin secciones'}${global !== null ? ` · nivel ~<strong>${global}</strong> ${bandToCEFR(global)}` : ''}</p>
        </div>`;
}
function _examRowHTML(r) {
    const isDelf = r.exam === 'DELF';
    const examTag = isDelf ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700';
    const examName = isDelf ? 'DELF B1' : 'TOEFL';
    const sec = EXAM_SECTION_LABEL[r.section] || r.section || '';
    const fecha = _examFecha(r);
    // Etiqueta de nivel: CEFR para TOEFL; para DELF, aviso del mínimo eliminatorio.
    const nivel = isDelf
        ? ((Number(r.score) || 0) >= DELF_MINIMO_ELIMINATORIO
            ? `<span class="text-micro font-medio text-emerald-600">supera ${DELF_MINIMO_ELIMINATORIO}</span>`
            : `<span class="text-micro font-medio text-red-500">bajo ${DELF_MINIMO_ELIMINATORIO}</span>`)
        : `<span class="text-micro font-medio text-blue-600">${bandToCEFR(r.score)}</span>`;
    return `
        <div class="flex items-center justify-between gap-3 rounded-control border border-gray-100 bg-gray-50/70 px-3 py-2.5">
            <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="px-2 py-0.5 rounded-md text-[11px] font-fuerte ${examTag}">${sanitizeHTML(examName)}</span>
                    <span class="text-sm font-fuerte text-gray-800">${sanitizeHTML(sec)}</span>
                </div>
                ${fecha ? `<p class="text-[11px] text-gray-400 mt-0.5">${sanitizeHTML(fecha)}</p>` : ''}
            </div>
            <div class="shrink-0 text-right">
                <span class="text-lg font-fuerte text-gray-900">${sanitizeHTML(String(r.score))}<span class="text-xs text-gray-400 font-fuerte">${sanitizeHTML(r.scale || '')}</span></span>
                <div>${nivel}</div>
            </div>
        </div>`;
}
function renderExamResultsHTML(results) {
    if (!results || !results.length) {
        return `<p class="text-sm text-gray-400 italic">Sin prácticas registradas todavía.</p>`;
    }
    const byExam = {};
    results.forEach(r => { (byExam[r.exam] = byExam[r.exam] || []).push(r); });
    return Object.keys(byExam).map(exam => `
        <div class="mb-4">
            ${_examSummaryHTML(exam, byExam[exam])}
            <div class="space-y-2">${byExam[exam].map(_examRowHTML).join('')}</div>
        </div>`).join('');
}
async function syncHitosCount(uid, count) {
    try {
        await alumniCollection.doc(uid).set({
            hitosCount: count,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } catch (e) {}
}
// Ruta derivada para perfiles antiguos sin hitos: se arma desde los campos planos, solo para mostrar.
function deriveLegacyHitos(profile = {}) {
    const hitos = [];
    if (profile.graduationYear || profile.school) {
        hitos.push({ tipo: 'colegio', organizacion: profile.school || DEFAULT_SCHOOL, rol: 'Bachiller', anioInicio: null, anioFin: Number(profile.graduationYear) || null, actual: false, descripcion: '', legacy: true });
    }
    if (hasProfileValue(profile.studies, ['No especificado'])) {
        hitos.push({ tipo: 'educacion', organizacion: '', rol: profile.studies, anioInicio: Number(profile.graduationYear) || null, anioFin: null, actual: String(profile.status || '').includes('estudiando'), descripcion: '', legacy: true });
    }
    if (hasProfileValue(profile.role, ['Sin rol'])) {
        hitos.push({ tipo: profile.status === 'emprendiendo' ? 'emprendimiento' : 'empleo', organizacion: '', rol: profile.role, anioInicio: null, anioFin: null, actual: true, descripcion: '', legacy: true });
    }
    return sortHitos(hitos);
}
// Convierte la ruta derivada en hitos reales. Se llama la primera vez que el egresado guarda un hito
// propio: sin esto, el hito derivado (bachillerato, estudios, empleo) desaparece al dejar de estar vacía
// la subcolección, y parece que se hubiera borrado.
async function materializeLegacyHitos(uid, profile = {}) {
    if (!uid) return [];
    const existentes = await loadHitos(uid);
    if (existentes.length) return existentes;
    const derivados = deriveLegacyHitos(profile);
    for (const h of derivados) {
        if (h.organizacion) {
            h.organizacionId = await upsertOrganization(h.organizacion,
                h.tipo === 'educacion' ? 'universidad' : (h.tipo === 'colegio' ? 'colegio' : 'empresa'));
        }
        await saveHito(uid, h);
    }
    return loadHitos(uid);
}
function formatHitoYears(h) {
    const inicio = h.anioInicio || '';
    const fin = h.actual ? 'Hoy' : (h.anioFin || '');
    if (inicio && fin) return `${inicio} — ${fin}`;
    return String(inicio || fin || '');
}
// Renderizador compartido de la línea de tiempo (perfil propio, perfil público, rutas destacadas).
function renderTimelineHTML(hitos = [], { editable = false, editorNS = 'rutaLogic' } = {}) {
    if (!hitos.length) {
        return `<div class="text-center py-8 text-gray-400">
            <i class="ph ph-path text-4xl mb-2 block"></i>
            <p class="text-sm font-medium">Aún no hay hitos en esta ruta.</p>
        </div>`;
    }
    const last = hitos.length - 1;
    return `<ol class="relative">` + hitos.map((h, i) => {
        const info = hitoTypeInfo(h.tipo);
        const years = formatHitoYears(h);
        const actions = (editable && h.id) ? `
            <span class="flex gap-1 shrink-0">
                <button type="button" onclick="${editorNS}.editHito('${sanitizeHTML(h.id)}')" class="p-1.5 rounded-control text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition" title="Editar hito"><i class="ph-bold ph-pencil-simple"></i></button>
                <button type="button" onclick="${editorNS}.removeHito('${sanitizeHTML(h.id)}')" class="p-1.5 rounded-control text-gray-400 hover:text-red-600 hover:bg-red-50 transition" title="Eliminar hito"><i class="ph-bold ph-trash"></i></button>
            </span>` : '';
        return `
        <li class="relative flex gap-4 ${i < last ? 'pb-2' : ''}">
            <div class="flex flex-col items-center shrink-0">
                <span class="relative z-10 w-11 h-11 rounded-superficie flex items-center justify-center text-xl shadow-sm ${h.actual ? 'bg-brand-600 text-white shadow-brand-600/30' : 'bg-white text-brand-600 border border-brand-100'}">
                    <i class="ph-duotone ${info.icon}"></i>
                    ${h.actual ? '<span class="absolute -top-1 -right-1 flex h-3 w-3"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span><span class="relative inline-flex rounded-full h-3 w-3 bg-brand-500 border-2 border-white"></span></span>' : ''}
                </span>
                ${i < last ? '<span class="w-0.5 flex-1 my-1 rounded-full bg-gradient-to-b from-brand-300 to-brand-100"></span>' : ''}
            </div>
            <div class="min-w-0 flex-1 pb-5">
                <div class="rounded-superficie border ${h.actual ? 'border-brand-100 bg-brand-50' : 'border-gray-100 bg-white'} px-4 py-3 shadow-sm hover:shadow-md transition group/hito">
                    <div class="flex items-start justify-between gap-2">
                        <div class="min-w-0">
                            <div class="flex items-center gap-2 flex-wrap mb-0.5">
                                <span class="text-micro font-medio uppercase tracking-widest text-brand-600">${sanitizeHTML(info.label)}</span>
                                ${h.actual ? '<span class="text-micro font-medio px-2 py-0.5 bg-brand-600 text-white rounded-full uppercase tracking-wide">Hoy</span>' : ''}
                            </div>
                            <p class="font-fuerte text-gray-900 leading-snug">${sanitizeHTML(h.organizacion || h.rol || 'Sin detalle')}</p>
                            ${h.organizacion && h.rol ? `<p class="text-sm text-gray-500 leading-snug">${sanitizeHTML(h.rol)}</p>` : ''}
                            ${h.descripcion ? `<p class="text-xs text-gray-400 mt-1.5 leading-relaxed">${sanitizeHTML(h.descripcion)}</p>` : ''}
                        </div>
                        <div class="flex flex-col items-end gap-1 shrink-0">
                            ${years ? `<span class="text-micro font-medio px-2 py-1 rounded-control bg-gray-50 border border-gray-100 text-gray-500 whitespace-nowrap">${sanitizeHTML(years)}</span>` : ''}
                            ${actions}
                        </div>
                    </div>
                </div>
            </div>
        </li>`;
    }).join('') + `</ol>`;
}

// ── Ruta como imagen compartible (canvas, sin librerías ni imágenes externas) ──
const rutaImagen = {
    _wrap(ctx, text, maxWidth) {
        const words = String(text || '').split(' ');
        const lines = [];
        let line = '';
        for (const w of words) {
            const test = line ? `${line} ${w}` : w;
            if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
            else line = test;
        }
        if (line) lines.push(line);
        return lines.slice(0, 2);
    },

    descargar(user, hitos = []) {
        // Sin emojis: esta imagen se descarga y circula fuera de la plataforma
        // con la marca de Sinapsis, y el tipo de hito ya va escrito en texto al
        // lado del marcador (COLEGIO, EMPLEO...), asi que el emoji era adorno
        // redundante. El marcador es geometrico: nucleo solido en el hito
        // actual, anillo hueco en los anteriores.
        const W = 1080, HEADER = 250, FOOTER = 110, ROW = 130;
        const rows = Math.max(hitos.length, 1);
        const H = HEADER + rows * ROW + 60 + FOOTER;
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d');

        // Fondo y encabezado con degradado de marca
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
        const grad = ctx.createLinearGradient(0, 0, W, HEADER);
        grad.addColorStop(0, '#14532d'); grad.addColorStop(1, '#16a34a');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, W, HEADER);
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.font = 'bold 26px "Plus Jakarta Sans", "Segoe UI", sans-serif';
        ctx.fillText('SINAPSIS · RED DE EGRESADOS', 70, 78);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 56px "Plus Jakarta Sans", "Segoe UI", sans-serif';
        ctx.fillText(String(user.name || 'Egresado').slice(0, 32), 70, 148);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = '600 30px "Plus Jakarta Sans", "Segoe UI", sans-serif';
        ctx.fillText(`Promoción ${user.year || '—'} · Liceo Campestre de Pereira`, 70, 200);

        // Línea de tiempo
        const lineX = 110;
        if (hitos.length > 1) {
            ctx.strokeStyle = '#bbf7d0'; ctx.lineWidth = 6; ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(lineX, HEADER + 70);
            ctx.lineTo(lineX, HEADER + 70 + (hitos.length - 1) * ROW);
            ctx.stroke();
        }
        hitos.forEach((h, i) => {
            const y = HEADER + 70 + i * ROW;
            ctx.fillStyle = h.actual ? '#16a34a' : '#f0fdf4';
            ctx.beginPath(); ctx.arc(lineX, y, 34, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = h.actual ? '#15803d' : '#bbf7d0'; ctx.lineWidth = 3; ctx.stroke();
            ctx.fillStyle = h.actual ? '#ffffff' : '#16a34a';
            ctx.beginPath(); ctx.arc(lineX, y, 11, 0, Math.PI * 2); ctx.fill();

            const info = hitoTypeInfo(h.tipo);
            const years = formatHitoYears(h);
            ctx.fillStyle = '#16a34a';
            ctx.font = 'bold 22px "Plus Jakarta Sans", "Segoe UI", sans-serif';
            ctx.fillText(`${info.label.toUpperCase()}${years ? `  ·  ${years}` : ''}${h.actual ? '  ·  HOY' : ''}`, 175, y - 22);
            ctx.fillStyle = '#111827';
            ctx.font = 'bold 34px "Plus Jakarta Sans", "Segoe UI", sans-serif';
            const titulo = this._wrap(ctx, h.organizacion || h.rol || 'Sin detalle', W - 250);
            ctx.fillText(titulo[0], 175, y + 16);
            if (h.organizacion && h.rol) {
                ctx.fillStyle = '#6b7280';
                ctx.font = '500 26px "Plus Jakarta Sans", "Segoe UI", sans-serif';
                ctx.fillText(this._wrap(ctx, h.rol, W - 250)[0], 175, y + 52);
            }
        });

        // Pie con invitación
        ctx.fillStyle = '#f0fdf4'; ctx.fillRect(0, H - FOOTER, W, FOOTER);
        ctx.fillStyle = '#15803d';
        ctx.font = 'bold 26px "Plus Jakarta Sans", "Segoe UI", sans-serif';
        ctx.fillText('Mi ruta también empezó en el Liceo', 70, H - FOOTER + 46);
        ctx.fillStyle = '#4b5563';
        ctx.font = '500 22px "Plus Jakarta Sans", "Segoe UI", sans-serif';
        ctx.fillText('Únete a la red: sinapsisred.web.app', 70, H - FOOTER + 82);

        const a = document.createElement('a');
        a.download = `ruta-${String(user.firstName || 'egresado').toLowerCase()}-sinapsis.png`;
        a.href = canvas.toDataURL('image/png');
        a.click();
    }
};

// ── Pulso de un clic: si el hito abierto lleva >1 año sin tocarse, se pregunta
// "¿Sigues en X?" con respuesta de un clic. Mantiene fresca la red sin backend.
const PULSO_SNOOZE_KEY = 'sinapsis_pulso_snooze';
async function checkPulsoRuta() {
    if (!esMiembro()) return; // el invitado anónimo no tiene ruta que refrescar
    if (document.getElementById('pulso-banner')) return;
    try {
        if (Date.now() < Number(localStorage.getItem(PULSO_SNOOZE_KEY) || 0)) return;
        const hitos = await loadHitos(state.user.uid);
        const abierto = hitos.find(h => h.actual);
        if (!abierto) return;
        const upd = abierto.updatedAt?.toDate ? abierto.updatedAt.toDate() : null;
        if (!upd || (Date.now() - upd.getTime()) < 365 * 24 * 3600 * 1000) return;
        const etiqueta = [abierto.rol, abierto.organizacion].filter(Boolean).join(' en ') || 'lo mismo';
        const banner = document.createElement('div');
        banner.id = 'pulso-banner';
        banner.className = 'fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100vw-2rem)] max-w-md bg-white rounded-superficie border border-gray-200 shadow-2xl p-4 animate-slide-up';
        banner.innerHTML = `
            <div class="flex items-start gap-3">
                <div class="w-10 h-10 rounded-control bg-brand-50 text-brand-600 border border-brand-100 flex items-center justify-center text-xl shrink-0"><i class="ph-duotone ph-path"></i></div>
                <div class="min-w-0 flex-1">
                    <p class="text-sm font-fuerte text-gray-900">¿Sigues en ${sanitizeHTML(etiqueta)}?</p>
                    <p class="text-xs text-gray-500 mt-0.5">Tu ruta lleva un tiempo sin actualizarse.</p>
                    <div class="flex gap-2 mt-3">
                        <button onclick="confirmarPulso('${sanitizeHTML(abierto.id)}')" class="px-4 py-2 bg-brand-600 text-white text-micro font-medio rounded-control hover:bg-brand-700 transition">Sí, sigo ahí</button>
                        <a href="profile.html" class="px-4 py-2 bg-gray-50 border border-gray-200 text-gray-600 text-micro font-medio rounded-control hover:bg-gray-100 transition">Actualizar mi ruta</a>
                    </div>
                </div>
                <button onclick="snoozePulso()" class="p-1 text-gray-300 hover:text-gray-500 transition shrink-0" title="Recordar en 30 días"><i class="ph-bold ph-x"></i></button>
            </div>`;
        document.body.appendChild(banner);
    } catch (e) {}
}
async function confirmarPulso(hitoId) {
    try {
        await hitosCollection(state.user.uid).doc(hitoId).set({ updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    } catch (e) {}
    const b = document.getElementById('pulso-banner');
    if (b) {
        b.innerHTML = '<p class="text-sm font-fuerte text-brand-700 text-center py-1"><i class="ph-bold ph-check-circle"></i> Gracias, tu ruta quedó al día.</p>';
        setTimeout(() => b.remove(), 2200);
    }
}
function snoozePulso() {
    localStorage.setItem(PULSO_SNOOZE_KEY, String(Date.now() + 30 * 24 * 3600 * 1000));
    document.getElementById('pulso-banner')?.remove();
}

const state = {
    user: null,
    // news arranca vacío: las noticias demo (eventos y vacantes inventados)
    // se mostraban cuando Firestore no traía nada y hacían ver la red falsa.
    data: { alumni:[], news:[], chats:[], subAdmins:[] },
    profile: { firstName:'',lastName:'',graduationYear:'',location:'',status:'trabajando',role:'',area:'',studies:'',bio:'',skills:'',topics:'',expectations:'',phone:'',linkedin:'',photoURL:'',school:DEFAULT_SCHOOL,username:'',onboardingCompleted:false },
    guestMode: false, activeChatId:null, messagesByChat:{}, selectedDirectoryUserId:null,
    directoryLoading:false, directoryError:null, directoryPage:1, adminEmail:'juanda.fonsecag@gmail.com', adminTab:'users', editingNewsId:null,
    adminRole: null, adminSchool: null,
    listeners: { chats:null, messages:null }
};

if (sessionStorage.getItem('guestMode')==='true') {
    state.guestMode=true;
    state.user={ uid:'guest-view', displayName:'Invitado' };
}

// ===== INVITADO ANÓNIMO vs MIEMBRO REAL =====
// El modo invitado se conserva, pero ahora con Anonymous Auth: el visitante sin
// cuenta obtiene una sesión de Firebase (request.auth != null) y sigue
// explorando el directorio. Eso permite cerrar la lectura pública sin matar la
// exploración. PERO un anónimo NO es un miembro: no tiene perfil, no ve
// Mensajes ni "Mi perfil", y no accede al contacto de nadie.
// Regla única en todo el código: usar esMiembro(), nunca "¿hay state.user?".
function esMiembro() {
    const u = state.user;
    return Boolean(u) && u.isAnonymous !== true && u.uid !== 'guest-view' && !state.guestMode;
}
function esInvitado() { return !esMiembro(); }

// Arranque de la sesión anónima. Si el proveedor Anónimo todavía no está
// habilitado en la consola de Firebase, esto FALLA — y en ese caso la web debe
// seguir funcionando en modo lectura (hoy alumni sigue con read público), no
// quedarse en blanco. Por eso el fallo se registra y se marca en _anonAuthFallo.
let _anonAuthPromesa = null;
let _anonAuthFallo = false;
function anonAuthDisponible() { return !_anonAuthFallo; }

// ── Marca de "este navegador tiene un miembro" ──────────────────────────────
// signInAnonymously() REEMPLAZA al usuario actual, y la sesion anonima queda
// guardada: a partir de ahi el miembro entra como invitado en cada refresco
// —directorio sin contactos, sin Mensajes, sin su perfil— y nada lo devuelve a
// su cuenta. Basta UN instante con currentUser == null (IndexedDB en disputa
// entre pestañas, un arranque lento en el celular) para perderla sin aviso.
// Por eso, si este navegador tuvo sesion de miembro, NO se abre la anonima: se
// prefiere quedarse sin sesion y decirlo, que es reversible.
// La marca se pone al hidratar un miembro y se borra al cerrar sesion o al
// pedir el modo invitado a proposito.
const MARCA_MIEMBRO = 'sinapsis-miembro';
function marcarNavegadorConMiembro() { try { localStorage.setItem(MARCA_MIEMBRO, '1'); } catch (e) {} }
function olvidarNavegadorConMiembro() { try { localStorage.removeItem(MARCA_MIEMBRO); } catch (e) {} }
function navegadorTuvoMiembro() { try { return localStorage.getItem(MARCA_MIEMBRO) === '1'; } catch (e) { return false; } }
// La levanta quien detecta que un miembro se quedo sin sesion; la UI la usa
// para avisar en vez de disfrazarlo de visita anonima.
let _sesionMiembroPerdida = false;
function sesionMiembroPerdida() { return _sesionMiembroPerdida; }
// Se memoriza la PROMESA, no un booleano "ya se intentó": si dos lecturas piden
// sesión a la vez (la portada pide historias mientras el directorio pide alumni),
// la segunda espera a la primera en vez de irse sin sesión y leer un 0.
async function iniciarSesionInvitado() {
    if (_anonAuthPromesa) return _anonAuthPromesa;
    // Este navegador es de un miembro y ahora mismo no hay sesion: NO abrir la
    // anonima encima (ver MARCA_MIEMBRO). Se avisa y se le deja volver a entrar.
    // OJO: aqui NO vale mirar state.guestMode. Se pone solo en cuanto se detecta
    // un usuario anonimo, asi que no distingue "el usuario pidio entrar como
    // invitado" de "ya lo pisaron una vez"; con esa condicion el guardia se
    // saltaba justo en el caso que tenia que frenar. La intencion explicita ya
    // esta cubierta: browseAsGuest() y el logout borran la marca de miembro.
    if (navegadorTuvoMiembro()) {
        _sesionMiembroPerdida = true;
        console.warn('[Sinapsis] Habia sesion de miembro en este navegador y ahora no hay ninguna: no se abre sesion de invitado para no pisarla.');
        return null;
    }
    if (typeof auth.signInAnonymously !== 'function') {
        _anonAuthFallo = true;
        console.warn('[Sinapsis] Este SDK no expone signInAnonymously: se sigue en modo lectura sin sesión.');
        return null;
    }
    _anonAuthPromesa = (async () => {
        try {
            const cred = await auth.signInAnonymously();
            return cred?.user || null;
        } catch (e) {
            _anonAuthFallo = true;
            console.warn('[Sinapsis] No se pudo abrir la sesión de invitado (' +
                (e?.code || e?.message || 'error desconocido') +
                '). ¿Está habilitado el proveedor Anónimo en la consola de Firebase?');
            return null;
        }
    })();
    return _anonAuthPromesa;
}

// Primer veredicto de Firebase sobre la sesión persistida. Hay que esperarlo
// ANTES de abrir una sesión anónima: al cargar la página `auth.currentUser` es
// null durante unos ms aunque haya un miembro con sesión guardada, y abrir el
// anónimo en ese hueco le REEMPLAZARÍA la sesión al miembro.
const _authResuelta = new Promise(resolve => {
    const off = auth.onAuthStateChanged(u => { off(); resolve(u); });
});

// ── Red de seguridad del arranque ───────────────────────────────────────────
// TODA pagina arranca dentro de un callback async de onAuthStateChanged, y
// ninguna (salvo el directorio, que ya se arreglo) captura sus excepciones: una
// lectura de Firestore que falla —lo normal en la red de un celular— deja la
// promesa rechazada sin dueño y la pagina a medio pintar, en silencio, sin que
// el usuario sepa si esperar o recargar. Se envuelve aqui, una vez, para que
// eso nunca vuelva a ser invisible en ninguna pagina (ni en las que se
// escriban despues).
function mostrarFalloDeCarga() {
    if (document.getElementById('aviso-carga')) return;
    const aviso = document.createElement('div');
    aviso.id = 'aviso-carga';
    aviso.className = 'fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-50 bg-white border border-red-200 rounded-superficie shadow-xl p-4 flex items-start gap-3';
    aviso.innerHTML =
        '<i class="ph-fill ph-warning-circle text-red-500 text-xl shrink-0"></i>' +
        '<div class="flex-1">' +
        '<p class="text-sm font-fuerte text-gray-900">No pudimos cargar esta página</p>' +
        '<p class="text-xs text-gray-600 mt-0.5">Suele ser la conexión. Vuelve a intentarlo.</p>' +
        '<button onclick="location.reload()" class="mt-2 px-3 py-2 bg-brand-600 text-white text-micro font-medio rounded-control">Reintentar</button>' +
        '</div>' +
        '<button onclick="this.parentElement.remove()" aria-label="Cerrar aviso" class="text-gray-400 p-1"><i class="ph ph-x"></i></button>';
    document.body.appendChild(aviso);
}
(function blindarArranque() {
    const original = auth.onAuthStateChanged.bind(auth);
    auth.onAuthStateChanged = function (cb, ...resto) {
        if (typeof cb !== 'function') return original(cb, ...resto);
        return original(async function (u) {
            try { return await cb.call(this, u); }
            catch (e) {
                console.error('[Sinapsis] el arranque de la página falló:', e);
                mostrarFalloDeCarga();
            }
        }, ...resto);
    };
})();

// Vigilancia central de "la sesion del miembro se cayo". Va aqui y no en cada
// pagina porque el directorio (y otras) normalizan el anonimo a "invitado" por
// su cuenta, sin pasar por hydrateAuthenticatedUser: puesto alli, este aviso no
// se enteraba nunca. Un anonimo en un navegador marcado como de miembro, o
// ninguna sesion habiendo marca, es exactamente el caso que hay que avisar.
auth.onAuthStateChanged(u => {
    if (!navegadorTuvoMiembro()) return;
    if (!u || u.isAnonymous) _sesionMiembroPerdida = true;
    else _sesionMiembroPerdida = false;
});

// Puerta de toda lectura que el invitado deba poder hacer. Desde 2026-07-29
// `alumni` exige sesión en las reglas, así que sin esto el visitante sin cuenta
// leería un directorio vacío (y en silencio: loadAlumni se traga el error).
// El disparo vive aquí y no en las páginas porque NINGUNA llamaba a
// iniciarSesionInvitado(): `watchAuth()` quedó definida y sin usar.
async function asegurarSesionParaLeer() {
    await _authResuelta;
    if (auth.currentUser) return;
    await iniciarSesionInvitado();
}
// Marca el estado de invitado a partir de una sesión anónima. Reusa la bandera
// state.guestMode que YA consultan messages/news/preparacion/icfes-engine, así
// que esas páginas siguen tratando al anónimo como invitado sin tocarlas.
function marcarInvitadoAnonimo(user) {
    state.guestMode = true;
    state.user = user || { uid: 'guest-view', displayName: 'Invitado' };
    try { sessionStorage.setItem('guestMode', 'true'); } catch (e) {}
}
// Envoltorio del listener de auth para TODA página que admita invitados.
// - Sin usuario: intenta la sesión anónima. Si arranca, el listener se vuelve a
//   disparar con el usuario anónimo y esta pasada termina aquí.
// - Con usuario anónimo: lo marca como invitado y llama al handler con null
//   como "miembro" (el handler recibe (user, miembro)).
// - Si la sesión anónima falla: llama al handler igual, con user = null.
function watchAuth(handler) {
    return auth.onAuthStateChanged(async (user) => {
        if (!user) {
            const anon = await iniciarSesionInvitado();
            if (anon) return; // vuelve por el listener con el usuario anónimo
            state.user = state.guestMode ? state.user : null;
            updateMemberNavVisibility();
            await handler(null, false);
            return;
        }
        if (user.isAnonymous) {
            marcarInvitadoAnonimo(user);
            updateMemberNavVisibility();
            await handler(user, false);
            return;
        }
        await handler(user, true);
    });
}

// ── Contacto privado (teléfono / correo de contacto) ─────────────────────────
// Se lee BAJO DEMANDA (al abrir un perfil), nunca en el listado masivo.
// El contacto PROPIO se pedía una vez por página (6 lecturas en el recorrido
// medido) y es un dato del usuario que no cambia mientras navega. Se cachea por
// uid durante la sesión de pestaña; el de OTROS egresados no se cachea, porque
// se pide al abrir su perfil y ahí sí interesa el dato del momento.
async function loadContactoPrivado(uid) {
    const vacio = { phone: '', contactEmail: '' };
    if (!uid) return vacio;
    // Un invitado anónimo no tiene permiso: ni se intenta (así no ensucia la
    // consola con permission-denied ni deja huecos en la UI).
    if (!esMiembro()) return vacio;
    const esPropio = uid === state.user?.uid;
    if (esPropio) {
        try {
            const c = JSON.parse(sessionStorage.getItem(CONTACTO_CACHE) || 'null');
            if (c && c.uid === uid) return { phone: c.phone || '', contactEmail: c.contactEmail || '' };
        } catch {}
    }
    try {
        const doc = await contactoPrivadoDoc(uid).get();
        const d = doc.exists ? (doc.data() || {}) : {};
        const salida = { phone: d.phone || '', contactEmail: d.contactEmail || '' };
        // Se cachea aunque venga vacío: el documento que no existe también se
        // factura, y volver a preguntarlo en cada página cuesta lo mismo.
        if (esPropio) { try { sessionStorage.setItem(CONTACTO_CACHE, JSON.stringify({ uid, ...salida })); } catch {} }
        return salida;
    } catch (e) { return vacio; }
}
async function saveContactoPrivado(uid, { phone, contactEmail } = {}) {
    if (!uid) return;
    const payload = { updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
    if (phone !== undefined) payload.phone = String(phone || '').trim();
    if (contactEmail !== undefined) payload.contactEmail = String(contactEmail || '').trim().toLowerCase();
    await contactoPrivadoDoc(uid).set(payload, { merge: true });
    // Sin esto, guardar el teléfono y volver al perfil mostraría el anterior:
    // la caché tiene que morir donde se escribe, no solo por tiempo.
    try { sessionStorage.removeItem(CONTACTO_CACHE); } catch {}
}

function getDisplayNameFromProfileOrAuth() {
    return `${state.profile.firstName||''} ${state.profile.lastName||''}`.trim()||state.user?.displayName||'Usuario';
}
function getUserAvatarUrl() { return state.profile.photoURL||buildAvatarUrl(getDisplayNameFromProfileOrAuth()); }
function refreshHeaderIdentity() {
    const name=getDisplayNameFromProfileOrAuth()||state.profile.username||state.user?.displayName||state.user?.email?.split('@')[0]||'Usuario';
    const avatar=state.profile.photoURL||state.user?.photoURL||buildAvatarUrl(name);
    const el=document.getElementById('header-avatar'); const tr=document.getElementById('profile-menu-trigger');
    if(el) el.src=avatar; if(tr) tr.title=`Perfil de ${name}`;
}
// Solo correo EXACTO: los prefijos ('juanda.fonsecag@...') eran falsificables
// registrando ese usuario con otro dominio. Debe coincidir con isSuperAdmin()
// de docs/firestore.rules, que es la frontera real (esto solo decide la UI).
function isAdminUser() {
    const e=String(state.user?.email||'').toLowerCase().trim();
    return [state.adminEmail,'juanda.fonsecag@gmail.com'].includes(e);
}
const AUTH_ERROR_MESSAGES={'auth/user-not-found':'No existe la cuenta.','auth/wrong-password':'La contraseña es incorrecta.','auth/invalid-credential':'Correo o contraseña incorrectos.','auth/invalid-email':'El correo no tiene un formato válido.','auth/email-already-in-use':'Ese correo ya está registrado.','auth/weak-password':'La contraseña es muy débil.','auth/popup-closed-by-user':'Cerraste la ventana de Google antes de terminar.','auth/cancelled-popup-request':'Se canceló la solicitud con Google.','auth/network-request-failed':'No hay conexión a internet. Intenta nuevamente.'};
function getFriendlyAuthError(e,fb='Ocurrió un error.') { return AUTH_ERROR_MESSAGES[e?.code]||fb; }

async function loadAdminRole(uid) {
    if (isAdminUser()) { state.adminRole='superadmin'; state.adminSchool=null; return; }
    try {
        const doc=await adminsCollection.doc(uid).get();
        const data = doc.exists ? doc.data() : null;
        if (doc.exists && data.role==='subadmin' && data.enabled !== false) {
            state.adminRole='subadmin'; state.adminSchool=data.school||null;
        } else { state.adminRole=null; state.adminSchool=null; }
    } catch(e) { state.adminRole=null; state.adminSchool=null; }
}
function canAccessAdmin() { return isAdminUser()||state.adminRole==='subadmin'; }

// Muestra/oculta lo que es SOLO DE MIEMBROS (Mensajes, avatar, "Mi perfil") y
// lo que es SOLO DE INVITADOS (Entrar / Crear cuenta). Se llama al pintar la
// nav y cada vez que cambia el estado de auth: al pintar todavia no se sabe si
// hay sesion, asi que la nav arranca en modo invitado y se completa despues.
function updateMemberNavVisibility() {
    const miembro = esMiembro();
    document.querySelectorAll('.solo-miembro').forEach(el => el.classList.toggle('hidden', !miembro));
    document.querySelectorAll('.solo-invitado').forEach(el => el.classList.toggle('hidden', miembro));
    // La barra movil es una grilla de N columnas fijas: si se ocultan items sin
    // recalcularla, quedan huecos. Se ajusta al numero de items visibles.
    const mob = document.getElementById('mobile-nav');
    if (mob) {
        const visibles = Array.from(mob.children).filter(el => !el.classList.contains('hidden')).length;
        mob.style.gridTemplateColumns = `repeat(${visibles || 1}, minmax(0, 1fr))`;
    }
}
function updateAdminNavVisibility() {
    const adminBtn = document.getElementById('nav-admin');
    if (!adminBtn) return;
    if (canAccessAdmin()) adminBtn.classList.remove('hidden');
    else adminBtn.classList.add('hidden');
}
async function hydrateAuthenticatedUser(user, { redirectOnboarding = false } = {}) {
    if (!user) return false;
    // Un usuario ANÓNIMO no tiene perfil, ni colegio, ni rol de admin: pedirle
    // loadProfile/ensureDefaultSchool/loadAdminRole crearía documentos vacíos y
    // lo mandaría al onboarding de una cuenta que no existe.
    if (user.isAnonymous) {
        // Anonimo en un navegador que tenia miembro = la sesion se perdio (o la
        // piso una anonima vieja). No disfrazarlo de visita: hay que decirlo.
        if (navegadorTuvoMiembro()) _sesionMiembroPerdida = true;
        marcarInvitadoAnonimo(user);
        updateAdminNavVisibility();
        updateMemberNavVisibility();
        return false;
    }
    state.guestMode = false;
    sessionStorage.removeItem('guestMode');
    marcarNavegadorConMiembro();
    _sesionMiembroPerdida = false;
    state.user = user;
    // ⚠️ Estas tres lecturas NO pueden tumbar el arranque de la pagina. Antes
    // iban sueltas: si loadProfile fallaba (una red movil que parpadea basta),
    // la excepcion mataba el callback de onAuthStateChanged y la pagina se
    // quedaba con el directorio vacio o con los esqueletos girando para
    // siempre, sin un solo mensaje. El sintoma que reporto Juan.
    let perfilOk = true;
    try { await loadProfile(user.uid); }
    catch (e) { perfilOk = false; console.warn('[Sinapsis] No se pudo leer el perfil:', e?.code || e?.message || e); }
    try { await ensureDefaultSchool(user.uid); }
    catch (e) { console.warn('[Sinapsis] No se pudo asegurar el colegio:', e?.code || e?.message || e); }
    await loadAdminRole(user.uid);
    updateAdminNavVisibility();
    updateMemberNavVisibility();
    refreshHeaderIdentity();
    // Sin perfil leido, onboardingCompleted es el `false` del objeto vacio: si
    // se redirige, se manda al onboarding a alguien que ya lo hizo hace meses.
    if (redirectOnboarding && perfilOk && !state.profile.onboardingCompleted && !window.location.pathname.endsWith('/onboarding.html')) {
        goto('onboarding');
        return false;
    }
    return true;
}
async function loadSubAdmins() {
    try { const s=await adminsCollection.get(); state.data.subAdmins=s.docs.map(d=>({uid:d.id,...d.data()})); }
    catch(e) { state.data.subAdmins=[]; }
}

// Un tropiezo de red en el celular no puede costar la sesion visible: se
// reintenta una vez antes de dar la lectura por perdida.
async function conReintento(fn, intentos = 2, esperaMs = 700) {
    let ultimo;
    for (let i = 0; i < intentos; i++) {
        try { return await fn(); }
        catch (e) { ultimo = e; if (i < intentos - 1) await new Promise(r => setTimeout(r, esperaMs)); }
    }
    throw ultimo;
}

// El perfil propio se leía una vez por página (5 lecturas en el recorrido
// medido) y no cambia mientras se navega. Se cachea el objeto `state.profile`
// ya montado; cualquier escritura bajo `alumni/` lo tira.
async function loadProfile(uid) {
    const guardado = _cacheLeer(PERFIL_CACHE, uid);
    if (guardado) { state.profile = guardado; refreshHeaderIdentity(); return; }
    const doc=await conReintento(()=>alumniCollection.doc(uid).get());
    if(!doc.exists){ state.profile={firstName:state.user?.displayName?.split(' ')[0]||'',lastName:state.user?.displayName?.split(' ').slice(1).join(' ')||'',graduationYear:'',location:'',status:'trabajando',role:'',area:'',studies:'',bio:'',skills:'',topics:'',expectations:'',phone:'',linkedin:'',photoURL:state.user?.photoURL||'',school:DEFAULT_SCHOOL,username:'',onboardingCompleted:false}; refreshHeaderIdentity(); return; }
    const d=doc.data();
    // OJO: d.phone / d.contactEmail son RESIDUO de antes del cierre del
    // directorio (perfiles que aún no pasó la migración). La fuente de verdad
    // es alumni/{uid}/privado/contacto, que se lee justo abajo y pisa esto.
    state.profile={firstName:d.firstName||'',lastName:d.lastName||'',graduationYear:d.graduationYear||'',location:d.location||'',status:d.status||'trabajando',role:d.role||'',area:d.area||'',studies:d.studies||'',bio:d.bio||'',skills:Array.isArray(d.skills)?d.skills.join(', '):(d.skills||''),topics:d.topics||'',expectations:d.expectations||'',phone:d.phone||'',linkedin:d.linkedin||'',photoURL:d.photoURL||'',school:d.school||DEFAULT_SCHOOL,username:d.username||'',onboardingCompleted:d.onboardingCompleted||false};
    const contacto = await loadContactoPrivado(uid);
    if (contacto.phone) state.profile.phone = contacto.phone;
    state.profile.contactEmail = contacto.contactEmail || d.contactEmail || '';
    // Se guarda DESPUÉS del contacto privado: si se cacheara antes, la siguiente
    // página mostraría el perfil sin teléfono ni correo de contacto.
    _cacheEscribir(PERFIL_CACHE, state.profile, uid);
    refreshHeaderIdentity();
}
async function ensureDefaultSchool(uid) {
    if (!uid || !esMiembro() || state.profile.school) return;
    state.profile.school = DEFAULT_SCHOOL;
    await alumniCollection.doc(uid).set({ school: DEFAULT_SCHOOL, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
}
// Listado del directorio. NO trae `phone` ni `contactEmail`: ese par vive ahora
// en alumni/{uid}/privado/contacto y se pide BAJO DEMANDA al abrir un perfil
// (loadContactoPrivado), solo si esMiembro(). Antes viajaban aquí, y como este
// listado es un `list` de una colección de lectura pública, cualquiera podía
// volcar por REST el teléfono y el correo de los 68 egresados sin login.
// Consecuencia buscada: `user.phone` no existe en los objetos del directorio.
// ── Caché del directorio (lo que de verdad cuesta) ──────────────────────────
// Medido en producción el 2026-08-01 con el medidor de arriba: un recorrido de
// 5 páginas costaba 252 documentos, y **204 de ellos eran esta colección** — el
// 81 %. Dos causas, las dos aquí:
//   · La PORTADA la leía DOS VECES: una en su arranque y otra desde
//     `historiasLogic.init(true)`, cuyo throttle de 30 s no puede funcionar
//     porque `_lastLoad` vive en memoria y cada página es un HTML nuevo, así
//     que siempre está "vencido". 136 documentos para pintar 4 historias.
//   · Cada página vuelve a leerla entera. Sinapsis no es una SPA: ir de la
//     portada al directorio son dos cargas completas, y el directorio releía
//     lo que la portada acababa de traer.
//
// Se arregla en UN sitio, no en cada llamador: quien pida el directorio dos
// veces seguidas recibe la misma lectura. `sessionStorage` y no `localStorage`
// a propósito — la caché muere al cerrar la pestaña, así que nadie se queda
// con un directorio viejo de ayer.
//
// Quien necesite datos frescos de verdad (el admin tras editar un perfil) pide
// `{ forzar: true }`, igual que en loadNews.
const ALUMNI_CACHE = 'sinapsis_alumni_cache';
const ALUMNI_TTL_MS = 300000;   // 5 min: sobra para una sesión de navegación
let _alumniEnVuelo = null;

function _alumniDesdeCache() {
    try {
        const c = JSON.parse(sessionStorage.getItem(ALUMNI_CACHE) || 'null');
        if (!c || Date.now() - c.t > ALUMNI_TTL_MS || !Array.isArray(c.datos)) return null;
        return c.datos;
    } catch { return null; }
}
function _guardarAlumniEnCache(datos) {
    try { sessionStorage.setItem(ALUMNI_CACHE, JSON.stringify({ t: Date.now(), datos })); }
    catch { /* cuota llena: se sigue sin caché, no es un error que deba verse */ }
}
// Todo lo que se deriva de `alumni` caduca junto: el listado, los hitos y el
// perfil propio. Una sola función, para que invalidar no sea una lista que
// alguien pueda dejar incompleta.
const CONTACTO_CACHE = 'sinapsis_contacto_propio';
const HITOS_CACHE = 'sinapsis_hitos_cache';
const PERFIL_CACHE = 'sinapsis_perfil_propio';
function invalidarCacheAlumni() {
    for (const k of [ALUMNI_CACHE, HITOS_CACHE, PERFIL_CACHE, CONTACTO_CACHE]) {
        try { sessionStorage.removeItem(k); } catch {}
    }
}

// Caché con TTL sobre sessionStorage, para lo que se releía en cada página.
function _cacheLeer(clave, subclave) {
    try {
        const c = JSON.parse(sessionStorage.getItem(clave) || 'null');
        if (!c || Date.now() - c.t > ALUMNI_TTL_MS) return null;
        return subclave ? (subclave in (c.datos || {}) ? c.datos[subclave] : null) : c.datos;
    } catch { return null; }
}
function _cacheEscribir(clave, valor, subclave) {
    try {
        if (!subclave) { sessionStorage.setItem(clave, JSON.stringify({ t: Date.now(), datos: valor })); return; }
        const c = JSON.parse(sessionStorage.getItem(clave) || 'null');
        const datos = (c && Date.now() - c.t <= ALUMNI_TTL_MS) ? (c.datos || {}) : {};
        datos[subclave] = valor;
        sessionStorage.setItem(clave, JSON.stringify({ t: c?.t || Date.now(), datos }));
    } catch {}
}

// La caché se invalida sola cuando alguien ESCRIBE en alumni, envolviendo el
// prototipo — no pidiéndole a los 8 sitios que escriben (admin, onboarding,
// perfil, registro, migración…) que se acuerden de llamar a la invalidación.
// Una caché que depende de que nadie olvide una línea acaba sirviendo datos
// viejos: aquí el suspendido seguiría apareciendo activo hasta 5 minutos.
(function autoInvalidarAlumni() {
    const D = firebase.firestore.DocumentReference;
    if (!D?.prototype || D.prototype._invalidaAlumni) return;
    for (const metodo of ['set', 'update', 'delete']) {
        const original = D.prototype[metodo];
        if (typeof original !== 'function') continue;
        D.prototype[metodo] = function (...args) {
            // `/alumni/xxx` sí; `/alumni/xxx/hitos/yyy` también (cambia hitosCount).
            if (/(^|\/)alumni\//.test(this.path || '')) invalidarCacheAlumni();
            return original.apply(this, args);
        };
    }
    D.prototype._invalidaAlumni = true;
})();

async function loadAlumni({ forzar = false } = {}) {
    if (!forzar) {
        const cache = _alumniDesdeCache();
        if (cache) { state.data.alumni = cache; state.directoryLoading = false; state.directoryError = null; return; }
        if (_alumniEnVuelo) return _alumniEnVuelo;   // dos llamadas a la vez = una sola lectura
    }
    _alumniEnVuelo = _loadAlumniDeVerdad().finally(() => { _alumniEnVuelo = null; });
    return _alumniEnVuelo;
}

async function _loadAlumniDeVerdad() {
    state.directoryLoading=true;
    state.directoryError=null;
    // El invitado necesita sesión (anónima) para que las reglas le dejen listar.
    await asegurarSesionParaLeer();
    try {
        const snap=await conReintento(()=>alumniCollection.get());
        state.data.alumni=snap.docs.map(doc=>{const d=doc.data();const user={id:doc.id,name:`${d.firstName||''} ${d.lastName||''}`.trim()||'Sin nombre',firstName:(d.firstName||'').trim(),lastName:(d.lastName||'').trim(),email:d.email||'',username:d.username||'',newsletterOptIn:Boolean(d.newsletterOptIn),role:d.role||'Sin rol',status:d.status||'sin-definir',statusLabel:formatStatusLabel(d.status),accountStatus:d.accountStatus||'activo',company:d.studies||formatStatusLabel(d.status),photoURL:d.photoURL||'',img:d.photoURL||buildAvatarUrl(`${d.firstName||'Usuario'} ${d.lastName||''}`.trim()),tags:[d.school||DEFAULT_SCHOOL,d.area||'General',formatStatusLabel(d.status)].filter(Boolean),fullStudies:d.studies||'No especificado',location:d.location||'Ubicación no disponible',bio:d.bio||'Sin biografía disponible.',year:d.graduationYear||'---',area:d.area||'General',skills:Array.isArray(d.skills)?d.skills:(d.skills?String(d.skills).split(','):[]),linkedin:d.linkedin||'',expectations:d.expectations||'',school:d.school||DEFAULT_SCHOOL,hitosCount:Number(d.hitosCount)||0,rutaDestacada:Boolean(d.rutaDestacada),graduationYear:d.graduationYear||'',studies:d.studies||''};return{...user,profileCompleteness:getProfileCompletenessScore(user)};}).filter(a=>hasValidFirstName(a.firstName));
    } catch(e){
        // Antes esto se tragaba el error y el directorio salia VACIO como si la
        // red no tuviera a nadie. Ahora queda constancia para que la pagina lo
        // diga y ofrezca reintentar (el 90% de las veces es la red del celular).
        state.directoryError = e?.code || e?.message || 'error-desconocido';
        console.warn('[Sinapsis] No se pudo cargar el directorio:', state.directoryError);
        state.data.alumni=state.data.alumni.length?state.data.alumni:[];
    }
    finally{ state.directoryLoading=false; }
    // Solo se cachea lo que se leyó BIEN: si falló, la próxima página debe
    // reintentar contra Firestore, no heredar un directorio vacío.
    if (!state.directoryError && state.data.alumni.length) _guardarAlumniEnCache(state.data.alumni);
}
// `index.html` la llamaba DOS veces por carga —una en DOMContentLoaded, para que
// el invitado vea las noticias sin esperar a la autenticación, y otra dentro del
// arranque autenticado— y cada una se traía la colección entera. No sobra
// ninguna de las dos llamadas: sobra la segunda LECTURA.
//
// Se resuelve reusando la carga reciente en vez de borrar una llamada: así
// tampoco duele si mañana alguien añade una tercera. Quien de verdad necesita
// datos frescos —el admin, tras publicar o borrar— pide `{ forzar: true }`.
// El TTL es corto a propósito: esto deduplica el arranque de UNA página, no
// pretende ser una caché entre páginas (eso se decidirá con el medidor).
let _newsCargadas = 0, _newsEnVuelo = null;
const NEWS_TTL_MS = 30000;
async function loadNews({ forzar = false } = {}) {
    if (!forzar && _newsEnVuelo) return _newsEnVuelo;
    if (!forzar && state.data.news?.length && Date.now() - _newsCargadas < NEWS_TTL_MS) return;
    _newsEnVuelo = (async () => {
        try {
            const s=await newsCollection.orderBy('createdAt','desc').get(); state.data.news=s.docs.map(doc=>{const d=doc.data();return{id:doc.id,title:d.title||'Sin título',category:d.category||'Noticia',date:formatNewsDate(d.createdAt),summary:d.summary||'',img:d.img||'https://placehold.co/600x400/7e22ce/FFF?text=Noticia',audiencia:d.audiencia||'todos'};});
            _newsCargadas = Date.now();
        } catch(e){}
        finally { _newsEnVuelo = null; }
    })();
    return _newsEnVuelo;
}
async function loadChatsForUser(uid) {
    try { const s=await userChatsCollection(uid).orderBy('updatedAt','desc').get(); state.data.chats=s.docs.map(doc=>{const d=doc.data();return{id:doc.id,peerId:d.peerId||'',name:d.peerName||'Usuario',img:d.peerPhotoURL||buildAvatarUrl(d.peerName||'Usuario'),lastMsg:d.lastMsg||'Sin mensajes',time:formatChatTime(d.updatedAt)};}); } catch(e){ state.data.chats=[]; }
}
async function loadMessagesForChat(uid,chatId) {
    try { const s=await userChatMessagesCollection(uid,chatId).orderBy('createdAt','asc').get(); state.messagesByChat[chatId]=s.docs.map(doc=>{const d=doc.data();return{text:d.text||'',sender:d.senderId===uid?'me':'them',createdAt:d.createdAt};}); } catch(e){ state.messagesByChat[chatId]=[]; }
}
function watchChatsInRealtime(uid) {
    if(state.listeners.chats) state.listeners.chats();
    state.listeners.chats=userChatsCollection(uid).orderBy('updatedAt','desc').onSnapshot(snap=>{
        state.data.chats=snap.docs.map(doc=>{const d=doc.data();return{id:doc.id,peerId:d.peerId||'',name:d.peerName||'Usuario',img:d.peerPhotoURL||buildAvatarUrl(d.peerName||'Usuario'),lastMsg:d.lastMsg||'Sin mensajes',time:formatChatTime(d.updatedAt)};});
        // No basta con que chatLogic exista: index.html define una version
        // PARCIAL (solo para abrir un chat desde el directorio) que no tiene
        // renderList ni el DOM de la bandeja. Comprobar la funcion concreta,
        // no el objeto: asi este listener nunca vuelve a reventar en una
        // pagina que no muestra chats.
        if(typeof chatLogic!=='undefined'&&typeof chatLogic.renderList==='function') chatLogic.renderList();
    },()=>{ state.data.chats=[]; if(typeof chatLogic!=='undefined'&&typeof chatLogic.renderList==='function') chatLogic.renderList(); });
}
function watchMessagesInRealtime(uid,chatId) {
    if(state.listeners.messages) state.listeners.messages();
    state.listeners.messages=userChatMessagesCollection(uid,chatId).orderBy('createdAt','asc').onSnapshot(snap=>{
        state.messagesByChat[chatId]=snap.docs.map(doc=>{const d=doc.data();return{text:d.text||'',sender:d.senderId===uid?'me':'them',createdAt:d.createdAt};});
        if(String(state.activeChatId)===String(chatId)&&typeof chatLogic!=='undefined') chatLogic.openChat(chatId,{preserveListener:true});
    },()=>{ state.messagesByChat[chatId]=[]; });
}

function goto(page) {
    const m={home:'index.html',auth:'login.html',login:'login.html',register:'register.html',terms:'terms.html',onboarding:'onboarding.html',directory:'directory.html',news:'news.html',messages:'messages.html',profile:'profile.html',admin:'admin.html','exam-modules':'preparacion.html',preparacion:'preparacion.html'};
    window.location.href=m[page]||'index.html';
}

function renderNav(activePage='') {
    document.getElementById('theme-floating-toggle')?.remove();
    const active=(id)=>activePage===id?'text-brand-600 bg-brand-50 px-3 py-1 rounded-control':'text-gray-500 hover:text-brand-600';
    const mactive=(id)=>activePage===id?'text-brand-600':'text-gray-500';
    document.body.insertAdjacentHTML('afterbegin', `
        <nav class="glass-nav fixed w-full z-40 top-0 h-16 flex items-center justify-between px-4 lg:px-8 shadow-sm">
            <a href="index.html" class="flex items-center gap-3">
                <svg viewBox="0 0 32 32" role="img" aria-label="Sinapsis" class="w-9 h-9 shrink-0"><defs><linearGradient id="neuro-nav" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22c55e"/><stop offset="1" stop-color="#15803d"/></linearGradient></defs><g fill="none" stroke="#16a34a" stroke-width="1.5" stroke-linecap="round" opacity=".85"><path d="M13.6 12.6 L9.4 5.6 M11 15 L3.6 12.2 M12.4 19.6 L6.6 25.4 M17.6 19.8 L21.4 26.4 M19.4 14.6 L27.4 11.4 M18.2 12.2 L22.6 6.2"/></g><g fill="none" stroke="#86efac" stroke-width="1.1" stroke-linecap="round" opacity=".7"><path d="M9.4 5.6 L3.6 12.2 M21.4 26.4 L27.4 11.4 M3.6 12.2 L6.6 25.4"/></g><circle cx="15.6" cy="16.2" r="5" fill="url(#neuro-nav)"/><circle cx="15.6" cy="16.2" r="2" fill="#dcfce7"/><g fill="#16a34a"><circle cx="9" cy="4.6" r="2"/><circle cx="2.8" cy="11.8" r="2"/><circle cx="6" cy="26.2" r="2"/><circle cx="21.9" cy="27.4" r="2"/><circle cx="28.4" cy="11" r="2"/><circle cx="23.2" cy="5.4" r="2"/></g></svg>
                <span class="font-fuerte text-xl tracking-tight text-gray-900">Sinap<span class="text-brand-600">sis</span></span>
            </a>
            <div class="hidden md:flex items-center gap-6" id="nav-links">
                <a href="index.html" class="font-medium transition ${active('home')}" id="nav-home">Ecosistema</a>
                <a href="directory.html" class="font-medium transition ${active('directory')}" id="nav-dir">Comunidad</a>
                <a href="news.html" class="font-medium transition ${active('news')}" id="nav-news">Novedades</a>
                <a href="preparacion.html" class="font-medium transition ${active('exam-modules')}" id="nav-exams">Preparación</a>
                <a href="messages.html" class="solo-miembro hidden font-medium transition ${active('messages')}" id="nav-msg">Mensajes</a>
                <a href="admin.html" class="hidden font-medium transition ${active('admin')}" id="nav-admin">Admin</a>
            </div>
            <div class="flex items-center gap-2">
                <button type="button" class="theme-toggle" data-theme-toggle onclick="toggleThemeMode()" aria-label="Cambiar tema"></button>
                <a href="profile.html" id="profile-menu-trigger" class="solo-miembro hidden h-10 w-10 rounded-full bg-brand-50 overflow-hidden ring-2 ring-transparent hover:ring-brand-300 transition-all shadow-sm" title="Ver perfil">
                    <img src="https://ui-avatars.com/api/?name=Usuario&background=22c55e&color=fff" alt="Perfil" class="object-cover w-full h-full" id="header-avatar">
                </a>
                <a href="profile.html" class="solo-miembro hidden md:flex items-center gap-1 text-xs text-gray-500 font-semibold hover:text-brand-600 transition px-2 py-1 rounded-control hover:bg-brand-50"><span>Mi perfil</span><i class="ph-bold ph-caret-down"></i></a>
                <a href="login.html" id="nav-login" class="solo-invitado hidden inline-flex items-center gap-1 text-micro font-medio text-gray-600 hover:text-brand-700 transition px-3 py-2 rounded-control border border-gray-200 bg-white hover:bg-brand-50"><i class="ph-bold ph-sign-in"></i><span>Entrar</span></a>
                <a href="register.html" id="nav-register" class="solo-invitado hidden md:flex items-center gap-1 text-micro font-medio text-white bg-brand-600 hover:bg-brand-700 transition px-3 py-2 rounded-control shadow-sm"><span>Crear cuenta</span></a>
            </div>
        </nav>
        <nav id="mobile-nav" class="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-t border-gray-200 grid grid-cols-6">
            <a href="index.html" class="py-3 text-micro font-medio flex flex-col items-center gap-1 ${mactive('home')}"><i class="ph ph-house text-lg"></i><span>Inicio</span></a>
            <a href="directory.html" class="py-3 text-micro font-medio flex flex-col items-center gap-1 ${mactive('directory')}"><i class="ph ph-users text-lg"></i><span>Directorio</span></a>
            <a href="news.html" class="py-3 text-micro font-medio flex flex-col items-center gap-1 ${mactive('news')}"><i class="ph ph-newspaper text-lg"></i><span>Novedades</span></a>
            <a href="preparacion.html" class="py-3 text-micro font-medio flex flex-col items-center gap-1 ${mactive('exam-modules')}"><i class="ph ph-graduation-cap text-lg"></i><span>Prep.</span></a>
            <a href="messages.html" class="solo-miembro hidden py-3 text-micro font-medio flex flex-col items-center gap-1 ${mactive('messages')}"><i class="ph ph-chats-circle text-lg"></i><span>Mensajes</span></a>
            <a href="profile.html" class="solo-miembro hidden py-3 text-micro font-medio flex flex-col items-center gap-1 ${mactive('profile')}"><i class="ph ph-user-circle text-lg"></i><span>Perfil</span></a>
            <a href="login.html" class="solo-invitado hidden py-3 text-micro font-medio flex flex-col items-center gap-1 text-gray-500"><i class="ph ph-sign-in text-lg"></i><span>Entrar</span></a>
        </nav>
    `);
    // La nav se pinta antes de que resuelva onAuthStateChanged: arranca en modo
    // invitado (todo .solo-miembro oculto) y el listener la completa. Asi un
    // invitado nunca alcanza a ver "Mi perfil" ni Mensajes parpadeando.
    updateMemberNavVisibility();
    setThemeMode(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
}
