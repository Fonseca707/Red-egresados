// ─────────────────────────────────────────────────────────────────────────────
// Modo historias — la web se adapta al tamaño de la red (plan Sinapsis, jugada
// #1 del cold start): la portada muestra 3-4 rutas destacadas narrativas que
// NUNCA delatan el tamaño de la red. Los agregados (banda de métricas) solo se
// activan al cruzar el umbral de rutas completas; mientras tanto quedan ocultos.
// Depende de: shared.js (state, loadAlumni, loadHitos, deriveLegacyHitos,
// formatHitoYears, sanitizeHTML) y de directoryLogic (index.html) para abrir
// el perfil al tocar una historia.
// ─────────────────────────────────────────────────────────────────────────────

const HISTORIAS_UMBRAL_AGREGADOS = 35; // rutas completas para mostrar métricas
const HISTORIAS_MAX = 4;

const historiasLogic = {
    _lastLoad: 0,

    // force=true recarga los datos (p. ej. al volver a Inicio tras usar el admin);
    // con throttle de 30s para no releer Firestore en cada navegación.
    async init(force = false) {
        const holder = document.getElementById('historias-section');
        if (!holder) return;
        try {
            const stale = Date.now() - this._lastLoad > 30_000;
            if (!state.data.alumni.length || (force && stale)) {
                await loadAlumni();
                this._lastLoad = Date.now();
            }
            const activos = state.data.alumni.filter(a => a.accountStatus !== 'suspendido');

            // Candidatos: primero las historias DESTACADAS (curadas con IA desde
            // el panel admin, flag rutaDestacada); si faltan cupos, se completan
            // con los perfiles más completos (criterio del directorio).
            const destacados = activos.filter(a => a.rutaDestacada);
            const resto = activos
                .filter(a => !a.rutaDestacada)
                .sort((a, b) => (b.profileCompleteness || 0) - (a.profileCompleteness || 0));
            const candidatos = [...destacados, ...resto].slice(0, 10);
            const historias = [];
            for (const alum of candidatos) {
                let hitos = alum.hitosCount > 0 ? await loadHitos(alum.id) : [];
                if (!hitos.length) hitos = deriveLegacyHitos(alum);
                if (hitos.length >= 2) historias.push({ alum, hitos });
                if (historias.length === HISTORIAS_MAX) break;
            }

            // Agregados: solo con masa crítica (nunca mostrar números pequeños)
            const rutasCompletas = activos.filter(a => (a.hitosCount || 0) >= 2).length;
            this.renderStats(activos, rutasCompletas);

            // Con menos de 2 historias no se muestra nada: una fila medio vacía
            // también delata una red que apenas comienza.
            if (historias.length < 2) { holder.innerHTML = ''; return; }
            this.renderHistorias(holder, historias);
        } catch (e) {
            holder.innerHTML = '';
        }
    },

    renderStats(activos, rutasCompletas) {
        const section = document.getElementById('home-stats-section');
        if (!section) return;
        if (rutasCompletas < HISTORIAS_UMBRAL_AGREGADOS) {
            section.classList.add('hidden');
            return;
        }
        const distinct = (arr) => new Set(arr.filter(Boolean)).size;
        const stats = [
            [activos.length, 'Egresados conectados'],
            [distinct(activos.map(a => a.year)), 'Promociones'],
            [distinct(activos.map(a => a.area === 'General' ? '' : a.area)), 'Áreas profesionales'],
            [rutasCompletas, 'Rutas completas']
        ];
        const cells = section.querySelectorAll('[data-stat]');
        cells.forEach((cell, i) => {
            if (!stats[i]) return;
            cell.querySelector('[data-stat-value]').textContent = stats[i][0];
            cell.querySelector('[data-stat-label]').textContent = stats[i][1];
        });
        section.classList.remove('hidden');
    },

    renderHistorias(holder, historias) {
        holder.innerHTML = `
            <section class="py-12 md:py-16">
                <div class="text-center mb-12">
                    <h2 class="text-sm font-bold text-brand-600 uppercase tracking-widest mb-3">Historias que empezaron aquí</h2>
                    <h3 class="text-3xl md:text-4xl font-extrabold text-gray-900">Del Liceo a donde están hoy</h3>
                    <p class="text-gray-500 mt-3 max-w-2xl mx-auto">Rutas reales de egresados: cada una empezó en las mismas aulas donde estás tú.</p>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    ${historias.map(h => this.cardHTML(h)).join('')}
                </div>
            </section>`;
    },

    cardHTML({ alum, hitos }) {
        // Ruta compacta: máximo 3 tramos, del inicio a "hoy"
        const tramos = [];
        const ordenados = [...hitos];
        const primero = ordenados[ordenados.length - 1];
        const actual = ordenados.find(h => h.actual) || ordenados[0];
        const medio = ordenados.find(h => h !== primero && h !== actual);
        [primero, medio, actual].filter(Boolean).forEach(h => {
            const etiqueta = [h.rol, h.organizacion].filter(Boolean).join(' · ');
            if (etiqueta && !tramos.includes(etiqueta)) tramos.push(etiqueta);
        });
        const rutaHTML = tramos.map((t, i) => `
            ${i > 0 ? '<i class="ph-bold ph-arrow-right text-brand-600 shrink-0"></i>' : ''}
            <span class="px-2.5 py-1 rounded-lg bg-gray-50/70 border border-gray-100 text-xs font-semibold text-gray-700 whitespace-nowrap overflow-hidden text-ellipsis max-w-[12rem]">${sanitizeHTML(t)}</span>
        `).join('');
        const bio = alum.bio && alum.bio !== 'Sin biografía disponible.' ? alum.bio : '';
        return `
            <article onclick="historiasLogic.openHistoria('${sanitizeHTML(alum.id)}')"
                class="bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition p-6 cursor-pointer group">
                <div class="flex items-center gap-4 mb-4">
                    <img src="${sanitizeHTML(alum.img)}" alt="Foto de ${sanitizeHTML(alum.name)}" class="w-14 h-14 rounded-2xl object-cover shadow-sm group-hover:scale-105 transition shrink-0">
                    <div class="min-w-0">
                        <h4 class="font-extrabold text-gray-900 leading-tight group-hover:text-brand-600 transition">${sanitizeHTML(alum.name)}</h4>
                        <p class="text-xs font-bold text-brand-600 mt-0.5">Promoción ${sanitizeHTML(alum.year || '—')}${alum.area && alum.area !== 'General' ? ` · ${sanitizeHTML(alum.area)}` : ''}</p>
                    </div>
                </div>
                <div class="flex items-center gap-2 flex-wrap mb-4">${rutaHTML}</div>
                ${bio ? `<p class="text-sm text-gray-500 leading-relaxed line-clamp-2 mb-4">“${sanitizeHTML(bio)}”</p>` : ''}
                <span class="text-xs font-bold text-brand-600 flex items-center gap-1.5">Ver su ruta completa <i class="ph-bold ph-arrow-right group-hover:translate-x-1 transition"></i></span>
            </article>`;
    },

    openHistoria(id) {
        if (typeof directoryLogic !== 'undefined') directoryLogic.openProfile(id);
    }
};

document.addEventListener('DOMContentLoaded', () => historiasLogic.init());
