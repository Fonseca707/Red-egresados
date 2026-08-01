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
                let hitos = alum.hitosCount > 0 ? await loadHitos(alum.id) : [];
                if (!hitos.length) hitos = deriveLegacyHitos(alum);
                if (hitos.length >= 2) historias.push({ alum, hitos });
                if (historias.length === HISTORIAS_MAX) break;
            }

            // Agregados: solo con masa crítica (nunca mostrar números pequeños)
            const rutasCompletas = activos.filter(a => (a.hitosCount || 0) >= 2).length;
            this.renderStats(activos, rutasCompletas);
            this.renderHeroSocial(activos);
            // El hero ya no lleva foto de stock: lleva la red. Se pinta con las
            // mismas historias que la sección de abajo, así que si no hay
            // material tampoco hay hueco que rellenar.
            this.renderHeroRed(historias);

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
    renderHeroSocial(activos) {
        const wrap = document.getElementById('hero-social');
        if (!wrap || activos.length < 4) return;
        const conFoto = activos.filter(a => a.photoURL);
        const muestra = [...(conFoto.length >= 4 ? conFoto : activos)]
            .sort((a, b) => (b.profileCompleteness || 0) - (a.profileCompleteness || 0))
            .slice(0, 4);
        document.getElementById('hero-avatars').innerHTML = muestra.map(a => `
            <img class="w-9 h-9 rounded-full border-2 border-paper object-cover" src="${sanitizeHTML(a.img)}" alt="Egresado ${sanitizeHTML(a.name)}" title="${sanitizeHTML(a.name)}">`).join('');
        const promos = new Set(activos.map(a => String(a.year)).filter(y => y && y !== '---')).size;
        document.getElementById('hero-social-text').innerHTML = promos >= 3
            ? `Egresados de <span class="text-ink font-semibold">${promos} promociones</span> ya están en la red.`
            : `Egresados del Liceo ya están en la red.`;
        wrap.classList.remove('hidden');
        wrap.classList.add('flex');
    },

    // ── El hero ──────────────────────────────────────────────────────────────
    // Donde había una foto de stock de Unsplash ahora va la red: tres
    // trayectorias reales colgando del hilo, con su promoción, de dónde salieron
    // y dónde están hoy. Entran escalonadas, así que lo primero que hace la
    // página es DIBUJAR una trayectoria — que es exactamente lo que vende.
    //
    // Si no hay al menos dos historias con ruta, esto no pinta nada: el hero se
    // queda tipográfico. Preferible a rellenar con perfiles vacíos, que era la
    // regla que la tarjeta flotante de "Nuevas oportunidades" se saltaba.
    renderHeroRed(historias) {
        const holder = document.getElementById('hero-red');
        if (!holder) return;
        if (!historias || historias.length < 2) { holder.innerHTML = ''; return; }
        const muestra = historias.slice(0, 3);
        holder.innerHTML = `
            <div class="lienzo p-6 md:p-8">
                <p class="dato mb-6">Rutas de la red</p>
                <ol class="hilo">
                    ${muestra.map((h, i) => this.heroFilaHTML(h, i)).join('')}
                </ol>
            </div>`;
        motion.escalonar(holder, 110);
    },

    heroFilaHTML({ alum, hitos }, i) {
        const ordenados = [...hitos];
        const primero = ordenados[0];
        const actual = ordenados.find(x => x.actual) || ordenados[ordenados.length - 1];
        const desde = [primero?.organizacion, primero?.rol].find(Boolean) || '';
        const hoy = [actual?.rol, actual?.organizacion].filter(Boolean).join(' · ');
        return `
        <li class="hilo-hito ${i < 2 ? 'pb-7' : ''}" data-surgir ${actual?.actual ? 'data-actual' : ''}>
            <button type="button" onclick="historiasLogic.openHistoria('${sanitizeHTML(alum.id)}')"
                class="w-full text-left group/ruta">
                <div class="flex items-baseline gap-2.5 flex-wrap mb-1.5">
                    <span class="dato text-brand-600">Promoción ${sanitizeHTML(alum.year || '—')}</span>
                    ${alum.area && alum.area !== 'General' ? `<span class="dato">${sanitizeHTML(alum.area)}</span>` : ''}
                </div>
                <p class="fuente-display text-lg text-ink leading-snug group-hover/ruta:text-brand-600 transition-colors duration-180">${sanitizeHTML(alum.name)}</p>
                ${hoy ? `<p class="text-sm text-ink-soft mt-0.5">${sanitizeHTML(hoy)}</p>` : ''}
                ${desde ? `<p class="text-sm text-ink-mute mt-1">Desde ${sanitizeHTML(desde)}</p>` : ''}
            </button>
        </li>`;
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
            // data-contador hace que la cifra suba al entrar en pantalla. Se
            // anima porque el número es REAL; una cifra inventada animada sería
            // mentir con más énfasis.
            const valor = cell.querySelector('[data-stat-value]');
            valor.dataset.contador = String(stats[i][0]);
            valor.textContent = '0';
            cell.querySelector('[data-stat-label]').textContent = stats[i][1];
        });
        section.classList.remove('hidden');
        motion.refrescar(section);
    },

    renderHistorias(holder, historias) {
        holder.innerHTML = `
            <section class="py-16 md:py-24 border-t border-line">
                <div class="max-w-lectura mb-12">
                    <p class="dato mb-4">Historias que empezaron aquí</p>
                    <h2 class="fuente-display text-3xl md:text-[2.75rem] leading-tight tracking-tighter text-ink">
                        Del Liceo a donde están hoy
                    </h2>
                    <p class="text-lg text-ink-soft mt-4 leading-relaxed">
                        Rutas reales de egresados: cada una empezó en las mismas aulas donde estás tú.
                    </p>
                </div>
                <div class="grid md:grid-cols-2 gap-x-10 gap-y-0 md:gap-y-0">
                    ${historias.map(h => this.cardHTML(h)).join('')}
                </div>
            </section>`;
        motion.escalonar(holder, 90);
    },

    // Cada historia es una ruta, así que se dibuja como una ruta: el hilo con
    // sus tramos. Antes era una tarjeta redondeada con la foto grande y los
    // tramos como píldoras grises separadas por flechitas — se leía como un
    // breadcrumb, no como una trayectoria.
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
            const anios = formatHitoYears(h);
            if (etiqueta && !tramos.some(t => t.etiqueta === etiqueta)) tramos.push({ etiqueta, anios, actual: Boolean(h.actual) });
        });
        const rutaHTML = tramos.map((t, i) => `
            <li class="hilo-hito ${i < tramos.length - 1 ? 'pb-4' : ''}"${t.actual ? ' data-actual' : ''}>
                <p class="text-sm text-ink leading-snug">${sanitizeHTML(t.etiqueta)}</p>
                ${t.anios ? `<p class="dato mt-0.5">${sanitizeHTML(t.anios)}</p>` : ''}
            </li>`).join('');
        const bio = alum.bio && alum.bio !== 'Sin biografía disponible.' ? alum.bio : '';
        return `
            <article data-surgir class="py-8 border-b border-line">
                <button type="button" onclick="historiasLogic.openHistoria('${sanitizeHTML(alum.id)}')" class="w-full text-left group/h">
                    <div class="flex items-center gap-3.5 mb-5">
                        <img src="${sanitizeHTML(alum.img)}" alt="Foto de ${sanitizeHTML(alum.name)}" class="w-12 h-12 rounded-lg object-cover shrink-0">
                        <div class="min-w-0">
                            <h3 class="fuente-display text-lg text-ink leading-tight group-hover/h:text-brand-600 transition-colors duration-180">${sanitizeHTML(alum.name)}</h3>
                            <p class="dato mt-1">Promoción ${sanitizeHTML(alum.year || '—')}${alum.area && alum.area !== 'General' ? ` · ${sanitizeHTML(alum.area)}` : ''}</p>
                        </div>
                    </div>
                    <ol class="hilo mb-5">${rutaHTML}</ol>
                    ${bio ? `<p class="fuente-display italic text-ink-soft leading-relaxed mb-4 max-w-lectura">“${sanitizeHTML(bio)}”</p>` : ''}
                    <span class="text-sm font-semibold text-brand-600 inline-flex items-center gap-1.5">Ver su ruta completa <i class="ph-bold ph-arrow-right transition-transform duration-260 ease-salida group-hover/h:translate-x-1"></i></span>
                </button>
            </article>`;
    },

    openHistoria(id) {
        if (typeof directoryLogic !== 'undefined') directoryLogic.openProfile(id);
    }
};

document.addEventListener('DOMContentLoaded', () => historiasLogic.init());
