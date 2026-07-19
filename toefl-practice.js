// ─────────────────────────────────────────────────────────────────────────────
// Motor de práctica TOEFL (formato 2026) — Reading adaptativo + Writing
// Depende de: toefl-data.js (TOEFL_TESTS), shared.js (sanitizeHTML, state),
// y del router global de index.html.
// El email y la discussion los califica la IA (ia-calificadora.js) con la
// escala oficial 1-6; si falla, queda la autoevaluación manual como respaldo.
// ─────────────────────────────────────────────────────────────────────────────

const TOEFL_HISTORY_KEY = 'sinapsis_toefl_history';

const toeflLogic = {
    session: null,

    // ── Entrada ──────────────────────────────────────────────────────────────
    start(section) {
        // Banco de Firestore (precargado en state.examBank); respaldo: el JS.
        const bank = (window.state && state.examBank && state.examBank.TOEFL) || [];
        const test = bank.length ? bank[0] : TOEFL_TESTS[0];
        this.stopTimer();
        this.session = {
            test,
            section,               // 'reading' | 'writing'
            stage: 'intro',
            timer: null,
            // reading
            moduleKey: null,       // 'module1' | 'module2easy' | 'module2hard'
            taskIndex: 0,
            readingAnswers: {},    // `${moduleKey}:${taskIndex}` -> respuestas de la tarea
            readingResults: [],    // {moduleKey, label, correct, total}
            // writing
            writingStep: 0,        // 0 build, 1 email, 2 discussion, 3 self-eval
            buildIndex: 0,
            buildPicks: [],        // por ítem: array de chips elegidas
            buildResults: [],      // true/false por ítem
            emailText: '',
            discussionText: '',
            selfBands: { email: null, discussion: null }
        };
        router.navigate('toefl-practice');
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

    // ── Timer ────────────────────────────────────────────────────────────────
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
        const el = document.getElementById('toefl-timer');
        if (!el || !this.session?.timer) return;
        const r = Math.max(0, this.session.timer.remaining);
        const mm = String(Math.floor(r / 60)).padStart(2, '0');
        const ss = String(r % 60).padStart(2, '0');
        el.textContent = `${mm}:${ss}`;
        el.classList.toggle('text-red-600', r < 60);
        el.classList.toggle('animate-pulse', r < 60);
    },

    // ── Historial local ──────────────────────────────────────────────────────
    getHistory() {
        try { return JSON.parse(localStorage.getItem(TOEFL_HISTORY_KEY)) || []; }
        catch { return []; }
    },
    saveAttempt(entry) {
        const list = this.getHistory();
        list.unshift({ ...entry, date: new Date().toISOString() });
        localStorage.setItem(TOEFL_HISTORY_KEY, JSON.stringify(list.slice(0, 20)));
        // Persistencia en el perfil (best-effort, solo con sesión real): que el
        // progreso sea observable para el estudiante y su colegio.
        if (typeof saveExamResult === 'function') saveExamResult({ exam: 'TOEFL', ...entry });
    },

    // ── Render raíz ──────────────────────────────────────────────────────────
    root() { return document.getElementById('toefl-root'); },

    render() {
        const s = this.session;
        if (!s) return;
        if (s.stage === 'intro') return this.renderIntro();
        if (s.section === 'reading') return this.renderReadingStage();
        return this.renderWritingStage();
    },

    shell({ banner, timed, body }) {
        return `
            <div class="max-w-4xl mx-auto animate-fade-in pb-12">
                <div class="sticky top-16 z-30 bg-white/95 backdrop-blur rounded-2xl border border-gray-200 shadow-sm px-4 py-3 mb-6 flex items-center justify-between gap-3">
                    <div class="flex items-center gap-2 min-w-0">
                        <span class="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-extrabold shrink-0">TOEFL</span>
                        <p class="text-sm font-bold text-gray-700 truncate">${banner}</p>
                    </div>
                    <div class="flex items-center gap-3 shrink-0">
                        ${timed ? `<span class="flex items-center gap-1.5 font-mono font-extrabold text-lg text-gray-900"><i class="ph-bold ph-timer text-blue-600"></i><span id="toefl-timer">--:--</span></span>` : ''}
                        <button onclick="toeflLogic.exit()" class="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition" title="Salir de la práctica"><i class="ph-bold ph-x text-lg"></i></button>
                    </div>
                </div>
                ${body}
            </div>`;
    },

    // ── Intro ────────────────────────────────────────────────────────────────
    renderIntro() {
        const s = this.session;
        const isReading = s.section === 'reading';
        const history = this.getHistory().filter(h => h.section === s.section).slice(0, 3);
        const details = isReading ? [
            ['ph-list-magnifying-glass', 'Complete the Words', 'Párrafos con 10 palabras incompletas: escribe las letras que faltan.'],
            ['ph-chats-circle', 'Read in Daily Life', 'Textos cotidianos cortos (emails, avisos, mensajes, recibos) con preguntas de selección.'],
            ['ph-books', 'Read an Academic Passage', 'Pasajes académicos de ~200 palabras con preguntas de selección múltiple.']
        ] : [
            ['ph-puzzle-piece', 'Build a Sentence', '10 respuestas de conversación con fichas desordenadas. 7 minutos en total. Ojo: hay fichas que sobran.'],
            ['ph-envelope-simple', 'Write an Email', 'Escenario real + 3 puntos que debes cubrir. ~100–120 palabras en 7 minutos.'],
            ['ph-chats-teardrop', 'Academic Discussion', 'Pregunta del profesor + 2 posts de estudiantes. Aporta un argumento nuevo en 10 minutos.']
        ];
        const adaptiveNote = isReading ? `
            <div class="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 flex gap-2 mb-6">
                <i class="ph-bold ph-arrows-split mt-0.5 shrink-0"></i>
                <p><strong>Examen adaptativo:</strong> como en el TOEFL real, según tu desempeño en el Módulo 1 pasarás a un Módulo 2 exigente (más académico) o sencillo (más vida diaria). El aviso de arriba siempre te dirá en qué módulo estás.</p>
            </div>` : `
            <div class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-2 mb-6">
                <i class="ph-bold ph-scales mt-0.5 shrink-0"></i>
                <p><strong>Calificación:</strong> Build a Sentence se corrige automáticamente. El email y la discusión los autoevalúas al final con la rúbrica oficial de bandas 1–6 y una respuesta modelo.</p>
            </div>`;

        this.root().innerHTML = this.shell({
            banner: isReading ? 'Reading · Práctica formato 2026' : 'Writing · Práctica formato 2026',
            timed: false,
            body: `
                <div class="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-10">
                    <span class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-widest border border-blue-100 mb-4">
                        <i class="ph-duotone ph-globe-hemisphere-west"></i> Formato oficial desde enero 2026
                    </span>
                    <h2 class="text-3xl font-extrabold text-gray-900 mb-2">${isReading ? 'Sección Reading' : 'Sección Writing'}</h2>
                    <p class="text-gray-500 mb-8">${isReading
                        ? 'Dos módulos con cronómetro (≈13 y 14 min). Tres tipos de tarea, del vocabulario a la lectura académica.'
                        : 'Tres tareas con cronómetro propio (≈23 min en total), de armar oraciones a escribir en una discusión académica.'}</p>
                    <div class="grid md:grid-cols-3 gap-4 mb-6">
                        ${details.map(([icon, name, desc]) => `
                            <div class="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                                <i class="ph-duotone ${icon} text-2xl text-blue-600"></i>
                                <h4 class="font-bold text-gray-900 mt-2 mb-1">${name}</h4>
                                <p class="text-xs text-gray-500 leading-relaxed">${desc}</p>
                            </div>`).join('')}
                    </div>
                    ${adaptiveNote}
                    ${history.length ? `
                        <div class="mb-6">
                            <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Tus últimos intentos</p>
                            <div class="flex flex-wrap gap-2">
                                ${history.map(h => `<span class="px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-100 text-xs font-semibold text-gray-600">${new Date(h.date).toLocaleDateString()} · ${sanitizeHTML(h.summary)}</span>`).join('')}
                            </div>
                        </div>` : ''}
                    <button onclick="toeflLogic.begin()" class="w-full md:w-auto px-8 py-3.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2">
                        <i class="ph-bold ph-play"></i> Comenzar con cronómetro
                    </button>
                </div>`
        });
    },

    begin() {
        const s = this.session;
        if (s.section === 'reading') {
            s.stage = 'module';
            s.moduleKey = 'module1';
            s.taskIndex = 0;
            const mod = s.test.reading.module1;
            this.renderReadingStage();
            this.startTimer(mod.minutes, () => this.finishModule(true));
        } else {
            s.stage = 'writing';
            s.writingStep = 0;
            s.buildIndex = 0;
            s.buildPicks = s.test.writing.buildSentence.items.map(() => []);
            this.renderWritingStage();
            this.startTimer(s.test.writing.buildSentence.minutes, () => this.finishBuild(true));
        }
    },

    // ═════════════════════════════ READING ═══════════════════════════════════

    currentModule() { return this.session.test.reading[this.session.moduleKey]; },

    renderReadingStage() {
        const s = this.session;
        if (s.stage === 'interstitial') return this.renderInterstitial();
        if (s.stage === 'results') return this.renderReadingResults();
        const mod = this.currentModule();
        const task = mod.tasks[s.taskIndex];
        const key = `${s.moduleKey}:${s.taskIndex}`;
        if (!s.readingAnswers[key]) {
            s.readingAnswers[key] = task.type === 'complete_words'
                ? task.gaps.map(() => '')
                : task.questions.map(() => null);
        }
        const body = task.type === 'complete_words'
            ? this.renderCompleteWords(task, key)
            : this.renderMCTask(task, key);
        const isLast = s.taskIndex === mod.tasks.length - 1;
        this.root().innerHTML = this.shell({
            banner: mod.label,
            timed: true,
            body: `
                <div class="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8">
                    <div class="flex items-center justify-between gap-3 mb-1">
                        <p class="text-xs font-bold uppercase tracking-widest text-blue-600">Tarea ${s.taskIndex + 1} de ${mod.tasks.length} · ${sanitizeHTML(task.title)}</p>
                    </div>
                    <p class="text-sm text-gray-500 mb-6">${sanitizeHTML(task.instructions)}</p>
                    ${body}
                    <div class="mt-8 flex justify-end gap-3">
                        ${s.taskIndex > 0 ? `<button onclick="toeflLogic.prevTask()" class="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition">Anterior</button>` : ''}
                        <button onclick="toeflLogic.nextTask()" class="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition flex items-center gap-2">
                            ${isLast ? 'Terminar módulo' : 'Siguiente tarea'} <i class="ph-bold ph-arrow-right"></i>
                        </button>
                    </div>
                </div>`
        });
        this.paintTimer();
    },

    renderCompleteWords(task, key) {
        const answers = this.session.readingAnswers[key];
        let html = sanitizeHTML(task.text);
        task.gaps.forEach((gap, i) => {
            const filled = sanitizeHTML(answers[i] || '');
            const n = gap.missing.length;
            // Fiel al examen real: una raya por cada letra que falta (la pista es
            // CUÁNTAS letras) y el input acepta exactamente esas letras, ni una más.
            const guiones = '_'.repeat(n);
            const widthCh = Math.max(n, 2);
            const box = `<span class="inline-flex items-baseline whitespace-nowrap font-semibold text-blue-700"><span class="text-[10px] text-gray-400 font-bold mr-0.5 self-start">${i + 1}</span>${sanitizeHTML(gap.prefix)}<input id="toefl-gap-${i}" value="${filled}" maxlength="${n}" placeholder="${guiones}" style="width:calc(${widthCh}ch + 0.8rem); letter-spacing:0.28em" oninput="toeflLogic.setGap('${key}', ${i}, this.value)" class="mx-0.5 px-1 border-b-2 border-blue-400 bg-blue-50 rounded-t-md text-blue-800 font-bold placeholder:text-blue-300 placeholder:tracking-[0.28em] focus:outline-none focus:border-blue-600 text-center lowercase" autocomplete="off" autocapitalize="off" spellcheck="false"></span>`;
            html = html.replace(`[[${i + 1}]]`, box);
        });
        return `<div class="rounded-2xl border border-gray-100 bg-gray-50/70 p-5 md:p-6 leading-loose text-gray-800 text-[15px]">${html}</div>
            <p class="text-xs text-gray-400 mt-3"><i class="ph-bold ph-info"></i> Cada raya es una letra que falta: completa la palabra escribiendo solo esas letras.</p>`;
    },

    setGap(key, i, value) {
        this.session.readingAnswers[key][i] = value;
    },

    renderMCTask(task, key) {
        const answers = this.session.readingAnswers[key];
        return `
            <div class="grid lg:grid-cols-2 gap-5">
                <div class="rounded-2xl border border-gray-100 bg-gray-50/70 p-5">
                    <p class="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">${sanitizeHTML(task.textLabel)}</p>
                    <div class="text-gray-800 text-[15px] leading-relaxed whitespace-pre-line">${sanitizeHTML(task.text)}</div>
                </div>
                <div class="space-y-5">
                    ${task.questions.map((qu, qi) => `
                        <div>
                            <p class="font-bold text-gray-900 mb-2 text-sm">${qi + 1}. ${sanitizeHTML(qu.q)}</p>
                            <div class="space-y-1.5">
                                ${qu.options.map((opt, oi) => `
                                    <label class="flex items-start gap-2.5 p-2.5 rounded-xl border ${answers[qi] === oi ? 'border-blue-400 bg-blue-50' : 'border-gray-100 bg-white hover:bg-gray-50'} cursor-pointer transition text-sm">
                                        <input type="radio" name="toefl-q-${qi}" ${answers[qi] === oi ? 'checked' : ''} onchange="toeflLogic.setMC('${key}', ${qi}, ${oi})" class="mt-0.5 accent-blue-600">
                                        <span class="text-gray-700">${sanitizeHTML(opt)}</span>
                                    </label>`).join('')}
                            </div>
                        </div>`).join('')}
                </div>
            </div>`;
    },

    setMC(key, qi, oi) {
        this.session.readingAnswers[key][qi] = oi;
        this.renderReadingStage();
    },

    prevTask() {
        this.session.taskIndex--;
        this.renderReadingStage();
    },

    nextTask() {
        const s = this.session;
        const mod = this.currentModule();
        if (s.taskIndex < mod.tasks.length - 1) {
            s.taskIndex++;
            this.renderReadingStage();
        } else {
            this.finishModule(false);
        }
    },

    gradeTask(task, answers) {
        let correct = 0, total = 0;
        if (task.type === 'complete_words') {
            task.gaps.forEach((gap, i) => {
                total++;
                if ((answers?.[i] || '').trim().toLowerCase() === gap.missing.toLowerCase()) correct++;
            });
        } else {
            task.questions.forEach((qu, qi) => {
                total++;
                if (answers?.[qi] === qu.answer) correct++;
            });
        }
        return { correct, total };
    },

    finishModule(expired) {
        this.stopTimer();
        const s = this.session;
        const mod = this.currentModule();
        let correct = 0, total = 0;
        const taskBreakdown = mod.tasks.map((task, ti) => {
            const g = this.gradeTask(task, s.readingAnswers[`${s.moduleKey}:${ti}`]);
            correct += g.correct; total += g.total;
            return { title: task.title, ...g };
        });
        s.readingResults.push({ moduleKey: s.moduleKey, label: mod.label, correct, total, taskBreakdown, expired });

        if (s.moduleKey === 'module1') {
            const pct = correct / total;
            s.nextModuleKey = pct >= s.test.reading.adaptiveThreshold ? 'module2hard' : 'module2easy';
            s.stage = 'interstitial';
            this.renderInterstitial();
        } else {
            s.stage = 'results';
            this.renderReadingResults();
        }
    },

    renderInterstitial() {
        const s = this.session;
        const r1 = s.readingResults[0];
        const hard = s.nextModuleKey === 'module2hard';
        this.root().innerHTML = this.shell({
            banner: 'Módulo 1 completado',
            timed: false,
            body: `
                <div class="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 md:p-10 text-center">
                    <div class="w-16 h-16 mx-auto rounded-2xl ${hard ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-green-50 text-emerald-600 border-green-100'} border flex items-center justify-center text-3xl mb-4">
                        <i class="ph-duotone ${hard ? 'ph-trend-up' : 'ph-path'}"></i>
                    </div>
                    <h3 class="text-2xl font-extrabold text-gray-900 mb-2">Módulo 1: ${r1.correct} de ${r1.total} correctas${r1.expired ? ' (tiempo agotado)' : ''}</h3>
                    <p class="text-gray-500 max-w-lg mx-auto mb-8">Como en el TOEFL real, el examen se adapta: ${hard
                        ? 'tu desempeño te lleva a la <strong>ruta exigente</strong>, con énfasis en textos académicos. Aquí se alcanzan las bandas más altas.'
                        : 'continuarás por la <strong>ruta sencilla</strong>, con énfasis en textos de la vida diaria.'}</p>
                    <button onclick="toeflLogic.startModule2()" class="px-8 py-3.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-600/20">
                        Continuar al Módulo 2 <i class="ph-bold ph-arrow-right"></i>
                    </button>
                </div>`
        });
    },

    startModule2() {
        const s = this.session;
        s.stage = 'module';
        s.moduleKey = s.nextModuleKey;
        s.taskIndex = 0;
        const mod = this.currentModule();
        this.renderReadingStage();
        this.startTimer(mod.minutes, () => this.finishModule(true));
    },

    estimateReadingBand() {
        const s = this.session;
        const totC = s.readingResults.reduce((a, r) => a + r.correct, 0);
        const totT = s.readingResults.reduce((a, r) => a + r.total, 0);
        const pct = totT ? totC / totT : 0;
        const hard = s.readingResults[1]?.moduleKey === 'module2hard';
        // Estimación no oficial: la ruta exigente habilita bandas superiores
        const band = hard ? 2.5 + pct * 3.5 : 1 + pct * 3.5;
        return { band: Math.round(Math.min(6, Math.max(1, band)) * 2) / 2, pct, totC, totT };
    },

    renderReadingResults() {
        const s = this.session;
        const est = this.estimateReadingBand();
        this.saveAttempt({ section: 'reading', score: est.band, scale: '/6', summary: `Reading banda ~${est.band} (${est.totC}/${est.totT})` });
        this.root().innerHTML = this.shell({
            banner: 'Resultados · Reading',
            timed: false,
            body: `
                <div class="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-10">
                    <div class="text-center mb-8">
                        <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Banda estimada (no oficial, escala 1–6)</p>
                        <p class="text-6xl font-extrabold text-blue-600">${est.band}<span class="text-2xl text-gray-300"> /6</span></p>
                        <p class="mt-1 text-sm font-bold text-blue-700">Nivel aproximado ${bandToCEFR(est.band)} <span class="text-gray-400 font-semibold">(MCER)</span></p>
                        <p class="text-gray-500 mt-2">${est.totC} de ${est.totT} respuestas correctas (${Math.round(est.pct * 100)}%)</p>
                    </div>
                    <div class="space-y-4 mb-8">
                        ${s.readingResults.map(r => `
                            <div class="rounded-2xl border border-gray-100 bg-gray-50/70 p-5">
                                <div class="flex items-center justify-between gap-3 mb-3">
                                    <p class="font-bold text-gray-900 text-sm">${sanitizeHTML(r.label)}</p>
                                    <span class="px-3 py-1 rounded-lg bg-white border border-gray-200 text-sm font-extrabold text-gray-700 shrink-0">${r.correct}/${r.total}</span>
                                </div>
                                <div class="grid sm:grid-cols-2 gap-2">
                                    ${r.taskBreakdown.map(t => `
                                        <div class="flex items-center justify-between px-3 py-2 rounded-xl bg-white border border-gray-100 text-xs">
                                            <span class="font-semibold text-gray-600">${sanitizeHTML(t.title)}</span>
                                            <span class="font-extrabold ${t.correct === t.total ? 'text-emerald-600' : t.correct >= t.total / 2 ? 'text-amber-600' : 'text-red-500'}">${t.correct}/${t.total}</span>
                                        </div>`).join('')}
                                </div>
                                ${r.expired ? '<p class="text-xs text-red-500 font-semibold mt-2"><i class="ph-bold ph-timer"></i> El tiempo se agotó en este módulo.</p>' : ''}
                            </div>`).join('')}
                    </div>
                    <div class="flex flex-wrap gap-3 justify-center">
                        <button onclick="toeflLogic.start('reading')" class="px-6 py-3 rounded-xl border border-gray-200 text-gray-700 font-bold hover:bg-gray-50 transition"><i class="ph-bold ph-arrow-counter-clockwise"></i> Repetir práctica</button>
                        <button onclick="toeflLogic.start('writing')" class="px-6 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition"><i class="ph-bold ph-pencil-line"></i> Pasar a Writing</button>
                        <button onclick="toeflLogic.exit()" class="px-6 py-3 rounded-xl border border-gray-200 text-gray-500 font-bold hover:bg-gray-50 transition">Volver a módulos</button>
                    </div>
                </div>`
        });
    },

    // ═════════════════════════════ WRITING ═══════════════════════════════════

    renderWritingStage() {
        const s = this.session;
        if (s.stage === 'results') return this.renderWritingResults();
        if (s.writingStep === 0) return this.renderBuildSentence();
        if (s.writingStep === 1) return this.renderEmailTask();
        if (s.writingStep === 2) return this.renderDiscussionTask();
        return this.renderSelfEval();
    },

    // ── Build a Sentence ─────────────────────────────────────────────────────
    buildChipPool(item) {
        // Baraja determinista por ítem (mismo orden mientras dura la sesión)
        if (!item._pool) {
            const all = [...item.chips, ...(item.distractors || [])];
            for (let i = all.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [all[i], all[j]] = [all[j], all[i]];
            }
            item._pool = all;
        }
        return item._pool;
    },

    renderBuildSentence() {
        const s = this.session;
        const bs = s.test.writing.buildSentence;
        const item = bs.items[s.buildIndex];
        const pool = this.buildChipPool(item);
        const picks = s.buildPicks[s.buildIndex];
        const isLast = s.buildIndex === bs.items.length - 1;
        this.root().innerHTML = this.shell({
            banner: `Writing · Tarea 1: Build a Sentence (${s.buildIndex + 1}/${bs.items.length})`,
            timed: true,
            body: `
                <div class="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8">
                    <p class="text-sm text-gray-500 mb-6">${sanitizeHTML(bs.instructions)}</p>
                    <div class="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 mb-5">
                        <p class="text-[15px] text-gray-800 font-medium">${sanitizeHTML(item.context)}</p>
                    </div>
                    <p class="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Tu respuesta (B:)</p>
                    <div class="min-h-[3.5rem] rounded-2xl border-2 border-dashed ${picks.length ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-gray-50/70'} p-3 flex flex-wrap gap-2 mb-4">
                        ${picks.length ? picks.map((chip, ci) => `
                            <button onclick="toeflLogic.unpickChip(${ci})" class="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition shadow-sm">${sanitizeHTML(chip)}</button>`).join('')
                            : '<span class="text-sm text-gray-400 italic self-center">Toca las fichas de abajo en orden…</span>'}
                    </div>
                    <div class="flex flex-wrap gap-2 mb-6">
                        ${pool.map((chip, pi) => this.chipIsPicked(picks, pool, pi)
                            ? `<button disabled class="px-3 py-1.5 rounded-xl bg-gray-100 text-gray-300 text-sm font-bold border border-gray-100">${sanitizeHTML(chip)}</button>`
                            : `<button onclick="toeflLogic.pickChip(${pi})" class="px-3 py-1.5 rounded-xl bg-white text-gray-800 text-sm font-bold border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition shadow-sm">${sanitizeHTML(chip)}</button>`
                        ).join('')}
                    </div>
                    <div class="flex justify-between items-center">
                        <button onclick="toeflLogic.clearPicks()" class="text-sm font-bold text-gray-400 hover:text-red-500 transition"><i class="ph-bold ph-eraser"></i> Limpiar</button>
                        <button onclick="toeflLogic.nextBuild()" class="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition flex items-center gap-2">
                            ${isLast ? 'Terminar tarea' : 'Siguiente'} <i class="ph-bold ph-arrow-right"></i>
                        </button>
                    </div>
                </div>`
        });
        this.paintTimer();
    },

    // Manejo de fichas repetidas: se marca elegida la N-ésima ocurrencia
    chipIsPicked(picks, pool, poolIndex) {
        const chip = pool[poolIndex];
        let occurrence = 0;
        for (let i = 0; i <= poolIndex; i++) if (pool[i] === chip) occurrence++;
        return this.chipUsedCount(picks, chip) >= occurrence;
    },
    chipUsedCount(picks, chip) { return picks.filter(c => c === chip).length; },

    pickChip(poolIndex) {
        const s = this.session;
        const item = s.test.writing.buildSentence.items[s.buildIndex];
        const chip = item._pool[poolIndex];
        s.buildPicks[s.buildIndex].push(chip);
        this.renderBuildSentence();
    },

    unpickChip(pickIndex) {
        this.session.buildPicks[this.session.buildIndex].splice(pickIndex, 1);
        this.renderBuildSentence();
    },

    clearPicks() {
        this.session.buildPicks[this.session.buildIndex] = [];
        this.renderBuildSentence();
    },

    nextBuild() {
        const s = this.session;
        if (s.buildIndex < s.test.writing.buildSentence.items.length - 1) {
            s.buildIndex++;
            this.renderBuildSentence();
        } else {
            this.finishBuild(false);
        }
    },

    normalizeSentence(str) {
        return String(str).toLowerCase().replace(/[.,!?;:'’"]/g, '').replace(/\s+/g, ' ').trim();
    },

    finishBuild(expired) {
        this.stopTimer();
        const s = this.session;
        const bs = s.test.writing.buildSentence;
        s.buildResults = bs.items.map((item, i) =>
            this.normalizeSentence(s.buildPicks[i].join(' ')) === this.normalizeSentence(item.answer));
        s.buildExpired = expired;
        s.writingStep = 1;
        this.renderEmailTask();
        this.startTimer(s.test.writing.email.minutes, () => this.submitEmail(true));
    },

    // ── Write an Email ───────────────────────────────────────────────────────
    countWords(text) { return (String(text).trim().match(/\S+/g) || []).length; },

    renderEmailTask() {
        const s = this.session;
        const t = s.test.writing.email;
        this.root().innerHTML = this.shell({
            banner: 'Writing · Tarea 2: Write an Email',
            timed: true,
            body: `
                <div class="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8">
                    <div class="rounded-2xl border border-gray-100 bg-gray-50/70 p-5 mb-5">
                        <p class="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Scenario</p>
                        <p class="text-[15px] text-gray-800 leading-relaxed mb-3">${sanitizeHTML(t.scenario)}</p>
                        <p class="text-[15px] text-gray-900 font-bold mb-2">${sanitizeHTML(t.recipient)} In your email:</p>
                        <ul class="space-y-1">
                            ${t.bullets.map(b => `<li class="text-[15px] text-gray-700 flex gap-2"><i class="ph-bold ph-dot-outline text-blue-600 mt-1"></i>${sanitizeHTML(b)}</li>`).join('')}
                        </ul>
                    </div>
                    <textarea id="toefl-email-text" rows="10" oninput="toeflLogic.onWrittenInput('email')" placeholder="Dear Professor Reed, ..." class="w-full rounded-2xl border border-gray-200 p-4 text-[15px] text-gray-800 leading-relaxed focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition resize-y" spellcheck="false">${sanitizeHTML(s.emailText)}</textarea>
                    <div class="flex items-center justify-between mt-3">
                        <p class="text-sm font-bold text-gray-400"><span id="toefl-word-count">0</span> palabras · objetivo ${t.targetWords[0]}–${t.targetWords[1]}</p>
                        <button onclick="toeflLogic.submitEmail(false)" class="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition">Enviar y continuar <i class="ph-bold ph-arrow-right"></i></button>
                    </div>
                </div>`
        });
        this.onWrittenInput('email');
        this.paintTimer();
        document.getElementById('toefl-email-text')?.focus();
    },

    onWrittenInput(kind) {
        const el = document.getElementById(kind === 'email' ? 'toefl-email-text' : 'toefl-discussion-text');
        if (!el) return;
        if (kind === 'email') this.session.emailText = el.value;
        else this.session.discussionText = el.value;
        const counter = document.getElementById('toefl-word-count');
        if (counter) counter.textContent = this.countWords(el.value);
    },

    submitEmail(expired) {
        this.stopTimer();
        const s = this.session;
        s.emailExpired = expired;
        s.writingStep = 2;
        this.renderDiscussionTask();
        this.startTimer(s.test.writing.discussion.minutes, () => this.submitDiscussion(true));
    },

    // ── Academic Discussion ──────────────────────────────────────────────────
    renderDiscussionTask() {
        const s = this.session;
        const t = s.test.writing.discussion;
        this.root().innerHTML = this.shell({
            banner: 'Writing · Tarea 3: Academic Discussion',
            timed: true,
            body: `
                <div class="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8">
                    <div class="space-y-3 mb-5">
                        <div class="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                            <p class="text-xs font-extrabold text-blue-700 mb-1"><i class="ph-bold ph-chalkboard-teacher"></i> ${sanitizeHTML(t.professor.name)}</p>
                            <p class="text-[15px] text-gray-800 leading-relaxed">${sanitizeHTML(t.professor.post)}</p>
                        </div>
                        <div class="grid md:grid-cols-2 gap-3">
                            ${t.students.map(st => `
                                <div class="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                                    <p class="text-xs font-extrabold text-gray-500 mb-1"><i class="ph-bold ph-student"></i> ${sanitizeHTML(st.name)}</p>
                                    <p class="text-sm text-gray-700 leading-relaxed">${sanitizeHTML(st.post)}</p>
                                </div>`).join('')}
                        </div>
                    </div>
                    <p class="text-sm text-gray-500 mb-3"><i class="ph-bold ph-lightbulb text-amber-500"></i> Menciona a los otros estudiantes brevemente y aporta un <strong>argumento nuevo</strong> que nadie haya dado.</p>
                    <textarea id="toefl-discussion-text" rows="9" oninput="toeflLogic.onWrittenInput('discussion')" placeholder="I see valid points in both posts, but..." class="w-full rounded-2xl border border-gray-200 p-4 text-[15px] text-gray-800 leading-relaxed focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition resize-y" spellcheck="false">${sanitizeHTML(s.discussionText)}</textarea>
                    <div class="flex items-center justify-between mt-3">
                        <p class="text-sm font-bold text-gray-400"><span id="toefl-word-count">0</span> palabras · objetivo ${t.targetWords[0]}–${t.targetWords[1]}</p>
                        <button onclick="toeflLogic.submitDiscussion(false)" class="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition">Enviar y autoevaluar <i class="ph-bold ph-arrow-right"></i></button>
                    </div>
                </div>`
        });
        this.onWrittenInput('discussion');
        this.paintTimer();
        document.getElementById('toefl-discussion-text')?.focus();
    },

    async submitDiscussion(expired) {
        this.stopTimer();
        const s = this.session;
        s.discussionExpired = expired;
        s.writingStep = 3;
        this.renderSelfEval();
        await this.calificarConIA();
    },

    // La IA corrige los dos textos en paralelo. Si falla, queda la
    // autoevaluación con rúbrica (la práctica nunca se bloquea).
    async calificarConIA() {
        const s = this.session;
        const w = s.test.writing;
        s.iaEstado = 'cargando';
        this.renderSelfEval();
        const [email, discussion] = await Promise.all([
            iaCalificadora.calificarToefl('email', w.email, s.emailText).catch(() => null),
            iaCalificadora.calificarToefl('discussion', w.discussion, s.discussionText).catch(() => null)
        ]);
        s.iaResultados = { email, discussion };
        s.iaEstado = (email || discussion) ? 'listo' : 'error';
        // La banda de la IA pasa a ser la oficial; el estudiante puede ajustarla.
        if (email) s.selfBands.email = email.band;
        if (discussion) s.selfBands.discussion = discussion.band;
        this.renderSelfEval();
    },

    // ── Evaluación: IA + comparación con el modelo ───────────────────────────
    renderSelfEval() {
        const s = this.session;
        const w = s.test.writing;
        const iaCargando = s.iaEstado === 'cargando';
        const iaError = s.iaEstado === 'error';

        const evalBlock = (kind, task, userText) => {
            const r = s.iaResultados?.[kind];
            return `
            <div class="rounded-2xl border border-gray-100 bg-gray-50/70 p-5">
                <h4 class="font-extrabold text-gray-900 mb-4">${sanitizeHTML(task.title)}</h4>
                <div class="grid md:grid-cols-2 gap-4 mb-4">
                    <div class="rounded-xl bg-white border border-gray-100 p-4">
                        <p class="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Tu respuesta (${this.countWords(userText)} palabras)</p>
                        <p class="text-sm text-gray-700 leading-relaxed whitespace-pre-line">${userText.trim() ? sanitizeHTML(userText) : '<em class="text-gray-400">No escribiste respuesta.</em>'}</p>
                    </div>
                    <div class="rounded-xl bg-green-50 border border-green-100 p-4">
                        <p class="text-[11px] font-bold uppercase tracking-widest text-emerald-600 mb-2">Respuesta modelo (banda 5–6)</p>
                        <p class="text-sm text-gray-700 leading-relaxed whitespace-pre-line">${sanitizeHTML(task.model)}</p>
                    </div>
                </div>

                ${iaCargando ? iaCalificadora.cargandoHTML() : ''}
                ${r ? iaCalificadora.tarjetaHTML(r, { escala: '/6', acento: 'blue' }) : ''}

                <details class="mt-3" ${r ? '' : 'open'}>
                    <summary class="text-xs font-bold text-gray-500 cursor-pointer hover:text-blue-600">${r ? '¿No estás de acuerdo? Ajusta la banda tú mismo' : 'Asigna tu banda con la rúbrica'}</summary>
                    <div class="flex flex-wrap gap-2 mt-2">
                        ${w.rubric.map(rb => `
                            <button onclick="toeflLogic.setSelfBand('${kind}', ${rb.band})" title="${sanitizeHTML(rb.desc)}"
                                class="px-3.5 py-1.5 rounded-xl border text-xs font-extrabold transition ${s.selfBands[kind] === rb.band ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}">
                                ${rb.band} · ${sanitizeHTML(rb.label)}
                            </button>`).join('')}
                    </div>
                </details>
            </div>`;
        };

        this.root().innerHTML = this.shell({
            banner: 'Writing · Evaluación',
            timed: false,
            body: `
                <div class="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8 space-y-6">
                    <div>
                        <h3 class="text-2xl font-extrabold text-gray-900 mb-1">Tu escritura, corregida</h3>
                        <p class="text-gray-500 text-sm">${iaError
                            ? 'No pudimos conectar con la IA correctora. Puedes autoevaluarte con la rúbrica y la respuesta modelo.'
                            : 'La IA califica con la escala oficial de bandas 1–6, como el sistema automático del TOEFL real, y te señala qué corregir.'}</p>
                    </div>
                    ${evalBlock('email', w.email, s.emailText)}
                    ${evalBlock('discussion', w.discussion, s.discussionText)}
                    <div class="flex justify-end">
                        <button onclick="toeflLogic.finishWriting()" ${(s.selfBands.email && s.selfBands.discussion) ? '' : 'disabled'}
                            class="px-8 py-3 rounded-xl font-bold transition ${(s.selfBands.email && s.selfBands.discussion) ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}">
                            Ver resultados <i class="ph-bold ph-flag-checkered"></i>
                        </button>
                    </div>
                </div>`
        });
    },

    setSelfBand(kind, band) {
        this.session.selfBands[kind] = band;
        this.renderSelfEval();
    },

    finishWriting() {
        const s = this.session;
        s.stage = 'results';
        this.renderWritingResults();
    },

    renderWritingResults() {
        const s = this.session;
        const bs = s.test.writing.buildSentence;
        const buildCorrect = s.buildResults.filter(Boolean).length;
        const buildBand = Math.round((1 + (buildCorrect / bs.items.length) * 5) * 2) / 2;
        const overall = Math.round(((buildBand + s.selfBands.email + s.selfBands.discussion) / 3) * 2) / 2;
        this.saveAttempt({ section: 'writing', score: overall, scale: '/6', summary: `Writing banda ~${overall} (BaS ${buildCorrect}/${bs.items.length}, email ${s.selfBands.email}, disc. ${s.selfBands.discussion})` });
        this.root().innerHTML = this.shell({
            banner: 'Resultados · Writing',
            timed: false,
            body: `
                <div class="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-10">
                    <div class="text-center mb-8">
                        <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Banda estimada (no oficial, escala 1–6)</p>
                        <p class="text-6xl font-extrabold text-blue-600">${overall}<span class="text-2xl text-gray-300"> /6</span></p>
                        <p class="mt-1 text-sm font-bold text-blue-700">Nivel aproximado ${bandToCEFR(overall)} <span class="text-gray-400 font-semibold">(MCER)</span></p>
                        <p class="text-gray-500 mt-2">Promedio de las tres tareas · email y discusión autoevaluados</p>
                    </div>
                    <div class="grid md:grid-cols-3 gap-4 mb-8">
                        <div class="rounded-2xl border border-gray-100 bg-gray-50/70 p-5 text-center">
                            <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Build a Sentence</p>
                            <p class="text-3xl font-extrabold text-gray-900">${buildCorrect}/${bs.items.length}</p>
                            <p class="text-sm text-gray-500 mt-1">Banda ~${buildBand}${s.buildExpired ? ' · tiempo agotado' : ''}</p>
                        </div>
                        <div class="rounded-2xl border border-gray-100 bg-gray-50/70 p-5 text-center">
                            <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Write an Email</p>
                            <p class="text-3xl font-extrabold text-gray-900">${s.selfBands.email}</p>
                            <p class="text-sm text-gray-500 mt-1">Autoevaluación${s.emailExpired ? ' · tiempo agotado' : ''}</p>
                        </div>
                        <div class="rounded-2xl border border-gray-100 bg-gray-50/70 p-5 text-center">
                            <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Academic Discussion</p>
                            <p class="text-3xl font-extrabold text-gray-900">${s.selfBands.discussion}</p>
                            <p class="text-sm text-gray-500 mt-1">Autoevaluación${s.discussionExpired ? ' · tiempo agotado' : ''}</p>
                        </div>
                    </div>
                    <div class="rounded-2xl border border-gray-100 bg-gray-50/70 p-5 mb-8">
                        <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Detalle · Build a Sentence</p>
                        <div class="space-y-2">
                            ${bs.items.map((item, i) => `
                                <div class="rounded-xl bg-white border border-gray-100 p-3 text-sm">
                                    <div class="flex items-start gap-2">
                                        <i class="ph-bold ${s.buildResults[i] ? 'ph-check-circle text-emerald-500' : 'ph-x-circle text-red-400'} mt-0.5 shrink-0"></i>
                                        <div class="min-w-0">
                                            <p class="text-gray-400 text-xs mb-0.5">${sanitizeHTML(item.context)}</p>
                                            <p class="text-gray-800">${s.buildPicks[i].length ? sanitizeHTML(s.buildPicks[i].join(' ')) : '<em class="text-gray-400">Sin respuesta</em>'}</p>
                                            ${!s.buildResults[i] ? `<p class="text-emerald-600 text-xs font-semibold mt-0.5">Correcta: ${sanitizeHTML(item.answer)}</p>` : ''}
                                        </div>
                                    </div>
                                </div>`).join('')}
                        </div>
                    </div>
                    <div class="flex flex-wrap gap-3 justify-center">
                        <button onclick="toeflLogic.start('writing')" class="px-6 py-3 rounded-xl border border-gray-200 text-gray-700 font-bold hover:bg-gray-50 transition"><i class="ph-bold ph-arrow-counter-clockwise"></i> Repetir práctica</button>
                        <button onclick="toeflLogic.start('reading')" class="px-6 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition"><i class="ph-bold ph-book-open"></i> Pasar a Reading</button>
                        <button onclick="toeflLogic.exit()" class="px-6 py-3 rounded-xl border border-gray-200 text-gray-500 font-bold hover:bg-gray-50 transition">Volver a módulos</button>
                    </div>
                </div>`
        });
    }
};
