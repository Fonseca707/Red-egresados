// admin-audio.js — Estudio de audio de los listening (DELF CO / TOEFL Listening)
//
// El audio se genera UNA sola vez aquí y se guarda en Storage; el estudiante
// reproduce ese archivo. Nunca se llama al TTS durante un intento: un test lo
// presentan muchos alumnos (y el DELF se escucha 2 veces), así que generar en
// vivo sería pagar el TTS en cada reproducción.
//
// No toca shared.js a propósito: reusa la global artifactsRoot, así ninguna de
// las 11 páginas necesita bump de ?v=.

const audioClipsCollection = artifactsRoot.collection('public').doc('data').collection('audioClips');
const PROXY_TTS = 'https://sinapsis-ia.sinapsis-lcp.workers.dev/tts';

// Voces del generador. La descripción es la que guía al elegir: en el DELF los
// diálogos necesitan dos timbres claramente distintos, y el TOEFL pide variedad
// de acentos entre clips.
const VOCES = [
    { id: 'Kore',      nota: 'femenina, neutra' },
    { id: 'Leda',      nota: 'femenina, joven' },
    { id: 'Aoede',     nota: 'femenina, cálida' },
    { id: 'Despina',   nota: 'femenina, suave' },
    { id: 'Puck',      nota: 'masculina, animada' },
    { id: 'Charon',    nota: 'masculina, grave' },
    { id: 'Fenrir',    nota: 'masculina, firme' },
    { id: 'Orus',      nota: 'masculina, seria' },
    { id: 'Enceladus', nota: 'masculina, pausada' },
    { id: 'Algieba',   nota: 'mixta, informativa' },
    { id: 'Achernar',  nota: 'clara, de locución' },
    { id: 'Alnilam',   nota: 'clara, de reportaje' },
    { id: 'Sulafat',   nota: 'narrativa' }
];

// Plantillas de instrucción de estilo por tipo de documento. Van como preámbulo
// del texto: es como se pide acento y registro sin campos aparte.
const ESTILOS = {
    'delf-dialogo':   { examen: 'delf',  etiqueta: 'DELF · Ej.1 diálogo cotidiano', hablantes: 2,
        instruccion: "Lis ce dialogue en français de France, à débit naturel de conversation quotidienne, ton spontané et non théâtral :" },
    'delf-radio-pro': { examen: 'delf',  etiqueta: 'DELF · Ej.2 radio (tema profesional)', hablantes: 2,
        instruccion: "Lis cet extrait d'émission de radio française sur un sujet professionnel, ton de journaliste, débit posé et clair :" },
    'delf-radio-soc': { examen: 'delf',  etiqueta: 'DELF · Ej.3 radio (tema de société)', hablantes: 2,
        instruccion: "Lis cet extrait d'émission de radio française sur un sujet de société, ton de reportage, débit un peu plus soutenu :" },
    'toefl-respuesta': { examen: 'toefl', etiqueta: 'TOEFL · Listen and Choose a Response', hablantes: 1,
        instruccion: 'Read this short spoken line naturally, as one person speaking to another in everyday conversation:' },
    'toefl-conversacion': { examen: 'toefl', etiqueta: 'TOEFL · Listen to a Conversation', hablantes: 2,
        instruccion: 'Read this conversation naturally, at normal conversational pace:' },
    'toefl-anuncio':  { examen: 'toefl', etiqueta: 'TOEFL · Listen to an Announcement', hablantes: 1,
        instruccion: 'Read this campus announcement clearly, as if over a public address system:' },
    'toefl-charla':   { examen: 'toefl', etiqueta: 'TOEFL · Listen to an Academic Talk', hablantes: 1,
        instruccion: 'Read this academic talk as a professor lecturing to students, clear and measured:' }
};

// Acentos que pide ETS. Se agregan a la instrucción y se guardan en la ficha
// del clip para poder documentar qué acento tocó a cada uno.
const ACENTOS = {
    '':      { etiqueta: '—', frase: '' },
    'en-US': { etiqueta: 'Estadounidense', frase: 'Use a standard American accent.' },
    'en-GB': { etiqueta: 'Británico',      frase: 'Use a standard British accent.' },
    'en-CA': { etiqueta: 'Canadiense',     frase: 'Use a Canadian accent.' },
    'en-AU': { etiqueta: 'Australiano',    frase: 'Use an Australian accent.' }
};

const audioLogic = {
    ultimoWav: null,      // Blob generado y aún no guardado
    ultimaDuracion: 0,
    clips: [],

    // ── Estado de la tarjeta ────────────────────────────────────────────────
    aviso(mensaje, tipo = 'info') {
        const caja = document.getElementById('audio-aviso');
        if (!caja) return;
        const colores = {
            info:  'bg-blue-50 text-blue-800 border-blue-200',
            ok:    'bg-green-50 text-green-800 border-green-200',
            error: 'bg-red-50 text-red-800 border-red-200'
        };
        caja.className = `mt-4 text-sm rounded-xl border px-4 py-3 ${colores[tipo]}`;
        caja.textContent = mensaje;
        caja.classList.remove('hidden');
    },

    // Al cambiar el tipo de documento se ajusta cuántas voces se piden: el
    // diálogo necesita dos, el monólogo una.
    onTipoChange() {
        const tipo = document.getElementById('audio-tipo').value;
        const cfg = ESTILOS[tipo];
        document.getElementById('audio-voz2-wrap').classList.toggle('hidden', cfg.hablantes < 2);
        document.getElementById('audio-acento-wrap').classList.toggle('hidden', cfg.examen !== 'toefl');
        document.getElementById('audio-ayuda-speakers').classList.toggle('hidden', cfg.hablantes < 2);
    },

    // ── 1. Generar (llama al proxy, que agrega la clave del TTS) ────────────
    async generar() {
        const texto = document.getElementById('audio-texto').value.trim();
        if (!texto) return this.aviso('Escribe el transcript que se va a narrar.', 'error');

        const tipo = document.getElementById('audio-tipo').value;
        const cfg = ESTILOS[tipo];
        const acento = document.getElementById('audio-acento').value;
        const boton = document.getElementById('audio-btn-generar');

        // En diálogo, el texto debe venir marcado con los nombres de los
        // hablantes; si no, el generador no sabe a quién dar cada voz.
        let voces;
        if (cfg.hablantes >= 2) {
            const marcas = [...new Set([...texto.matchAll(/^\s*([A-Za-zÀ-ÿ0-9 _-]{1,20}):/gm)].map(m => m[1].trim()))];
            if (marcas.length < 2) {
                return this.aviso('Un diálogo necesita marcar quién habla en cada línea, por ejemplo "Nadia: Bonjour…" y "Marc: Salut…".', 'error');
            }
            voces = [
                { speaker: marcas[0], voice: document.getElementById('audio-voz1').value },
                { speaker: marcas[1], voice: document.getElementById('audio-voz2').value }
            ];
        } else {
            voces = [{ voice: document.getElementById('audio-voz1').value }];
        }

        const instruccion = [cfg.instruccion, ACENTOS[acento]?.frase].filter(Boolean).join(' ');

        boton.disabled = true;
        boton.textContent = 'Generando…';
        this.aviso('Generando el audio. Un documento largo puede tardar cerca de un minuto.', 'info');
        try {
            const token = await auth.currentUser.getIdToken();
            const respuesta = await fetch(PROXY_TTS, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ texto, voces, instruccion })
            });
            if (!respuesta.ok) {
                const detalle = await respuesta.json().catch(() => ({}));
                throw new Error(detalle.error || `El generador respondió ${respuesta.status}`);
            }
            this.ultimaDuracion = Number(respuesta.headers.get('X-Duracion-Aprox-Seg') || 0);
            this.ultimoWav = await respuesta.blob();

            const reproductor = document.getElementById('audio-preview');
            reproductor.src = URL.createObjectURL(this.ultimoWav);
            document.getElementById('audio-preview-wrap').classList.remove('hidden');
            document.getElementById('audio-btn-guardar').disabled = false;
            const mb = (this.ultimoWav.size / 1048576).toFixed(1);
            this.aviso(`Audio listo: ${this.formatoDuracion(this.ultimaDuracion)} · ${mb} MB. Escúchalo antes de guardarlo — si no convence, ajusta el texto o las voces y vuelve a generar.`, 'ok');
        } catch (e) {
            this.aviso(`No se pudo generar: ${e.message}`, 'error');
        } finally {
            boton.disabled = false;
            boton.textContent = 'Generar audio';
        }
    },

    // ── 2. Guardar (sube a Storage y cataloga la ficha en Firestore) ────────
    async guardar() {
        if (!this.ultimoWav) return;
        const titulo = document.getElementById('audio-titulo').value.trim();
        if (!titulo) return this.aviso('Ponle un título al clip para reconocerlo después.', 'error');

        const tipo = document.getElementById('audio-tipo').value;
        const cfg = ESTILOS[tipo];
        const boton = document.getElementById('audio-btn-guardar');
        boton.disabled = true;
        boton.textContent = 'Guardando…';
        try {
            const id = `${tipo}-${Date.now()}`;
            const ref = firebase.storage().ref(`tests-audio/${cfg.examen}/${id}.wav`);
            await ref.put(this.ultimoWav, { contentType: 'audio/wav' });
            const audioUrl = await ref.getDownloadURL();

            await audioClipsCollection.doc(id).set({
                titulo,
                examen: cfg.examen,
                tipo,
                etiqueta: cfg.etiqueta,
                transcript: document.getElementById('audio-texto').value.trim(),
                acento: document.getElementById('audio-acento').value || '',
                voces: cfg.hablantes >= 2
                    ? [document.getElementById('audio-voz1').value, document.getElementById('audio-voz2').value]
                    : [document.getElementById('audio-voz1').value],
                // El DELF se escucha 2 veces y el TOEFL 1: el límite viaja con el
                // clip para que el reproductor del test no tenga que deducirlo.
                maxPlays: cfg.examen === 'delf' ? 2 : 1,
                duracionSeg: this.ultimaDuracion,
                bytes: this.ultimoWav.size,
                audioUrl,
                audioStatus: 'generado',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            this.ultimoWav = null;
            document.getElementById('audio-btn-guardar').disabled = true;
            document.getElementById('audio-preview-wrap').classList.add('hidden');
            document.getElementById('audio-titulo').value = '';
            this.aviso('Clip guardado en el banco. Ya se puede usar en un test.', 'ok');
            await this.cargar();
        } catch (e) {
            this.aviso(`No se pudo guardar: ${e.message}`, 'error');
        } finally {
            boton.textContent = 'Guardar en el banco';
        }
    },

    // ── 3. Banco de clips ya generados ──────────────────────────────────────
    async cargar() {
        const lista = document.getElementById('audio-lista');
        if (!lista) return;
        try {
            const snap = await audioClipsCollection.orderBy('createdAt', 'desc').get();
            this.clips = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
            lista.innerHTML = `<p class="text-sm text-red-600">No se pudo leer el banco: ${e.message}</p>`;
            return;
        }
        if (!this.clips.length) {
            lista.innerHTML = '<p class="text-sm text-gray-500">Todavía no hay clips. El primero que generes aparecerá aquí.</p>';
            return;
        }
        lista.innerHTML = this.clips.map(c => `
            <div class="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                <div class="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                        <p class="font-bold text-sm">${this.escapar(c.titulo || c.id)}</p>
                        <p class="text-xs text-gray-500 mt-0.5">
                            ${this.escapar(c.etiqueta || '')} ·
                            ${this.formatoDuracion(c.duracionSeg || 0)} ·
                            ${(c.voces || []).join(' + ')}
                            ${c.acento ? ' · ' + (ACENTOS[c.acento]?.etiqueta || c.acento) : ''} ·
                            se escucha ${c.maxPlays === 1 ? '1 vez' : c.maxPlays + ' veces'}
                        </p>
                    </div>
                    <div class="flex items-center gap-2">
                        <button onclick="audioLogic.copiarId('${c.id}')" class="text-xs font-bold text-brand-600 hover:underline">Copiar id</button>
                        <button onclick="audioLogic.eliminar('${c.id}')" class="text-xs font-bold text-red-600 hover:underline">Eliminar</button>
                    </div>
                </div>
                <audio controls preload="none" src="${c.audioUrl}" class="w-full mt-3 h-9"></audio>
                <details class="mt-2">
                    <summary class="text-xs text-gray-500 cursor-pointer">Ver transcript</summary>
                    <pre class="mt-2 text-xs whitespace-pre-wrap text-gray-600 dark:text-gray-300">${this.escapar(c.transcript || '')}</pre>
                </details>
            </div>
        `).join('');
    },

    async eliminar(id) {
        const clip = this.clips.find(c => c.id === id);
        if (!clip) return;
        if (!confirm(`¿Eliminar "${clip.titulo}"? Si algún test lo usa, se quedará sin audio.`)) return;
        try {
            await audioClipsCollection.doc(id).delete();
            // El archivo se borra después: si falla, la ficha ya no lo referencia.
            await firebase.storage().ref(`tests-audio/${clip.examen}/${id}.wav`).delete().catch(() => {});
            this.aviso('Clip eliminado.', 'ok');
            await this.cargar();
        } catch (e) {
            this.aviso(`No se pudo eliminar: ${e.message}`, 'error');
        }
    },

    copiarId(id) {
        navigator.clipboard.writeText(id);
        this.aviso(`Id copiado: ${id}. Es lo que se pega en el test para enlazar este audio.`, 'ok');
    },

    // ── Utilidades ──────────────────────────────────────────────────────────
    formatoDuracion(seg) {
        const m = Math.floor(seg / 60), s = seg % 60;
        return m ? `${m} min ${String(s).padStart(2, '0')} s` : `${s} s`;
    },

    escapar(texto) {
        const d = document.createElement('div');
        d.textContent = texto ?? '';
        return d.innerHTML;
    },

    // Rellena los <select> una sola vez, al abrir la pestaña.
    montar() {
        const opciones = VOCES.map(v => `<option value="${v.id}">${v.id} — ${v.nota}</option>`).join('');
        const voz1 = document.getElementById('audio-voz1');
        const voz2 = document.getElementById('audio-voz2');
        if (voz1 && !voz1.options.length) { voz1.innerHTML = opciones; voz1.value = 'Kore'; }
        if (voz2 && !voz2.options.length) { voz2.innerHTML = opciones; voz2.value = 'Puck'; }

        const tipo = document.getElementById('audio-tipo');
        if (tipo && !tipo.options.length) {
            tipo.innerHTML = Object.entries(ESTILOS)
                .map(([id, cfg]) => `<option value="${id}">${cfg.etiqueta}</option>`).join('');
        }
        const acento = document.getElementById('audio-acento');
        if (acento && !acento.options.length) {
            acento.innerHTML = Object.entries(ACENTOS)
                .map(([id, a]) => `<option value="${id}">${a.etiqueta}</option>`).join('');
        }
        this.onTipoChange();
        this.cargar();
    }
};
