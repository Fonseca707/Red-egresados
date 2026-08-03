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

// Iniciales de un nombre, para cuando no hay foto. Se usa en toda la portada:
// el avatar por defecto (ui-avatars) pinta un color al azar segun el nombre y
// una fila de caras naranja/morada/rosa junto al verde de la marca parece de
// otra web. Aqui todas las iniciales van sobre el mismo tono.
function hpIniciales(nombre) {
    return String(nombre || '').trim().split(/\s+/).slice(0, 2)
        .map(p => p[0] || '').join('').toUpperCase();
}

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
            // ⚠️ RENDIMIENTO — esto se pedía EN CADENA y por eso la portada tardaba
            // ~6 s en pintar su panel: cada ruta esperaba a que terminara la
            // anterior, y con la ida y vuelta a Firestore en 150-200 ms eso son
            // segundos de esqueleto en pantalla. Ahora van en paralelo, en tandas
            // del tamaño de lo que se pinta.
            //
            // La tanda importa: pedir los 10 candidatos de golpe seria mas rapido
            // todavia, pero gastaria lecturas de gente que no se va a mostrar
            // —justo lo que se corrigio en su dia—. Con curaduria (el caso normal)
            // basta la primera tanda: 4 lecturas en UNA ida y vuelta en vez de
            // cuatro seguidas.
            const historias = [];
            for (let i = 0; i < candidatos.length && historias.length < HISTORIAS_MAX; i += HISTORIAS_MAX) {
                const tanda = candidatos.slice(i, i + HISTORIAS_MAX);
                const rutas = await Promise.all(tanda.map(async (alum) => {
                    // >= 2 y no > 0: abajo se exige que la ruta tenga al menos dos
                    // hitos, así que pedir los de quien solo tiene uno era pagar una
                    // lectura para descartarla. Eran 9 llamadas para pintar 4 rutas.
                    let hitos = alum.hitosCount >= 2 ? await loadHitos(alum.id) : [];
                    if (!hitos.length) hitos = deriveLegacyHitos(alum);
                    return { alum, hitos };
                }));
                for (const r of rutas) {
                    if (r.hitos.length >= 2) historias.push(r);
                    if (historias.length === HISTORIAS_MAX) break;
                }
            }

            // El panel del hero se pinta AQUI, en cuanto hay rutas, sin esperar al
            // resumen de la red: es lo primero que se ve y no depende de él.
            this.renderHeroFicha(historias);

            // ⚠️ Los agregados NO salen de `activos`: desde que la portada pide solo
            // sus historias, esa lista son 4 personas, no la red. Contar ahí decía
            // «4 egresados conectados» —y peor: el umbral de 35 rutas completas no se
            // habría cruzado nunca, así que las métricas jamás volverían a aparecer
            // por muy grande que se hiciera la red—. Vienen de `resumen/red`, un
            // documento que el admin mantiene y que cuesta UNA lectura.
            const resumen = await loadResumenRed();
            this.renderStats(resumen);
            this.renderHeroSocial(activos, resumen);

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
        const iniciales = hpIniciales;
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

    // El lado visual del hero: la plataforma enseñando lo que sabe hacer, que es
    // contar una trayectoria. Se dibuja en HTML con datos REALES —los mismos
    // destacados que la portada ya publica— en vez de con una captura o una foto
    // de banco: queda nitido en cualquier pantalla, no pesa y se actualiza solo.
    // Cero lecturas nuevas de Firestore.
    //
    // ⚠️ Con foto de perfil sale la foto; sin ella, las iniciales sobre el verde
    // de la marca. Lo que NO se hace es ampliar el avatar de ui-avatars, que
    // pinta un color al azar por nombre.
    renderHeroFicha(historias) {
        const ficha = document.getElementById('hp-ficha');
        if (!ficha || !historias.length) return;
        const { alum, hitos } = historias[0];
        const iniciales = hpIniciales(alum.name);
        // Cuatro pasos como mucho: la ventana tiene un alto y una ruta larga la
        // desbordaba. Se conservan los extremos, que son los que cuentan la
        // historia (de donde salio y donde esta hoy).
        const pasos = hitos.length > 4
            ? [hitos[0], hitos[1], hitos[hitos.length - 2], hitos[hitos.length - 1]]
            : hitos;
        const avatar = alum.photoURL
            ? `<img class="hp-ficha-avatar" src="${sanitizeHTML(alum.img)}" alt="Foto de ${sanitizeHTML(alum.name)}">`
            : `<span class="hp-ficha-avatar">${sanitizeHTML(iniciales)}</span>`;
        ficha.innerHTML = `
            <div class="hp-ficha-cab">
                ${avatar}
                <div>
                    <p class="hp-ficha-nombre">${sanitizeHTML(alum.name)}</p>
                    <p class="hp-ficha-promo">Promoción ${sanitizeHTML(alum.year || '—')}${alum.area && alum.area !== 'General' ? ` · ${sanitizeHTML(alum.area)}` : ''}</p>
                </div>
            </div>
            <ol class="hp-ruta">
                ${pasos.map((h, i) => {
                    const anios = formatHitoYears(h);
                    return `<li style="--d:${560 + i * 130}ms"${h.actual ? ' data-actual' : ''}>
                        <p class="hp-ruta-rol">${sanitizeHTML(h.rol || h.titulo || 'Hito')}</p>
                        ${h.organizacion ? `<p class="hp-ruta-org">${sanitizeHTML(h.organizacion)}</p>` : ''}
                        ${anios ? `<p class="hp-ruta-anio">${sanitizeHTML(anios)}</p>` : ''}
                    </li>`;
                }).join('')}
            </ol>`;
        // Marca del momento en que el panel del hero queda pintado: es lo primero
        // que se ve y lo que se percibe como «la web tarda en aparecer». Medir el
        // ultimo viaje a Firestore engaña, porque ese es el resumen de la red, que
        // llega despues y no pinta nada del hero. Se lee con:
        //   performance.getEntriesByName('hp-ficha-pintada')[0].startTime
        try { performance.mark('hp-ficha-pintada'); } catch (e) { /* no es critico */ }

        // Se guarda para la proxima visita: el panel es lo primero que se mira y
        // aun con las lecturas en paralelo tarda ~2 s en llegar de Firestore. Con
        // esto, quien ya estuvo aqui lo ve al instante y los datos frescos lo
        // reemplazan sin que se note. Son los mismos datos que la portada ya
        // publica, guardados en el equipo del propio visitante.
        try {
            localStorage.setItem('hp_ficha_cache', JSON.stringify({ t: Date.now(), html: ficha.innerHTML }));
        } catch (e) { /* sin espacio o en modo privado: no pasa nada */ }
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
        // Mismo sistema visual que el resto de la portada (clases .hp-): si esta
        // seccion se queda con las tarjetas gordas de antes, la pagina se lee
        // como dos webs pegadas.
        // Sin lienzo verde: el hero y el bloque de propósito ya lo llevan y
        // repetirlo en todas las secciones cansaba. Aquí la caja SÍ tiene
        // función —cada trayectoria se pulsa y abre el perfil—, así que se queda,
        // pero flotando sobre fondo claro en vez de sobre color.
        //
        // ⚠️ La rejilla se elige segun CUANTAS historias hay de verdad. Estaba
        // fija a dos columnas con cuatro posiciones: hoy hay exactamente cuatro
        // egresados con ruta, asi que el dia que uno se suspenda o pierda un
        // hito, la cuarta celda queda como un hueco blanco de 220 px. Con tres,
        // tres columnas; con dos o cuatro, dos.
        holder.innerHTML = `
            <section class="hp-seccion"><div class="hp-interior">
                <div class="hp-cab hp-cab-izq" data-hp-sube>
                    <p class="hp-kicker">Historias que empezaron aquí</p>
                    <h3 class="hp-h2 mt-4">Del colegio a donde están hoy</h3>
                    <p class="hp-sub">Rutas reales de egresados: cada una empezó en las mismas aulas donde estás tú.</p>
                </div>
                <div class="hp-rejilla ${historias.length === 3 ? 'hp-rejilla-3 hp-historias-3' : 'hp-rejilla-2'}">
                    ${historias.map((h, i) => this.cardHTML(h, i)).join('')}
                </div>
              </div>
            </section>`;
        // El observador ya recorrió el documento cuando esto llega de Firestore:
        // hay que darle los bloques nuevos o se quedan invisibles para siempre.
        if (typeof hpObservar === 'function') hpObservar(holder);
    },

    cardHTML({ alum, hitos }, indice = 0) {
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
            ${i > 0 ? '<i class="ph-bold ph-arrow-right hp-tramo-flecha" aria-hidden="true"></i>' : ''}
            <span class="hp-tramo">${sanitizeHTML(t)}</span>
        `).join('');
        const bio = alum.bio && alum.bio !== 'Sin biografía disponible.' ? alum.bio : '';
        return `
            <article onclick="historiasLogic.openHistoria('${sanitizeHTML(alum.id)}')"
                class="hp-card hp-historia hp-card-flotante" data-hp-sube style="--d:${indice * 90}ms">
                <div class="hp-historia-cab">
                    ${alum.photoURL
                        ? `<img src="${sanitizeHTML(alum.img)}" alt="Foto de ${sanitizeHTML(alum.name)}" class="hp-historia-foto" loading="lazy" decoding="async">`
                        : `<span class="hp-historia-foto hp-historia-iniciales" aria-hidden="true">${sanitizeHTML(hpIniciales(alum.name))}</span>`}
                    <div class="min-w-0">
                        <h4 class="hp-card-t">${sanitizeHTML(alum.name)}</h4>
                        <p class="hp-historia-promo">Promoción ${sanitizeHTML(alum.year || '—')}${alum.area && alum.area !== 'General' ? ` · ${sanitizeHTML(alum.area)}` : ''}</p>
                    </div>
                </div>
                <div class="hp-tramos">${rutaHTML}</div>
                ${bio ? `<p class="hp-card-p hp-historia-bio">“${sanitizeHTML(bio)}”</p>` : ''}
                <span class="hp-enlace">Ver su ruta completa <i class="ph-bold ph-arrow-right" aria-hidden="true"></i></span>
            </article>`;
    },

    openHistoria(id) {
        if (typeof directoryLogic !== 'undefined') directoryLogic.openProfile(id);
    }
};

document.addEventListener('DOMContentLoaded', () => historiasLogic.init());
