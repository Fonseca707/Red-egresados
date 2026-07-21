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

    // Clon visual del TOEFL iBT real (spec toefl-formato-real-2026 §10):
    // header teal #066A6E ancho completo + sub-barra blanca con la sección y el
    // contador; controles tipo píldora a la derecha. No lleva logo de ETS.
    shell({ banner, timed, body, section }) {
        const sectionLabel = section || (this.session && this.session.section === 'writing' ? 'Writing' : 'Reading');
        return `
            <div class="max-w-5xl mx-auto animate-fade-in pb-12">
                <div class="sticky top-16 z-30 mb-6 rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
                    <!-- Header teal -->
                    <div class="bg-[#066A6E] px-4 py-3 flex items-center justify-between gap-3">
                        <div class="flex items-center gap-2 min-w-0">
                            <span class="px-2.5 py-1 rounded-md bg-[#077F83] text-white text-xs font-extrabold shrink-0 border border-white/70">TOEFL</span>
                            <p class="text-sm font-semibold text-white/95 truncate">${banner}</p>
                        </div>
                        <div class="flex items-center gap-2 shrink-0">
                            ${timed ? `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#077F83] border border-white/70 text-white font-mono font-bold text-sm"><i class="ph-bold ph-timer"></i><span id="toefl-timer">--:--</span></span>` : ''}
                            <button onclick="toeflLogic.exit()" class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/10 text-white hover:bg-white/25 transition" title="Salir de la práctica"><i class="ph-bold ph-x"></i></button>
                        </div>
                    </div>
                    <!-- Sub-barra blanca: sección | contador -->
                    <div class="bg-white px-4 py-2 flex items-center gap-2 border-t border-[#055457]/20">
                        <span class="text-sm font-bold text-gray-900">${sectionLabel}</span>
                        <span class="text-gray-300">|</span>
                        <span class="text-xs font-semibold text-gray-500 truncate">${banner}</span>
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
            <div class="rounded-2xl border border-[#a3c9cb] bg-[#e8f2f2] px-4 py-3 text-sm text-[#043e40] flex gap-2 mb-6">
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
                    <span class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#e8f2f2] text-[#055457] text-xs font-bold uppercase tracking-widest border border-[#cce0e1] mb-4">
                        <i class="ph-duotone ph-globe-hemisphere-west"></i> Formato oficial desde enero 2026
                    </span>
                    <h2 class="text-3xl font-extrabold text-gray-900 mb-2">${isReading ? 'Sección Reading' : 'Sección Writing'}</h2>
                    <p class="text-gray-500 mb-8">${isReading
                        ? 'Dos módulos con cronómetro (≈13 y 14 min). Tres tipos de tarea, del vocabulario a la lectura académica.'
                        : 'Tres tareas con cronómetro propio (≈23 min en total), de armar oraciones a escribir en una discusión académica.'}</p>
                    <div class="grid md:grid-cols-3 gap-4 mb-6">
                        ${details.map(([icon, name, desc]) => `
                            <div class="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                                <i class="ph-duotone ${icon} text-2xl text-[#066A6E]"></i>
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
                    <button onclick="toeflLogic.begin()" class="w-full md:w-auto px-8 py-3.5 bg-[#066A6E] text-white font-bold rounded-xl hover:bg-[#055457] transition shadow-lg shadow-[#066A6E]/20 flex items-center justify-center gap-2">
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
                        <p class="text-xs font-bold uppercase tracking-widest text-[#066A6E]">Tarea ${s.taskIndex + 1} de ${mod.tasks.length} · ${sanitizeHTML(task.title)}</p>
                    </div>
                    <p class="text-sm text-gray-500 mb-6">${sanitizeHTML(task.instructions)}</p>
                    ${body}
                    <div class="mt-8 flex justify-end gap-3">
                        ${s.taskIndex > 0 ? `<button onclick="toeflLogic.prevTask()" class="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition">Anterior</button>` : ''}
                        <button onclick="toeflLogic.nextTask()" class="px-6 py-2.5 rounded-xl bg-[#066A6E] text-white font-bold hover:bg-[#055457] transition flex items-center gap-2">
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
            // Ancho fiel: 1ch por letra + un respiro. Sin letter-spacing (era la
            // causa de que el texto escrito se desbordara del hueco). box-border
            // para que el padding no ensanche el input más allá del width.
            // Ancho = una letra por hueco + un respiro para el cursor. Texto a la
            // IZQUIERDA para que las letras faltantes queden pegadas al prefijo
            // (la palabra se lee continua, como en el examen real).
            const widthCh = `calc(${Math.max(n, 2)}ch + 0.4rem)`;
            // La palabra debe verse CONTINUA: prefijo (peso normal, como el texto)
            // pegado al hueco gris neutro (#D1D1D1). El acento teal solo al enfocar.
            const box = `<span class="inline-flex items-baseline whitespace-nowrap text-gray-800"><span class="text-[10px] text-[#066A6E] font-bold mr-px self-start">${i + 1}</span>${sanitizeHTML(gap.prefix)}<input id="toefl-gap-${i}" value="${filled}" maxlength="${n}" placeholder="${guiones}" style="width:${widthCh}" oninput="toeflLogic.setGap('${key}', ${i}, this.value)" class="box-border px-0.5 border-b-2 border-gray-400 bg-[#D1D1D1]/40 rounded-t-sm text-gray-900 font-semibold placeholder:text-gray-400 placeholder:font-normal focus:outline-none focus:border-[#066A6E] focus:bg-[#e8f2f2] text-left lowercase align-baseline" autocomplete="off" autocapitalize="off" spellcheck="false"></span>`;
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
                                    <label class="flex items-start gap-2.5 p-2.5 rounded-xl border ${answers[qi] === oi ? 'border-[#077F83] bg-[#e8f2f2]' : 'border-gray-100 bg-white hover:bg-gray-50'} cursor-pointer transition text-sm">
                                        <input type="radio" name="toefl-q-${qi}" ${answers[qi] === oi ? 'checked' : ''} onchange="toeflLogic.setMC('${key}', ${qi}, ${oi})" class="mt-0.5 accent-[#066A6E]">
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
                    <button onclick="toeflLogic.startModule2()" class="px-8 py-3.5 bg-[#066A6E] text-white font-bold rounded-xl hover:bg-[#055457] transition shadow-lg shadow-[#066A6E]/20">
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
                        <p class="text-6xl font-extrabold text-[#066A6E]">${est.band}<span class="text-2xl text-gray-300"> /6</span></p>
                        <p class="mt-1 text-sm font-bold text-[#055457]">Nivel aproximado ${bandToCEFR(est.band)} <span class="text-gray-400 font-semibold">(MCER)</span></p>
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
                        <button onclick="toeflLogic.start('writing')" class="px-6 py-3 rounded-xl bg-[#066A6E] text-white font-bold hover:bg-[#055457] transition"><i class="ph-bold ph-pencil-line"></i> Pasar a Writing</button>
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
        const slotCount = item.chips.length; // huecos consecutivos = fichas correctas
        // Texto de la pregunta del interlocutor A, sin el prefijo 'A: "..."'
        const promptText = String(item.context).replace(/^A:\s*/, '').replace(/^["“](.*)["”]$/, '$1');
        this.root().innerHTML = this.shell({
            banner: `Make an appropriate sentence · ${s.buildIndex + 1} of ${bs.items.length}`,
            timed: true,
            body: `
                <div class="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8">
                    <p class="text-center text-lg md:text-xl font-bold text-gray-900 mb-1">Make an appropriate sentence.</p>
                    <p class="text-center text-sm text-gray-500 mb-6">Move the words in the boxes to create a grammatical sentence.</p>

                    <!-- Conversación: A pregunta (izq), B responde (der) -->
                    <div class="max-w-3xl mx-auto space-y-4 mb-6">
                        <div class="flex items-start gap-3">
                            <span class="shrink-0 w-9 h-9 rounded-full bg-gray-100 border-2 border-[#7db3b6] flex items-center justify-center text-[#066A6E]"><i class="ph-bold ph-user"></i></span>
                            <div class="rounded-2xl rounded-tl-sm bg-gray-50 border border-gray-100 px-4 py-2.5 text-[15px] text-gray-800">${sanitizeHTML(promptText)}</div>
                        </div>
                        <div class="flex items-start gap-3 flex-row-reverse">
                            <span class="shrink-0 w-9 h-9 rounded-full bg-[#066A6E] border-2 border-[#066A6E] flex items-center justify-center text-white"><i class="ph-bold ph-user"></i></span>
                            <div class="flex-1 rounded-2xl rounded-tr-sm bg-[#e8f2f2] border border-[#cce0e1] px-3 py-3">
                                <div class="flex flex-wrap items-center gap-1.5">
                                    ${Array.from({ length: slotCount }).map((_, si) => picks[si]
                                        ? `<button onclick="toeflLogic.unpickChip(${si})" title="Quitar" class="px-3 py-1.5 rounded-lg bg-[#066A6E] text-white text-sm font-bold hover:bg-[#055457] transition shadow-sm">${sanitizeHTML(picks[si])}</button>`
                                        : `<span class="inline-block min-w-[3rem] h-8 rounded-lg border-2 border-dashed border-[#7db3b6]/60 bg-white/50 align-middle"></span>`
                                    ).join('')}
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Banco de fichas (incluye distractores) -->
                    <p class="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2 text-center">Fichas</p>
                    <div class="flex flex-wrap justify-center gap-2 mb-6">
                        ${pool.map((chip, pi) => this.chipIsPicked(picks, pool, pi)
                            ? `<button disabled class="px-3 py-1.5 rounded-xl bg-gray-100 text-gray-300 text-sm font-bold border border-gray-100">${sanitizeHTML(chip)}</button>`
                            : `<button onclick="toeflLogic.pickChip(${pi})" class="px-3 py-1.5 rounded-xl bg-white text-gray-800 text-sm font-bold border border-gray-200 hover:border-[#077F83] hover:bg-[#e8f2f2] transition shadow-sm">${sanitizeHTML(chip)}</button>`
                        ).join('')}
                    </div>
                    <div class="flex justify-between items-center border-t border-gray-100 pt-4">
                        <button onclick="toeflLogic.clearPicks()" class="text-sm font-bold text-gray-400 hover:text-red-500 transition"><i class="ph-bold ph-eraser"></i> Limpiar</button>
                        <button onclick="toeflLogic.nextBuild()" class="px-6 py-2.5 rounded-xl bg-[#066A6E] text-white font-bold hover:bg-[#055457] transition flex items-center gap-2">
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
        // No permitir más fichas que huecos disponibles
        if (s.buildPicks[s.buildIndex].length >= item.chips.length) return;
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

    // Barra de herramientas del editor (Cut/Copy/Paste/Undo/Redo), fiel al examen.
    // Funcional sobre el textarea con foco; nada decorativo muerto.
    writingToolbar(textareaId) {
        const btn = (cmd, icon, label) => `<button type="button" onmousedown="event.preventDefault()" onclick="toeflLogic.editorCmd('${textareaId}','${cmd}')" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold text-gray-600 hover:bg-gray-100 transition"><i class="ph-bold ${icon}"></i> ${label}</button>`;
        return `<div class="flex items-center gap-1 border-b border-gray-200 bg-gray-50/80 rounded-t-2xl px-2 py-1.5">
            ${btn('cut', 'ph-scissors', 'Cut')}${btn('copy', 'ph-copy', 'Copy')}${btn('paste', 'ph-clipboard-text', 'Paste')}
            <span class="w-px h-4 bg-gray-200 mx-1"></span>
            ${btn('undo', 'ph-arrow-counter-clockwise', 'Undo')}${btn('redo', 'ph-arrow-clockwise', 'Redo')}
        </div>`;
    },

    // Panel derecho "Your Response:" reutilizado por Email y Discussion.
    responsePanel({ kind, textareaId, to, subject, current, target, placeholder, submitFn, submitLabel }) {
        return `
            <div class="rounded-2xl border border-gray-200 overflow-hidden">
                <div class="bg-white px-4 py-2.5 border-b border-gray-100">
                    <p class="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Your Response</p>
                    ${to !== undefined ? `<div class="flex items-center gap-2 text-sm mb-1"><span class="w-16 text-gray-400 font-semibold">To:</span><span class="text-gray-800 font-medium">${sanitizeHTML(to)}</span></div>
                    <div class="flex items-center gap-2 text-sm"><span class="w-16 text-gray-400 font-semibold">Subject:</span><span class="text-gray-800 font-medium">${sanitizeHTML(subject)}</span></div>` : ''}
                </div>
                ${this.writingToolbar(textareaId)}
                <textarea id="${textareaId}" rows="11" oninput="toeflLogic.onWrittenInput('${kind}')" placeholder="${placeholder}" class="w-full p-4 text-[15px] text-gray-800 leading-relaxed focus:outline-none resize-y border-0" spellcheck="false">${sanitizeHTML(current)}</textarea>
                <div class="flex items-center justify-between px-4 py-2.5 bg-gray-50/80 border-t border-gray-100">
                    <p class="text-sm font-bold text-gray-400"><span id="toefl-word-count">0</span> words · target ${target[0]}–${target[1]}</p>
                    <button onclick="toeflLogic.${submitFn}(false)" class="px-5 py-2 rounded-xl bg-[#066A6E] text-white font-bold hover:bg-[#055457] transition text-sm">${submitLabel} <i class="ph-bold ph-arrow-right"></i></button>
                </div>
            </div>`;
    },

    editorCmd(textareaId, cmd) {
        const el = document.getElementById(textareaId);
        if (!el) return;
        el.focus();
        if (cmd === 'paste') {
            navigator.clipboard?.readText?.().then(txt => {
                const [a, b] = [el.selectionStart, el.selectionEnd];
                el.setRangeText(txt, a, b, 'end');
                el.dispatchEvent(new Event('input', { bubbles: true }));
            }).catch(() => {});
            return;
        }
        try { document.execCommand(cmd); } catch (_) {}
        el.dispatchEvent(new Event('input', { bubbles: true }));
    },

    renderEmailTask() {
        const s = this.session;
        const t = s.test.writing.email;
        this.root().innerHTML = this.shell({
            banner: 'Write an Email · 1 of 2',
            timed: true,
            body: `
                <div class="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8">
                    <p class="text-center text-lg md:text-xl font-bold text-gray-900 mb-5">Write an Email</p>
                    <div class="grid lg:grid-cols-2 gap-5">
                        <!-- Izquierda: escenario + viñetas -->
                        <div class="rounded-2xl border border-gray-100 bg-gray-50/70 p-5">
                            <p class="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Scenario</p>
                            <p class="text-[15px] text-gray-800 leading-relaxed mb-3">${sanitizeHTML(t.scenario)}</p>
                            <p class="text-[15px] text-gray-900 font-bold mb-2">${sanitizeHTML(t.recipient)} In your email, do the following:</p>
                            <ul class="space-y-1 mb-3">
                                ${t.bullets.map(b => `<li class="text-[15px] text-gray-700 flex gap-2"><i class="ph-bold ph-dot-outline text-[#066A6E] mt-1"></i>${sanitizeHTML(b)}</li>`).join('')}
                            </ul>
                            <p class="text-sm text-gray-400 italic">Write as much as you can and in complete sentences.</p>
                        </div>
                        <!-- Derecha: editor -->
                        ${this.responsePanel({
                            kind: 'email', textareaId: 'toefl-email-text',
                            to: t.to, subject: t.subject, current: s.emailText,
                            target: t.targetWords, placeholder: 'Dear Professor Reed, ...',
                            submitFn: 'submitEmail', submitLabel: 'Enviar y continuar'
                        })}
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
            banner: 'Write for an Academic Discussion · 2 of 2',
            timed: true,
            body: `
                <div class="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8">
                    <p class="text-center text-lg md:text-xl font-bold text-gray-900 mb-1">Write for an Academic Discussion</p>
                    <p class="text-center text-sm text-gray-500 mb-5">Make a contribution to the discussion. Refer to your classmates’ ideas and add your own.</p>
                    <div class="grid lg:grid-cols-2 gap-5">
                        <!-- Izquierda: hilo del foro -->
                        <div class="space-y-3">
                            <div class="rounded-2xl border border-[#cce0e1] bg-[#e8f2f2] p-4">
                                <p class="text-xs font-extrabold text-[#055457] mb-1 flex items-center gap-1.5"><span class="w-6 h-6 rounded-full bg-[#066A6E] text-white flex items-center justify-center"><i class="ph-bold ph-chalkboard-teacher"></i></span> ${sanitizeHTML(t.professor.name)}</p>
                                <p class="text-[15px] text-gray-800 leading-relaxed">${sanitizeHTML(t.professor.post)}</p>
                            </div>
                            ${t.students.map(st => `
                                <div class="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 ml-4">
                                    <p class="text-xs font-extrabold text-gray-500 mb-1 flex items-center gap-1.5"><span class="w-6 h-6 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center"><i class="ph-bold ph-student"></i></span> ${sanitizeHTML(st.name)}</p>
                                    <p class="text-sm text-gray-700 leading-relaxed">${sanitizeHTML(st.post)}</p>
                                </div>`).join('')}
                        </div>
                        <!-- Derecha: editor -->
                        ${this.responsePanel({
                            kind: 'discussion', textareaId: 'toefl-discussion-text',
                            current: s.discussionText, target: t.targetWords,
                            placeholder: 'I see valid points in both posts, but...',
                            submitFn: 'submitDiscussion', submitLabel: 'Enviar y autoevaluar'
                        })}
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
                ${r ? iaCalificadora.tarjetaHTML(r, { escala: '/6', acento: 'teal' }) : ''}

                <details class="mt-3" ${r ? '' : 'open'}>
                    <summary class="text-xs font-bold text-gray-500 cursor-pointer hover:text-[#066A6E]">${r ? '¿No estás de acuerdo? Ajusta la banda tú mismo' : 'Asigna tu banda con la rúbrica'}</summary>
                    <div class="flex flex-wrap gap-2 mt-2">
                        ${w.rubric.map(rb => `
                            <button onclick="toeflLogic.setSelfBand('${kind}', ${rb.band})" title="${sanitizeHTML(rb.desc)}"
                                class="px-3.5 py-1.5 rounded-xl border text-xs font-extrabold transition ${s.selfBands[kind] === rb.band ? 'bg-[#066A6E] text-white border-[#066A6E] shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:border-[#7db3b6]'}">
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
                            class="px-8 py-3 rounded-xl font-bold transition ${(s.selfBands.email && s.selfBands.discussion) ? 'bg-[#066A6E] text-white hover:bg-[#055457] shadow-lg shadow-[#066A6E]/20' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}">
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
                        <p class="text-6xl font-extrabold text-[#066A6E]">${overall}<span class="text-2xl text-gray-300"> /6</span></p>
                        <p class="mt-1 text-sm font-bold text-[#055457]">Nivel aproximado ${bandToCEFR(overall)} <span class="text-gray-400 font-semibold">(MCER)</span></p>
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
                        <button onclick="toeflLogic.start('reading')" class="px-6 py-3 rounded-xl bg-[#066A6E] text-white font-bold hover:bg-[#055457] transition"><i class="ph-bold ph-book-open"></i> Pasar a Reading</button>
                        <button onclick="toeflLogic.exit()" class="px-6 py-3 rounded-xl border border-gray-200 text-gray-500 font-bold hover:bg-gray-50 transition">Volver a módulos</button>
                    </div>
                </div>`
        });
    }
};
