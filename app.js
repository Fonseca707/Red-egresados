import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js';
import { getFirestore, collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js';

let firebaseConfig;
try {
  const module = await import('./firebase-config.js');
  firebaseConfig = module.firebaseConfig;
} catch {
  firebaseConfig = null;
}

const mockAlumni = [
  { id: 1, name: 'Sofia Ramirez', role: 'UX Designer', company: 'Google', img: 'https://ui-avatars.com/api/?name=Sofia+Ramirez&background=random' },
  { id: 2, name: 'Carlos Mendez', role: 'Project Manager', company: 'Constructora Bolivar', img: 'https://ui-avatars.com/api/?name=Carlos+Mendez&background=random' }
];

const state = {
  user: null,
  alumni: [...mockAlumni],
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

const router = {
  navigate(viewId) {
    const guarded = ['directory', 'profile'];
    if (guarded.includes(viewId) && !state.user) {
      this.navigate('auth');
      return;
    }

    ['view-home', 'view-auth', 'view-directory', 'view-profile'].forEach((id) => {
      document.getElementById(id)?.classList.add('hidden');
    });

    document.getElementById(`view-${viewId}`)?.classList.remove('hidden');

    if (viewId === 'directory') directoryLogic.render();
    if (viewId === 'profile') profileLogic.populate();
  }
};

const directoryLogic = {
  render() {
    const grid = document.getElementById('directory-grid');
    grid.innerHTML = state.alumni
      .map(
        (alum) => `
        <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div class="flex gap-4">
            <img src="${alum.img}" class="w-14 h-14 rounded-xl object-cover" />
            <div>
              <h3 class="font-bold text-gray-900">${alum.name}</h3>
              <p class="text-xs text-brand-600 font-semibold uppercase tracking-wide mt-0.5">${alum.company}</p>
              <p class="text-sm text-gray-500 mt-1">${alum.role}</p>
            </div>
          </div>
        </div>
      `
      )
      .join('');
  }
};

const profileLogic = {
  populate() {
    document.getElementById('display-name').innerText = state.user?.displayName || state.user?.email || 'Sin nombre';
    document.getElementById('display-role').innerText = state.firebaseEnabled ? 'Conectado con Firebase' : 'Modo demo local';
  }
};

const authLogic = {
  async login(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const feedback = document.getElementById('auth-feedback');

    if (!state.firebaseEnabled) {
      state.user = { email, displayName: 'Demo User' };
      feedback.textContent = 'Modo demo: crea firebase-config.js para autenticación real.';
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
      state.user = { email: 'demo.google@alumni.test', displayName: 'Demo Google User' };
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
    if (state.firebaseEnabled) {
      await signOut(auth);
    }
    state.user = null;
    router.navigate('auth');
  }
};

const uiLogic = {
  toggleAuthModal: () => router.navigate('auth')
};

async function loadAlumni() {
  if (!state.firebaseEnabled) return;
  try {
    const snap = await getDocs(collection(db, 'alumni'));
    state.alumni = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch {
    state.alumni = [...mockAlumni];
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

await loadAlumni();
router.navigate('home');
