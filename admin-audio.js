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
// Los dos están operativos (la clave de Gemini quedó puesta en el Worker el
// 2026-07-26). ElevenLabs va primero —o sea, sale por defecto— porque sus
// acentos son voces reales y no una instrucción escrita que el modelo puede
// ignorar, y en un examen de escucha el acento es parte de lo que se evalúa.
const PROVEEDORES = {
    elevenlabs: { etiqueta: 'ElevenLabs — voces con acento real (recomendado)', comprimirEnCliente: false },
    gemini:     { etiqueta: 'Gemini — más barato, acento por instrucción', comprimirEnCliente: true }
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
//
// Calibradas contra las FUENTES OFICIALES (2026-07-26), no a ojo:
//  · DELF — transcripción del surveillant del sujet démo B1TP_02 (nouveau format,
//    France Éducation International): 3 documentos de 324-388 palabras ≈ 2 min
//    cada uno, tope oficial 6 min entre los tres, estudio limpio sin música.
//  · TOEFL — `toefl-ibt-full-length-practice-test1.pdf` de ETS ("aligns with
//    tests from January 21, 2026"), que trae los guiones literales de los audios.
//
// Cada estilo lleva su `ficha` (cómo suena el audio real) y su `referencia` (un
// transcript oficial). Generar la referencia y compararla con la grabación real
// es la única forma honesta de medir cuánto se parece nuestro TTS.
const ESTILOS = {
    'delf-dialogo': {
        examen: 'delf', etiqueta: 'DELF · Ej.1 diálogo cotidiano', hablantes: 2,
        instruccion: "Dialogue authentique en français de France entre deux amis proches qui se tutoient. Débit naturel d'environ 150 mots par minute, ton spontané, chaleureux et non théâtral — surtout pas une lecture à voix haute. Articulation nette (chaque mot doit rester identifiable pour un apprenant B1), enchaînements et intonations montantes des questions bien marquées, courtes respirations entre les répliques. Aucune musique, aucun bruit de fond, prise de son de studio :",
        ficha: {
            duracion: '≈ 1 min 50 s – 2 min (352 palabras en el sujet oficial)',
            voces: '2 · francés de Francia, timbres claramente distintos, tuteo',
            ritmo: '≈ 150 palabras/min, espontáneo pero articulado',
            fondo: 'Estudio limpio: sin música, sin ambiente, sin efectos',
            ojo: 'El audio real es una PISTA completa: consigna hablada + un “son” (bip) antes de cada escucha + silencios de 1 min / 10 s / 30 s. Eso lo arma el reproductor, no el TTS.'
        },
        referencia: `Célia: Salut Lilian !
Lilian: Salut Célia ! Ça va ?
Célia: Génial ! Tu sais quoi ? Pour mes trente ans, je vais organiser un week-end à la montagne. Un week-end... sans enfants !
Lilian: C'est une super idée ! Tu sais déjà où ?
Célia: Mes parents ont une maison dans les Alpes. Ils nous la prêtent avec plaisir ! Et moi, je leur offre le restaurant pour leur dire merci !
Lilian: Génial ! Et tu vas inviter beaucoup de monde ?
Célia: Non, seulement mes meilleurs amis. On sera une dizaine. Je préfère quand il n'y a pas trop de gens, pour pouvoir parler avec tout le monde. Tu vas venir ?
Lilian: J'aimerais bien ! C'est quand ?
Célia: Les 20 et 21 janvier.
Lilian: Malheureusement, je travaille le samedi, mais je peux prendre le train après et passer la moitié du week-end avec vous ! Ça me ferait plaisir de partager ce moment avec toi, depuis tout le temps qu'on se connaît !
Célia: Oui, c'est parfait, tu arriveras juste à temps pour le grand repas d'anniversaire !
Lilian: Ça ne va pas te faire trop de choses à préparer ?
Célia: Non, je vais demander à chaque personne d'apporter quelque chose à manger, et moi, je m'occupe des boissons.
Lilian: C'est une bonne solution ! Et le dimanche, qu'est-ce qu'on va faire ?
Célia: J'espère qu'il va y avoir de la neige. Comme ça, on pourra faire du ski.
Lilian: J'aime beaucoup ce programme ! Et au fait... qu'est-ce que tu aimerais comme cadeau pour ton anniversaire ?
Célia: Hmm, j'ai réfléchi mais je ne veux pas de cadeau. En fait, ce qui est le plus important pour moi, c'est que vous soyez tous présents ce week-end-là !
Lilian: D'accord. Alors compte sur moi !`
    },
    'delf-radio-pro': {
        examen: 'delf', etiqueta: 'DELF · Ej.2 radio (entrevista, tema profesional)', hablantes: 2,
        instruccion: "Extrait d'émission de radio française : un journaliste interviewe un invité. Le journaliste a une voix de studio posée et bien articulée, il pose ses questions avec une intonation claire ; l'invité répond sur un ton naturel et spontané, un peu plus rapide et moins net que le journaliste, comme une vraie personne interviewée. Débit d'environ 150 mots par minute. Pas de jingle, pas de musique, pas d'ambiance : voix seules, prise de son de studio :",
        ficha: {
            duracion: '≈ 2 min – 2 min 30 s (388 palabras en el sujet oficial)',
            voces: '2 · periodista (locución) + invitado (habla natural)',
            ritmo: '≈ 150 palabras/min; el invitado algo más suelto que el periodista',
            fondo: 'Sin jingle ni música — el examen recorta solo las voces',
            ojo: 'La consigna previa es “Vous écoutez la radio.” Nunca se anuncia el nombre del programa.'
        },
        referencia: `Journaliste: Aujourd'hui, je vous présente l'association Un regard pour toi, qui propose à des personnes malvoyantes de faire leur shopping avec des bénévoles qui, eux, voient et les aident. Je suis avec Hayette Louail, 29 ans, qui a créé l'association. Bonjour Hayette, est-ce que vous pouvez nous expliquer pourquoi vous avez lancé Un regard pour toi ?
Hayette: Bonjour. Moi, je suis malvoyante. Quand je vais dans les magasins pour acheter des vêtements, je ne sais jamais si je vais trouver un vendeur disponible. Et même si un vendeur est là, ce n'est pas toujours facile : est-ce qu'il a bien compris ce que je cherche ? Les vendeurs vont vite, ils n'ont pas le temps... Moi, j'ai besoin de prendre mon temps... Alors j'ai pensé que des gens qui aiment faire du shopping pourraient m'aider en venant avec moi et en m'expliquant ce qu'ils voient !
Journaliste: Qu'est-ce que ça a changé dans votre expérience du shopping ?
Hayette: J'adore quand un bénévole me suggère une façon différente de m'habiller. Il me décrit un vêtement, et je pense, oh la la, non, ce n'est pas du tout pour moi ! mais j'essaie, et parfois, c'est vraiment super ! Grâce aux bénévoles, j'apprends à porter d'autres choses. Après, au travail, mes collègues me demandent où j'ai acheté mes vêtements.
Journaliste: Et si je veux aider l'association, comment est-ce que je fais ?
Hayette: Aujourd'hui, on a une cinquantaine de bénévoles, mais on est toujours à la recherche de nouvelles personnes, donc vous êtes le bienvenu. D'abord, vous aurez une réunion d'information pour rencontrer les autres bénévoles et préparer votre premier rendez-vous. Puis, c'est vous qui décidez à quel rythme vous faites des sorties shopping, et quand.`
    },
    'delf-radio-soc': {
        examen: 'delf', etiqueta: 'DELF · Ej.3 radio (tema de société)', hablantes: 2,
        instruccion: "Extrait d'émission de radio française sur un sujet de société : le journaliste présente brièvement son invité, puis l'invité développe une longue réponse suivie. Ton de reportage, débit d'environ 150 mots par minute, phrases longues avec des respirations aux virgules, sans emphase publicitaire. L'invité parle comme un professionnel passionné, pas comme un lecteur. Aucune musique ni bruit de fond, prise de son de studio :",
        ficha: {
            duracion: '≈ 2 min (324 palabras en el sujet oficial)',
            voces: '2 · presentación corta del periodista + monólogo largo del invitado',
            ritmo: '≈ 150 palabras/min, frases largas con respiraciones marcadas',
            fondo: 'Sin música ni ambiente',
            ojo: 'Es el documento “más difícil” de los tres, pero NO por ser más rápido: por densidad de información y cifras (30 cuisiniers, 400 à 1 000 repas, 48 heures).'
        },
        referencia: `Journaliste: Aujourd'hui, je reçois François Dechy qui va nous parler de Baluchon. C'est une entreprise qu'il a créée à Romainville, en région parisienne.
François: Alors, Baluchon, c'est une petite entreprise qui existe depuis deux ans. On prépare des repas qu'on livre dans les entreprises, pour les salariés qui n'ont pas le temps de cuisiner eux-mêmes et qui en ont assez de manger des sandwichs en cinq minutes devant leur ordinateur... Je me suis rendu compte que les employés prenaient de moins en moins de temps pour déjeuner. Mais on sait que s'arrêter un bon moment et prendre un vrai repas permet d'être plus productif l'après-midi ! Je voulais donc créer un projet qui redonnait de l'importance au moment du déjeuner. Je voulais aussi que cette entreprise mette en valeur des produits locaux, cultivés naturellement et sans produits chimiques. Et puis, ce qui m'intéresse surtout, c'est l'humain. J'avais envie d'aider des gens qui ont du mal à trouver du travail, des personnes qui sont au chômage depuis longtemps ou des jeunes qui ont arrêté l'école. À Baluchon, ces personnes sont formées pendant deux ans pour apprendre un métier dans la restauration. Pour accéder à nos cours, on leur demande seulement de savoir parler français, écrire, et compter jusqu'à cent. Quand j'ai présenté le projet à ma ville, ils ont décidé de m'aider, et le maire nous a prêté une cuisine qui n'était pas utilisée depuis plusieurs années. On prépare tous les repas là-bas, et c'est vraiment pratique pour nous, parce que c'est très central ! Tous les jours, on a 30 cuisiniers qui préparent entre 400 et 1 000 repas. Par exemple, aujourd'hui, notre équipe prépare une crème de courgette à la menthe. Vous pouvez regarder les menus sur notre site internet. Pour commander, téléphonez au moins 48 heures à l'avance, surtout pour un grand groupe.`
    },
    'toefl-respuesta': {
        examen: 'toefl', etiqueta: 'TOEFL · Listen and Choose a Response', hablantes: 1,
        instruccion: 'One single spoken line, addressed directly to the listener, as in a real everyday exchange. Around 2 to 4 seconds long. Natural conversational speed (about 150 words per minute) — not slow, not exaggerated. The intonation must carry the meaning unmistakably: rising for a yes/no question, falling for a wh- question or a statement, since the listener has no text on screen and hears it only once. Clean studio voice, no background sound, no introduction, no narrator:',
        ficha: {
            duracion: '2–4 s por ítem (una sola frase de 6 a 14 palabras)',
            voces: '1 · alterna hombre/mujer entre ítems',
            ritmo: 'Conversacional (≈150 wpm); la entonación es la que da la pista',
            fondo: 'Voz limpia, sin ambiente',
            ojo: 'No hay narrador ni contexto hablado: en pantalla solo se ve la foto de la persona y las 4 opciones. Se escucha 1 sola vez.'
        },
        referencia: `Didn't I just see you in the library an hour ago?`
    },
    'toefl-conversacion': {
        examen: 'toefl', etiqueta: 'TOEFL · Listen to a Conversation', hablantes: 2,
        instruccion: 'A short, real conversation between two people who know each other (roommates, coworkers, a student and a staff member). Around 20 to 30 seconds. Relaxed everyday speed, overlapping-free but quick turn-taking, with the small sounds real speech has: a surprised "Huh?", a thoughtful "Oh", a trailing-off pause where the line ends in an ellipsis. Contractions and reductions must sound natural, never over-enunciated. It must sound recorded in a room, not read from a page — but with a clean studio voice, no background noise:',
        ficha: {
            duracion: '20–30 s (60–110 palabras en los guiones de ETS)',
            voces: '2 · hombre + mujer, acentos de EE. UU./Canadá/RU/Australia',
            ritmo: 'Rápido y coloquial, con turnos cortos',
            fondo: 'Sin ruido ambiente, pero con habla imperfecta (“Huh?”, “Oh. Wow”)',
            ojo: 'Los modismos son ítem: “I\'d forget my head if it wasn\'t screwed on” se pregunta después. La frase cortada (“In that case....”) es intencional.'
        },
        referencia: `Woman: Need anything from the supermarket?
Man: Huh? Aren't we getting ready to go see that play in a few minutes?
Woman: That's tomorrow.
Man: Oh. Wow, I'd forget my head if it wasn't screwed on.... Guess I don't need to change my clothes after all.
Woman: So, you weren't planning to prepare dinner?
Man: No, but I can. What do you want?
Woman: Just something light and healthy. So, can you go shopping instead?
Man: Yeah, sure. How about salmon and salad? Want anything else?
Woman: No, that's good. Thanks!`
    },
    'toefl-anuncio': {
        examen: 'toefl', etiqueta: 'TOEFL · Listen to an Announcement', hablantes: 1,
        instruccion: 'A spoken announcement made to a room full of students by a teacher or staff member — a person speaking to a group, NOT a loudspeaker or an automated system. Around 20 to 26 seconds. Clear, unhurried, slightly formal, with a brief pause before each key detail (day, time, place) so it can be caught on a single listening. Warm and helpful, never robotic. Clean studio voice, no echo, no PA distortion, no background sound:',
        ficha: {
            duracion: '20–26 s (70–85 palabras en los guiones de ETS)',
            voces: '1 · profesor o personal del campus dirigiéndose a un grupo',
            ritmo: 'Claro y algo más pausado, con pausa antes de los datos clave',
            fondo: 'Voz limpia — NO megafonía con eco (era un error del preset anterior)',
            ojo: 'Los datos concretos (Monday at 2 PM, Waldman Auditorium) son la respuesta: deben oírse nítidos a la primera.'
        },
        referencia: `Good afternoon, everyone. I am excited to inform you that Dr. Cynthia Palmer, a renowned expert in environmental science, will be giving a guest lecture next Monday at 2 PM in Waldman Auditorium. Dr. Palmer will discuss the latest advancements in sustainable energy solutions and their impact on global climate change. Due to her popularity and the high interest in her work, I highly recommend arriving early to secure a seat.`
    },
    'toefl-charla': {
        examen: 'toefl', etiqueta: 'TOEFL · Listen to an Academic Talk', hablantes: 1,
        instruccion: 'An academic talk — a professor teaching a class, or a podcast host explaining an idea to an audience. Around 60 to 90 seconds. Teaching pace: about 145 words per minute, engaged and expressive, not a flat reading. Mark the structure with the voice: a small pause before each technical term the first time it appears, slight emphasis on the term itself, and a clear drop before moving to the next idea. Rhetorical questions rise naturally. Dashes are short thinking pauses. Clean studio voice, no music, no background sound:',
        ficha: {
            duracion: '60–90 s (150–250 palabras en los guiones de ETS)',
            voces: '1 · profesor en clase o presentador de pódcast',
            ritmo: '≈145 palabras/min, didáctico y expresivo',
            fondo: 'Sin música ni ambiente de aula',
            ojo: 'Cada término nuevo (hard fascination, Default Mode Network) se pregunta después: si el TTS lo dice atropellado, el ítem se vuelve injusto.'
        },
        referencia: `Did you see that new thriller movie that came out last week? I did and loved it. The action, the plot twists... I was totally captivated. Time just flew by. Not a single thought occurred to me that was unrelated to the movie. What I experienced is what psychologists call hard fascination. Hard fascination means intense focus and concentration. Whether it's TV programs, video games... hard fascination is all too easy to come by in this modern world.
There's another type of fascination—soft fascination. There's still effortless attention, meaning that no special effort is required for you to stay focused, but there's still room for other thoughts. When I take a walk in the park and look at the flowers and trees, for example, I might be thinking in the back of my mind about my dinner plans.
Now, one thing to know is hard fascination causes mental fatigue. The mind is so intensely focused that it gets tired fast. What follows mental fatigue? You might find yourself easily distracted, irritable, and stressed. Soft fascination, in contrast, engages a different part of the brain—the DMN, or Default Mode Network, which soothes the mind and helps combat mental fatigue. So next time you feel like your mind is on overload, turn off the TV, put down your phone. Take a walk, or simply sit and stare at the clouds.`
    }
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
        // Al abrir la pestaña, onProveedorChange corre antes de que el select de
        // tipos tenga opciones; el init vuelve a llamar aquí cuando ya las tiene.
        if (!cfg) return;
        document.getElementById('audio-voz2-wrap').classList.toggle('hidden', cfg.hablantes < 2);
        document.getElementById('audio-ayuda-speakers').classList.toggle('hidden', cfg.hablantes < 2);
        // El acento por instrucción es cosa de Gemini: en ElevenLabs el acento
        // ya viene en la voz que se elige.
        const esGemini = this.proveedor() === 'gemini';
        document.getElementById('audio-acento-wrap').classList.toggle('hidden', cfg.examen !== 'toefl' || !esGemini);
        this.pintarFicha(cfg);
    },

    // ── Ficha "así suena el audio real" ─────────────────────────────────────
    // Sin esto, el estudio genera a ciegas: uno oye el clip y no tiene contra qué
    // compararlo. Los números salen de las fuentes oficiales, no de la intuición.
    pintarFicha(cfg) {
        const caja = document.getElementById('audio-ficha');
        if (!caja || !cfg.ficha) return;
        const f = cfg.ficha;
        const fila = (etiqueta, valor) => valor
            ? `<div><dt class="text-[11px] uppercase tracking-wide text-gray-500">${etiqueta}</dt><dd class="text-xs">${this.escapar(valor)}</dd></div>` : '';
        caja.innerHTML = `
            <dl class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
                ${fila('Duración', f.duracion)}
                ${fila('Voces', f.voces)}
                ${fila('Ritmo', f.ritmo)}
                ${fila('Fondo', f.fondo)}
            </dl>
            ${f.ojo ? `<p class="text-xs text-amber-700 dark:text-amber-400">⚠️ ${this.escapar(f.ojo)}</p>` : ''}`;
    },

    // Carga el transcript OFICIAL de ese tipo de documento. Sirve para lo único
    // que resuelve la duda de fidelidad: generar exactamente el mismo texto que
    // existe grabado por el examen real y escuchar los dos seguidos.
    cargarReferencia() {
        const cfg = ESTILOS[document.getElementById('audio-tipo').value];
        if (!cfg?.referencia) return;
        const campo = document.getElementById('audio-texto');
        if (campo.value.trim() && !confirm('Se reemplaza el transcript que hay escrito. ¿Seguir?')) return;
        campo.value = cfg.referencia;
        this.aviso('Cargado el transcript oficial de ese tipo de documento. Genéralo y compáralo con la grabación real del examen: es la prueba de fidelidad.', 'info');
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

            // Si el bucket no está aprovisionado, el SDK de Storage NO falla:
            // reintenta en silencio para siempre y el botón se queda en
            // "Guardando…" sin explicar nada. Se le pone un tope y un mensaje que
            // diga exactamente qué hacer.
            const subida = ref.put(this.ultimoAudio, { contentType: mime });
            await Promise.race([
                subida,
                new Promise((_, rechazar) => setTimeout(() => {
                    subida.cancel();
                    rechazar(new Error('Firebase Storage no respondió. Casi siempre es que el bucket todavía no está creado: entra a la consola de Firebase → Storage → "Comenzar", y luego se despliegan las reglas con "firebase deploy --only storage". El clip generado NO se pierde: sigue en la vista previa, puedes guardarlo apenas quede listo.'));
                }, 45000))
            ]);
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
            // El botón se reactiva: el clip sigue en memoria y en la vista previa,
            // así que reintentar no obliga a generarlo (ni a pagarlo) de nuevo.
            boton.disabled = !this.ultimoAudio;
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
