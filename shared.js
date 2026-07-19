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
// Analytics (evidencia de uso para la investigación): registra vistas por página.
try { if (firebase.analytics) firebase.analytics(); } catch (e) {}
const auth = firebase.auth();
const db = firebase.firestore();
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
const hitosCollection = (uid) => alumniCollection.doc(uid).collection('hitos');
// Resultados de práctica de idiomas (TOEFL/DELF). Subcolección del alumno, como
// los hitos, PERO privada: son datos personales del estudiante (progreso), así
// que las reglas solo dejan leerlos al dueño y a los admins de su colegio.
const examResultsCollection = (uid) => alumniCollection.doc(uid).collection('examResults');
const userChatsCollection = (uid) => artifactsRoot.collection('users').doc(uid).collection('chats');
const userChatMessagesCollection = (uid, chatId) => userChatsCollection(uid).doc(chatId).collection('messages');

const DEFAULT_SCHOOL = 'LCP';
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
        [isValidPhone(user.phone) ? user.phone : '', 5],
        [isValidLinkedInUrl(user.linkedin) ? user.linkedin : '', 5],
        [user.photoURL, 5],
        [Number(user.hitosCount) > 0 ? 'ruta' : '', 8],
        [Number(user.hitosCount) >= 3 ? 'ruta-completa' : '', 6]
    ];
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
    const school = (!state.guestMode && state.profile?.school) ? state.profile.school : DEFAULT_SCHOOL;
    const colegio = await getColegio(school);
    return (colegio && colegio.modulos) ? { ...MODULOS_DEFAULT, ...colegio.modulos } : { ...MODULOS_DEFAULT };
}
// Filtra novedades según la audiencia: 'todos' para cualquiera; las dirigidas
// a un colegio solo las ve quien tiene ese tag (los invitados ven solo 'todos').
function newsVisiblesParaUsuario(items = []) {
    const school = (!state.guestMode && state.profile?.school) ? state.profile.school : '';
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
async function loadHitos(uid) {
    if (!uid) return [];
    try {
        const snap = await hitosCollection(uid).get();
        return sortHitos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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
        if (!state.user || state.guestMode || state.user.uid === 'guest-view') return;
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
function renderExamResultsHTML(results) {
    if (!results || !results.length) {
        return `<p class="text-sm text-gray-400 italic">Sin prácticas registradas todavía.</p>`;
    }
    return `<div class="space-y-2">${results.map(r => {
        const examTag = r.exam === 'DELF'
            ? 'bg-purple-100 text-purple-700'
            : 'bg-blue-100 text-blue-700';
        const examName = r.exam === 'DELF' ? 'DELF B1' : 'TOEFL';
        const sec = EXAM_SECTION_LABEL[r.section] || r.section || '';
        let fecha = '';
        try {
            const d = r.createdAt?.toDate ? r.createdAt.toDate() : (r.createdAt ? new Date(r.createdAt) : null);
            if (d) fecha = d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch (e) {}
        return `
            <div class="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-2.5">
                <div class="min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="px-2 py-0.5 rounded-md text-[11px] font-extrabold ${examTag}">${sanitizeHTML(examName)}</span>
                        <span class="text-sm font-bold text-gray-800">${sanitizeHTML(sec)}</span>
                    </div>
                    ${fecha ? `<p class="text-[11px] text-gray-400 mt-0.5">${sanitizeHTML(fecha)}</p>` : ''}
                </div>
                <span class="shrink-0 text-lg font-extrabold text-gray-900">${sanitizeHTML(String(r.score))}<span class="text-xs text-gray-400 font-bold">${sanitizeHTML(r.scale || '')}</span></span>
            </div>`;
    }).join('')}</div>`;
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
                <button type="button" onclick="${editorNS}.editHito('${sanitizeHTML(h.id)}')" class="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition" title="Editar hito"><i class="ph-bold ph-pencil-simple"></i></button>
                <button type="button" onclick="${editorNS}.removeHito('${sanitizeHTML(h.id)}')" class="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition" title="Eliminar hito"><i class="ph-bold ph-trash"></i></button>
            </span>` : '';
        return `
        <li class="relative flex gap-4 ${i < last ? 'pb-2' : ''}">
            <div class="flex flex-col items-center shrink-0">
                <span class="relative z-10 w-11 h-11 rounded-2xl flex items-center justify-center text-xl shadow-sm ${h.actual ? 'bg-brand-600 text-white shadow-brand-600/30' : 'bg-white text-brand-600 border border-brand-100'}">
                    <i class="ph-duotone ${info.icon}"></i>
                    ${h.actual ? '<span class="absolute -top-1 -right-1 flex h-3 w-3"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span><span class="relative inline-flex rounded-full h-3 w-3 bg-brand-500 border-2 border-white"></span></span>' : ''}
                </span>
                ${i < last ? '<span class="w-0.5 flex-1 my-1 rounded-full bg-gradient-to-b from-brand-300 to-brand-100"></span>' : ''}
            </div>
            <div class="min-w-0 flex-1 pb-5">
                <div class="rounded-2xl border ${h.actual ? 'border-brand-100 bg-brand-50' : 'border-gray-100 bg-white'} px-4 py-3 shadow-sm hover:shadow-md transition group/hito">
                    <div class="flex items-start justify-between gap-2">
                        <div class="min-w-0">
                            <div class="flex items-center gap-2 flex-wrap mb-0.5">
                                <span class="text-[11px] font-bold uppercase tracking-widest text-brand-600">${sanitizeHTML(info.label)}</span>
                                ${h.actual ? '<span class="text-[10px] font-bold px-2 py-0.5 bg-brand-600 text-white rounded-full uppercase tracking-wide">Hoy</span>' : ''}
                            </div>
                            <p class="font-bold text-gray-900 leading-snug">${sanitizeHTML(h.organizacion || h.rol || 'Sin detalle')}</p>
                            ${h.organizacion && h.rol ? `<p class="text-sm text-gray-500 leading-snug">${sanitizeHTML(h.rol)}</p>` : ''}
                            ${h.descripcion ? `<p class="text-xs text-gray-400 mt-1.5 leading-relaxed">${sanitizeHTML(h.descripcion)}</p>` : ''}
                        </div>
                        <div class="flex flex-col items-end gap-1 shrink-0">
                            ${years ? `<span class="text-[11px] font-bold px-2 py-1 rounded-lg bg-gray-50 border border-gray-100 text-gray-500 whitespace-nowrap">${sanitizeHTML(years)}</span>` : ''}
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
        const EMOJI = { colegio: '🎓', educacion: '📚', practica: '🧪', empleo: '💼', emprendimiento: '🚀', logro: '🏆' };
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
            ctx.font = '34px "Segoe UI Emoji", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(EMOJI[h.tipo] || '📍', lineX, y + 12);
            ctx.textAlign = 'left';

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
        ctx.fillText('Mi ruta también empezó en el Liceo 🌱', 70, H - FOOTER + 46);
        ctx.fillStyle = '#4b5563';
        ctx.font = '500 22px "Plus Jakarta Sans", "Segoe UI", sans-serif';
        ctx.fillText('Únete a la red: fonseca707.github.io/Red-egresados', 70, H - FOOTER + 82);

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
    if (!state.user || state.guestMode) return;
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
        banner.className = 'fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100vw-2rem)] max-w-md bg-white rounded-2xl border border-gray-200 shadow-2xl p-4 animate-slide-up';
        banner.innerHTML = `
            <div class="flex items-start gap-3">
                <div class="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 border border-brand-100 flex items-center justify-center text-xl shrink-0"><i class="ph-duotone ph-path"></i></div>
                <div class="min-w-0 flex-1">
                    <p class="text-sm font-bold text-gray-900">¿Sigues en ${sanitizeHTML(etiqueta)}?</p>
                    <p class="text-xs text-gray-500 mt-0.5">Tu ruta lleva un tiempo sin actualizarse.</p>
                    <div class="flex gap-2 mt-3">
                        <button onclick="confirmarPulso('${sanitizeHTML(abierto.id)}')" class="px-4 py-2 bg-brand-600 text-white text-xs font-bold rounded-lg hover:bg-brand-700 transition">Sí, sigo ahí</button>
                        <a href="profile.html" class="px-4 py-2 bg-gray-50 border border-gray-200 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-100 transition">Actualizar mi ruta</a>
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
        b.innerHTML = '<p class="text-sm font-bold text-brand-700 text-center py-1"><i class="ph-bold ph-check-circle"></i> Gracias, tu ruta quedó al día.</p>';
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
    directoryLoading:false, directoryPage:1, adminEmail:'juanda.fonsecag@gmail.com', adminTab:'users', editingNewsId:null,
    adminRole: null, adminSchool: null,
    listeners: { chats:null, messages:null }
};

if (sessionStorage.getItem('guestMode')==='true') {
    state.guestMode=true;
    state.user={ uid:'guest-view', displayName:'Invitado' };
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

function updateAdminNavVisibility() {
    const adminBtn = document.getElementById('nav-admin');
    if (!adminBtn) return;
    if (canAccessAdmin()) adminBtn.classList.remove('hidden');
    else adminBtn.classList.add('hidden');
}
async function hydrateAuthenticatedUser(user, { redirectOnboarding = false } = {}) {
    if (!user) return false;
    state.guestMode = false;
    sessionStorage.removeItem('guestMode');
    state.user = user;
    await loadProfile(user.uid);
    await ensureDefaultSchool(user.uid);
    await loadAdminRole(user.uid);
    updateAdminNavVisibility();
    refreshHeaderIdentity();
    if (redirectOnboarding && !state.profile.onboardingCompleted && !window.location.pathname.endsWith('/onboarding.html')) {
        goto('onboarding');
        return false;
    }
    return true;
}
async function loadSubAdmins() {
    try { const s=await adminsCollection.get(); state.data.subAdmins=s.docs.map(d=>({uid:d.id,...d.data()})); }
    catch(e) { state.data.subAdmins=[]; }
}

async function loadProfile(uid) {
    const doc=await alumniCollection.doc(uid).get();
    if(!doc.exists){ state.profile={firstName:state.user?.displayName?.split(' ')[0]||'',lastName:state.user?.displayName?.split(' ').slice(1).join(' ')||'',graduationYear:'',location:'',status:'trabajando',role:'',area:'',studies:'',bio:'',skills:'',topics:'',expectations:'',phone:'',linkedin:'',photoURL:state.user?.photoURL||'',school:DEFAULT_SCHOOL,username:'',onboardingCompleted:false}; refreshHeaderIdentity(); return; }
    const d=doc.data();
    state.profile={firstName:d.firstName||'',lastName:d.lastName||'',graduationYear:d.graduationYear||'',location:d.location||'',status:d.status||'trabajando',role:d.role||'',area:d.area||'',studies:d.studies||'',bio:d.bio||'',skills:Array.isArray(d.skills)?d.skills.join(', '):(d.skills||''),topics:d.topics||'',expectations:d.expectations||'',phone:d.phone||'',linkedin:d.linkedin||'',photoURL:d.photoURL||'',school:d.school||DEFAULT_SCHOOL,username:d.username||'',onboardingCompleted:d.onboardingCompleted||false};
    refreshHeaderIdentity();
}
async function ensureDefaultSchool(uid) {
    if (!uid || state.guestMode || state.profile.school) return;
    state.profile.school = DEFAULT_SCHOOL;
    await alumniCollection.doc(uid).set({ school: DEFAULT_SCHOOL, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
}
async function loadAlumni() {
    state.directoryLoading=true;
    try {
        const snap=await alumniCollection.get();
        state.data.alumni=snap.docs.map(doc=>{const d=doc.data();const user={id:doc.id,name:`${d.firstName||''} ${d.lastName||''}`.trim()||'Sin nombre',firstName:(d.firstName||'').trim(),lastName:(d.lastName||'').trim(),email:d.email||d.contactEmail||'',contactEmail:d.contactEmail||'',username:d.username||'',newsletterOptIn:Boolean(d.newsletterOptIn),role:d.role||'Sin rol',status:d.status||'sin-definir',statusLabel:formatStatusLabel(d.status),accountStatus:d.accountStatus||'activo',company:d.studies||formatStatusLabel(d.status),photoURL:d.photoURL||'',img:d.photoURL||buildAvatarUrl(`${d.firstName||'Usuario'} ${d.lastName||''}`.trim()),tags:[d.school||DEFAULT_SCHOOL,d.area||'General',formatStatusLabel(d.status)].filter(Boolean),fullStudies:d.studies||'No especificado',location:d.location||'Ubicación no disponible',bio:d.bio||'Sin biografía disponible.',year:d.graduationYear||'---',area:d.area||'General',skills:Array.isArray(d.skills)?d.skills:(d.skills?String(d.skills).split(','):[]),phone:d.phone||'',linkedin:d.linkedin||'',expectations:d.expectations||'',school:d.school||DEFAULT_SCHOOL,hitosCount:Number(d.hitosCount)||0,rutaDestacada:Boolean(d.rutaDestacada),graduationYear:d.graduationYear||'',studies:d.studies||''};return{...user,profileCompleteness:getProfileCompletenessScore(user)};}).filter(a=>hasValidFirstName(a.firstName));
    } catch(e){ state.data.alumni=state.data.alumni.length?state.data.alumni:[];}
    finally{ state.directoryLoading=false; }
}
async function loadNews() {
    try { const s=await newsCollection.orderBy('createdAt','desc').get(); state.data.news=s.docs.map(doc=>{const d=doc.data();return{id:doc.id,title:d.title||'Sin título',category:d.category||'Noticia',date:formatNewsDate(d.createdAt),summary:d.summary||'',img:d.img||'https://placehold.co/600x400/7e22ce/FFF?text=Noticia',audiencia:d.audiencia||'todos'};}); } catch(e){}
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
        if(typeof chatLogic!=='undefined') chatLogic.renderList();
    },()=>{ state.data.chats=[]; if(typeof chatLogic!=='undefined') chatLogic.renderList(); });
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
    const active=(id)=>activePage===id?'text-brand-600 bg-brand-50 px-3 py-1 rounded-lg':'text-gray-500 hover:text-brand-600';
    const mactive=(id)=>activePage===id?'text-brand-600':'text-gray-500';
    document.body.insertAdjacentHTML('afterbegin', `
        <nav class="glass-nav fixed w-full z-40 top-0 h-16 flex items-center justify-between px-4 lg:px-8 shadow-sm">
            <a href="index.html" class="flex items-center gap-3">
                <div class="w-8 h-8 bg-gradient-to-br from-brand-600 to-brand-500 rounded-lg flex items-center justify-center text-white font-bold shadow-md shadow-brand-500/30">S</div>
                <span class="font-bold text-xl tracking-tight text-gray-900">Sinap<span class="text-brand-600">sis</span></span>
            </a>
            <div class="hidden md:flex items-center gap-6" id="nav-links">
                <a href="index.html" class="font-medium transition ${active('home')}" id="nav-home">Ecosistema</a>
                <a href="directory.html" class="font-medium transition ${active('directory')}" id="nav-dir">Comunidad</a>
                <a href="news.html" class="font-medium transition ${active('news')}" id="nav-news">Novedades</a>
                <a href="preparacion.html" class="font-medium transition ${active('exam-modules')}" id="nav-exams">Preparación</a>
                <a href="messages.html" class="font-medium transition ${active('messages')}" id="nav-msg">Mensajes</a>
                <a href="admin.html" class="hidden font-medium transition ${active('admin')}" id="nav-admin">Admin</a>
            </div>
            <div class="flex items-center gap-2">
                <button type="button" class="theme-toggle" data-theme-toggle onclick="toggleThemeMode()" aria-label="Cambiar tema"></button>
                <a href="profile.html" id="profile-menu-trigger" class="h-10 w-10 rounded-full bg-brand-50 overflow-hidden ring-2 ring-transparent hover:ring-brand-300 transition-all shadow-sm" title="Ver perfil">
                    <img src="https://ui-avatars.com/api/?name=Usuario&background=22c55e&color=fff" alt="Perfil" class="object-cover w-full h-full" id="header-avatar">
                </a>
                <a href="profile.html" class="hidden md:flex items-center gap-1 text-xs text-gray-500 font-semibold hover:text-brand-600 transition px-2 py-1 rounded-lg hover:bg-brand-50"><span>Mi perfil</span><i class="ph-bold ph-caret-down"></i></a>
            </div>
        </nav>
        <nav id="mobile-nav" class="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-t border-gray-200 grid grid-cols-6">
            <a href="index.html" class="py-3 text-xs font-semibold flex flex-col items-center gap-1 ${mactive('home')}"><i class="ph ph-house text-lg"></i><span>Inicio</span></a>
            <a href="directory.html" class="py-3 text-xs font-semibold flex flex-col items-center gap-1 ${mactive('directory')}"><i class="ph ph-users text-lg"></i><span>Directorio</span></a>
            <a href="news.html" class="py-3 text-xs font-semibold flex flex-col items-center gap-1 ${mactive('news')}"><i class="ph ph-newspaper text-lg"></i><span>Novedades</span></a>
            <a href="preparacion.html" class="py-3 text-xs font-semibold flex flex-col items-center gap-1 ${mactive('exam-modules')}"><i class="ph ph-graduation-cap text-lg"></i><span>Prep.</span></a>
            <a href="messages.html" class="py-3 text-xs font-semibold flex flex-col items-center gap-1 ${mactive('messages')}"><i class="ph ph-chats-circle text-lg"></i><span>Mensajes</span></a>
            <a href="profile.html" class="py-3 text-xs font-semibold flex flex-col items-center gap-1 ${mactive('profile')}"><i class="ph ph-user-circle text-lg"></i><span>Perfil</span></a>
        </nav>
    `);
    setThemeMode(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
}
