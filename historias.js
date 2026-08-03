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
            // `loadAlumniDestacados` y no `loadAlumni`: la portada pinta 4 historias
            // y traía los 68 perfiles de la red para elegirlas. Pide solo los
            // curados (`rutaDestacada`) y, si no llegan a dos, los que tienen al
            // menos dos hitos. Si la colección entera ya está en caché la reusa,
            // así que el admin y las búsquedas no leen dos veces.
            const stale = Date.now() - this._lastLoad > 30_000;
            if (!state.data.alumni.length || (force && stale)) {
                await loadAlumniDestacados();
                this._lastLoad = Date.now();
            }
            const activos = state.data.alumni.filter(a => a.accountStatus !== 'suspendido');

            // Candidatos: si hay historias DESTACADAS curadas desde el admin
            // (flag rutaDestacada), la portada muestra SOLO esas — sin rellenos.
            // Solo si no hay curaduría se cae al ranking por completitud.
            const destacados = activos.filter(a => a.rutaDestacada);
            const candidatos = destacados.length >= 2
                ? destacados
                : [...destacados, ...activos
                    .filter(a => !a.rutaDestacada)
                    .sort((a, b) => (b.profileCompleteness || 0) - (a.profileCompleteness || 0))
                  ].slice(0, 10);
            const historias = [];
            for (const alum of candidatos) {
                // >= 2 y no > 0: abajo se exige que la ruta tenga al menos dos
                // hitos, así que pedir los de quien solo tiene uno era pagar una
                // lectura para descartarla. Eran 9 llamadas para pintar 4 rutas.
                let hitos = alum.hitosCount >= 2 ? await loadHitos(alum.id) : [];
                if (!hitos.length) hitos = deriveLegacyHitos(alum);
                if (hitos.length >= 2) historias.push({ alum, hitos });
                if (historias.length === HISTORIAS_MAX) break;
            }

            // ⚠️ Los agregados NO salen de `activos`: desde que la portada pide solo
            // sus historias, esa lista son 4 personas, no la red. Contar ahí decía
            // «4 egresados conectados» —y peor: el umbral de 35 rutas completas no se
            // habría cruzado nunca, así que las métricas jamás volverían a aparecer
            // por muy grande que se hiciera la red—. Vienen de `resumen/red`, un
            // documento que el admin mantiene y que cuesta UNA lectura.
            const resumen = await loadResumenRed();
            this.renderStats(resumen);
            this.renderHeroSocial(activos, resumen);
            this.renderHeroMosaico(activos);

            // Con menos de 2 historias no se muestra nada: una fila medio vacía
            // también delata una red que apenas comienza.
            if (historias.length < 2) { holder.innerHTML = ''; return; }
            this.renderHistorias(holder, historias);
        } catch (e) {
            holder.innerHTML = '';
        }
    },

    // Prueba social del hero con caras reales (nunca inventadas). Sin decir el
    // número exacto si la red es pequeña: se habla de promociones, que siempre
    // suenan sólidas (principio de Juan: no delatar el tamaño de la red).
    renderHeroSocial(activos, resumen) {
        const wrap = document.getElementById('hero-social');
        // Las CARAS salen de los destacados (son los que la portada ya trajo); el
        // NÚMERO de promociones sale del resumen de la red. Antes se contaban las
        // promociones de las cuatro caras y salía "Egresados del Liceo", el texto
        // de reserva, con 60 personas y 20 promociones detrás.
        if (!wrap || activos.length < 4) return;
        const conFoto = activos.filter(a => a.photoURL);
        const muestra = [...(conFoto.length >= 4 ? conFoto : activos)]
            .sort((a, b) => (b.profileCompleteness || 0) - (a.profileCompleteness || 0))
            .slice(0, 4);
        // Quien tiene foto sale con su foto; el resto, con sus iniciales sobre un
        // tono neutro. El avatar por defecto de ui-avatars pinta un color al azar
        // segun el nombre y la fila salia naranja/morada/rosa junto al verde de la
        // marca — parecia de otra web.
        const iniciales = (nombre) => String(nombre || '').trim().split(/\s+/).slice(0, 2)
            .map(p => p[0] || '').join('').toUpperCase();
        document.getElementById('hero-avatars').innerHTML = muestra.map(a => a.photoURL
            ? `<img class="w-10 h-10 rounded-full border-2 border-white object-cover" src="${sanitizeHTML(a.img)}" alt="Egresado ${sanitizeHTML(a.name)}" title="${sanitizeHTML(a.name)}">`
            : `<span class="hp-inicial" title="${sanitizeHTML(a.name)}" aria-label="Egresado ${sanitizeHTML(a.name)}">${sanitizeHTML(iniciales(a.name))}</span>`
        ).join('') +
            `<span class="hp-inicial hp-inicial-mas" aria-hidden="true">+</span>`;
        const promos = Number(resumen?.promociones) ||
            new Set(activos.map(a => String(a.year)).filter(y => y && y !== '---')).size;
        document.getElementById('hero-social-text').innerHTML = promos >= 3
            ? `Egresados de ${promos} promociones <span class="font-normal text-gray-500">ya están en la red.</span>`
            : `Egresados del Liceo <span class="font-normal text-gray-500">ya están en la red.</span>`;
        wrap.classList.remove('hidden');
    },

    // Bloque visual del hero: en vez de una foto de banco, las cuatro personas
    // destacadas de la red. Reusa los destacados que init() ya trajo, asi que no
    // cuesta ni una lectura mas de Firestore.
    //
    // ⚠️ Quien tiene foto subida sale con su foto; quien no, con un retrato
    // tipografico. NO se amplia el avatar de iniciales de ui-avatars: a 300 px es
    // una inicial gigante sobre un bloque de color y delata que no hay foto. Hoy
    // (2026-08-02) ninguno de los cuatro destacados tiene photoURL, o sea que el
    // caso tipografico es el normal, no la excepcion. Las celdas que sobren se
    // quedan como superficie: aqui no se rellena con gente inventada.
    renderHeroMosaico(activos) {
        const celdas = document.querySelectorAll('#hp-mosaico [data-hp-celda]');
        if (!celdas.length) return;
        const muestra = [...activos]
            .sort((a, b) => (b.profileCompleteness || 0) - (a.profileCompleteness || 0))
            .slice(0, celdas.length);
        muestra.forEach((a, i) => {
            const celda = celdas[i];
            const promo = a.year && a.year !== '---' ? `Promoción ${a.year}` : 'Egresado';
            const rol = [a.role, a.area && a.area !== 'General' ? a.area : '']
                .filter(v => v && v !== 'Sin rol definido')[0] || '';
            celda.classList.remove('hp-celda-vacia');
            celda.classList.add('hp-celda-reveal');
            celda.style.setProperty('--d', `${140 + i * 90}ms`);
            celda.dataset.tono = String((i % 4) + 1);
            const cuerpo = a.photoURL
                ? `<img src="${sanitizeHTML(a.img)}" alt="${sanitizeHTML(a.name)}, egresada o egresado del Liceo Campestre de Pereira" loading="${i < 2 ? 'eager' : 'lazy'}" decoding="async">
                   <figcaption>
                       <p class="hp-celda-nombre">${sanitizeHTML(a.name)}</p>
                       <p class="hp-celda-detalle">${sanitizeHTML([promo, rol].filter(Boolean).join(' · '))}</p>
                   </figcaption>`
                : `<div class="hp-tile">
                       <p class="hp-tile-promo">${sanitizeHTML(promo)}</p>
                       <div>
                           <p class="hp-tile-nombre">${sanitizeHTML(a.name)}</p>
                           ${rol ? `<p class="hp-tile-rol">${sanitizeHTML(rol)}</p>` : ''}
                       </div>
                   </div>`;
            celda.innerHTML = `${cuerpo}
                <button type="button" class="hp-celda-btn" aria-label="Ver la ruta de ${sanitizeHTML(a.name)}"
                    onclick="historiasLogic.openHistoria('${sanitizeHTML(a.id)}')"></button>`;
        });
    },

    renderStats(resumen) {
        const section = document.getElementById('home-stats-section');
        if (!section) return;
        // Sin resumen no se inventa un cero: se calla, que es lo que hacía antes de
        // cruzar el umbral. El documento lo escribe el admin la primera vez que
        // abre el panel.
        if (!resumen || (resumen.rutasCompletas || 0) < HISTORIAS_UMBRAL_AGREGADOS) {
            section.classList.add('hidden');
            return;
        }
        const stats = [
            [resumen.total, 'Egresados conectados'],
            [resumen.promociones, 'Promociones'],
            [resumen.areas, 'Áreas profesionales'],
            [resumen.rutasCompletas, 'Rutas completas']
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
        // Ruta compacta: máximo 3 tramos, del inicio (colegio) a "hoy".
        // loadHitos ya entrega orden cronológico ascendente (sortHitos).
        const tramos = [];
        const ordenados = [...hitos];
        const primero = ordenados[0];
        const actual = ordenados.find(h => h.actual) || ordenados[ordenados.length - 1];
        const medio = [...ordenados].reverse().find(h => h !== primero && h !== actual);
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
