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
        // Banco de Firestore (precargado en state.examBank); respaldo: el JS.
        const bank = (window.state && state.examBank && state.examBank.DELF) || [];
        const test = bank.length ? bank[0] : DELF_TESTS[0];
        // Los tests guardados en Firestore antes del 2026-07-19 traen la grille PE
        // vieja (6 criterios 2/4/4/3/6/6). La grille oficial vigente vive en el
        // código: si al test del banco le falta `scale`, se le injerta la del código.
        if (test?.pe && !test.pe.scale && DELF_TESTS[0]?.pe?.scale) {
            test.pe = {
                ...test.pe,
                scale: DELF_TESTS[0].pe.scale,
                criteria: DELF_TESTS[0].pe.criteria,
                anomalies: DELF_TESTS[0].pe.anomalies
            };
        }
        this.stopTimer();
        this.pararAudio();
        this.session = {
            test,
            section,            // 'ce' | 'co' | 'pe'
            stage: 'intro',
            timer: null,
            // ce
            taskIndex: 0,
            ceAnswers: {},      // taskIndex -> array de índices elegidos
            ceExpired: false,
            // co
            coIndex: 0,
            coFase: 'consigne',
            coAnswers: {},      // docId -> array de índices elegidos
            coPlays: {},        // docId -> escuchas gastadas (el límite del DELF)
            clips: null,        // docId -> clip del banco; null = aún no cargado
            coExpired: false,
            // pe
            peText: '',
            peExpired: false,
            peSelf: {}          // key criterio -> puntos elegidos
        };
        router.navigate('delf-practice');
        this.render();
        // El CO necesita saber qué audios existen antes de dejar empezar. Se
        // pinta primero el intro ("Buscando los audios…") y se repinta al
        // llegar: así la pantalla nunca se queda en blanco esperando la red.
        if (section === 'co') {
            this.cargarClips().then(() => {
                if (this.session?.section === 'co' && this.session.stage === 'intro') this.renderIntro();
            });
        }
    },

    exit() {
        if (this.session && this.session.stage !== 'intro' && this.session.stage !== 'results') {
            if (!confirm('¿Salir de la práctica? Se perderá el progreso de esta sesión.')) return;
        }
        this.stopTimer();
        this.pararAudio();
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
        if (!this.session?.timer) return;
        const r = Math.max(0, this.session.timer.remaining);
        const mm = String(Math.floor(r / 60)).padStart(2, '0');
        const ss = String(r % 60).padStart(2, '0');
        const el = document.getElementById('delf-timer');
        if (el) {
            el.textContent = `${mm}:${ss}`;
            el.classList.toggle('text-red-600', r < 120);
            el.classList.toggle('animate-pulse', r < 120);
        }
        // El CO repite la cuenta en grande dentro del panel de la fase: sus
        // pausas son de 10-60 s y en la cabecera pasan desapercibidas.
        const fase = document.getElementById('delf-fase-timer');
        if (fase) fase.textContent = `${mm}:${ss}`;
    },

    getHistory() {
        try { return JSON.parse(localStorage.getItem(DELF_HISTORY_KEY)) || []; }
        catch { return []; }
    },
    saveAttempt(entry) {
        const list = this.getHistory();
        list.unshift({ ...entry, date: new Date().toISOString() });
        localStorage.setItem(DELF_HISTORY_KEY, JSON.stringify(list.slice(0, 20)));
        // Persistencia en el perfil (best-effort, solo con sesión real): que el
        // progreso sea observable para el estudiante y su colegio.
        if (typeof saveExamResult === 'function') saveExamResult({ exam: 'DELF', ...entry });
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
        if (s.section === 'co') return this.renderCO();
        return this.renderPE();
    },

    // ── Intro ────────────────────────────────────────────────────────────────
    renderIntro() {
        const s = this.session;
        if (s.section === 'co') return this.renderCOIntro();
        const isCE = s.section === 'ce';
        const history = this.getHistory().filter(h => h.section === s.section).slice(0, 3);
        const details = isCE ? [
            ['ph-list-checks', 'Exercice 1 · S’orienter', 'Situación con criterios + 4 anuncios: decide Oui/Non y elige la opción correcta.'],
            ['ph-newspaper', 'Exercices 2 et 3 · La presse', 'Dos artículos (~300 palabras) con preguntas de selección múltiple.'],
            ['ph-check-square', 'Todo cerrado', 'En el formato nuevo NO hay respuestas abiertas: solo QCM y Oui/Non. 25 puntos.']
        ] : [
            ['ph-note-pencil', 'Un solo texto', 'Ensayo, carta o artículo de opinión sobre un tema de actualidad.'],
            ['ph-text-align-left', '160 palabras mínimo', 'Presenta hechos, ventajas/inconvenientes y tu punto de vista con ejemplos.'],
            ['ph-robot', 'Corrección con IA', 'La IA califica con la grille oficial de France Éducation International (réalisation de la tâche, cohérence et cohésion, adéquation sociolinguistique, lexique, morphosyntaxe) en su escala real 0/1/3/5, y señala qué mejorar.']
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
                        <p>En el DELF real necesitas mínimo <strong>5/25 en cada prueba</strong> y <strong>50/100 en total</strong> para aprobar el diploma.</p>
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

    // Intro del CO. Es distinto del de CE/PE porque aquí hay una condición que
    // los otros no tienen: sin clips en el banco no hay examen, y hay que decir
    // exactamente qué falta generar en vez de dejar un botón que no hace nada.
    renderCOIntro() {
        const s = this.session;
        const history = this.getHistory().filter(h => h.section === 'co').slice(0, 3);
        const cargando = s.clips === null;
        const disponibles = cargando ? [] : this.docsConAudio();
        const faltan = cargando ? [] : s.test.co.documents.filter(d => !s.clips?.[d.id]?.audioUrl);

        this.root().innerHTML = this.shell({
            banner: 'Compréhension de l’oral · Práctica',
            timed: false,
            body: `
                <div class="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-10">
                    <span class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-50 text-purple-700 text-xs font-bold uppercase tracking-widest border border-purple-100 mb-4">
                        <i class="ph-duotone ph-headphones"></i> Nouveau format officiel
                    </span>
                    <h2 class="text-3xl font-extrabold text-gray-900 mb-2">Compréhension de l’oral — DELF B1</h2>
                    <p class="text-gray-500 mb-8">3 documentos · 25 puntos · cada documento se escucha <strong>exactamente 2 veces</strong>, como en el examen real.</p>

                    <div class="grid md:grid-cols-3 gap-4 mb-6">
                        ${[
                            ['ph-speaker-high', 'Dos escuchas y ya', 'No se puede pausar, retroceder ni repetir. El contador de escuchas se agota y no vuelve.'],
                            ['ph-timer', 'Con las pausas del examen', 'Un minuto para leer las preguntas, 10 s entre las dos escuchas y 30 s para responder. Puedes saltarlas si ya terminaste.'],
                            ['ph-scales', 'Puntos desiguales', 'Como en el DELF real, no todas las preguntas valen lo mismo: hay ítems de 1 y de 1,5 puntos.']
                        ].map(([icon, name, desc]) => `
                            <div class="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                                <i class="ph-duotone ${icon} text-2xl text-purple-600"></i>
                                <h4 class="font-bold text-gray-900 mt-2 mb-1">${name}</h4>
                                <p class="text-xs text-gray-500 leading-relaxed">${desc}</p>
                            </div>`).join('')}
                    </div>

                    <div class="rounded-2xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-900 flex gap-2 mb-6">
                        <i class="ph-bold ph-info mt-0.5 shrink-0"></i>
                        <p>Necesitas mínimo <strong>5/25 en cada prueba</strong> y <strong>50/100 en total</strong> para aprobar el diploma. Usa auriculares si puedes.</p>
                    </div>

                    ${cargando ? `
                        <p class="text-sm text-gray-500 mb-6 flex items-center gap-2"><i class="ph-bold ph-spinner animate-spin"></i> Buscando los audios…</p>
                    ` : s.clipsError ? `
                        <div class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 mb-6">
                            No se pudo leer el banco de audios: ${sanitizeHTML(s.clipsError)}
                        </div>
                    ` : faltan.length ? `
                        <div class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 mb-6">
                            <p class="font-bold mb-1">${disponibles.length ? `Solo ${disponibles.length} de ${s.test.co.documents.length} documentos tienen audio.` : 'Todavía no hay audios para esta prueba.'}</p>
                            <p>Faltan por generar: ${faltan.map(d => sanitizeHTML(d.title)).join(' · ')}.
                            ${disponibles.length ? 'Puedes practicar con los que hay, pero la nota no será sobre 25.' : ''}</p>
                        </div>` : ''}

                    ${history.length ? `
                        <div class="mb-6">
                            <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Tus últimos intentos</p>
                            <div class="flex flex-wrap gap-2">
                                ${history.map(h => `<span class="px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-100 text-xs font-semibold text-gray-600">${new Date(h.date).toLocaleDateString()} · ${sanitizeHTML(h.summary)}</span>`).join('')}
                            </div>
                        </div>` : ''}

                    ${disponibles.length ? `
                        <button onclick="delfLogic.begin()"
                            class="w-full md:w-auto px-8 py-3.5 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition shadow-lg shadow-purple-600/20 flex items-center justify-center gap-2">
                            <i class="ph-bold ph-play"></i> ${disponibles.length < s.test.co.documents.length ? 'Practicar con los documentos disponibles' : 'Comenzar la prueba'}
                        </button>`
                    : !cargando ? `
                        <p class="text-sm text-gray-500 flex items-center gap-2"><i class="ph-bold ph-lock-simple"></i> La prueba se activa en cuanto haya audio generado en el estudio.</p>`
                    : ''}
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
        } else if (s.section === 'co') {
            s.stage = 'doc';
            // Se arranca en el primer documento QUE TENGA audio: si el ej.1 aún
            // no está generado, empezar por él dejaría el examen mudo.
            const primero = s.test.co.documents.findIndex(d => s.clips?.[d.id]?.audioUrl);
            if (primero < 0) return;
            s.coIndex = primero;
            this.entrarFase('consigne');
        } else {
            s.stage = 'write';
            this.renderPE();
            this.startTimer(s.test.pe.minutes, () => this.submitPE(true));
        }
    },

    // ═════════════════════════════════════════════════════════════════════════
    // Compréhension de l'oral
    // ═════════════════════════════════════════════════════════════════════════
    //
    // En el examen real la pista es UNA grabación continua que el vigilante ni
    // toca: consigna hablada → 1 min para leer las preguntas → 1ª escucha →
    // 10 s → 2ª escucha → 30 s para responder, con un BIP antes de cada escucha.
    //
    // Aquí el clip guardado es SOLO el documento (así el mismo audio sirve para
    // las dos escuchas y no se paga TTS de las consignas): la pista la arma este
    // reproductor alrededor. Las pausas son las del nouveau format y corren
    // solas, pero se pueden saltar — decisión de Juan: practicar no es
    // examinarse, y esperar 30 s con la respuesta ya marcada no enseña nada.
    //
    // Lo que NO es negociable es el límite de escuchas: en el DELF son 2 y ya.
    // Si se pudiera repetir, la prueba mediría otra cosa.

    // Cada documento lleva escrito en `clipTipo` qué tipo de clip le toca, y su
    // transcript es el mismo que carga el botón «transcript oficial de
    // referencia» del estudio. Así el examen encuentra su audio solo, sin un
    // panel que los empareje a mano: se genera el clip y queda enganchado.
    normalizarTranscript(t) {
        return (t || '')
            .replace(/^[ \t]*[A-Za-zÀ-ÿ0-9 _-]{1,20}:[ \t]*/gm, ' ')   // marcas de hablante
            .normalize('NFD').replace(/[̀-ͯ]/g, '')          // acentos
            .replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 300);
    },

    async cargarClips() {
        const s = this.session;
        s.clips = {};
        let banco = [];
        try {
            const snap = await artifactsRoot.collection('public').doc('data')
                .collection('audioClips').where('examen', '==', 'delf').get();
            banco = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
            s.clipsError = e.message;
            return;
        }
        // Más nuevo primero: si hay varias versiones de un documento, gana la
        // última generada.
        banco.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        for (const doc of s.test.co.documents) {
            const esperado = this.normalizarTranscript(doc.transcript);
            s.clips[doc.id] =
                banco.find(c => this.normalizarTranscript(c.transcript) === esperado)
                || banco.find(c => c.tipo === doc.clipTipo)
                || null;
        }
    },

    // Los documentos que sí tienen audio. Se puede practicar con los que haya:
    // un examen a medias es peor que nada solo si no se dice, y se dice.
    docsConAudio() {
        const s = this.session;
        return s.test.co.documents.filter(d => s.clips?.[d.id]?.audioUrl);
    },

    // ── El bip que anuncia cada escucha ─────────────────────────────────────
    // Se sintetiza, no es un archivo: son dos tonos de 0,25 s y traerlos de
    // Storage sería un archivo más que puede fallar en mitad de un examen. Las
    // rampas de entrada y salida existen para que no suene un clic seco.
    bip() {
        return new Promise(resolver => {
            let ctx;
            try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
            catch { return resolver(); }
            const ahora = ctx.currentTime;
            [0, 0.3].forEach(retraso => {
                const osc = ctx.createOscillator();
                const vol = ctx.createGain();
                osc.frequency.value = 880;
                osc.connect(vol); vol.connect(ctx.destination);
                vol.gain.setValueAtTime(0, ahora + retraso);
                vol.gain.linearRampToValueAtTime(0.25, ahora + retraso + 0.02);
                vol.gain.setValueAtTime(0.25, ahora + retraso + 0.2);
                vol.gain.linearRampToValueAtTime(0, ahora + retraso + 0.25);
                osc.start(ahora + retraso);
                osc.stop(ahora + retraso + 0.26);
            });
            setTimeout(() => { ctx.close().catch(() => {}); resolver(); }, 650);
        });
    },

    // ── Máquina de fases ────────────────────────────────────────────────────
    // consigne → leer(60s) → escucha 1 → entre(10s) → escucha 2 → responder(30s)
    entrarFase(fase) {
        const s = this.session;
        this.stopTimer();
        this.pararAudio();
        s.coFase = fase;
        const p = s.test.co.pausas;
        this.renderCO();

        if (fase === 'leer')      this.contar(p.leer,          () => this.entrarFase('escucha'));
        if (fase === 'entre')     this.contar(p.entreEscuchas, () => this.entrarFase('escucha'));
        if (fase === 'responder') this.contar(p.responder,     () => this.siguienteDocumento());
        if (fase === 'escucha')   this.reproducir();
    },

    contar(segundos, alTerminar) {
        this.startTimer(segundos / 60, alTerminar);
    },

    // Saltar la espera. No salta la ESCUCHA: eso sería otra cosa.
    saltarPausa() {
        const s = this.session;
        if (s.coFase === 'leer' || s.coFase === 'entre') return this.entrarFase('escucha');
        if (s.coFase === 'responder') return this.siguienteDocumento();
    },

    async reproducir() {
        const s = this.session;
        const doc = s.test.co.documents[s.coIndex];
        const clip = s.clips?.[doc.id];
        if (!clip?.audioUrl) return this.entrarFase('responder');

        s.coPlays[doc.id] = (s.coPlays[doc.id] || 0) + 1;
        this.renderCO();
        await this.bip();
        if (s.coFase !== 'escucha') return;   // salió del examen mientras sonaba el bip

        const audio = new Audio(clip.audioUrl);
        s.coAudio = audio;
        // Si alguna vez hace falta la duración, la manda la FICHA del clip y no
        // este elemento: lamejs no escribe cabecera Xing, así que `audio.duration`
        // puede mentir mientras el archivo se está descargando.
        audio.onended = () => {
            if (s.coAudio !== audio) return;
            const ultima = s.coPlays[doc.id] >= (doc.maxPlays || 2);
            this.entrarFase(ultima ? 'responder' : 'entre');
        };
        audio.onerror = () => {
            if (s.coAudio !== audio) return;
            s.coErrorAudio = 'No se pudo cargar el audio de este documento.';
            this.entrarFase('responder');
        };
        try { await audio.play(); }
        catch {
            // Autoplay bloqueado: el navegador exige un gesto. Se pide.
            s.coNecesitaGesto = true;
            this.renderCO();
        }
    },

    // Botón de rescate cuando el navegador bloquea la reproducción automática.
    reanudar() {
        const s = this.session;
        s.coNecesitaGesto = false;
        s.coAudio?.play().catch(() => {});
        this.renderCO();
    },

    pararAudio() {
        const s = this.session;
        if (!s?.coAudio) return;
        s.coAudio.onended = null;
        s.coAudio.onerror = null;
        s.coAudio.pause();
        s.coAudio = null;
    },

    setCO(qi, oi) {
        const s = this.session;
        const doc = s.test.co.documents[s.coIndex];
        if (!s.coAnswers[doc.id]) s.coAnswers[doc.id] = doc.questions.map(() => null);
        s.coAnswers[doc.id][qi] = oi;
        this.renderCO();
    },

    siguienteDocumento() {
        const s = this.session;
        this.stopTimer();
        this.pararAudio();
        // Se salta lo que no tenga audio: no se puede responder a lo que no sonó.
        let i = s.coIndex + 1;
        while (i < s.test.co.documents.length && !s.clips?.[s.test.co.documents[i].id]?.audioUrl) i++;
        if (i >= s.test.co.documents.length) return this.finishCO(false);
        s.coIndex = i;
        this.entrarFase('consigne');
    },

    finishCO(expired) {
        this.stopTimer();
        this.pararAudio();
        const s = this.session;
        s.coExpired = expired;
        s.stage = 'results';
        this.renderCOResults();
    },

    // ── Vista del CO ────────────────────────────────────────────────────────
    renderCO() {
        const s = this.session;
        if (s.stage === 'results') return this.renderCOResults();
        const doc = s.test.co.documents[s.coIndex];
        const disponibles = this.docsConAudio();
        const cual = disponibles.indexOf(doc) + 1;
        const escuchas = s.coPlays[doc.id] || 0;
        const maxPlays = doc.maxPlays || 2;
        const sonando = s.coFase === 'escucha';
        if (!s.coAnswers[doc.id]) s.coAnswers[doc.id] = doc.questions.map(() => null);
        const respuestas = s.coAnswers[doc.id];

        // Las preguntas se ven desde la fase de lectura —que existe justamente
        // para leerlas— pero durante la escucha no se pueden tocar: en el examen
        // real tampoco se escribe mientras suena.
        const puedeResponder = s.coFase === 'responder' || s.coFase === 'entre';
        const verPreguntas = s.coFase !== 'consigne';

        const cabecera = {
            consigne:  ['ph-info', 'Consigne', 'Lee la consigna. Cuando empieces, tendrás un minuto para leer las preguntas.'],
            leer:      ['ph-eye', 'Lisez les questions', 'Aprovecha para leer las preguntas antes de la primera escucha.'],
            escucha:   ['ph-speaker-high', `Écoute ${escuchas} sur ${maxPlays}`, 'Escucha con atención: no se puede pausar ni repetir.'],
            entre:     ['ph-hourglass', 'Entre les deux écoutes', 'Pausa antes de la segunda escucha.'],
            responder: ['ph-pencil-simple', 'Répondez', 'Última oportunidad para completar tus respuestas de este documento.']
        }[s.coFase] || ['ph-info', '', ''];

        this.root().innerHTML = this.shell({
            banner: `Compréhension orale · ${cual}/${disponibles.length}`,
            timed: s.coFase === 'leer' || s.coFase === 'entre' || s.coFase === 'responder',
            body: `
                <div class="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8">
                    <p class="text-xs font-bold uppercase tracking-widest text-purple-600 mb-1">${sanitizeHTML(doc.title)} · ${doc.points} points</p>
                    <p class="text-sm text-gray-500 mb-6">${sanitizeHTML(doc.consigne)}</p>

                    <div class="rounded-2xl border ${sonando ? 'border-purple-300 bg-purple-50' : 'border-gray-100 bg-gray-50/70'} p-6 mb-6 text-center">
                        <i class="ph-duotone ${cabecera[0]} text-4xl ${sonando ? 'text-purple-600 animate-pulse' : 'text-gray-400'}"></i>
                        <p class="font-extrabold text-gray-900 mt-2">${sanitizeHTML(cabecera[1])}</p>
                        <p class="text-xs text-gray-500 mt-1 max-w-md mx-auto">${sanitizeHTML(cabecera[2])}</p>

                        ${s.coFase === 'consigne' ? `
                            <button onclick="delfLogic.entrarFase('leer')" class="mt-4 px-6 py-2.5 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700 transition inline-flex items-center gap-2">
                                <i class="ph-bold ph-play"></i> Commencer
                            </button>` : ''}

                        ${(s.coFase === 'leer' || s.coFase === 'entre' || s.coFase === 'responder') ? `
                            <p class="font-mono font-extrabold text-3xl text-gray-900 mt-3"><span id="delf-fase-timer">--:--</span></p>
                            <button onclick="delfLogic.saltarPausa()" class="mt-2 text-xs font-bold text-purple-600 hover:underline">
                                ${s.coFase === 'responder' ? 'Ya respondí, continuar' : 'Saltar la espera'}
                            </button>` : ''}

                        ${s.coNecesitaGesto ? `
                            <button onclick="delfLogic.reanudar()" class="mt-4 px-6 py-2.5 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700 transition inline-flex items-center gap-2">
                                <i class="ph-bold ph-play"></i> Tu navegador bloqueó el audio — pulsa para escuchar
                            </button>` : ''}

                        <div class="flex items-center justify-center gap-1.5 mt-4">
                            ${Array.from({ length: maxPlays }, (_, i) => `
                                <span class="w-2.5 h-2.5 rounded-full ${i < escuchas ? 'bg-purple-600' : 'bg-gray-300'}"></span>`).join('')}
                            <span class="text-xs text-gray-500 ml-1.5">${escuchas} de ${maxPlays} escuchas</span>
                        </div>
                    </div>

                    ${verPreguntas ? `
                    <div class="space-y-4 ${puedeResponder ? '' : 'opacity-60 pointer-events-none'}">
                        ${doc.questions.map((qu, qi) => `
                            <div>
                                <p class="font-bold text-gray-900 mb-2 text-sm">${qi + 1}. ${sanitizeHTML(qu.q)}
                                    <span class="font-normal text-xs text-gray-400">· ${qu.points} pt${qu.points > 1 ? 's' : ''}</span></p>
                                <div class="space-y-1.5">
                                    ${qu.options.map((opt, oi) => `
                                        <label class="flex items-start gap-2.5 p-2.5 rounded-xl border ${respuestas[qi] === oi ? 'border-purple-400 bg-purple-50' : 'border-gray-100 bg-white hover:bg-gray-50'} cursor-pointer transition text-sm">
                                            <input type="radio" name="delf-co-${doc.id}-${qi}" ${respuestas[qi] === oi ? 'checked' : ''} onchange="delfLogic.setCO(${qi}, ${oi})" class="mt-0.5 accent-purple-600">
                                            <span class="text-gray-700">${sanitizeHTML(opt)}</span>
                                        </label>`).join('')}
                                </div>
                            </div>`).join('')}
                    </div>
                    ${!puedeResponder ? '<p class="text-xs text-gray-400 mt-3 text-center">Podrás marcar tus respuestas después de la primera escucha.</p>' : ''}
                    ` : ''}

                    ${s.coErrorAudio ? `<p class="mt-4 text-sm text-red-600">${sanitizeHTML(s.coErrorAudio)}</p>` : ''}
                </div>`
        });
        this.paintTimer();
    },

    renderCOResults() {
        const s = this.session;
        const disponibles = this.docsConAudio();
        let obtenidos = 0, posibles = 0;
        const desglose = disponibles.map(doc => {
            let p = 0;
            doc.questions.forEach((qu, qi) => {
                posibles += qu.points;
                if (s.coAnswers[doc.id]?.[qi] === qu.answer) { p += qu.points; obtenidos += qu.points; }
            });
            return { doc, puntos: p };
        });

        // La nota se da SOBRE LO PRESENTADO. Si faltaban audios, decirlo: un /25
        // calculado sobre 7 puntos sería una nota inventada.
        const parcial = disponibles.length < s.test.co.documents.length;
        const puntos = Math.round(obtenidos * 10) / 10;
        const sobre = Math.round(posibles * 10) / 10;
        const eliminatorio = !parcial && puntos < 5;

        this.saveAttempt({
            section: 'co',
            summary: `Compréhension orale ${puntos}/${sobre}${parcial ? ' (parcial)' : ''}`,
            score: puntos, max: sobre
        });

        this.root().innerHTML = this.shell({
            banner: 'Compréhension orale · Resultados',
            timed: false,
            body: `
                <div class="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-10">
                    <p class="text-xs font-bold uppercase tracking-widest text-purple-600 mb-2">Résultat</p>
                    <p class="text-5xl font-extrabold text-gray-900 mb-1">${puntos}<span class="text-2xl text-gray-400">/${sobre}</span></p>
                    ${parcial ? `<p class="text-sm text-amber-700 mb-4">Solo ${disponibles.length} de ${s.test.co.documents.length} documentos tenían audio, así que esta nota <strong>no es sobre 25</strong> y no equivale a la épreuve completa.</p>` : ''}
                    ${eliminatorio ? `<div class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 mb-4 flex gap-2">
                        <i class="ph-bold ph-warning mt-0.5 shrink-0"></i>
                        <p>Menos de <strong>5/25</strong>: en el examen real esta nota es <strong>eliminatoria</strong> y hace perder el diploma completo, aunque las otras pruebas vayan bien.</p></div>` : ''}

                    <div class="space-y-2 mb-6">
                        ${desglose.map(d => `
                            <div class="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3">
                                <p class="text-sm font-bold text-gray-700 truncate">${sanitizeHTML(d.doc.title)}</p>
                                <p class="text-sm font-mono font-bold text-gray-900 shrink-0">${Math.round(d.puntos * 10) / 10}/${d.doc.points}</p>
                            </div>`).join('')}
                    </div>

                    <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Corrección y transcripciones</p>
                    <div class="space-y-3 mb-6">
                        ${desglose.map(({ doc }) => `
                            <details class="rounded-2xl border border-gray-100 bg-gray-50/70 px-4 py-3">
                                <summary class="text-sm font-bold text-gray-700 cursor-pointer">${sanitizeHTML(doc.title)}</summary>
                                <div class="mt-3 space-y-2">
                                    ${doc.questions.map((qu, qi) => {
                                        const mia = s.coAnswers[doc.id]?.[qi];
                                        const bien = mia === qu.answer;
                                        return `<div class="text-sm">
                                            <p class="font-semibold text-gray-800">${qi + 1}. ${sanitizeHTML(qu.q)}</p>
                                            <p class="${bien ? 'text-green-700' : 'text-red-600'}">
                                                <i class="ph-bold ${bien ? 'ph-check' : 'ph-x'}"></i>
                                                ${mia == null ? 'Sin responder' : sanitizeHTML(qu.options[mia])}
                                                ${bien ? '' : ` · correcta: <strong>${sanitizeHTML(qu.options[qu.answer])}</strong>`}
                                            </p>
                                        </div>`;
                                    }).join('')}
                                    <div class="mt-3 pt-3 border-t border-gray-200">
                                        <p class="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Transcription</p>
                                        <p class="text-xs text-gray-600 whitespace-pre-line leading-relaxed">${sanitizeHTML(doc.transcript)}</p>
                                    </div>
                                </div>
                            </details>`).join('')}
                    </div>

                    <div class="flex flex-wrap gap-3">
                        <button onclick="delfLogic.start('co')" class="px-6 py-3 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700 transition">Repetir la prueba</button>
                        <button onclick="delfLogic.exit()" class="px-6 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition">Volver a los módulos</button>
                    </div>
                </div>`
        });
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
        const passed = points >= DELF_MINIMO_ELIMINATORIO; // constante unica en shared.js
        this.saveAttempt({ section: 'ce', score: points, scale: '/25', summary: `CE ${points}/25 (${correct}/${total})` });
        this.root().innerHTML = this.shell({
            banner: 'Résultats · Compréhension écrite',
            timed: false,
            body: `
                <div class="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-10">
                    <div class="text-center mb-8">
                        <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Puntaje (escala oficial /25)</p>
                        <p class="text-6xl font-extrabold text-purple-600">${points}<span class="text-2xl text-gray-400">/25</span></p>
                        <p class="text-gray-500 mt-2">${correct} de ${total} respuestas correctas${s.ceExpired ? ' · el tiempo se agotó' : ''}</p>
                        <p class="mt-2 text-sm font-bold ${passed ? 'text-emerald-600' : 'text-red-500'}">${passed ? 'Superas el mínimo eliminatorio (5/25)' : 'Por debajo del mínimo eliminatorio (5/25)'}</p>
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
                            ? sanitizeHTML(iaCalificadora.ultimoError || 'No pudimos conectar con la IA correctora.') + ' Autoevalúate con la grilla y la respuesta modelo.'
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
                                        ${(t.scale || []).map(n => `
                                            <button onclick="delfLogic.setCriterion('${c.key}', ${n.pts})" title="${sanitizeHTML(n.label)}"
                                                class="px-3 h-9 rounded-lg border text-xs font-extrabold transition ${s.peSelf[c.key] === n.pts ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-500 border-gray-200 hover:border-purple-300'}">${n.pts}</button>`).join('')}
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
        const passed = points >= DELF_MINIMO_ELIMINATORIO; // constante unica en shared.js
        this.saveAttempt({ section: 'pe', score: points, scale: '/25', summary: `PE ${points}/25 (autoeval.)` });
        this.root().innerHTML = this.shell({
            banner: 'Résultats · Production écrite',
            timed: false,
            body: `
                <div class="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-10">
                    <div class="text-center mb-8">
                        <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Puntaje autoevaluado (escala oficial /25)</p>
                        <p class="text-6xl font-extrabold text-purple-600">${points}<span class="text-2xl text-gray-400">/25</span></p>
                        <p class="mt-2 text-sm font-bold ${passed ? 'text-emerald-600' : 'text-red-500'}">${passed ? 'Superas el mínimo eliminatorio (5/25)' : 'Por debajo del mínimo eliminatorio (5/25)'}</p>
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
