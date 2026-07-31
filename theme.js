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
        html.dark [class~="text-amber-900"],
        html.dark [class~="text-sun-600"] { color:#fcd34d !important; }
        html.dark [class~="hover:text-sun-700"]:hover { color:#fde68a !important; }
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

        /* ── Fondos claros restantes ── */
        html.dark [class~="bg-brand-50/50"],
        html.dark [class~="bg-brand-100"] { background-color:#052e1a !important; }
        html.dark [class~="bg-gray-200"] { background-color:#263244 !important; }
        html.dark [class~="bg-gray-50/30"] { background-color:rgba(30,41,59,0.4) !important; }
        html.dark [class~="bg-green-100"] { background-color:#052e16 !important; }
        html.dark [class~="bg-purple-100"] { background-color:#2e1065 !important; }
        html.dark [class~="bg-yellow-100"] { background-color:#422006 !important; }

        /* ── Bordes claros restantes ── */
        html.dark [class~="border-brand-200"],
        html.dark [class~="border-brand-300"],
        html.dark [class~="border-gray-300"],
        html.dark [class~="border-green-200"],
        html.dark [class~="border-red-200"],
        html.dark [class~="border-sun-200"] { border-color:#334155 !important; }
        html.dark [class~="border-gray-50"] { border-color:#1f2937 !important; }
        html.dark img[class~="border-white"],
        html.dark [class~="border-white"] { border-color:#1e293b !important; }

        /* ── Hovers: sin fogonazos blancos en oscuro ── */
        html.dark [class~="hover:bg-white"]:hover,
        html.dark [class~="hover:bg-gray-50"]:hover { background-color:#1e293b !important; }
        html.dark [class~="hover:bg-gray-100"]:hover,
        html.dark [class~="hover:bg-gray-200"]:hover { background-color:#263244 !important; }
        html.dark [class~="hover:bg-brand-50"]:hover,
        html.dark [class~="hover:bg-brand-50/50"]:hover,
        html.dark [class~="hover:bg-brand-100"]:hover,
        html.dark [class~="hover:bg-green-50"]:hover,
        html.dark [class~="hover:bg-green-100"]:hover { background-color:#052e1a !important; }
        html.dark [class~="hover:bg-blue-50"]:hover,
        html.dark [class~="hover:bg-blue-100"]:hover { background-color:#0b2545 !important; }
        html.dark [class~="hover:bg-purple-50"]:hover { background-color:#2e1065 !important; }
        html.dark [class~="hover:bg-amber-50"]:hover { background-color:#422006 !important; }
        html.dark [class~="hover:bg-red-50"]:hover { background-color:#450a0a !important; }
        html.dark [class~="hover:border-brand-200"]:hover,
        html.dark [class~="hover:border-brand-300"]:hover,
        html.dark [class~="hover:border-blue-300"]:hover,
        html.dark [class~="hover:border-purple-300"]:hover { border-color:#475569 !important; }
        html.dark [class~="bg-white/70"] { background-color:rgba(17,24,39,0.8) !important; color:#e5e7eb !important; }

        /* ── Degradados decorativos (hero, conectores de ruta) ── */
        html.dark [class~="from-brand-200"] { --tw-gradient-from:#14532d !important; --tw-gradient-stops:var(--tw-gradient-from), var(--tw-gradient-to) !important; }
        html.dark [class~="from-brand-300"] { --tw-gradient-from:#166534 !important; --tw-gradient-stops:var(--tw-gradient-from), var(--tw-gradient-to) !important; }
        html.dark [class~="to-brand-50"] { --tw-gradient-to:#052e16 !important; }
        html.dark [class~="to-brand-100"] { --tw-gradient-to:#14532d !important; }
        html.dark [class~="from-gray-50"] { --tw-gradient-from:#111827 !important; --tw-gradient-stops:var(--tw-gradient-from), var(--tw-gradient-to) !important; }
        html.dark [class~="to-gray-100"] { --tw-gradient-to:#1e293b !important; }
        html.dark [class~="from-brand-50"] { --tw-gradient-from:#052e1a !important; --tw-gradient-stops:var(--tw-gradient-from), var(--tw-gradient-to) !important; }
        html.dark [class~="from-sun-50"] { --tw-gradient-from:#422006 !important; --tw-gradient-stops:var(--tw-gradient-from), var(--tw-gradient-to) !important; }
        html.dark [class~="to-white"] { --tw-gradient-to:#111827 !important; }

        /* ── Textos oscuros sobre fondos que se oscurecen ── */
        html.dark [class~="text-brand-800"],
        html.dark [class~="text-green-800"] { color:#86efac !important; }
        html.dark [class~="text-red-900"],
        html.dark [class~="text-red-800"] { color:#fca5a5 !important; }
        html.dark [class~="text-gray-300"] { color:#475569 !important; }

        /* ── Auditoría 2026-07-28: clases sueltas sin traducir ── */
        /* Fondos pálidos -100 y variantes con opacidad de colores ya mapeados */
        html.dark [class~="bg-amber-100"] { background-color:#422006 !important; }
        html.dark [class~="bg-blue-100"] { background-color:#0b2545 !important; }
        html.dark [class~="bg-red-100"] { background-color:#450a0a !important; }
        html.dark [class~="bg-stone-100"] { background-color:#1e293b !important; }
        html.dark [class~="bg-sun-50"] { background-color:#422006 !important; }
        html.dark [class~="bg-brand-50/20"] { background-color:rgba(5,46,26,0.35) !important; }
        html.dark [class~="bg-gray-50/40"] { background-color:rgba(30,41,59,0.4) !important; }
        html.dark [class~="bg-red-50/30"] { background-color:rgba(69,10,10,0.35) !important; }
        /* Overlays translúcidos blancos: faltaban /50 y /90 (ya existían /70 y /95) */
        html.dark [class~="bg-white/50"] { background-color:rgba(17,24,39,0.6) !important; color:#e5e7eb !important; }
        html.dark [class~="bg-white/90"] { background-color:rgba(17,24,39,0.92) !important; color:#e5e7eb !important; }
        /* Hovers de fondo pálido: faltaban -100/-200 y variantes con opacidad */
        html.dark [class~="hover:bg-amber-200"]:hover,
        html.dark [class~="hover:bg-amber-50/40"]:hover { background-color:#422006 !important; }
        html.dark [class~="hover:bg-red-100"]:hover { background-color:#450a0a !important; }
        html.dark [class~="hover:bg-blue-100"]:hover { background-color:#0b2545 !important; }
        /* Hovers de borde de grupo (tarjetas con group-hover) */
        html.dark [class~="group-hover:border-amber-200"]:hover,
        html.dark [class~="group-hover:border-blue-200"]:hover,
        html.dark [class~="group-hover:border-purple-200"]:hover { border-color:#475569 !important; }
        /* Hovers de texto: el token "hover:text-X" es un class distinto de "text-X",
           así que necesita su propia regla aunque el color base ya esté mapeado.
           Estos quedaban gris oscuro sobre fondo oscuro = invisibles al pasar el mouse. */
        html.dark [class~="hover:text-gray-500"]:hover,
        html.dark [class~="hover:text-gray-600"]:hover,
        html.dark [class~="hover:text-gray-700"]:hover { color:#cbd5e1 !important; }
        html.dark [class~="hover:text-blue-700"]:hover { color:#93c5fd !important; }
        html.dark [class~="hover:text-brand-600"]:hover,
        html.dark [class~="hover:text-brand-700"]:hover,
        html.dark [class~="hover:text-brand-800"]:hover { color:#86efac !important; }
        html.dark [class~="hover:text-purple-600"]:hover { color:#d8b4fe !important; }
        html.dark [class~="hover:text-red-500"]:hover,
        html.dark [class~="hover:text-red-600"]:hover,
        html.dark [class~="hover:text-red-700"]:hover { color:#fca5a5 !important; }
        html.dark [class~="hover:border-gray-300"]:hover { border-color:#475569 !important; }
        /* Focus rings (box-shadow via --tw-ring-color, no border-color) */
        html.dark [class~="ring-brand-100"] { --tw-ring-color:rgba(134,239,172,0.35) !important; }
        html.dark [class~="focus:ring-brand-100"]:focus { --tw-ring-color:rgba(134,239,172,0.35) !important; }
        html.dark [class~="focus:ring-purple-100"]:focus { --tw-ring-color:rgba(216,180,254,0.35) !important; }
        /* Textos de marca y acentos en tonos claros que se perdían en fondo blanco→oscuro */
        html.dark [class~="text-brand-100"],
        html.dark [class~="text-brand-200"],
        html.dark [class~="text-brand-300"],
        html.dark [class~="text-brand-500"],
        html.dark [class~="text-brand-900"] { color:#86efac !important; }
        html.dark [class~="text-amber-400"],
        html.dark [class~="text-amber-800"] { color:#fcd34d !important; }
        html.dark [class~="text-blue-500"] { color:#93c5fd !important; }
        html.dark [class~="text-red-400"] { color:#fca5a5 !important; }
        html.dark [class~="text-green-500"],
        html.dark [class~="text-green-600"],
        html.dark [class~="text-green-700"],
        html.dark [class~="text-green-800"] { color:#6ee7b7 !important; }
        /* Bordes pálidos/medios restantes */
        html.dark [class~="border-gray-400"] { border-color:#334155 !important; }
        html.dark [class~="border-amber-100"],
        html.dark [class~="border-amber-300"],
        html.dark [class~="border-green-300"] { border-color:#334155 !important; }
        html.dark [class~="border-purple-400"] { border-color:#a78bfa !important; }
        html.dark [class~="border-red-300"],
        html.dark [class~="border-red-400"] { border-color:#f87171 !important; }
        /* Prefijos responsive (sm:/md:/lg:/xl:) nunca hacían match porque
           [class~="X"] exige el token EXACTO: "lg:border-gray-200" no es lo mismo
           que "border-gray-200". Barrido en todo el repo (2026-07-28): el único
           caso real es lg:border-gray-200 (toefl-practice.js). Se resuelve con una
           regla explícita por token en vez de [class*="..."] (substring): un
           selector por substring haría match también de forma incorrecta con
           shades más largos que empiezan igual (p.ej. [class*="bg-gray-50"]
           también matchea "bg-gray-500", que es un color totalmente distinto).
           Si aparecen más combinaciones responsive+color, replicar este patrón. */
        html.dark [class~="sm:border-gray-200"],
        html.dark [class~="md:border-gray-200"],
        html.dark [class~="lg:border-gray-200"],
        html.dark [class~="xl:border-gray-200"] { border-color:#334155 !important; }

        /* ── TOEFL: simulador (toefl-practice.js) usa valores hex arbitrarios
           ([#066A6E] etc.) para clonar la paleta teal oficial del examen real.
           No se sustituye esa paleta (fidelidad visual intencional): solo se
           traducen a un teal más claro/legible sobre fondo oscuro y se
           oscurecen los tintes pálidos que quedaban blancos. ── */
        html.dark [class~="text-[#066A6E]"],
        html.dark [class~="text-[#055457]"],
        html.dark [class~="text-[#077F83]"],
        html.dark [class~="hover:text-[#066A6E]"]:hover { color:#5eead4 !important; }
        html.dark [class~="border-[#066A6E]"],
        html.dark [class~="focus:border-[#066A6E]"]:focus,
        html.dark [class~="border-[#077F83]"],
        html.dark [class~="hover:border-[#077F83]"]:hover { border-color:#2dd4bf !important; }
        html.dark [class~="hover:border-[#7db3b6]"]:hover { border-color:#3f8b8e !important; }
        html.dark [class~="bg-[#e8f2f2]"],
        html.dark [class~="focus:bg-[#e8f2f2]"]:focus,
        html.dark [class~="hover:bg-[#e8f2f2]"]:hover { background-color:#0d2e2f !important; }
        html.dark [class~="hover:bg-[#d3e6e7]"]:hover { background-color:#123a3b !important; }
        html.dark [class~="text-[#043e40]"] { color:#7ecbcf !important; }
        html.dark [class~="border-[#a3c9cb]"],
        html.dark [class~="border-[#cce0e1]"] { border-color:#2a6467 !important; }
        html.dark [class~="border-[#055457]/20"] { border-color:#334155 !important; }
        html.dark [class~="bg-[#D1D1D1]/40"] { background-color:rgba(51,65,85,0.5) !important; }
        /* bg-[#066A6E], bg-[#077F83], hover:bg-[#055457], shadow-[#066A6E]/20,
           accent-[#066A6E]: superficies teal SÓLIDAS (header, badge, CTA, glow) —
           ya son coloreadas a propósito y se ven bien sobre fondo oscuro; no se
           tocan para no romper la identidad visual del examen. */

        /* ── Estilos hardcodeados por página ── */
        html.dark .section-card { background:#111827 !important; border-color:#334155 !important; box-shadow:0 8px 30px rgba(0,0,0,0.35) !important; }
        html.dark .detail-icon { background:#052e1a !important; color:#86efac !important; }
        html.dark .detail-row { border-color:#263244 !important; }
        html.dark .traj-row { background:#0f172a !important; border-color:#334155 !important; }
        html.dark .step-dot.pending { background:#1e293b !important; color:#64748b !important; border-color:#334155 !important; }
        html.dark .step-dot.done { background:#052e1a !important; color:#86efac !important; border-color:#14532d !important; }
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

        /* ── Movil ──
           Safari en iOS hace ZOOM automatico al enfocar un campo cuyo texto mide
           menos de 16px, y no vuelve solo: el usuario queda con la pagina ampliada
           a mitad del registro o del examen. La plataforma usa text-sm (14px) en
           casi todos los campos, asi que el piso se pone aqui, una sola vez, en
           vez de perseguir clase por clase. Solo por debajo de md (768px).
           Los :not() no cambian el sentido de la regla: estan para ganarle en
           especificidad a las clases de Tailwind (.text-sm). Sin ellos, un
           select con text-sm se queda en 14px y sigue haciendo zoom. */
        @media (max-width: 767px) {
            input:not([type=checkbox]):not([type=radio]),
            select:not([hidden]),
            textarea:not([hidden]) { font-size: 16px; }
        }
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
    setThemeMode(saved || 'light');
}

initThemeMode();
document.addEventListener('DOMContentLoaded', () => {
    ensureFloatingThemeToggle();
    setThemeMode(getSavedThemeMode() || (document.documentElement.classList.contains('dark') ? 'dark' : 'light'));
});
