// ─────────────────────────────────────────────────────────────────────────────
// Motor de práctica DELF B1 (nouveau format) — CE lineal + PE con autoevaluación
// Depende de: delf-data.js (DELF_TESTS), shared.js (sanitizeHTML), router global.
// La production écrite la califica la IA (ia-calificadora.js) con la grilla
// oficial /25; si falla, queda la autoevaluación manual como respaldo.
// ─────────────────────────────────────────────────────────────────────────────

const DELF_HISTORY_KEY = 'sinapsis_delf_history';

const delfLogic = {
    session: null,

    start(section) {
        const test = DELF_TESTS[0];
        this.stopTimer();
        this.session = {
            test,
            section,            // 'ce' | 'pe'
            stage: 'intro',
            timer: null,
            // ce
            taskIndex: 0,
            ceAnswers: {},      // taskIndex -> array de índices elegidos
            ceExpired: false,
            // pe
            peText: '',
            peExpired: false,
            peSelf: {}          // key criterio -> puntos elegidos
        };
        router.navigate('delf-practice');
        this.render();
    },

    exit() {
        if (this.session && this.session.stage !== 'intro' && this.session.stage !== 'results') {
            if (!confirm('¿Salir de la práctica? Se perderá el progreso de esta sesión.')) return;
        }
        this.stopTimer();
        this.session = null;
        router.navigate('exam-modules');
    },

    // ── Timer (mismo patrón que toefl-practice.js) ───────────────────────────
    startTimer(minutes, onExpire) {
        this.stopTimer();
        const s = this.session;
        s.timer = { remaining: Math.round(minutes * 60), onExpire };
        s.timer.interval = setInterval(() => {
            s.timer.remaining--;
            this.paintTimer();
            if (s.timer.remaining <= 0) {
                this.stopTimer();
                onExpire();
            }
        }, 1000);
        this.paintTimer();
    },
    stopTimer() {
        if (this.session?.timer?.interval) clearInterval(this.session.timer.interval);
        if (this.session) this.session.timer = null;
    },
    paintTimer() {
        const el = document.getElementById('delf-timer');
        if (!el || !this.session?.timer) return;
        const r = Math.max(0, this.session.timer.remaining);
        const mm = String(Math.floor(r / 60)).padStart(2, '0');
        const ss = String(r % 60).padStart(2, '0');
        el.textContent = `${mm}:${ss}`;
        el.classList.toggle('text-red-600', r < 120);
        el.classList.toggle('animate-pulse', r < 120);
    },

    getHistory() {
        try { return JSON.parse(localStorage.getItem(DELF_HISTORY_KEY)) || []; }
        catch { return []; }
    },
    saveAttempt(entry) {
        const list = this.getHistory();
        list.unshift({ ...entry, date: new Date().toISOString() });
        localStorage.setItem(DELF_HISTORY_KEY, JSON.stringify(list.slice(0, 20)));
    },

    root() { return document.getElementById('delf-root'); },

    shell({ banner, timed, body }) {
        return `
            <div class="max-w-4xl mx-auto animate-fade-in pb-12">
                <div class="sticky top-16 z-30 bg-white/95 backdrop-blur rounded-2xl border border-gray-200 shadow-sm px-4 py-3 mb-6 flex items-center justify-between gap-3">
                    <div class="flex items-center gap-2 min-w-0">
                        <span class="px-2.5 py-1 rounded-lg bg-purple-600 text-white text-xs font-extrabold shrink-0">DELF B1</span>
                        <p class="text-sm font-bold text-gray-700 truncate">${banner}</p>
                    </div>
                    <div class="flex items-center gap-3 shrink-0">
                        ${timed ? `<span class="flex items-center gap-1.5 font-mono font-extrabold text-lg text-gray-900"><i class="ph-bold ph-timer text-purple-600"></i><span id="delf-timer">--:--</span></span>` : ''}
                        <button onclick="delfLogic.exit()" class="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition" title="Salir de la práctica"><i class="ph-bold ph-x text-lg"></i></button>
                    </div>
                </div>
                ${body}
            </div>`;
    },

    render() {
        const s = this.session;
        if (!s) return;
        if (s.stage === 'intro') return this.renderIntro();
        if (s.section === 'ce') return this.renderCE();
        return this.renderPE();
    },

    // ── Intro ────────────────────────────────────────────────────────────────
    renderIntro() {
        const s = this.session;
        const isCE = s.section === 'ce';
        const history = this.getHistory().filter(h => h.section === s.section).slice(0, 3);
        const details = isCE ? [
            ['ph-list-checks', 'Exercice 1 · S’orienter', 'Situación con criterios + 4 anuncios: decide Oui/Non y elige la opción correcta.'],
            ['ph-newspaper', 'Exercices 2 et 3 · La presse', 'Dos artículos (~300 palabras) con preguntas de selección múltiple.'],
            ['ph-check-square', 'Todo cerrado', 'En el formato nuevo NO hay respuestas abiertas: solo QCM y Oui/Non. 25 puntos.']
        ] : [
            ['ph-note-pencil', 'Un solo texto', 'Ensayo, carta o artículo de opinión sobre un tema de actualidad.'],
            ['ph-text-align-left', '160 palabras mínimo', 'Presenta hechos, ventajas/inconvenientes y tu punto de vista con ejemplos.'],
            ['ph-robot', 'Corrección con IA', 'La IA califica con la grilla oficial (consigne, faits, opinion, cohérence, lexique, grammaire) y señala qué mejorar.']
        ];
        this.root().innerHTML = this.shell({
            banner: isCE ? 'Compréhension écrite · Práctica' : 'Production écrite · Práctica',
            timed: false,
            body: `
                <div class="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-10">
                    <span class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-50 text-purple-700 text-xs font-bold uppercase tracking-widest border border-purple-100 mb-4">
                        <i class="ph-duotone ph-flag"></i> Nouveau format officiel
                    </span>
                    <h2 class="text-3xl font-extrabold text-gray-900 mb-2">${isCE ? 'Compréhension écrite' : 'Production écrite'} — DELF B1</h2>
                    <p class="text-gray-500 mb-8">${isCE
                        ? '45 minutos con cronómetro · 3 ejercicios · 25 puntos. Igual que el examen real: todas las preguntas son cerradas.'
                        : '45 minutos con cronómetro · 25 puntos. Al terminar, una IA corrige tu texto con la grilla oficial y lo comparas con una respuesta modelo.'}</p>
                    <div class="grid md:grid-cols-3 gap-4 mb-6">
                        ${details.map(([icon, name, desc]) => `
                            <div class="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                                <i class="ph-duotone ${icon} text-2xl text-purple-600"></i>
                                <h4 class="font-bold text-gray-900 mt-2 mb-1">${name}</h4>
                                <p class="text-xs text-gray-500 leading-relaxed">${desc}</p>
                            </div>`).join('')}
                    </div>
                    <div class="rounded-2xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-900 flex gap-2 mb-6">
                        <i class="ph-bold ph-info mt-0.5 shrink-0"></i>
                        <p>En el DELF real necesitas mínimo <strong>4,5/25 en cada prueba</strong> y <strong>50/100 en total</strong> para aprobar el diploma.</p>
                    </div>
                    ${history.length ? `
                        <div class="mb-6">
                            <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Tus últimos intentos</p>
                            <div class="flex flex-wrap gap-2">
                                ${history.map(h => `<span class="px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-100 text-xs font-semibold text-gray-600">${new Date(h.date).toLocaleDateString()} · ${sanitizeHTML(h.summary)}</span>`).join('')}
                            </div>
                        </div>` : ''}
                    <button onclick="delfLogic.begin()" class="w-full md:w-auto px-8 py-3.5 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition shadow-lg shadow-purple-600/20 flex items-center justify-center gap-2">
                        <i class="ph-bold ph-play"></i> Comenzar con cronómetro
                    </button>
                </div>`
        });
    },

    begin() {
        const s = this.session;
        if (s.section === 'ce') {
            s.stage = 'task';
            s.taskIndex = 0;
            this.renderCE();
            this.startTimer(s.test.ce.minutes, () => this.finishCE(true));
        } else {
            s.stage = 'write';
            this.renderPE();
            this.startTimer(s.test.pe.minutes, () => this.submitPE(true));
        }
    },

    // ── Compréhension écrite ─────────────────────────────────────────────────
    renderCE() {
        const s = this.session;
        if (s.stage === 'results') return this.renderCEResults();
        const task = s.test.ce.tasks[s.taskIndex];
        if (!s.ceAnswers[s.taskIndex]) s.ceAnswers[s.taskIndex] = task.questions.map(() => null);
        const answers = s.ceAnswers[s.taskIndex];
        const isLast = s.taskIndex === s.test.ce.tasks.length - 1;
        this.root().innerHTML = this.shell({
            banner: `Compréhension écrite · ${s.taskIndex + 1}/${s.test.ce.tasks.length}`,
            timed: true,
            body: `
                <div class="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8">
                    <p class="text-xs font-bold uppercase tracking-widest text-purple-600 mb-1">${sanitizeHTML(task.title)}</p>
                    <p class="text-sm text-gray-500 mb-6">${sanitizeHTML(task.instructions)}</p>
                    <div class="grid lg:grid-cols-2 gap-5">
                        <div class="rounded-2xl border border-gray-100 bg-gray-50/70 p-5 lg:max-h-[32rem] lg:overflow-y-auto">
                            <p class="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">${sanitizeHTML(task.textLabel)}</p>
                            <div class="text-gray-800 text-[15px] leading-relaxed whitespace-pre-line">${sanitizeHTML(task.text)}</div>
                        </div>
                        <div class="space-y-4">
                            ${task.questions.map((qu, qi) => `
                                <div>
                                    <p class="font-bold text-gray-900 mb-2 text-sm">${qi + 1}. ${sanitizeHTML(qu.q)}</p>
                                    <div class="${qu.options.length === 2 ? 'flex gap-2' : 'space-y-1.5'}">
                                        ${qu.options.map((opt, oi) => `
                                            <label class="flex items-start gap-2.5 p-2.5 rounded-xl border ${answers[qi] === oi ? 'border-purple-400 bg-purple-50' : 'border-gray-100 bg-white hover:bg-gray-50'} cursor-pointer transition text-sm ${qu.options.length === 2 ? 'flex-1 justify-center' : ''}">
                                                <input type="radio" name="delf-q-${qi}" ${answers[qi] === oi ? 'checked' : ''} onchange="delfLogic.setMC(${qi}, ${oi})" class="mt-0.5 accent-purple-600">
                                                <span class="text-gray-700">${sanitizeHTML(opt)}</span>
                                            </label>`).join('')}
                                    </div>
                                </div>`).join('')}
                        </div>
                    </div>
                    <div class="mt-8 flex justify-end gap-3">
                        ${s.taskIndex > 0 ? `<button onclick="delfLogic.prevTask()" class="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition">Anterior</button>` : ''}
                        <button onclick="delfLogic.nextTask()" class="px-6 py-2.5 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700 transition flex items-center gap-2">
                            ${isLast ? 'Terminar la prueba' : 'Exercice suivant'} <i class="ph-bold ph-arrow-right"></i>
                        </button>
                    </div>
                </div>`
        });
        this.paintTimer();
    },

    setMC(qi, oi) {
        this.session.ceAnswers[this.session.taskIndex][qi] = oi;
        this.renderCE();
    },
    prevTask() { this.session.taskIndex--; this.renderCE(); },
    nextTask() {
        const s = this.session;
        if (s.taskIndex < s.test.ce.tasks.length - 1) {
            s.taskIndex++;
            this.renderCE();
        } else {
            this.finishCE(false);
        }
    },

    finishCE(expired) {
        this.stopTimer();
        const s = this.session;
        s.ceExpired = expired;
        s.stage = 'results';
        this.renderCEResults();
    },

    renderCEResults() {
        const s = this.session;
        let correct = 0, total = 0;
        const breakdown = s.test.ce.tasks.map((task, ti) => {
            let c = 0;
            task.questions.forEach((qu, qi) => { total++; if (s.ceAnswers[ti]?.[qi] === qu.answer) { c++; correct++; } });
            return { title: task.title, correct: c, total: task.questions.length };
        });
        // 1 punto por ítem (25 ítems = 25 pts, como la prueba real)
        const points = Math.round((correct / total) * s.test.ce.totalPoints * 10) / 10;
        const passed = points >= 4.5;
        this.saveAttempt({ section: 'ce', summary: `CE ${points}/25 (${correct}/${total})` });
        this.root().innerHTML = this.shell({
            banner: 'Résultats · Compréhension écrite',
            timed: false,
            body: `
                <div class="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-10">
                    <div class="text-center mb-8">
                        <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Puntaje (escala oficial /25)</p>
                        <p class="text-6xl font-extrabold text-purple-600">${points}<span class="text-2xl text-gray-400">/25</span></p>
                        <p class="text-gray-500 mt-2">${correct} de ${total} respuestas correctas${s.ceExpired ? ' · el tiempo se agotó' : ''}</p>
                        <p class="mt-2 text-sm font-bold ${passed ? 'text-emerald-600' : 'text-red-500'}">${passed ? 'Superas el mínimo eliminatorio (4,5/25)' : 'Por debajo del mínimo eliminatorio (4,5/25)'}</p>
                    </div>
                    <div class="grid sm:grid-cols-3 gap-3 mb-8">
                        ${breakdown.map(b => `
                            <div class="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 text-center">
                                <p class="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">${sanitizeHTML(b.title.split('—')[0].trim())}</p>
                                <p class="text-2xl font-extrabold ${b.correct === b.total ? 'text-emerald-600' : b.correct >= b.total / 2 ? 'text-amber-600' : 'text-red-500'}">${b.correct}/${b.total}</p>
                            </div>`).join('')}
                    </div>
                    <div class="flex flex-wrap gap-3 justify-center">
                        <button onclick="delfLogic.start('ce')" class="px-6 py-3 rounded-xl border border-gray-200 text-gray-700 font-bold hover:bg-gray-50 transition"><i class="ph-bold ph-arrow-counter-clockwise"></i> Repetir práctica</button>
                        <button onclick="delfLogic.start('pe')" class="px-6 py-3 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700 transition"><i class="ph-bold ph-pencil-line"></i> Pasar a Production écrite</button>
                        <button onclick="delfLogic.exit()" class="px-6 py-3 rounded-xl border border-gray-200 text-gray-500 font-bold hover:bg-gray-50 transition">Volver a módulos</button>
                    </div>
                </div>`
        });
    },

    // ── Production écrite ────────────────────────────────────────────────────
    countWords(text) { return (String(text).trim().match(/\S+/g) || []).length; },

    renderPE() {
        const s = this.session;
        if (s.stage === 'selfeval') return this.renderPESelfEval();
        if (s.stage === 'results') return this.renderPEResults();
        const t = s.test.pe;
        this.root().innerHTML = this.shell({
            banner: 'Production écrite · 160 mots minimum',
            timed: true,
            body: `
                <div class="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8">
                    <div class="rounded-2xl border border-gray-100 bg-gray-50/70 p-5 mb-5">
                        <p class="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Consigne</p>
                        <p class="text-[15px] text-gray-800 leading-relaxed">${sanitizeHTML(t.consigne)}</p>
                    </div>
                    <textarea id="delf-pe-text" rows="14" oninput="delfLogic.onPEInput()" placeholder="Écrivez votre article ici…" class="w-full rounded-2xl border border-gray-200 p-4 text-[15px] text-gray-800 leading-relaxed focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition resize-y" spellcheck="false">${sanitizeHTML(s.peText)}</textarea>
                    <div class="flex items-center justify-between mt-3">
                        <p class="text-sm font-bold text-gray-400"><span id="delf-word-count">0</span> palabras · mínimo ${t.minWords}</p>
                        <button onclick="delfLogic.submitPE(false)" class="px-6 py-2.5 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700 transition">Terminar y autoevaluar <i class="ph-bold ph-arrow-right"></i></button>
                    </div>
                </div>`
        });
        this.onPEInput();
        this.paintTimer();
        document.getElementById('delf-pe-text')?.focus();
    },

    onPEInput() {
        const el = document.getElementById('delf-pe-text');
        if (!el) return;
        this.session.peText = el.value;
        const counter = document.getElementById('delf-word-count');
        if (counter) {
            const n = this.countWords(el.value);
            counter.textContent = n;
            counter.parentElement.classList.toggle('text-red-500', n > 0 && n < this.session.test.pe.minWords);
        }
    },

    async submitPE(expired) {
        this.stopTimer();
        const s = this.session;
        s.peExpired = expired;
        s.stage = 'selfeval';
        this.renderPESelfEval();
        await this.calificarConIA();
    },

    // La IA corrige con la grilla oficial /25. Si falla, queda la autoevaluación.
    async calificarConIA() {
        const s = this.session;
        s.iaEstado = 'cargando';
        this.renderPESelfEval();
        try {
            const r = await iaCalificadora.calificarDelf(s.test.pe, s.peText);
            s.iaResultado = r;
            s.iaEstado = 'listo';
            // Los puntos de la IA quedan cargados; el estudiante puede ajustarlos.
            r.criterios.forEach(c => { s.peSelf[c.clave] = c.puntos; });
        } catch (e) {
            s.iaEstado = 'error';
        }
        this.renderPESelfEval();
    },

    renderPESelfEval() {
        const s = this.session;
        const t = s.test.pe;
        const allSet = t.criteria.every(c => s.peSelf[c.key] !== undefined);
        const r = s.iaResultado;
        const iaCargando = s.iaEstado === 'cargando';
        this.root().innerHTML = this.shell({
            banner: 'Production écrite · Evaluación (grille /25)',
            timed: false,
            body: `
                <div class="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8 space-y-6">
                    <div>
                        <h3 class="text-2xl font-extrabold text-gray-900 mb-1">Tu texto, corregido</h3>
                        <p class="text-gray-500 text-sm">${s.iaEstado === 'error'
                            ? 'No pudimos conectar con la IA correctora. Autoevalúate con la grilla y la respuesta modelo.'
                            : 'La IA corrige con la grilla oficial del DELF B1 sobre 25 puntos y te señala qué mejorar.'}</p>
                    </div>
                    <div class="grid md:grid-cols-2 gap-4">
                        <div class="rounded-2xl bg-gray-50/70 border border-gray-100 p-4">
                            <p class="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Tu texto (${this.countWords(s.peText)} palabras)${s.peExpired ? ' · tiempo agotado' : ''}</p>
                            <p class="text-sm text-gray-700 leading-relaxed whitespace-pre-line">${s.peText.trim() ? sanitizeHTML(s.peText) : '<em class="text-gray-400">No escribiste respuesta.</em>'}</p>
                        </div>
                        <div class="rounded-2xl bg-green-50 border border-green-100 p-4">
                            <p class="text-[11px] font-bold uppercase tracking-widest text-emerald-600 mb-2">Respuesta modelo (~20/25)</p>
                            <p class="text-sm text-gray-700 leading-relaxed whitespace-pre-line">${sanitizeHTML(t.model)}</p>
                        </div>
                    </div>

                    ${iaCargando ? iaCalificadora.cargandoHTML('La IA está corrigiendo tu texto en francés…') : ''}
                    ${r ? iaCalificadora.tarjetaHTML(r, { escala: '/25', acento: 'purple' }) : ''}

                    <details class="space-y-4" ${r ? '' : 'open'}>
                        <summary class="text-sm font-bold text-gray-500 cursor-pointer hover:text-purple-600">${r ? '¿No estás de acuerdo? Ajusta los puntos tú mismo' : 'Asigna los puntos con la grilla oficial'}</summary>
                        <div class="space-y-4 mt-3">
                        ${t.criteria.map(c => `
                            <div class="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                                <div class="flex flex-col gap-2 mb-1">
                                    <p class="font-bold text-gray-900 text-sm">${sanitizeHTML(c.label)} <span class="text-gray-400 font-semibold">(máx. ${c.max} pts)</span></p>
                                    <div class="flex flex-wrap gap-1.5">
                                        ${Array.from({ length: c.max * 2 + 1 }, (_, i) => i / 2).map(v => `
                                            <button onclick="delfLogic.setCriterion('${c.key}', ${v})"
                                                class="w-9 h-9 rounded-lg border text-xs font-extrabold transition ${s.peSelf[c.key] === v ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-500 border-gray-200 hover:border-purple-300'}">${v}</button>`).join('')}
                                    </div>
                                </div>
                                <p class="text-xs text-gray-500">${sanitizeHTML(c.desc)}</p>
                            </div>`).join('')}
                        </div>
                    </details>
                    <div class="flex justify-end">
                        <button onclick="delfLogic.finishPE()" ${allSet ? '' : 'disabled'}
                            class="px-8 py-3 rounded-xl font-bold transition ${allSet ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-600/20' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}">
                            Ver resultado <i class="ph-bold ph-flag-checkered"></i>
                        </button>
                    </div>
                </div>`
        });
    },

    setCriterion(key, value) {
        this.session.peSelf[key] = value;
        this.renderPESelfEval();
    },

    finishPE() {
        const s = this.session;
        s.stage = 'results';
        this.renderPEResults();
    },

    renderPEResults() {
        const s = this.session;
        const t = s.test.pe;
        const points = Math.round(t.criteria.reduce((a, c) => a + (s.peSelf[c.key] || 0), 0) * 10) / 10;
        const passed = points >= 4.5;
        this.saveAttempt({ section: 'pe', summary: `PE ${points}/25 (autoeval.)` });
        this.root().innerHTML = this.shell({
            banner: 'Résultats · Production écrite',
            timed: false,
            body: `
                <div class="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-10">
                    <div class="text-center mb-8">
                        <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Puntaje autoevaluado (escala oficial /25)</p>
                        <p class="text-6xl font-extrabold text-purple-600">${points}<span class="text-2xl text-gray-400">/25</span></p>
                        <p class="mt-2 text-sm font-bold ${passed ? 'text-emerald-600' : 'text-red-500'}">${passed ? 'Superas el mínimo eliminatorio (4,5/25)' : 'Por debajo del mínimo eliminatorio (4,5/25)'}</p>
                    </div>
                    <div class="grid sm:grid-cols-2 md:grid-cols-3 gap-3 mb-8">
                        ${t.criteria.map(c => `
                            <div class="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 text-center">
                                <p class="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">${sanitizeHTML(c.label)}</p>
                                <p class="text-2xl font-extrabold text-gray-900">${s.peSelf[c.key] ?? 0}<span class="text-sm text-gray-400">/${c.max}</span></p>
                            </div>`).join('')}
                    </div>
                    <div class="flex flex-wrap gap-3 justify-center">
                        <button onclick="delfLogic.start('pe')" class="px-6 py-3 rounded-xl border border-gray-200 text-gray-700 font-bold hover:bg-gray-50 transition"><i class="ph-bold ph-arrow-counter-clockwise"></i> Repetir práctica</button>
                        <button onclick="delfLogic.start('ce')" class="px-6 py-3 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700 transition"><i class="ph-bold ph-book-open"></i> Pasar a Compréhension écrite</button>
                        <button onclick="delfLogic.exit()" class="px-6 py-3 rounded-xl border border-gray-200 text-gray-500 font-bold hover:bg-gray-50 transition">Volver a módulos</button>
                    </div>
                </div>`
        });
    }
};
