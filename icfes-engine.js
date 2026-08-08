// icfes-engine.js — Motor de banco de ítems (ICFES Saber 11).
//
// 🔴 Decisión de arquitectura: esto NO es un tercer clon de toefl-practice.js /
// delf-practice.js. Esos dos reimplementan cada uno cronómetro, navegación,
// corrección e historial para un examen con muchos tipos de tarea distintos.
// El ICFES es 100% selección múltiple de 4 opciones y una sola correcta, así que
// lo que hace falta es un motor de ítems: seleccionar, presentar, corregir y
// diagnosticar. Sirve igual para las otras 3 pruebas del Saber 11 el día que se
// agreguen, sin escribir un motor nuevo.
//
// Es ENTRENAMIENTO, no simulacro: sesiones cortas, sin cronómetro, con
// retroalimentación inmediata. Un simulacro dice "fallaste"; un entrenador dice
// por qué el distractor que elegiste era tentador. Ahí vive el valor del módulo.

const icfesLogic = {
    session: null,
    banco: { items: [], estimulos: {}, cargado: false },

    root() { return document.getElementById('icfes-root'); },

    // ── Banco ───────────────────────────────────────────────────────────────
    // Se filtra en el cliente a propósito: una consulta con varias igualdades
    // (prueba + revisado + active + school) exigiría un índice compuesto y un
    // despliegue aparte. El banco es de cientos de ítems, no de millones.
    async cargarBanco() {
        if (this.banco.cargado) return this.banco;
        try {
            const snap = await examItemsCollection.where('exam', '==', 'ICFES').get();
            this.banco.items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const est = await examStimuliCollection.get();
            est.docs.forEach(d => { this.banco.estimulos[d.id] = { id: d.id, ...d.data() }; });
            this.banco.cargado = true;
        } catch (e) {
            this.banco.items = [];
        }
        return this.banco;
    },

    // Un ítem sin revisar NUNCA se le sirve a un estudiante. Es la regla dura del
    // módulo: la IA genera, el humano aprueba, solo lo aprobado se practica.
    disponibles(prueba) {
        const miColegio = state.profile?.school || '';
        return this.banco.items.filter(i =>
            i.prueba === prueba &&
            i.revisado === true &&
            i.active !== false &&
            (!i.school || i.school === miColegio)
        );
    },

    // ── Cómo se presentan las opciones ──────────────────────────────────────
    //
    // En el banco, la respuesta correcta se guarda SIEMPRE en la primera
    // posición. Así, escribir una pregunta deja de exigir que uno reparta las
    // claves a mano entre A, B, C y D — que es donde se colaba el sesgo: un solo
    // autor tiende sin darse cuenta a la misma letra, y eso no se ve leyendo las
    // preguntas una por una (una tanda salió con la clave en C nueve veces de
    // dieciséis). Lo que el estudiante ve se decide aquí, al presentar.
    //
    // 🔑 Y hay una excepción que NO se puede barajar: cuando las cuatro opciones
    // son cifras, el cuadernillo oficial las ordena de menor a mayor. Barajarlas
    // se vería mal y delataría que no es un examen de verdad. Ahí se ordenan por
    // valor, y la posición de la correcta queda determinada por su magnitud
    // frente a los distractores — que es tan impredecible como barajar, sin
    // romper la convención.
    ordenables(opciones) {
        const valor = (o) => {
            // "5.800 pesos." → 5800 · "32 %." → 32 · "84 m²." → 84
            // El primer grupo EXIGE un dígito. Con `[\d.,]+` a secas, el punto
            // final de cualquier frase ("El Obrero y San José.") contaba como
            // número, todas las opciones parecían cifras de valor 0 y el
            // barajado no llegaba a ocurrir nunca.
            const m = String(o).match(/^[^\d]*?(-?\d[\d.,]*)/);
            if (!m) return null;
            const n = Number(m[1].replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
            return Number.isFinite(n) ? n : null;
        };
        const valores = opciones.map(valor);
        return valores.every(v => v !== null) ? valores : null;
    },

    // Generador con semilla: el mismo alumno, en la misma sesión y en el mismo
    // ítem, ve siempre el mismo orden. Sin esto no se podría reanudar una sesión
    // a medias: al volver, la respuesta ya guardada apuntaría a otra opción.
    aleatorio(semilla) {
        let h = 1779033703 ^ String(semilla).length;
        for (let i = 0; i < String(semilla).length; i++) {
            h = Math.imul(h ^ String(semilla).charCodeAt(i), 3432918353);
            h = (h << 13) | (h >>> 19);
        }
        return () => {
            h = Math.imul(h ^ (h >>> 16), 2246822507);
            h = Math.imul(h ^ (h >>> 13), 3266489909);
            h ^= h >>> 16;
            return (h >>> 0) / 4294967296;
        };
    },

    presentacion(item, semilla) {
        const opciones = item.opciones || [];
        const justificaciones = item.justificaciones || [];
        const claveOriginal = Number(item.clave) || 0;
        let orden = opciones.map((_, i) => i);

        const valores = this.ordenables(opciones);
        if (valores) {
            orden.sort((a, b) => valores[a] - valores[b]);
        } else {
            const rnd = this.aleatorio(`${semilla}|${item.id}`);
            for (let i = orden.length - 1; i > 0; i--) {
                const j = Math.floor(rnd() * (i + 1));
                [orden[i], orden[j]] = [orden[j], orden[i]];
            }
        }
        return {
            opciones: orden.map(i => opciones[i]),
            justificaciones: orden.map(i => justificaciones[i] || ''),
            clave: orden.indexOf(claveOriginal),
        };
    },

    // ── Historial del alumno (para no repetir y para diagnosticar) ───────────
    async cargarIntentos() {
        const uid = state.user?.uid;
        if (!uid || state.guestMode || uid === 'guest-view') return [];
        try {
            const snap = await itemAttemptsCollection(uid).orderBy('createdAt', 'desc').limit(500).get();
            return snap.docs.map(d => d.data());
        } catch (e) { return []; }
    },

    // Tasa de acierto por afirmación: la peor manda en la sesión siguiente.
    diagnostico(intentos) {
        const por = {};
        intentos.forEach(a => {
            const k = a.afirmacion || a.competencia;
            if (!k) return;
            por[k] = por[k] || { total: 0, aciertos: 0 };
            por[k].total++;
            if (a.correcta) por[k].aciertos++;
        });
        Object.values(por).forEach(v => { v.tasa = v.total ? v.aciertos / v.total : null; });
        return por;
    },

    // ── Selección de ítems (el corazón del entrenamiento) ────────────────────
    // Regla simple y explicable, no IRT ni adaptativo: sería sobre-ingeniería
    // antes de tener un solo usuario.
    seleccionar(prueba, cuantos, intentos, semilla) {
        const vistos = new Set(intentos.map(a => a.itemId));
        const diag = this.diagnostico(intentos);
        const pool = this.disponibles(prueba).filter(i => !vistos.has(i.id));

        // 1. Cuota oficial: con 15 ítems de LC da 4/6/5, no 5/5/5.
        const reparto = icfesRepartirPorCuota(prueba, cuantos);

        // 2. La afirmación con peor tasa recibe un ítem extra, quitándoselo a la
        //    mejor. El refuerzo se nota sin romper la forma del examen.
        const conDatos = Object.entries(diag).filter(([k]) => reparto[k] !== undefined && diag[k].total >= 3);
        if (conDatos.length >= 2) {
            conDatos.sort((a, b) => a[1].tasa - b[1].tasa);
            const peor = conDatos[0][0], mejor = conDatos[conDatos.length - 1][0];
            if (reparto[mejor] > 1) { reparto[mejor]--; reparto[peor]++; }
        }

        // 3. Dificultad: se arranca en 2 y se prefiere lo cercano a ese nivel.
        const objetivo = 2;
        const elegidos = [];
        Object.entries(reparto).forEach(([afirmacion, n]) => {
            const candidatos = pool
                .filter(i => i.afirmacion === afirmacion && !elegidos.includes(i))
                .sort((a, b) => Math.abs((a.dificultad || 2) - objetivo) - Math.abs((b.dificultad || 2) - objetivo));
            elegidos.push(...candidatos.slice(0, n));
        });

        // 4. Si el banco aún no da para la cuota, se completa con lo que haya:
        //    mejor una sesión más corta de lo ideal que ninguna sesión.
        if (elegidos.length < cuantos) {
            pool.filter(i => !elegidos.includes(i))
                .slice(0, cuantos - elegidos.length)
                .forEach(i => elegidos.push(i));
        }

        // 5. Agrupar por estímulo y barajar los BLOQUES, no las preguntas
        //    sueltas. En Lectura Crítica un mismo texto alimenta varias
        //    preguntas y debe presentarse UNA vez: si se barajaran sueltas, el
        //    texto reaparecería tres veces separado y el rótulo "responde las
        //    preguntas 1 a 3" dejaría de ser cierto. Cada sesión sale en un
        //    orden distinto, pero cada texto conserva sus preguntas seguidas.
        const bloques = new Map();
        elegidos.forEach(i => {
            const k = i.estimuloId || `solo:${i.id}`;
            if (!bloques.has(k)) bloques.set(k, []);
            bloques.get(k).push(i);
        });
        const orden = [...bloques.values()];
        const rnd = this.aleatorio(semilla);
        for (let i = orden.length - 1; i > 0; i--) {
            const j = Math.floor(rnd() * (i + 1));
            [orden[i], orden[j]] = [orden[j], orden[i]];
        }
        return orden.flat();
    },

    // ── Sesión ──────────────────────────────────────────────────────────────
    async start(prueba, cuantos = 10) {
        const raiz = this.root();
        if (raiz) raiz.innerHTML = `<div class="max-w-3xl mx-auto py-20 text-center text-gray-400"><i class="ph-duotone ph-circle-notch animate-spin text-3xl"></i><p class="mt-3 text-sm">Preparando tu sesión…</p></div>`;
        router.navigate('icfes-practice');

        await this.cargarBanco();

        // ¿Quedó una sesión a medias de esta misma prueba? Se le pregunta antes
        // de armar otra: rehacerla desde cero borraría lo que ya respondió.
        const guardada = await this.cargarSesionGuardada();
        if (guardada && guardada.prueba === prueba && !this.session) {
            this.session = { ...guardada, stage: 'reanudar' };
            return this.render();
        }

        const intentos = await this.cargarIntentos();
        // La semilla identifica esta sesión: de ella dependen el orden de los
        // bloques y el de las opciones dentro de cada pregunta. Se guarda con la
        // sesión para que al reanudar todo salga exactamente igual.
        const semilla = `${state.user?.uid || 'anon'}-${prueba}-${Date.now()}`;
        const items = this.seleccionar(prueba, cuantos, intentos, semilla);

        this.session = {
            prueba, semilla,
            itemIds: items.map(i => i.id),
            items, indice: 0,
            respuestas: [],           // { itemId, elegida, correcta, segundos }
            inicioItem: Date.now(),
            stage: items.length ? 'item' : 'vacio'
        };
        this.guardarSesion();
        this.render();
    },

    // ── Sesión a medias ─────────────────────────────────────────────────────
    // Los intentos ya se guardaban uno a uno, así que lo practicado nunca se
    // perdía; lo que se perdía era la SESIÓN: al volver, el alumno empezaba
    // otras diez preguntas y las que había dejado a medias quedaban contadas
    // como vistas sin haberlas terminado. Esto guarda dónde iba.
    async guardarSesion() {
        const uid = state.user?.uid;
        const s = this.session;
        if (!uid || state.guestMode || uid === 'guest-view' || !s) return;
        try {
            await icfesSesionDoc(uid).set({
                prueba: s.prueba, semilla: s.semilla, itemIds: s.itemIds,
                indice: s.indice, respuestas: s.respuestas,
                actualizada: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (e) { /* best-effort: nunca romper el entrenamiento */ }
    },

    async borrarSesionGuardada() {
        const uid = state.user?.uid;
        if (!uid || state.guestMode || uid === 'guest-view') return;
        try { await icfesSesionDoc(uid).delete(); } catch (e) { /* da igual */ }
    },

    async cargarSesionGuardada() {
        const uid = state.user?.uid;
        if (!uid || state.guestMode || uid === 'guest-view') return null;
        try {
            const d = await icfesSesionDoc(uid).get();
            if (!d.exists) return null;
            const g = d.data();
            // Los ítems se reconstruyen del banco por id: si alguno se retiró o
            // dejó de estar aprobado desde entonces, sale de la sesión en vez de
            // romperla.
            const porId = new Map(this.banco.items.map(i => [i.id, i]));
            const items = (g.itemIds || []).map(id => porId.get(id)).filter(Boolean);
            if (items.length < 2) { await this.borrarSesionGuardada(); return null; }
            const respuestas = (g.respuestas || []).filter(r => items.some(i => i.id === r.itemId));
            return {
                prueba: g.prueba, semilla: g.semilla, itemIds: items.map(i => i.id),
                items, indice: Math.min(g.indice || 0, items.length - 1),
                respuestas, inicioItem: Date.now()
            };
        } catch (e) { return null; }
    },

    reanudar() {
        this.session.stage = 'item';
        this.session.inicioItem = Date.now();
        this.render();
    },

    async empezarDeNuevo() {
        const prueba = this.session.prueba;
        await this.borrarSesionGuardada();
        this.session = null;
        this.start(prueba);
    },

    exit() {
        const s = this.session;
        if (s && s.stage === 'item' && s.respuestas.length) {
            if (!confirm('¿Salir del entrenamiento? Se pierde el avance de esta sesión.')) return;
        }
        this.session = null;
        router.navigate('exam-modules');
    },

    render() {
        const s = this.session;
        if (!s || !this.root()) return;
        if (s.stage === 'vacio') return this.renderVacio();
        if (s.stage === 'reanudar') return this.renderReanudar();
        if (s.stage === 'resultados') return this.renderResultados();
        return this.renderItem();
    },

    shell(titulo, cuerpo, progreso) {
        return `
            <div class="max-w-4xl mx-auto animate-fade-in pb-12">
                <div class="sticky top-16 z-30 bg-white/95 backdrop-blur rounded-2xl border border-gray-200 shadow-sm px-4 py-3 mb-6 flex items-center justify-between gap-3">
                    <div class="flex items-center gap-2 min-w-0">
                        <span class="px-2.5 py-1 rounded-lg bg-amber-600 text-white text-xs font-extrabold shrink-0">SABER 11</span>
                        <p class="text-sm font-bold text-gray-700 truncate">${titulo}</p>
                    </div>
                    <div class="flex items-center gap-3 shrink-0">
                        ${progreso || ''}
                        <button onclick="icfesLogic.exit()" class="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition" title="Salir del entrenamiento"><i class="ph-bold ph-x text-lg"></i></button>
                    </div>
                </div>
                ${cuerpo}
            </div>`;
    },

    // Sin ítems aprobados todavía. Se dice la verdad en vez de mostrar una
    // pantalla vacía: el banco se llena desde el admin y pasa por revisión.
    renderVacio() {
        const prueba = ICFES_PRUEBAS[this.session.prueba];
        this.root().innerHTML = this.shell(prueba.nombre, `
            <div class="bg-white rounded-3xl border border-gray-100 shadow-sm p-10 text-center">
                <div class="w-16 h-16 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-3xl mb-4"><i class="ph-duotone ph-tray"></i></div>
                <h2 class="text-2xl font-extrabold text-gray-900 mb-2">Todavía no hay preguntas aprobadas de ${sanitizeHTML(prueba.nombre)}</h2>
                <p class="text-gray-500 max-w-lg mx-auto">Cada pregunta de este módulo se genera con IA y <strong>la revisa una persona</strong> antes de que llegue a un estudiante. En cuanto haya preguntas aprobadas, aparecerán aquí.</p>
                <button onclick="icfesLogic.exit()" class="mt-6 px-6 py-3 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700 transition">Volver a los módulos</button>
            </div>`);
    },

    // ── Mi progreso ─────────────────────────────────────────────────────────
    // Lo que el estudiante no tenía: al terminar una sesión veía su resultado y
    // se acababa ahí. No sabía cuánto le faltaba del banco, en qué competencia
    // está flojo ni si va mejorando. Un entrenador que no lleva la cuenta es un
    // cuestionario.
    async progreso(prueba) {
        const raiz = this.root();
        if (raiz) raiz.innerHTML = `<div class="max-w-3xl mx-auto py-20 text-center text-gray-400"><i class="ph-duotone ph-circle-notch animate-spin text-3xl"></i></div>`;
        router.navigate('icfes-practice');
        await this.cargarBanco();
        const intentos = await this.cargarIntentos();
        this.session = { stage: 'progreso', prueba, intentos };
        this.renderProgreso();
    },

    renderProgreso() {
        const { prueba, intentos } = this.session;
        const mios = intentos.filter(a => a.prueba === prueba);
        const banco = this.disponibles(prueba);
        const vistos = new Set(mios.map(a => a.itemId));
        const pendientes = banco.filter(i => !vistos.has(i.id)).length;
        const aciertos = mios.filter(a => a.correcta).length;
        const puntaje = mios.length ? Math.round((aciertos / mios.length) * 100) : null;
        const nivel = puntaje !== null ? icfesNivelDesempeno(puntaje, prueba) : null;
        const diag = this.diagnostico(mios);

        const barra = (hechas, total, color) => {
            const pct = total ? Math.round((hechas / total) * 100) : 0;
            return `<div class="h-2 bg-gray-100 overflow-hidden rounded-full"><div class="h-full ${color}" style="width:${pct}%"></div></div>`;
        };

        // Cómo va en cada competencia. Se dice cuántas lleva, porque una tasa
        // sacada de dos preguntas no significa nada y presentarla como si
        // significara algo es peor que no mostrarla.
        const competencias = icfesAfirmacionesDe(prueba).map(a => {
            const d = diag[a.codigo];
            const n = d?.total || 0;
            const tasa = n ? Math.round(d.tasa * 100) : null;
            const color = tasa === null ? 'bg-gray-200' : tasa >= 70 ? 'bg-green-500' : tasa >= 45 ? 'bg-amber-500' : 'bg-red-400';
            return `
                <div class="py-3 border-t border-gray-100">
                    <div class="flex items-baseline justify-between gap-3 mb-1.5">
                        <p class="text-sm text-gray-800">${sanitizeHTML(a.corto)}</p>
                        <p class="text-xs shrink-0 ${tasa === null ? 'text-gray-400' : 'text-gray-600 font-semibold'}">
                            ${n ? `${tasa} % · ${n} pregunta${n === 1 ? '' : 's'}` : 'sin practicar'}
                        </p>
                    </div>
                    ${barra(tasa || 0, 100, color)}
                </div>`;
        }).join('');

        // La más floja, dicha con nombre: "vas al 40 %" no le dice a nadie qué
        // hacer el lunes; "practica sentido global" sí.
        const conDatos = Object.entries(diag).filter(([, d]) => d.total >= 3).sort((a, b) => a[1].tasa - b[1].tasa);
        const floja = conDatos.length ? ICFES_AFIRMACIONES[conDatos[0][0]] : null;

        const pestanas = Object.keys(ICFES_PRUEBAS).map(p => `
            <button onclick="icfesLogic.progreso('${p}')"
                    class="px-4 py-2 rounded-lg text-sm font-semibold transition ${p === prueba
                        ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:text-gray-800'}">
                ${sanitizeHTML(ICFES_PRUEBAS[p].nombre)}
            </button>`).join('');

        const cuerpo = `
            <div class="flex gap-2 mb-4">${pestanas}</div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div class="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                    <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Preguntas practicadas</p>
                    <p class="text-3xl font-extrabold text-gray-900">${mios.length}</p>
                    <p class="text-xs text-gray-500 mt-1">${pendientes} sin ver en el banco</p>
                </div>
                <div class="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                    <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Aciertos</p>
                    <p class="text-3xl font-extrabold text-gray-900">${puntaje === null ? '—' : puntaje + '%'}</p>
                    <p class="text-xs text-gray-500 mt-1">${mios.length ? `${aciertos} de ${mios.length}` : 'aún no has practicado'}</p>
                </div>
                <div class="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                    <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Nivel estimado</p>
                    <p class="text-3xl font-extrabold text-gray-900">${nivel ? nivel.nombre.replace('Nivel ', '') : '—'}</p>
                    <p class="text-xs text-gray-500 mt-1">${nivel ? 'de 4' : 'practica para verlo'}</p>
                </div>
            </div>

            <div class="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8">
                <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Cómo vas por competencia</p>
                ${competencias}
                ${floja ? `
                <div class="mt-5 pt-4 border-t border-gray-100 flex items-start gap-2">
                    <i class="ph-bold ph-target text-amber-600 mt-0.5"></i>
                    <p class="text-sm text-gray-600">
                        Lo que más te conviene reforzar ahora es <strong class="text-gray-900">${sanitizeHTML(floja.corto)}</strong>.
                        Tu próxima sesión traerá una pregunta más de esa competencia.
                    </p>
                </div>` : `
                <p class="text-xs text-gray-400 mt-4">Cuando lleves al menos tres preguntas de una competencia, aquí aparecerá cuál conviene reforzar.</p>`}
            </div>

            <div class="mt-4 flex flex-wrap gap-3">
                <button onclick="icfesLogic.start('${prueba}')" class="px-6 py-3 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 transition">
                    ${mios.length ? 'Seguir entrenando' : 'Empezar a entrenar'}
                </button>
                <button onclick="icfesLogic.exit()" class="px-6 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition">
                    Volver a los módulos
                </button>
            </div>

            ${pendientes === 0 && banco.length ? `
            <p class="text-xs text-gray-400 mt-4">
                Ya viste las ${banco.length} preguntas disponibles de esta prueba. Las siguientes sesiones repetirán preguntas
                hasta que se publiquen más.
            </p>` : ''}`;

        this.root().innerHTML = this.shell(ICFES_PRUEBAS[prueba].nombre + ' · Mi progreso', cuerpo);
    },

    renderReanudar() {
        const s = this.session;
        const hechas = s.respuestas.length;
        const total = s.items.length;
        const aciertos = s.respuestas.filter(r => r.correcta).length;
        this.root().innerHTML = this.shell(ICFES_PRUEBAS[s.prueba].nombre, `
            <div class="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 md:p-10 text-center">
                <div class="w-16 h-16 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-3xl mb-4"><i class="ph-duotone ph-bookmark-simple"></i></div>
                <h2 class="text-2xl font-extrabold text-gray-900 mb-2">Dejaste una sesión a medias</h2>
                <p class="text-gray-500 max-w-lg mx-auto">
                    Llevabas <strong class="text-gray-900">${hechas} de ${total}</strong> preguntas de ${sanitizeHTML(ICFES_PRUEBAS[s.prueba].nombre)},
                    con ${aciertos} acertada${aciertos === 1 ? '' : 's'}. Puedes seguir donde ibas o empezar una sesión nueva.
                </p>
                <div class="flex flex-wrap gap-3 justify-center mt-6">
                    <button onclick="icfesLogic.reanudar()" class="px-6 py-3 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 transition">
                        Continuar donde iba
                    </button>
                    <button onclick="icfesLogic.empezarDeNuevo()" class="px-6 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition">
                        Empezar una nueva
                    </button>
                </div>
                <p class="text-xs text-gray-400 mt-4">Lo que respondiste ya quedó guardado en tu progreso, empieces una nueva o no.</p>
            </div>`);
    },

    // El rótulo que el ICFES pone encima de cada texto base, con los números de
    // las preguntas que dependen de él. Verificado en el cuadernillo oficial de
    // Lectura Crítica 2026: "RESPONDE LAS PREGUNTAS 17 Y 18 DE ACUERDO CON LA
    // SIGUIENTE INFORMACIÓN". Decíamos "Lee el siguiente texto", que no es la
    // fórmula del examen y, sobre todo, no avisa de cuántas preguntas cuelgan
    // del texto — que es justo lo que le dice al estudiante cuánto leer.
    // Va en tuteo ("responde"), como el original.
    rotuloBloque() {
        const s = this.session;
        const actual = s.items[s.indice];
        if (!actual?.estimuloId) return '';
        // Posiciones (1-based) de todas las preguntas de la sesión que comparten
        // este texto. Van seguidas porque `seleccionar()` las agrupa.
        const nums = s.items
            .map((it, i) => (it.estimuloId === actual.estimuloId ? i + 1 : null))
            .filter(Boolean);
        const lista = nums.length === 1 ? `LA PREGUNTA ${nums[0]}`
            : nums.length === 2 ? `LAS PREGUNTAS ${nums[0]} Y ${nums[1]}`
            : `LAS PREGUNTAS ${nums[0]} A ${nums[nums.length - 1]}`;
        return `RESPONDE ${lista} DE ACUERDO CON LA SIGUIENTE INFORMACIÓN`;
    },

    renderItem() {
        const s = this.session;
        const item = s.items[s.indice];
        const yaRespondida = s.respuestas.find(r => r.itemId === item.id);
        const estimulo = item.estimuloId ? this.banco.estimulos[item.estimuloId] : null;
        // El texto se repite en pantalla mientras dure el bloque de preguntas que
        // lo comparten, pero no se vuelve a "presentar" como si fuera nuevo.
        const anterior = s.indice > 0 ? s.items[s.indice - 1] : null;
        const mismoTexto = anterior && anterior.estimuloId && anterior.estimuloId === item.estimuloId;

        // Las opciones no van encerradas en una caja: sin borde ni fondo. Lo que
        // dice cuál es cuál es la letra, y después de responder, el color de esa
        // letra y su icono. Una rejilla de cuatro recuadros compite con el
        // enunciado y con la tabla de la pregunta, que es lo que hay que leer.
        // Orden en que se le muestran a ESTE alumno en ESTA sesión.
        const vista = this.presentacion(item, s.semilla);
        const opciones = vista.opciones.map((op, i) => {
            const letra = 'ABCD'[i];
            let ancla = 'bg-gray-100 text-gray-600';
            let texto = 'text-gray-900';
            let marca = '';
            let pesoTexto = '';
            let colorJusti = 'text-gray-500';
            if (yaRespondida) {
                if (i === vista.clave) {
                    // Sin caja, el color y el peso son lo único que señala la
                    // correcta, así que tienen que verse: verde saturado en el
                    // texto, no un verde tan oscuro que se confunda con negro.
                    ancla = 'bg-green-600 text-white'; texto = 'text-green-600';
                    pesoTexto = 'font-bold'; colorJusti = 'text-green-600';
                    marca = '<i class="ph-fill ph-check-circle text-green-600 text-xl shrink-0"></i>';
                } else if (i === yaRespondida.elegida) {
                    ancla = 'bg-red-500 text-white'; texto = 'text-red-600';
                    pesoTexto = 'font-bold'; colorJusti = 'text-red-600';
                    marca = '<i class="ph-fill ph-x-circle text-red-500 text-xl shrink-0"></i>';
                } else {
                    ancla = 'bg-gray-100 text-gray-400'; texto = 'text-gray-400';
                }
            }
            const justificacion = yaRespondida && vista.justificaciones?.[i]
                ? `<span class="block text-xs ${colorJusti} mt-1 leading-relaxed">${sanitizeHTML(vista.justificaciones[i])}</span>` : '';
            return `
                <button ${yaRespondida ? 'disabled' : ''} onclick="icfesLogic.responder(${i})"
                        class="w-full text-left rounded-xl px-2 py-2.5 transition flex items-start gap-3 ${yaRespondida ? 'cursor-default' : 'hover:bg-gray-50'}">
                    <span class="w-6 h-6 rounded ${ancla} font-semibold text-xs flex items-center justify-center shrink-0 mt-px transition-colors">${letra}</span>
                    <span class="flex-1 min-w-0">
                        <span class="block text-sm ${texto} ${pesoTexto}">${sanitizeHTML(op)}</span>
                        ${justificacion}
                    </span>
                    ${marca}
                </button>`;
        }).join('');

        const afirmacion = ICFES_AFIRMACIONES[item.afirmacion];
        const cuerpo = `
            ${estimulo ? `
            <div class="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8 mb-4">
                <p class="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-2">
                    ${this.rotuloBloque()}
                </p>
                ${estimulo.titulo ? `<h3 class="text-lg font-extrabold text-gray-900 mb-2">${sanitizeHTML(estimulo.titulo)}</h3>` : ''}
                ${estimulo.texto ? `<div class="prose prose-sm max-w-none text-gray-700 whitespace-pre-line leading-relaxed">${sanitizeHTML(estimulo.texto)}</div>` : ''}
                ${estimulo.visual ? icfesVisual.render(estimulo.visual) : ''}
                ${estimulo.fuente ? `<p class="text-xs text-gray-400 mt-3 italic">${sanitizeHTML(estimulo.fuente)}</p>` : ''}
            </div>` : ''}

            <div class="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8">
                <p class="text-base md:text-lg font-medium text-gray-900 ${item.visual ? 'mb-2' : 'mb-5'} whitespace-pre-line leading-relaxed">${sanitizeHTML(item.enunciado || '')}</p>
                ${item.visual ? `<div class="mb-5">${icfesVisual.render(item.visual)}</div>` : ''}
                <div class="space-y-3">${opciones}</div>

                ${yaRespondida ? `
                <div class="mt-6 pt-5 border-t border-gray-100 flex items-center justify-between gap-4 flex-wrap">
                    <p class="text-xs text-gray-500">
                        <i class="ph-bold ph-target text-amber-600"></i>
                        Esta pregunta evalúa: <strong>${sanitizeHTML(afirmacion?.corto || '')}</strong>
                        ${item.evidencia ? ` · evidencia ${sanitizeHTML(item.evidencia)}` : ''}
                    </p>
                    <button onclick="icfesLogic.siguiente()" class="px-6 py-3 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 transition">
                        ${s.indice + 1 >= s.items.length ? 'Ver mi resultado' : 'Siguiente pregunta'}
                    </button>
                </div>
                ${this.renderReporte(item, (s.reportados || []).includes(item.id))}` : ''}
            </div>`;

        const progreso = `<span class="text-xs font-bold text-gray-500">${s.indice + 1} / ${s.items.length}</span>`;
        this.root().innerHTML = this.shell(ICFES_PRUEBAS[s.prueba].nombre + ' · Entrenamiento', cuerpo, progreso);
    },

    // ── Reportar una pregunta ───────────────────────────────────────────────
    // Decisión de Juan (2026-08-07): la revisión una por una la hace él esta
    // primera vez; de ahí en adelante son los estudiantes quienes señalan lo
    // que está mal. Esto es, de hecho, la mitad empírica que al módulo le
    // faltaba —el ICFES la hace con pilotaje— pero por el camino más barato:
    // quien se topa con el error lo dice en el momento, no un panel de expertos.
    //
    // Solo aparece DESPUÉS de responder. Antes sería una vía de escape para no
    // contestar, y además el estudiante todavía no sabe si el problema es la
    // pregunta o que no la supo.
    MOTIVOS_REPORTE: {
        clave: 'La respuesta marcada como correcta no lo es',
        enunciado: 'El enunciado o los datos están mal o incompletos',
        varias: 'Hay más de una opción correcta',
        confusa: 'No se entiende qué se pregunta',
        otro: 'Otra cosa',
    },

    abrirReporte() { this.session.reportando = true; this.render(); },
    cerrarReporte() { this.session.reportando = false; this.render(); },

    async enviarReporte() {
        const s = this.session;
        const item = s.items[s.indice];
        const motivo = document.getElementById('icfes-reporte-motivo')?.value || 'otro';
        const comentario = (document.getElementById('icfes-reporte-texto')?.value || '').trim().slice(0, 500);
        s.reportando = false;
        // Se marca como enviado antes de que responda el servidor: si falla la
        // red, el estudiante no tiene por qué quedarse esperando en mitad de su
        // entrenamiento. El reporte se pierde, la sesión no.
        s.reportados = s.reportados || [];
        s.reportados.push(item.id);
        this.render();
        try {
            await examItemReportsCollection.add({
                itemId: item.id, prueba: item.prueba,
                afirmacion: item.afirmacion || '', evidencia: item.evidencia || '',
                motivo, comentario,
                uid: state.user?.uid || '',
                school: state.profile?.school || '',
                atendido: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            });
        } catch (e) { /* best-effort: nunca romper el entrenamiento */ }
    },

    renderReporte(item, yaReportada) {
        const s = this.session;
        if (yaReportada) {
            return `<p class="text-xs text-green-700 mt-4 flex items-center gap-1.5">
                <i class="ph-fill ph-check-circle"></i> Gracias: revisaremos esta pregunta.
            </p>`;
        }
        if (!s.reportando) {
            return `<button onclick="icfesLogic.abrirReporte()"
                        class="text-xs text-gray-400 hover:text-gray-700 mt-4 transition flex items-center gap-1.5">
                    <i class="ph-bold ph-flag"></i> Reportar un problema con esta pregunta
                </button>`;
        }
        const opciones = Object.entries(this.MOTIVOS_REPORTE)
            .map(([k, t]) => `<option value="${k}">${sanitizeHTML(t)}</option>`).join('');
        return `
            <div class="mt-4 pt-4 border-t border-gray-100">
                <p class="text-xs font-semibold text-gray-600 mb-2">¿Qué problema tiene esta pregunta?</p>
                <select id="icfes-reporte-motivo" class="input-field text-sm mb-2">${opciones}</select>
                <textarea id="icfes-reporte-texto" rows="2" maxlength="500"
                          class="input-field text-sm" placeholder="Cuéntanos qué viste (opcional)"></textarea>
                <div class="flex gap-2 justify-end mt-2">
                    <button onclick="icfesLogic.enviarReporte()" class="px-4 py-2 bg-gray-900 text-white text-xs font-bold rounded-lg hover:bg-gray-800 transition">Enviar reporte</button>
                    <button onclick="icfesLogic.cerrarReporte()" class="px-3 py-2 text-gray-500 text-xs font-bold rounded-lg hover:bg-gray-100 transition">Cancelar</button>
                </div>
            </div>`;
    },

    responder(indice) {
        const s = this.session;
        const item = s.items[s.indice];
        if (s.respuestas.find(r => r.itemId === item.id)) return;
        // Se compara contra la clave TAL COMO SE PRESENTÓ, no contra la del
        // banco: el estudiante pulsó la opción que vio en pantalla.
        const correcta = indice === this.presentacion(item, s.semilla).clave;
        s.respuestas.push({
            itemId: item.id, elegida: indice, correcta,
            afirmacion: item.afirmacion,
            segundos: Math.round((Date.now() - s.inicioItem) / 1000)
        });
        // Se guarda intento por intento, no al final: si el alumno cierra la
        // pestaña a mitad de sesión, lo que ya practicó no se pierde.
        this.guardarIntento(item, indice, correcta, s.respuestas[s.respuestas.length - 1].segundos);
        this.guardarSesion();
        this.render();
    },

    async guardarIntento(item, elegida, correcta, segundos) {
        const uid = state.user?.uid;
        if (!uid || state.guestMode || uid === 'guest-view') return;
        try {
            await itemAttemptsCollection(uid).add({
                itemId: item.id, prueba: item.prueba, afirmacion: item.afirmacion || '',
                elegida, correcta, tiempoSegundos: segundos,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (e) { /* best-effort: nunca romper el entrenamiento */ }
    },

    siguiente() {
        const s = this.session;
        if (s.indice + 1 >= s.items.length) {
            s.stage = 'resultados';
            this.guardarResumen();
            // La sesión terminada deja de estar 'a medias': si no se borra, al
            // volver le ofreceríamos reanudar algo que ya acabó.
            this.borrarSesionGuardada();
        } else {
            s.indice++;
            s.inicioItem = Date.now();
            this.guardarSesion();
        }
        this.render();
    },

    // El resumen va a examResults, la misma colección de TOEFL/DELF: así el panel
    // del admin ya construido lo muestra sin tocar una línea.
    guardarResumen() {
        const s = this.session;
        const aciertos = s.respuestas.filter(r => r.correcta).length;
        const puntaje = Math.round((aciertos / s.respuestas.length) * 100);
        const nivel = icfesNivelDesempeno(puntaje, s.prueba);
        if (typeof saveExamResult === 'function') {
            saveExamResult({
                exam: 'ICFES',
                section: s.prueba,
                score: puntaje,
                scale: '/100',
                summary: `${aciertos} de ${s.respuestas.length} · ${nivel.nombre} · ${ICFES_PRUEBAS[s.prueba].nombre}`
            });
        }
    },

    renderResultados() {
        const s = this.session;
        const aciertos = s.respuestas.filter(r => r.correcta).length;
        const total = s.respuestas.length;
        const puntaje = Math.round((aciertos / total) * 100);
        const nivel = icfesNivelDesempeno(puntaje, s.prueba);

        // Desglose por afirmación: es lo que convierte un puntaje en un plan.
        const por = {};
        s.respuestas.forEach(r => {
            const k = r.afirmacion;
            if (!k) return;
            por[k] = por[k] || { total: 0, aciertos: 0 };
            por[k].total++; if (r.correcta) por[k].aciertos++;
        });
        const filas = Object.entries(por).map(([codigo, v]) => {
            const a = ICFES_AFIRMACIONES[codigo];
            const pct = Math.round((v.aciertos / v.total) * 100);
            const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';
            return `
                <div>
                    <div class="flex items-baseline justify-between gap-3 mb-1">
                        <p class="text-sm font-bold text-gray-800">${sanitizeHTML(a?.corto || codigo)}</p>
                        <p class="text-sm text-gray-500 shrink-0">${v.aciertos}/${v.total}</p>
                    </div>
                    <div class="h-2 rounded-full bg-gray-100 overflow-hidden"><div class="h-full ${color}" style="width:${pct}%"></div></div>
                    <p class="text-xs text-gray-400 mt-1">${sanitizeHTML(a?.nombre || '')}</p>
                </div>`;
        }).join('');

        const flojo = Object.entries(por).sort((a, b) => (a[1].aciertos / a[1].total) - (b[1].aciertos / b[1].total))[0];

        this.root().innerHTML = this.shell(ICFES_PRUEBAS[s.prueba].nombre + ' · Resultado', `
            <div class="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-10">
                <div class="text-center mb-8">
                    <p class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Sesión de entrenamiento</p>
                    <p class="text-6xl font-extrabold text-gray-900">${puntaje}<span class="text-2xl text-gray-400">/100</span></p>
                    <p class="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 text-sm font-bold border border-amber-100">
                        <i class="ph-duotone ph-medal"></i> ${nivel.nombre}
                    </p>
                    <p class="text-sm text-gray-500 mt-3 max-w-lg mx-auto">${sanitizeHTML(nivel.descripcion)}</p>
                    <p class="text-xs text-gray-400 mt-2">Acertaste ${aciertos} de ${total} preguntas. Esta escala imita la del ICFES (0-100 por prueba), pero un entrenamiento corto no predice el puntaje real.</p>
                </div>

                <div class="border-t border-gray-100 pt-6 space-y-5">
                    <p class="text-xs font-bold text-gray-500 uppercase tracking-wide">Cómo te fue por competencia</p>
                    ${filas}
                </div>

                ${flojo ? `
                <div class="mt-6 bg-amber-50 border border-amber-100 rounded-2xl p-5">
                    <p class="text-sm font-bold text-amber-900 mb-1"><i class="ph-duotone ph-lightbulb"></i> Por dónde seguir</p>
                    <p class="text-sm text-amber-800">Tu punto más flojo hoy fue <strong>${sanitizeHTML(ICFES_AFIRMACIONES[flojo[0]]?.corto || '')}</strong>. La próxima sesión te dará más preguntas de esa competencia automáticamente.</p>
                </div>` : ''}

                <div class="mt-8 flex items-center justify-center gap-3 flex-wrap">
                    <button onclick="icfesLogic.start('${s.prueba}')" class="px-6 py-3 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 transition">Otra sesión</button>
                    <button onclick="icfesLogic.exit()" class="px-6 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition">Volver a los módulos</button>
                </div>
            </div>`);
    }
};

window.icfesLogic = icfesLogic;
