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
const PROXY_TTS_VOCES = PROXY_TTS + '/voces';

// Dos generadores, para poder comparar con los oídos antes de casarse con uno.
// Gemini: barato, ya configurado, pero el acento se pide por escrito y sus
// consonantes son más blandas — justo lo que un examen de escucha evalúa.
// ElevenLabs: más nítido y sus acentos son voces reales (británica, australiana),
// no una instrucción que el modelo puede ignorar. Devuelve MP3 ya comprimido.
const PROVEEDORES = {
    gemini:     { etiqueta: 'Gemini — más barato', comprimirEnCliente: true },
    elevenlabs: { etiqueta: 'ElevenLabs — más natural, acentos reales', comprimirEnCliente: false }
};

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

// El generador entrega WAV (PCM 24 kHz): ~2,9 MB por minuto. Un DELF completo
// serían ~15 MB que el estudiante paga en datos. Comprimido a MP3 mono 64 kbps
// baja a ~0,5 MB/min — 6 veces menos, sin diferencia audible en voz — y el MP3
// lo reproduce cualquier teléfono, iPhone incluido.
const ENCODER_CDN = 'https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js';
const MP3_KBPS = 64;

const audioLogic = {
    ultimoAudio: null,    // Blob ya comprimido, aún sin guardar
    ultimaDuracion: 0,
    clips: [],

    // ── Compresión (en el navegador del admin, antes de subir) ──────────────
    cargarEncoder() {
        if (window.lamejs) return Promise.resolve();
        if (this._encoderPromesa) return this._encoderPromesa;
        this._encoderPromesa = new Promise((resolver, rechazar) => {
            const script = document.createElement('script');
            script.src = ENCODER_CDN;
            script.onload = resolver;
            script.onerror = () => rechazar(new Error('no se pudo cargar el compresor'));
            document.head.appendChild(script);
        });
        return this._encoderPromesa;
    },

    async comprimir(wavBlob) {
        await this.cargarEncoder();
        // A la tasa nativa del generador (24 kHz): si se deja la del sistema, el
        // navegador remuestrea a 44,1/48 kHz y se comprime el doble de muestras
        // para nada. Si el navegador no acepta fijarla, se sigue igual.
        const Contexto = window.AudioContext || window.webkitAudioContext;
        let ctx;
        try { ctx = new Contexto({ sampleRate: 24000 }); } catch { ctx = new Contexto(); }
        const buffer = await ctx.decodeAudioData(await wavBlob.arrayBuffer());
        ctx.close();

        // Mono: la voz no gana nada con estéreo y pesaría el doble.
        const muestras = buffer.getChannelData(0);
        const pcm = new Int16Array(muestras.length);
        for (let i = 0; i < muestras.length; i++) {
            const s = Math.max(-1, Math.min(1, muestras[i]));
            pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        const encoder = new lamejs.Mp3Encoder(1, buffer.sampleRate, MP3_KBPS);
        const trozos = [];
        const BLOQUE = 1152; // tamaño de frame que espera el encoder
        for (let i = 0; i < pcm.length; i += BLOQUE) {
            const datos = encoder.encodeBuffer(pcm.subarray(i, i + BLOQUE));
            if (datos.length) trozos.push(datos);
        }
        const cola = encoder.flush();
        if (cola.length) trozos.push(cola);

        return new Blob(trozos, { type: 'audio/mpeg' });
    },

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
        document.getElementById('audio-ayuda-speakers').classList.toggle('hidden', cfg.hablantes < 2);
        // El acento por instrucción es cosa de Gemini: en ElevenLabs el acento
        // ya viene en la voz que se elige.
        const esGemini = this.proveedor() === 'gemini';
        document.getElementById('audio-acento-wrap').classList.toggle('hidden', cfg.examen !== 'toefl' || !esGemini);
    },

    proveedor() {
        return document.getElementById('audio-proveedor')?.value || 'gemini';
    },

    // Al cambiar de generador cambian las voces disponibles: Gemini tiene un
    // catálogo fijo; las de ElevenLabs se leen de la cuenta, con su acento.
    async onProveedorChange() {
        const cual = this.proveedor();
        const voz1 = document.getElementById('audio-voz1');
        const voz2 = document.getElementById('audio-voz2');
        this.onTipoChange();

        if (cual === 'gemini') {
            const opciones = VOCES.map(v => `<option value="${v.id}">${v.id} — ${v.nota}</option>`).join('');
            voz1.innerHTML = opciones; voz1.value = 'Kore';
            voz2.innerHTML = opciones; voz2.value = 'Puck';
            return;
        }

        voz1.innerHTML = '<option>Cargando voces…</option>';
        voz2.innerHTML = '<option>Cargando voces…</option>';
        try {
            const token = await auth.currentUser.getIdToken();
            const respuesta = await fetch(PROXY_TTS_VOCES, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
            });
            const datos = await respuesta.json();
            if (!respuesta.ok) throw new Error(datos.error || `respondió ${respuesta.status}`);

            // Con el acento por delante: es el criterio de selección en el TOEFL.
            const opciones = (datos.voces || [])
                .sort((a, b) => (a.acento || 'zz').localeCompare(b.acento || 'zz'))
                .map(v => {
                    const detalle = [v.acento, v.genero].filter(Boolean).join(', ');
                    return `<option value="${v.id}">${this.escapar(v.nombre)}${detalle ? ' — ' + this.escapar(detalle) : ''}</option>`;
                }).join('');
            if (!opciones) throw new Error('la cuenta no tiene voces');
            voz1.innerHTML = opciones;
            voz2.innerHTML = opciones;
            if (voz2.options.length > 1) voz2.selectedIndex = 1; // que las dos voces no sean la misma
        } catch (e) {
            voz1.innerHTML = '<option value="">—</option>';
            voz2.innerHTML = '<option value="">—</option>';
            this.aviso(`No se pudieron cargar las voces de ElevenLabs: ${e.message}`, 'error');
        }
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
                body: JSON.stringify({ proveedor: this.proveedor(), texto, voces, instruccion })
            });
            if (!respuesta.ok) {
                const detalle = await respuesta.json().catch(() => ({}));
                throw new Error(detalle.error || `El generador respondió ${respuesta.status}`);
            }
            this.ultimaDuracion = Number(respuesta.headers.get('X-Duracion-Aprox-Seg') || 0);
            const crudo = await respuesta.blob();

            let aviso;
            if (PROVEEDORES[this.proveedor()].comprimirEnCliente) {
                // Se comprime ANTES de la vista previa a propósito: así lo que
                // escuchas aquí es exactamente lo que va a oír el estudiante.
                boton.textContent = 'Comprimiendo…';
                try {
                    this.ultimoAudio = await this.comprimir(crudo);
                    const ahorro = Math.round((1 - this.ultimoAudio.size / crudo.size) * 100);
                    aviso = `Audio listo: ${this.formatoDuracion(this.ultimaDuracion)} · ${this.formatoPeso(this.ultimoAudio.size)} (${ahorro}% menos que sin comprimir).`;
                } catch (e) {
                    // Si el compresor no cargó, mejor un clip pesado que ninguno.
                    this.ultimoAudio = crudo;
                    aviso = `Audio listo: ${this.formatoDuracion(this.ultimaDuracion)} · ${this.formatoPeso(crudo.size)} — sin comprimir (${e.message}), pesará más de lo normal.`;
                }
            } else {
                // ElevenLabs ya devuelve MP3: recomprimir solo degradaría.
                this.ultimoAudio = crudo;
                aviso = `Audio listo: ${this.formatoPeso(crudo.size)}.`;
            }
            if (!this.ultimaDuracion) {
                this.ultimaDuracion = await this.medirDuracion(this.ultimoAudio);
            }

            const reproductor = document.getElementById('audio-preview');
            reproductor.src = URL.createObjectURL(this.ultimoAudio);
            document.getElementById('audio-preview-wrap').classList.remove('hidden');
            document.getElementById('audio-btn-guardar').disabled = false;
            this.aviso(`${aviso} Escúchalo antes de guardarlo — si no convence, ajusta el texto o las voces y vuelve a generar.`, 'ok');
        } catch (e) {
            this.aviso(`No se pudo generar: ${e.message}`, 'error');
        } finally {
            boton.disabled = false;
            boton.textContent = 'Generar audio';
        }
    },

    // ── 2. Guardar (sube a Storage y cataloga la ficha en Firestore) ────────
    async guardar() {
        if (!this.ultimoAudio) return;
        const titulo = document.getElementById('audio-titulo').value.trim();
        if (!titulo) return this.aviso('Ponle un título al clip para reconocerlo después.', 'error');

        const tipo = document.getElementById('audio-tipo').value;
        const cfg = ESTILOS[tipo];
        const boton = document.getElementById('audio-btn-guardar');
        boton.disabled = true;
        boton.textContent = 'Guardando…';
        try {
            const id = `${tipo}-${Date.now()}`;
            const mime = this.ultimoAudio.type || 'audio/mpeg';
            const extension = mime === 'audio/mpeg' ? 'mp3' : 'wav';
            const ref = firebase.storage().ref(`tests-audio/${cfg.examen}/${id}.${extension}`);
            await ref.put(this.ultimoAudio, { contentType: mime });
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
                proveedor: this.proveedor(),
                duracionSeg: this.ultimaDuracion,
                bytes: this.ultimoAudio.size,
                formato: extension,
                audioUrl,
                audioStatus: 'generado',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            this.ultimoAudio = null;
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
                            ${this.formatoPeso(c.bytes || 0)} ·
                            ${c.proveedor === 'elevenlabs' ? 'ElevenLabs' : 'Gemini'} ·
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
            await firebase.storage().ref(`tests-audio/${clip.examen}/${id}.${clip.formato || 'wav'}`).delete().catch(() => {});
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
    // ElevenLabs no informa la duración: se mide decodificando el audio. El test
    // usará este valor guardado y no el `duration` del elemento <audio>, que en
    // MP3 sin cabecera Xing puede ser impreciso mientras descarga.
    async medirDuracion(blob) {
        try {
            const Contexto = window.AudioContext || window.webkitAudioContext;
            const ctx = new Contexto();
            const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
            ctx.close();
            return Math.round(buffer.duration);
        } catch { return 0; }
    },

    formatoPeso(bytes) {
        return bytes >= 1048576
            ? `${(bytes / 1048576).toFixed(1)} MB`
            : `${Math.round(bytes / 1024)} KB`;
    },

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
        const proveedor = document.getElementById('audio-proveedor');
        if (proveedor && !proveedor.options.length) {
            proveedor.innerHTML = Object.entries(PROVEEDORES)
                .map(([id, p]) => `<option value="${id}">${p.etiqueta}</option>`).join('');
        }
        const voz1 = document.getElementById('audio-voz1');
        if (voz1 && !voz1.options.length) this.onProveedorChange();

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
