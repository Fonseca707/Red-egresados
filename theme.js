function installThemeStyles() {
    if (document.getElementById('sinapsis-theme-styles')) return;
    const style = document.createElement('style');
    style.id = 'sinapsis-theme-styles';
    style.textContent = `
        :root { color-scheme: light; }
        html.dark { color-scheme: dark; }
        html.dark body { background:#0b1120 !important; color:#e5e7eb !important; }
        html.dark .glass-nav,
        html.dark nav.glass-nav { background:rgba(15,23,42,0.94) !important; border-color:rgba(51,65,85,0.9) !important; }
        html.dark [class~="bg-white"],
        html.dark [class~="bg-stone-50"],
        html.dark [class~="bg-gray-50"],
        html.dark [class~="bg-white/95"],
        html.dark [class~="bg-stone-50/60"] { background-color:#111827 !important; }
        html.dark [class~="bg-gray-100"],
        html.dark [class~="bg-gray-50/50"],
        html.dark [class~="bg-gray-50/70"] { background-color:#1e293b !important; }
        html.dark [class~="bg-brand-50"] { background-color:#052e1a !important; }
        html.dark [class~="bg-blue-50"] { background-color:#0b2545 !important; }
        html.dark [class~="bg-purple-50"] { background-color:#2e1065 !important; }
        html.dark [class~="bg-amber-50"] { background-color:#422006 !important; }
        html.dark [class~="bg-red-50"] { background-color:#450a0a !important; }
        html.dark [class~="bg-green-50"] { background-color:#052e16 !important; }
        html.dark [class~="border-gray-100"],
        html.dark [class~="border-gray-200"],
        html.dark [class~="border-stone-200"],
        html.dark [class~="border-brand-100"],
        html.dark [class~="border-blue-100"],
        html.dark [class~="border-purple-100"],
        html.dark [class~="border-amber-200"],
        html.dark [class~="border-green-100"],
        html.dark [class~="border-red-100"],
        html.dark [class~="border-blue-200"],
        html.dark [class~="border-blue-300"],
        html.dark [class~="border-purple-200"],
        html.dark [class~="border-green-100"] { border-color:#334155 !important; }
        html.dark [class~="divide-gray-50"] > :not([hidden]) ~ :not([hidden]) { border-color:#263244 !important; }
        html.dark [class~="text-gray-900"],
        html.dark [class~="text-stone-800"] { color:#f8fafc !important; }
        html.dark [class~="text-gray-700"],
        html.dark [class~="text-stone-700"],
        html.dark [class~="text-gray-800"],
        html.dark [class~="text-gray-600"] { color:#cbd5e1 !important; }
        html.dark [class~="text-blue-800"],
        html.dark [class~="text-blue-900"] { color:#93c5fd !important; }
        html.dark [class~="text-emerald-500"],
        html.dark [class~="text-emerald-600"] { color:#6ee7b7 !important; }
        html.dark [class~="text-gray-500"],
        html.dark [class~="text-stone-500"],
        html.dark [class~="text-gray-400"] { color:#94a3b8 !important; }
        html.dark [class~="text-brand-600"],
        html.dark [class~="text-brand-700"] { color:#86efac !important; }
        html.dark [class~="text-blue-600"],
        html.dark [class~="text-blue-700"] { color:#93c5fd !important; }
        html.dark [class~="text-purple-600"],
        html.dark [class~="text-purple-700"],
        html.dark [class~="text-purple-900"] { color:#d8b4fe !important; }
        html.dark [class~="text-amber-600"],
        html.dark [class~="text-amber-700"],
        html.dark [class~="text-amber-900"] { color:#fcd34d !important; }
        html.dark [class~="text-red-500"],
        html.dark [class~="text-red-600"],
        html.dark [class~="text-red-700"] { color:#fca5a5 !important; }
        html.dark .input-field,
        html.dark input,
        html.dark textarea,
        html.dark select { background:#0f172a !important; color:#e5e7eb !important; border-color:#334155 !important; }
        html.dark .input-field::placeholder,
        html.dark input::placeholder,
        html.dark textarea::placeholder { color:#64748b !important; }
        html.dark table thead,
        html.dark [class~="bg-gray-50"] thead { background:#172033 !important; }
        html.dark tr:hover { background:#172033 !important; }
        .theme-toggle { width:2.5rem; height:2.5rem; display:inline-flex; align-items:center; justify-content:center; border-radius:9999px; border:1px solid #e5e7eb; color:#64748b; background:#fff; transition:all .2s ease; }
        .theme-toggle:hover { color:#16a34a; border-color:#86efac; background:#f0fdf4; }
        html.dark .theme-toggle { background:#0f172a; border-color:#334155; color:#cbd5e1; }
        html.dark .theme-toggle:hover { background:#13251c; color:#86efac; border-color:#16a34a; }
        .theme-toggle-floating { position:fixed; top:1rem; right:1rem; z-index:60; box-shadow:0 12px 30px rgba(15,23,42,.12); }
        .admin-table-scroll { width:100%; max-width:100%; overflow-x:auto; overscroll-behavior-x:contain; -webkit-overflow-scrolling:touch; }
        .admin-table-scroll table { min-width:980px; }
        .admin-table-scroll th,
        .admin-table-scroll td { white-space:nowrap; }
        .admin-table-scroll td:first-child,
        .admin-table-scroll th:first-child { min-width:260px; }
        .admin-table-scroll td:last-child,
        .admin-table-scroll th:last-child { position:sticky; right:0; z-index:1; background:inherit; box-shadow:-12px 0 18px -18px rgba(15,23,42,.45); }
    `;
    document.head.appendChild(style);
}

function getSavedThemeMode() {
    try { return localStorage.getItem('sinapsis-theme'); } catch { return null; }
}

function setThemeMode(mode) {
    const next = mode === 'dark' ? 'dark' : 'light';
    document.documentElement.classList.toggle('dark', next === 'dark');
    try { localStorage.setItem('sinapsis-theme', next); } catch {}
    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
        button.setAttribute('aria-label', next === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
        button.title = next === 'dark' ? 'Tema claro' : 'Tema oscuro';
        button.innerHTML = `<i class="ph-bold ${next === 'dark' ? 'ph-sun' : 'ph-moon'} text-lg"></i>`;
    });
}

function toggleThemeMode() {
    setThemeMode(document.documentElement.classList.contains('dark') ? 'light' : 'dark');
}

function ensureFloatingThemeToggle() {
    if (document.querySelector('[data-theme-toggle]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'theme-floating-toggle';
    button.className = 'theme-toggle theme-toggle-floating';
    button.setAttribute('data-theme-toggle', '');
    button.onclick = toggleThemeMode;
    document.body.appendChild(button);
}

function initThemeMode() {
    installThemeStyles();
    const saved = getSavedThemeMode();
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    setThemeMode(saved || (prefersDark ? 'dark' : 'light'));
}

initThemeMode();
document.addEventListener('DOMContentLoaded', () => {
    ensureFloatingThemeToggle();
    setThemeMode(getSavedThemeMode() || (document.documentElement.classList.contains('dark') ? 'dark' : 'light'));
});
