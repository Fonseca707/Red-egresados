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
const userChatsCollection = (uid) => artifactsRoot.collection('users').doc(uid).collection('chats');
const userChatMessagesCollection = (uid, chatId) => userChatsCollection(uid).doc(chatId).collection('messages');

const DEFAULT_SCHOOL = 'LCP';
const USERNAME_AUTH_DOMAIN = 'sinapsis.local';
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
    const username=normalizeUsername(state.profile?.username || (e.endsWith(`@${USERNAME_AUTH_DOMAIN}`) ? e.split('@')[0] : ''));
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
        state.data.alumni=snap.docs.map(doc=>{const d=doc.data();return{id:doc.id,name:`${d.firstName||''} ${d.lastName||''}`.trim()||'Sin nombre',firstName:(d.firstName||'').trim(),lastName:(d.lastName||'').trim(),email:d.email||d.contactEmail||'',username:d.username||'',newsletterOptIn:Boolean(d.newsletterOptIn),role:d.role||'Sin rol',status:d.status||'sin-definir',statusLabel:formatStatusLabel(d.status),accountStatus:d.accountStatus||'activo',company:d.studies||formatStatusLabel(d.status),img:d.photoURL||buildAvatarUrl(`${d.firstName||'Usuario'} ${d.lastName||''}`.trim()),tags:[d.school||DEFAULT_SCHOOL,d.area||'General',formatStatusLabel(d.status)].filter(Boolean),fullStudies:d.studies||'No especificado',location:d.location||'Ubicación no disponible',bio:d.bio||'Sin biografía disponible.',year:d.graduationYear||'---',area:d.area||'General',skills:Array.isArray(d.skills)?d.skills:(d.skills?String(d.skills).split(','):[]),phone:d.phone||'',linkedin:d.linkedin||'',expectations:d.expectations||'',school:d.school||DEFAULT_SCHOOL};}).filter(a=>hasValidFirstName(a.firstName));
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
