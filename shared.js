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
const auth = firebase.auth();
const db = firebase.firestore();
const _appId = "1:874010522484:web:28881821d110defd3b7221";
const artifactsRoot = db.collection('artifacts').doc(_appId);
const alumniCollection = artifactsRoot.collection('public').doc('data').collection('alumni');
const adminsCollection = artifactsRoot.collection('admins');
const usernamesCollection = artifactsRoot.collection('usernames');
const newsCollection = artifactsRoot.collection('public').doc('data').collection('news');
const organizationsCollection = artifactsRoot.collection('public').doc('data').collection('organizaciones');
const hitosCollection = (uid) => alumniCollection.doc(uid).collection('hitos');
const userChatsCollection = (uid) => artifactsRoot.collection('users').doc(uid).collection('chats');
const userChatMessagesCollection = (uid, chatId) => userChatsCollection(uid).doc(chatId).collection('messages');

const DEFAULT_SCHOOL = 'LCP';
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
    return `<ol class="relative border-l-2 border-brand-100 ml-5 space-y-6">` + hitos.map(h => {
        const info = hitoTypeInfo(h.tipo);
        const years = formatHitoYears(h);
        const actions = (editable && h.id) ? `
            <span class="flex gap-1 shrink-0">
                <button type="button" onclick="${editorNS}.editHito('${sanitizeHTML(h.id)}')" class="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition" title="Editar hito"><i class="ph-bold ph-pencil-simple"></i></button>
                <button type="button" onclick="${editorNS}.removeHito('${sanitizeHTML(h.id)}')" class="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition" title="Eliminar hito"><i class="ph-bold ph-trash"></i></button>
            </span>` : '';
        return `
        <li class="ml-6 relative">
            <span class="absolute -left-[2.45rem] top-0 w-9 h-9 rounded-xl flex items-center justify-center text-lg shadow-sm ${h.actual ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-600 border border-brand-100'}">
                <i class="ph-duotone ${info.icon}"></i>
            </span>
            <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-[11px] font-bold uppercase tracking-wide text-brand-600">${sanitizeHTML(info.label)}</span>
                        ${years ? `<span class="text-[11px] font-semibold text-gray-400">${sanitizeHTML(years)}</span>` : ''}
                        ${h.actual ? '<span class="text-[10px] font-bold px-2 py-0.5 bg-brand-600 text-white rounded-full">Actual</span>' : ''}
                    </div>
                    <p class="font-bold text-gray-900 leading-tight mt-0.5">${sanitizeHTML(h.organizacion || h.rol || 'Sin detalle')}</p>
                    ${h.organizacion && h.rol ? `<p class="text-sm text-gray-500">${sanitizeHTML(h.rol)}</p>` : ''}
                    ${h.descripcion ? `<p class="text-xs text-gray-400 mt-1 leading-relaxed">${sanitizeHTML(h.descripcion)}</p>` : ''}
                </div>
                ${actions}
            </div>
        </li>`;
    }).join('') + `</ol>`;
}

const state = {
    user: null,
    data: { alumni:[], news:[{id:1,title:"Encuentro Anual de Egresados 2024",category:"Evento",date:"15 Oct",summary:"Únete a nosotros para una noche de networking y celebración.",img:"https://placehold.co/600x400/1e3a8a/FFF?text=Evento"},{id:2,title:"Senior Developer Vacancy",category:"Empleo",date:"Hace 2h",summary:"Empresa aliada busca desarrollador Full Stack con experiencia.",img:"https://placehold.co/600x400/2563eb/FFF?text=Empleo"}], chats:[], subAdmins:[] },
    profile: { firstName:'',lastName:'',graduationYear:'',location:'',status:'trabajando',role:'',area:'',studies:'',bio:'',skills:'',topics:'',expectations:'',phone:'',linkedin:'',photoURL:'',school:DEFAULT_SCHOOL,username:'',onboardingCompleted:false },
    guestMode: false, activeChatId:null, messagesByChat:{}, selectedDirectoryUserId:null,
    directoryLoading:false, directoryPage:1, adminEmail:'juanda.fonsecag@gmail.com', superAdminUsernames:['wanda.cg','juanda.fonsecag'], adminTab:'users', editingNewsId:null,
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
function isAdminUser() {
    const e=String(state.user?.email||'').toLowerCase().trim();
    const username=normalizeUsername(state.profile?.username || usernameFromSyntheticEmail(e));
    return [state.adminEmail,'juanda.fonsecag@gmail.com'].includes(e)
        || e.startsWith('juanda.fonsecag@')
        || e.startsWith('wanda.cg@')
        || (state.superAdminUsernames || []).includes(username);
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
        state.data.alumni=snap.docs.map(doc=>{const d=doc.data();const user={id:doc.id,name:`${d.firstName||''} ${d.lastName||''}`.trim()||'Sin nombre',firstName:(d.firstName||'').trim(),lastName:(d.lastName||'').trim(),email:d.email||d.contactEmail||'',contactEmail:d.contactEmail||'',username:d.username||'',newsletterOptIn:Boolean(d.newsletterOptIn),role:d.role||'Sin rol',status:d.status||'sin-definir',statusLabel:formatStatusLabel(d.status),accountStatus:d.accountStatus||'activo',company:d.studies||formatStatusLabel(d.status),photoURL:d.photoURL||'',img:d.photoURL||buildAvatarUrl(`${d.firstName||'Usuario'} ${d.lastName||''}`.trim()),tags:[d.school||DEFAULT_SCHOOL,d.area||'General',formatStatusLabel(d.status)].filter(Boolean),fullStudies:d.studies||'No especificado',location:d.location||'Ubicación no disponible',bio:d.bio||'Sin biografía disponible.',year:d.graduationYear||'---',area:d.area||'General',skills:Array.isArray(d.skills)?d.skills:(d.skills?String(d.skills).split(','):[]),phone:d.phone||'',linkedin:d.linkedin||'',expectations:d.expectations||'',school:d.school||DEFAULT_SCHOOL,hitosCount:Number(d.hitosCount)||0,graduationYear:d.graduationYear||'',studies:d.studies||''};return{...user,profileCompleteness:getProfileCompletenessScore(user)};}).filter(a=>hasValidFirstName(a.firstName));
    } catch(e){ state.data.alumni=state.data.alumni.length?state.data.alumni:[];}
    finally{ state.directoryLoading=false; }
}
async function loadNews() {
    try { const s=await newsCollection.orderBy('createdAt','desc').get(); state.data.news=s.docs.map(doc=>{const d=doc.data();return{id:doc.id,title:d.title||'Sin título',category:d.category||'Noticia',date:formatNewsDate(d.createdAt),summary:d.summary||'',img:d.img||'https://placehold.co/600x400/7e22ce/FFF?text=Noticia'};}); } catch(e){}
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
    const m={home:'index.html',auth:'login.html',login:'login.html',register:'register.html',terms:'terms.html',onboarding:'onboarding.html',directory:'directory.html',news:'news.html',messages:'messages.html',profile:'profile.html',admin:'admin.html'};
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
                <a href="index.html?view=exam-modules" class="font-medium transition ${active('exam-modules')}" id="nav-exams">Preparación</a>
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
            <a href="index.html?view=exam-modules" class="py-3 text-xs font-semibold flex flex-col items-center gap-1 ${mactive('exam-modules')}"><i class="ph ph-graduation-cap text-lg"></i><span>Prep.</span></a>
            <a href="messages.html" class="py-3 text-xs font-semibold flex flex-col items-center gap-1 ${mactive('messages')}"><i class="ph ph-chats-circle text-lg"></i><span>Mensajes</span></a>
            <a href="profile.html" class="py-3 text-xs font-semibold flex flex-col items-center gap-1 ${mactive('profile')}"><i class="ph ph-user-circle text-lg"></i><span>Perfil</span></a>
        </nav>
    `);
    setThemeMode(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
}
