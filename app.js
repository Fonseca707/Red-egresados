import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js';
import { getFirestore, collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js';

let firebaseConfig;
try {
  const module = await import('./firebase-config.js');
  firebaseConfig = module.firebaseConfig;
} catch {
  firebaseConfig = null;
}

const state = {
  user: null,
  view: 'home',
  data: {
    alumni: [
      { id: 1, name: 'Sofia Ramirez', role: 'UX Designer', company: 'Google', img: 'https://ui-avatars.com/api/?name=Sofia+Ramirez&background=random', tags: ['Diseño', 'Tech'] },
      { id: 2, name: 'Carlos Mendez', role: 'Project Manager', company: 'Constructora Bolivar', img: 'https://ui-avatars.com/api/?name=Carlos+Mendez&background=random', tags: ['Ingeniería', 'Gestión'] },
      { id: 3, name: 'Laura Torres', role: 'Marketing Lead', company: 'Rappi', img: 'https://ui-avatars.com/api/?name=Laura+Torres&background=random', tags: ['Marketing', 'Startups'] }
    ],
    news: [
      { id: 1, title: 'Encuentro Anual de Egresados 2024', category: 'Evento', date: '15 Oct', summary: 'Únete a nosotros para una noche de networking y celebración.', img: 'https://placehold.co/600x400/1e3a8a/FFF?text=Evento' },
      { id: 2, title: 'Senior Developer Vacancy', category: 'Empleo', date: 'Hace 2h', summary: 'Empresa aliada busca desarrollador Full Stack con experiencia.', img: 'https://placehold.co/600x400/2563eb/FFF?text=Empleo' }
    ],
    chats: [
      { id: 1, name: 'Sofia Ramirez', img: 'https://ui-avatars.com/api/?name=Sofia+Ramirez&background=random', lastMsg: '¡Claro! Hablemos mañana.', time: '10:30 AM' },
      { id: 2, name: 'Carlos Mendez', img: 'https://ui-avatars.com/api/?name=Carlos+Mendez&background=random', lastMsg: 'Gracias por conectar.', time: 'Ayer' }
    ]
  },
  profile: { firstName: '', lastName: '', role: '' },
  firebaseEnabled: Boolean(firebaseConfig)
};

let auth;
let db;
let googleProvider;
if (firebaseConfig) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();
}

const authLogic = {
  async login(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const feedback = document.getElementById('auth-feedback');

    if (!state.firebaseEnabled) {
      state.user = { uid: 'guest1', email, displayName: 'Usuario Demo', status: 'approved' };
      state.profile = { firstName: 'Usuario', lastName: 'Demo', role: 'Desarrollador' };
      feedback.textContent = 'Modo demo local activo.';
      router.navigate('directory');
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      feedback.textContent = '';
      router.navigate('directory');
    } catch (error) {
      feedback.textContent = `Error de acceso email: ${error.message}`;
    }
  },

  async loginWithGoogle() {
    const feedback = document.getElementById('auth-feedback');

    if (!state.firebaseEnabled) {
      state.user = { uid: 'guest-google', email: 'demo.google@alumni.test', displayName: 'Demo Google User', status: 'approved' };
      state.profile = { firstName: 'Demo', lastName: 'Google', role: 'Egresado' };
      feedback.textContent = 'Modo demo: Google login simulado.';
      router.navigate('directory');
      return;
    }

    try {
      await signInWithPopup(auth, googleProvider);
      feedback.textContent = '';
      router.navigate('directory');
    } catch (error) {
      feedback.textContent = `Error de acceso Google: ${error.message}`;
    }
  },

  async logout() {
    if (state.firebaseEnabled) await signOut(auth);
    state.user = null;
    router.navigate('auth');
  }
};

const router = {
  navigate(viewId) {
    if (viewId !== 'auth' && viewId !== 'home' && !state.user) {
      authLogic.logout();
      return;
    }

    const views = ['view-home', 'view-auth', 'view-directory', 'view-news', 'view-messages', 'view-profile'];
    views.forEach((id) => document.getElementById(id)?.classList.add('hidden'));

    const targetView = document.getElementById(`view-${viewId}`);
    if (!targetView) return;
    targetView.classList.remove('hidden');

    if (viewId === 'directory') directoryLogic.render();
    if (viewId === 'news') newsLogic.render();
    if (viewId === 'messages') chatLogic.renderList();
    if (viewId === 'profile') profileLogic.populate();
  }
};

const directoryLogic = {
  render() {
    const grid = document.getElementById('directory-grid');
    grid.innerHTML = state.data.alumni
      .map((alum) => `
      <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition">
        <div class="flex gap-4">
          <img src="${alum.img}" class="w-14 h-14 rounded-xl object-cover" />
          <div>
            <h3 class="font-bold text-gray-900">${alum.name}</h3>
            <p class="text-xs text-brand-600 font-semibold uppercase tracking-wide mt-0.5">${alum.company}</p>
            <p class="text-sm text-gray-500 mt-1">${alum.role}</p>
          </div>
        </div>
      </div>`)
      .join('');
  }
};

const newsLogic = {
  render() {
    const feed = document.getElementById('news-feed');
    feed.innerHTML = state.data.news
      .map((item, idx) => `
      <div class="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg transition cursor-pointer" onclick="uiLogic.openNewsModal(${idx})">
        <img src="${item.img}" class="w-full h-40 object-cover" />
        <div class="p-4"><p class="text-xs text-brand-600">${item.date} • ${item.category}</p><h3 class="font-bold mt-1">${item.title}</h3><p class="text-sm text-gray-500 mt-2">${item.summary}</p></div>
      </div>`)
      .join('');
  }
};

const chatLogic = {
  renderList() {
    const list = document.getElementById('chat-list');
    list.innerHTML = state.data.chats
      .map((chat) => `
      <div onclick="chatLogic.openChat(${chat.id})" class="p-4 hover:bg-white cursor-pointer border-b border-gray-100 flex gap-3 transition">
        <img src="${chat.img}" class="w-12 h-12 rounded-full object-cover">
        <div class="flex-1 min-w-0"><h4 class="font-bold text-sm text-gray-900 truncate">${chat.name}</h4><p class="text-xs text-gray-500 truncate">${chat.lastMsg}</p></div>
      </div>`)
      .join('');
  },
  openChat(id) {
    const chat = state.data.chats.find((c) => c.id === id);
    document.getElementById('chat-header-img').src = chat.img;
    document.getElementById('chat-header-name').innerText = chat.name;
    document.getElementById('chat-body').innerHTML = '<div class="chat-bubble chat-them">Hola, ¿cómo estás?</div><div class="chat-bubble chat-me">¡Todo bien!</div>';
  },
  send(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    if (!input.value.trim()) return;
    document.getElementById('chat-body').innerHTML += `<div class="chat-bubble chat-me">${input.value}</div>`;
    input.value = '';
  }
};

const profileLogic = {
  populate() {
    const p = state.profile;
    document.getElementById('display-name').innerText = `${p.firstName || ''} ${p.lastName || ''}`.trim() || (state.user?.displayName || 'Tu Nombre');
    document.getElementById('display-role').innerText = p.role || (state.firebaseEnabled ? 'Conectado con Firebase' : 'Modo demo local');
    document.getElementById('p-name').value = p.firstName || '';
    document.getElementById('p-lastname').value = p.lastName || '';
  },
  save() {
    state.profile.firstName = document.getElementById('p-name').value;
    state.profile.lastName = document.getElementById('p-lastname').value;
    profileLogic.populate();
  }
};

const uiLogic = {
  toggleNotifications() {
    document.getElementById('notif-panel').classList.toggle('hidden');
  },
  openNewsModal(idx) {
    const item = state.data.news[idx];
    document.getElementById('news-modal-img').src = item.img;
    document.getElementById('news-modal-title').innerText = item.title;
    document.getElementById('news-modal-body').innerText = item.summary;
    document.getElementById('modal-news').classList.remove('hidden');
  },
  closeNewsModal() {
    document.getElementById('modal-news').classList.add('hidden');
  },
  toggleAuthModal() {
    router.navigate('auth');
  }
};

async function loadAlumniFromFirestore() {
  if (!state.firebaseEnabled) return;
  try {
    const snap = await getDocs(collection(db, 'alumni'));
    const docs = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (docs.length > 0) state.data.alumni = docs;
  } catch {
    // fallback a mock
  }
}

if (state.firebaseEnabled) {
  onAuthStateChanged(auth, (user) => {
    state.user = user;
    router.navigate(user ? 'directory' : 'home');
  });
}

window.router = router;
window.authLogic = authLogic;
window.uiLogic = uiLogic;
window.chatLogic = chatLogic;
window.profileLogic = profileLogic;

await loadAlumniFromFirestore();
router.navigate('home');
