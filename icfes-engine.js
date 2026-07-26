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
        const miColegio = state.userProfile?.school || state.userProfile?.colegio || '';
        return this.banco.items.filter(i =>
            i.prueba === prueba &&
            i.revisado === true &&
            i.active !== false &&
            (!i.school || i.school === miColegio)
        );
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
    seleccionar(prueba, cuantos, intentos) {
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

        // 5. Agrupar por estímulo: en Lectura Crítica un mismo texto alimenta
        //    varias preguntas y debe presentarse UNA vez, no tres.
        return elegidos.sort((a, b) => String(a.estimuloId || 'zz').localeCompare(String(b.estimuloId || 'zz')));
    },

    // ── Sesión ──────────────────────────────────────────────────────────────
    async start(prueba, cuantos = 10) {
        const raiz = this.root();
        if (raiz) raiz.innerHTML = `<div class="max-w-3xl mx-auto py-20 text-center text-gray-400"><i class="ph-duotone ph-circle-notch animate-spin text-3xl"></i><p class="mt-3 text-sm">Preparando tu sesión…</p></div>`;
        router.navigate('icfes-practice');

        await this.cargarBanco();
        const intentos = await this.cargarIntentos();
        const items = this.seleccionar(prueba, cuantos, intentos);

        this.session = {
            prueba, items, indice: 0,
            respuestas: [],           // { itemId, elegida, correcta, segundos }
            inicioItem: Date.now(),
            stage: items.length ? 'item' : 'vacio'
        };
        this.render();
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

    renderItem() {
        const s = this.session;
        const item = s.items[s.indice];
        const yaRespondida = s.respuestas.find(r => r.itemId === item.id);
        const estimulo = item.estimuloId ? this.banco.estimulos[item.estimuloId] : null;
        // El texto se repite en pantalla mientras dure el bloque de preguntas que
        // lo comparten, pero no se vuelve a "presentar" como si fuera nuevo.
        const anterior = s.indice > 0 ? s.items[s.indice - 1] : null;
        const mismoTexto = anterior && anterior.estimuloId && anterior.estimuloId === item.estimuloId;

        const opciones = (item.opciones || []).map((op, i) => {
            const letra = 'ABCD'[i];
            let clases = 'border-gray-200 hover:border-amber-400 hover:bg-amber-50/40';
            let marca = '';
            if (yaRespondida) {
                if (i === item.clave) { clases = 'border-green-500 bg-green-50'; marca = '<i class="ph-bold ph-check-circle text-green-600 text-xl shrink-0"></i>'; }
                else if (i === yaRespondida.elegida) { clases = 'border-red-400 bg-red-50'; marca = '<i class="ph-bold ph-x-circle text-red-500 text-xl shrink-0"></i>'; }
                else clases = 'border-gray-200 opacity-60';
            }
            const justificacion = yaRespondida && item.justificaciones?.[i]
                ? `<p class="text-xs text-gray-600 mt-1.5 leading-relaxed">${sanitizeHTML(item.justificaciones[i])}</p>` : '';
            return `
                <button ${yaRespondida ? 'disabled' : ''} onclick="icfesLogic.responder(${i})"
                        class="w-full text-left border-2 ${clases} rounded-2xl px-4 py-3 transition flex items-start gap-3 ${yaRespondida ? 'cursor-default' : ''}">
                    <span class="w-7 h-7 rounded-lg bg-gray-100 text-gray-700 font-extrabold text-sm flex items-center justify-center shrink-0">${letra}</span>
                    <span class="flex-1 min-w-0">
                        <span class="block text-sm text-gray-900">${sanitizeHTML(op)}</span>
                        ${justificacion}
                    </span>
                    ${marca}
                </button>`;
        }).join('');

        const afirmacion = ICFES_AFIRMACIONES[item.afirmacion];
        const cuerpo = `
            ${estimulo ? `
            <div class="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8 mb-4">
                <p class="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                    ${mismoTexto ? 'El mismo texto de la pregunta anterior' : 'Lee el siguiente texto'}
                </p>
                ${estimulo.titulo ? `<h3 class="text-lg font-extrabold text-gray-900 mb-2">${sanitizeHTML(estimulo.titulo)}</h3>` : ''}
                <div class="prose prose-sm max-w-none text-gray-700 whitespace-pre-line leading-relaxed">${sanitizeHTML(estimulo.texto || '')}</div>
                ${estimulo.fuente ? `<p class="text-xs text-gray-400 mt-3 italic">${sanitizeHTML(estimulo.fuente)}</p>` : ''}
            </div>` : ''}

            <div class="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8">
                <p class="text-base md:text-lg font-bold text-gray-900 mb-5 whitespace-pre-line">${sanitizeHTML(item.enunciado || '')}</p>
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
                </div>` : ''}
            </div>`;

        const progreso = `<span class="text-xs font-bold text-gray-500">${s.indice + 1} / ${s.items.length}</span>`;
        this.root().innerHTML = this.shell(ICFES_PRUEBAS[s.prueba].nombre + ' · Entrenamiento', cuerpo, progreso);
    },

    responder(indice) {
        const s = this.session;
        const item = s.items[s.indice];
        if (s.respuestas.find(r => r.itemId === item.id)) return;
        const correcta = indice === item.clave;
        s.respuestas.push({
            itemId: item.id, elegida: indice, correcta,
            afirmacion: item.afirmacion,
            segundos: Math.round((Date.now() - s.inicioItem) / 1000)
        });
        // Se guarda intento por intento, no al final: si el alumno cierra la
        // pestaña a mitad de sesión, lo que ya practicó no se pierde.
        this.guardarIntento(item, indice, correcta, s.respuestas[s.respuestas.length - 1].segundos);
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
        } else {
            s.indice++;
            s.inicioItem = Date.now();
        }
        this.render();
    },

    // El resumen va a examResults, la misma colección de TOEFL/DELF: así el panel
    // del admin ya construido lo muestra sin tocar una línea.
    guardarResumen() {
        const s = this.session;
        const aciertos = s.respuestas.filter(r => r.correcta).length;
        const puntaje = Math.round((aciertos / s.respuestas.length) * 100);
        const nivel = icfesNivelDesempeno(puntaje);
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
        const nivel = icfesNivelDesempeno(puntaje);

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
