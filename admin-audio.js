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

// Dos generadores, y cuál se usa YA NO ES UNA PREFERENCIA: es una decisión
// cerrada por examen (Juan, 2026-07-31, después de comparar los dos a oído).
//
//   · DELF (francés) → ElevenLabs. Sale estable tirada tras tirada y el francés
//     no se le oye a IA. El francés queda cerrado: no se toca el preset.
//   · TOEFL (inglés) → Gemini. Es mucho MÁS volátil, y esa es justamente la
//     razón: da variedad entre clips (voces, acentos, habla coloquial) y el
//     TOEFL la pide. El precio es revisar cada clip con más cuidado — por eso
//     abajo existen las tomas: se generan varias y se elige a oído.
//
// El select sigue existiendo para poder saltarse la regla en un caso puntual,
// pero al cambiar de examen se repone el que corresponde.
const PROVEEDORES = {
    elevenlabs: { etiqueta: 'ElevenLabs — estable (el del DELF)', comprimirEnCliente: false, maxCharsDialogo: 2000 },
    gemini:     { etiqueta: 'Gemini — variado (el del TOEFL)',    comprimirEnCliente: true }
};

const GENERADOR_POR_EXAMEN = { delf: 'elevenlabs', toefl: 'gemini' };

const PORQUE_ESE_GENERADOR = {
    delf:  'ElevenLabs sale estable tirada tras tirada; en francés es lo que decidió Juan y no se cambia.',
    toefl: 'Gemini varía mucho entre tomas, y esa variedad es la que el TOEFL necesita. Genera varias tomas y quédate con la que mejor suene.'
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
        wpm: 150,
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
        wpm: 150,
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
        wpm: 150,
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
        wpm: 150,
        examen: 'toefl', etiqueta: 'TOEFL · Listen and Choose a Response', hablantes: 1,
        instruccion: 'One single spoken line, addressed directly to the listener, as in a real everyday exchange. Natural conversational speed (about 150 words per minute) — not slow, not exaggerated, and never rushed to fit a target length. The intonation must carry the meaning unmistakably: rising for a yes/no question, falling for a wh- question or a statement, since the listener has no text on screen and hears it only once. Clean studio voice, no background sound, no introduction, no narrator:',
        ficha: {
            duracion: '≈ 3–6 s por ítem — lo que dura una frase de 6 a 14 palabras a 150 wpm',
            voces: '1 · alterna hombre/mujer entre ítems',
            ritmo: 'Conversacional (≈150 wpm); la entonación es la que da la pista',
            fondo: 'Voz limpia, sin ambiente',
            ojo: 'No hay narrador ni contexto hablado: en pantalla solo se ve la foto de la persona y las 4 opciones. Se escucha 1 sola vez.'
        },
        referencia: `Didn't I just see you in the library an hour ago?`
    },
    'toefl-conversacion': {
        wpm: 150,
        examen: 'toefl', etiqueta: 'TOEFL · Listen to a Conversation', hablantes: 2,
        instruccion: 'A short, real conversation between two people who know each other (roommates, coworkers, a student and a staff member). Relaxed everyday speed of about 150 words per minute — take exactly as long as the script needs, never speed up to fit a target length. Overlapping-free but quick turn-taking, with the small sounds real speech has: a surprised "Huh?", a thoughtful "Oh", a trailing-off pause where the line ends in an ellipsis. Contractions and reductions must sound natural, never over-enunciated. It must sound recorded in a room, not read from a page — but with a clean studio voice, no background noise:',
        ficha: {
            duracion: '≈ 25–45 s — lo que dura el guion a 150 wpm. Lo oficial de ETS son las 60–110 palabras, NO la duración: su PDF solo publica los guiones. El guion de referencia (82 palabras) da ≈ 33 s',
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
        wpm: 140,
        examen: 'toefl', etiqueta: 'TOEFL · Listen to an Announcement', hablantes: 1,
        instruccion: 'A spoken announcement made to a room full of students by a teacher or staff member — a person speaking to a group, NOT a loudspeaker or an automated system. Clear, unhurried, about 140 words per minute — take exactly as long as the script needs, never speed up to fit a target length. Slightly formal, with a brief pause before each key detail (day, time, place) so it can be caught on a single listening. Warm and helpful, never robotic. Clean studio voice, no echo, no PA distortion, no background sound:',
        ficha: {
            duracion: '≈ 30–36 s — lo que duran 70–85 palabras a 140 wpm. Lo oficial de ETS es el nº de palabras, no la duración',
            voces: '1 · profesor o personal del campus dirigiéndose a un grupo',
            ritmo: 'Claro y algo más pausado, con pausa antes de los datos clave',
            fondo: 'Voz limpia — NO megafonía con eco (era un error del preset anterior)',
            ojo: 'Los datos concretos (Monday at 2 PM, Waldman Auditorium) son la respuesta: deben oírse nítidos a la primera.'
        },
        referencia: `Good afternoon, everyone. I am excited to inform you that Dr. Cynthia Palmer, a renowned expert in environmental science, will be giving a guest lecture next Monday at 2 PM in Waldman Auditorium. Dr. Palmer will discuss the latest advancements in sustainable energy solutions and their impact on global climate change. Due to her popularity and the high interest in her work, I highly recommend arriving early to secure a seat.`
    },
    'toefl-charla': {
        wpm: 145,
        examen: 'toefl', etiqueta: 'TOEFL · Listen to an Academic Talk', hablantes: 1,
        instruccion: 'An academic talk — a professor teaching a class, or a podcast host explaining an idea to an audience. Teaching pace: about 145 words per minute — take exactly as long as the script needs, never speed up to fit a target length. Engaged and expressive, not a flat reading. Mark the structure with the voice: a small pause before each technical term the first time it appears, slight emphasis on the term itself, and a clear drop before moving to the next idea. Rhetorical questions rise naturally. Dashes are short thinking pauses. Clean studio voice, no music, no background sound:',
        ficha: {
            duracion: '≈ 1 min – 1 min 45 s — lo que duran 150–250 palabras a 145 wpm. Lo oficial de ETS es el nº de palabras, no la duración',
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

// ── Troceo: RED DE SEGURIDAD, ya no un paso normal ──────────────────────────
// Se construyó el 2026-07-28 para los documentos largos, que salían
// atropellados: partir el texto le quitaba al modelo margen para acelerar y
// permitía rehacer solo la parte mala.
//
// ⛔ Juan lo DESCARTÓ el 2026-07-31, y por buenas razones, una por generador:
//   · TOEFL/Gemini: la volatilidad entre tiradas es tan alta que dos partes
//     generadas por separado no suenan a la misma grabación. El remedio salía
//     peor que la enfermedad — y esa volatilidad ahora se busca a propósito.
//   · DELF/ElevenLabs: ya no hace falta. Sale estable de una sola tirada, y los
//     tres documentos del sujet oficial miden 1633 / 1716 / 1842 caracteres
//     contra el tope de 2000 del endpoint de diálogo: caben enteros.
//
// Así que el troceo NO se dispara por longitud. Solo salta cuando el texto no
// cabe de una en el proveedor —si no, la petición se rechazaría entera— y
// cuando se pide a mano con "---". En ambos casos se avisa, no se hace en
// silencio. La continuidad entre partes se fabrica con cuatro reglas, en orden
// de peso, que siguen valiendo cuando toca partir:
//   1. La voz es un id fijo → el TIMBRE no puede cambiar. Nunca se cambia de
//      voz ni de mapeo hablante→voz entre partes de un mismo clip.
//   2. El preámbulo de estilo viaja IDÉNTICO, carácter por carácter, en todas.
//      La deriva de estilo viene casi toda de que el prompt cambie.
//   3. Se corta solo en frontera de turno o de párrafo, nunca a mitad de frase,
//      y las partes salen parejas: un trozo de 40 palabras junto a uno de 300
//      suena a dos grabaciones distintas, porque el ritmo depende del largo.
//   4. Al pegar se iguala el volumen de cada parte (mismo RMS) y se separa con
//      un silencio corto. Un trozo más fuerte que el anterior se oye como
//      "otro corte" aunque la voz sea la misma.
const TROCEO_OBJETIVO = 85;        // palabras por parte cuando SÍ toca partir
const PROXY_MAX_CHARS = 6000;      // tope del Worker, igual para los dos generadores
const CORTE_MANUAL = /^\s*-{3,}\s*$/;  // una línea "---" fuerza un corte ahí
const PAUSA_ENTRE_PARTES_MS = 350; // lo que dura una respiración entre turnos
const CONCURRENCIA = 2;            // generaciones a la vez (el proxy limita 40/h)

// ── Rescate de una parte que salió rápida (idea de Juan, 2026-07-28) ────────
// Alargar el audio para bajarlo al ritmo objetivo. Funciona, pero con un límite
// que no es negociable: cuando el modelo corre no solo va rápido, también come
// consonantes y se traga las pausas. Estirar devuelve la DURACIÓN, no la
// ARTICULACIÓN — y en un examen de comprensión la consonante nítida es lo que
// se evalúa. Por eso esto es un rescate, no un arreglo, y va en dos escalones:
//
//   1. Estirar SOLO los silencios. Lo primero que el generador sacrifica al
//      correr son las pausas entre frases; devolvérselas no toca ni una sílaba
//      (cero artefactos) y acerca el clip al examen real, que tiene
//      respiraciones marcadas. Muchas veces con esto basta.
//   2. Si aún falta, estirar el habla con WSOLA (solapar y sumar buscando el
//      mejor punto de empalme por correlación). Hasta ~12% es transparente en
//      voz; más allá aparece el timbre metálico y el eco.
//
// Por encima del tope, el clip no está rápido: está roto. Ahí se regenera la
// parte, que con el troceo cuesta 20 segundos.
const ESTIRADO_MAX = 1.12;          // tope de estirado del habla
const SILENCIO_UMBRAL = 0.02;       // amplitud por debajo de la cual es pausa
const SILENCIO_MIN_MS = 60;         // pausas más cortas son parte del habla
const WSOLA_VENTANA_MS = 40;
const WSOLA_BUSQUEDA_MS = 10;

const audioLogic = {
    clips: [],

    // ── Tomas ───────────────────────────────────────────────────────────────
    // Por qué existen (2026-07-31): el TOEFL se genera con Gemini justamente
    // porque varía mucho entre tiradas. Con un solo hueco, cada "vuelve a
    // generar" PISABA la toma anterior: si la primera era la buena, se perdía y
    // había que rezar para que volviera a salir. Ahora cada generación se apila
    // con su wpm y su reproductor, se escuchan seguidas y se elige una.
    //
    // Cada toma es un clip completo e independiente (sus partes, su sesión, su
    // audio), así que rehacer una parte o ajustar el ritmo dentro de una toma no
    // toca a las demás.
    tomas: [],
    tomaActiva: -1,

    get toma() { return this.tomas[this.tomaActiva] || null; },
    // Alias sobre la toma activa: el resto del código sigue hablando de
    // this.partes / this.sesion / this.ultimoAudio como antes de las tomas.
    get partes() { return this.toma?.partes || []; },
    set partes(v) { if (this.toma) this.toma.partes = v; },
    get sesion() { return this.toma?.sesion || null; },
    set sesion(v) { if (this.toma) this.toma.sesion = v; },
    get ultimoAudio() { return this.toma?.audio || null; },
    set ultimoAudio(v) { if (this.toma) this.toma.audio = v; },
    get ultimaDuracion() { return this.toma?.duracionSeg || 0; },
    set ultimaDuracion(v) { if (this.toma) this.toma.duracionSeg = v; },

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

    // ── Control de ritmo del clip ───────────────────────────────────────────
    // Por qué existe (2026-07-28): salieron clips atropellados —el mismo guion
    // en 35,2 s una vez y en 28,7 s otra— y en un examen de comprensión
    // auditiva eso no es cosmético: cambia cuál es la respuesta correcta.
    //
    // La causa era una pinza en el propio preset, que pedía a la vez un ritmo
    // (150 wpm) y una duración («Around 20 to 30 seconds») imposibles de
    // cumplir juntas para un guion de 82 palabras, que a 150 wpm dura 33 s. A
    // veces el modelo obedecía el ritmo y a veces la duración — de ahí que el
    // defecto pareciera aleatorio. Las cláusulas de segundos ya se quitaron de
    // los cuatro presets, pero el generador sigue teniendo una varianza propia
    // del ~10 % con texto idéntico, así que hace falta la comprobación.
    //
    // ⭐ Se mide con una división, no analizando el audio: palabras del
    // transcript ÷ duración del clip. Antes se intentaron dos detectores
    // acústicos (contar sílabas por picos de energía, y la frecuencia de
    // modulación de la envolvente) y AMBOS fallaron la validación — el primero
    // satura cuando el habla se acelera, el segundo mide pausas y no sílabas.
    // Validado contra clips reales: el bueno da 140 wpm, el atropellado 174, y
    // seis generaciones de control caen entre 139 y 154.
    RITMO_ALERTA: 1.10,   // por encima de esto se bloquea el guardado
    RITMO_SOSPECHA: 1.05, // por encima de esto se avisa sin bloquear
    RITMO_MIN_PALABRAS: 20, // con menos no hay muestra fiable (Choose a Response son 6-14)

    // Cuenta las palabras que se van a NARRAR: las marcas de hablante
    // ("Woman:", "Nadia:") no se pronuncian y falsearían el ritmo al alza.
    palabrasNarradas(texto) {
        return texto.replace(/^[ \t]*[A-Za-zÀ-ÿ0-9 _-]{1,20}:[ \t]*/gm, ' ')
            .split(/\s+/).filter(Boolean).length;
    },

    evaluarRitmo(texto, duracionSeg, cfg) {
        const palabras = this.palabrasNarradas(texto);
        const objetivo = cfg?.wpm;
        if (!objetivo || !duracionSeg || palabras < this.RITMO_MIN_PALABRAS) return null;
        const wpm = palabras / (duracionSeg / 60);
        return { wpm: Math.round(wpm), objetivo, factor: wpm / objetivo, palabras };
    },

    pintarRitmo(r, ajuste) {
        const caja = document.getElementById('audio-ritmo');
        const forzar = document.getElementById('audio-btn-forzar');
        forzar.classList.add('hidden');
        if (!r) { caja.classList.add('hidden'); return; }

        // Con partes ajustadas, el que manda es el ritmo de origen: es el que
        // dice cómo habló el generador. El otro solo describe el archivo.
        if (ajuste?.corregidas && ajuste.origen) {
            const o = ajuste.origen;
            const base = 'mt-3 text-sm rounded-xl border px-4 py-3 ';
            const malo = o.factor >= this.RITMO_ALERTA;
            caja.className = base + (malo ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-green-50 text-green-800 border-green-200');
            caja.innerHTML = `<b>${ajuste.corregidas} parte(s) van ajustadas.</b> El archivo queda en <b>${r.wpm} wpm</b>, `
                + `pero el generador habló a <b>${o.wpm} wpm</b> (objetivo ${o.objetivo}).<br>`
                + (malo
                    ? 'Alargar el audio le devuelve la duración, no la articulación: las consonantes que se comió siguen comidas. Guárdalo solo si al escucharlo se entiende todo; si no, rehaz esa parte.'
                    : 'La corrección es cosmética y el origen ya era bueno: sin problema.');
            caja.classList.remove('hidden');
            document.getElementById('audio-btn-guardar').disabled = false;
            return;
        }

        const base = 'mt-3 text-sm rounded-xl border px-4 py-3 ';
        const dato = `<b>${r.wpm} palabras/min</b> (el objetivo de este tipo son ${r.objetivo}). ${r.palabras} palabras habladas.`;
        if (r.factor >= this.RITMO_ALERTA) {
            caja.className = base + 'bg-red-50 text-red-800 border-red-200';
            caja.innerHTML = `<b>Va demasiado rápido: ${dato}</b><br>Es el clip atropellado que ya conocemos — el generador varía entre una toma y otra. <b>Vuelve a generar</b>, con el mismo texto suele salir bien. Si lo escuchas y te convence, puedes guardarlo igual.`;
            document.getElementById('audio-btn-guardar').disabled = true;
            forzar.classList.remove('hidden');
        } else if (r.factor >= this.RITMO_SOSPECHA) {
            caja.className = base + 'bg-amber-50 text-amber-800 border-amber-200';
            caja.innerHTML = `Algo rápido: ${dato}<br>Está en el límite — <b>escúchalo entero</b> antes de guardarlo.`;
        } else {
            caja.className = base + 'bg-green-50 text-green-800 border-green-200';
            caja.innerHTML = `Ritmo fiel al examen: ${dato}`;
        }
        caja.classList.remove('hidden');
    },

    // Escape explícito: el umbral es una regla, no un oído. Si Juan escucha el
    // clip y está bien, manda él.
    forzarGuardado() {
        document.getElementById('audio-btn-guardar').disabled = false;
        document.getElementById('audio-btn-forzar').classList.add('hidden');
        this.aviso('Guardado desbloqueado: queda bajo tu criterio de oído.', 'info');
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

    // Al cambiar el tipo de documento, lo primero es el GENERADOR: cada examen
    // tiene el suyo decidido (DELF→ElevenLabs, TOEFL→Gemini) y elegir a mano se
    // presta a generar medio banco con el que no era.
    //
    // Solo se repone al cambiar de EXAMEN, no de tipo: dentro del mismo examen
    // se respeta lo que haya puesto Juan, por si está comparando algo puntual.
    onTipoChange() {
        const cfg = ESTILOS[document.getElementById('audio-tipo').value];
        if (!cfg) return;
        const select = document.getElementById('audio-proveedor');
        const debido = GENERADOR_POR_EXAMEN[cfg.examen];
        const cambioDeExamen = this.examenActual !== cfg.examen;
        this.examenActual = cfg.examen;
        if (cambioDeExamen && debido && select?.value && select.value !== debido) {
            select.value = debido;
            return this.onProveedorChange();   // este termina llamando a aplicarTipo()
        }
        this.aplicarTipo();
    },

    // Lo que depende del tipo una vez el generador ya está fijado: cuántas
    // voces se piden (el diálogo necesita dos, el monólogo una) y la ficha.
    aplicarTipo() {
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
        this.pintarNotaGenerador(cfg);
        // Cada tipo trae su propia instrucción y su ritmo: cambiar de tipo los
        // repone, para no arrastrar los del anterior sin darse cuenta.
        this.restaurarInstruccion();
    },

    // Por qué ese generador y no el otro, escrito bajo el select. Si está
    // puesto uno distinto del que manda la decisión, se dice — que salte a la
    // vista antes de generar, no después de tener el clip en el banco.
    pintarNotaGenerador(cfg) {
        const caja = document.getElementById('audio-generador-nota');
        if (!caja || !cfg) return;
        const debido = GENERADOR_POR_EXAMEN[cfg.examen];
        const actual = this.proveedor();
        if (debido && actual !== debido) {
            caja.className = 'text-xs mt-1 text-red-700';
            caja.innerHTML = `<b>No es el generador de este examen.</b> ${this.escapar(PORQUE_ESE_GENERADOR[cfg.examen] || '')} `
                + `<button type="button" onclick="audioLogic.reponerGenerador()" class="font-bold underline">Volver a ${PROVEEDORES[debido].etiqueta.split(' —')[0]}</button>`;
        } else {
            caja.className = 'text-xs mt-1 text-gray-500';
            caja.textContent = PORQUE_ESE_GENERADOR[cfg.examen] || '';
        }
    },

    reponerGenerador() {
        const cfg = ESTILOS[document.getElementById('audio-tipo').value];
        const debido = GENERADOR_POR_EXAMEN[cfg?.examen];
        if (!debido) return;
        document.getElementById('audio-proveedor').value = debido;
        this.onProveedorChange();
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
            ${f.ojo ? `<p class="text-xs text-amber-700 flex items-start gap-1"><i class="ph-bold ph-warning-circle mt-0.5 shrink-0"></i> ${this.escapar(f.ojo)}</p>` : ''}`;
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
        this.aplicarTipo();   // aplicarTipo y no onTipoChange: si no, se llaman en círculo

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

    // ── Troceo ──────────────────────────────────────────────────────────────
    // Parte el transcript en unidades que NO se pueden romper: en un diálogo,
    // cada turno de hablante; en un monólogo, cada párrafo, y si un párrafo se
    // pasa de largo, cada frase. Cortar a mitad de frase es lo único que sí se
    // oye como un empalme, porque parte la curva de entonación.
    unidades(texto) {
        const bloques = [];
        let actual = [];
        for (const linea of texto.split('\n')) {
            if (CORTE_MANUAL.test(linea)) {           // "---" = corte pedido a mano
                if (actual.length) bloques.push({ lineas: actual, corteDespues: true });
                actual = [];
                continue;
            }
            if (!linea.trim()) { if (actual.length) { bloques.push({ lineas: actual }); actual = []; } continue; }
            // Línea con marca de hablante = turno nuevo; si no, continúa el anterior.
            if (/^\s*[A-Za-zÀ-ÿ0-9 _-]{1,20}:/.test(linea) && actual.length) {
                bloques.push({ lineas: actual });
                actual = [linea];
            } else {
                actual.push(linea);
            }
        }
        if (actual.length) bloques.push({ lineas: actual });

        // Un bloque larguísimo sin turnos (monólogo de radio) se abre por frases.
        const salida = [];
        for (const b of bloques) {
            const bloque = b.lineas.join('\n');
            if (this.palabrasNarradas(bloque) <= TROCEO_OBJETIVO * 1.6 || /^\s*[A-Za-zÀ-ÿ0-9 _-]{1,20}:/.test(bloque)) {
                salida.push({ texto: bloque, corteDespues: !!b.corteDespues });
                continue;
            }
            const frases = bloque.match(/[^.!?…]+(?:[.!?…]+["»']?)?\s*/g) || [bloque];
            frases.forEach((f, i) => salida.push({ texto: f.trim(), corteDespues: i === frases.length - 1 && !!b.corteDespues }));
        }
        return salida.filter(u => u.texto);
    },

    // ¿Cuántos caracteres acepta de una sola vez el generador elegido? Si el
    // transcript se pasa, la petición se rechaza entera: ese —y solo ese— es el
    // caso en que partir sigue siendo mejor que no tener clip.
    topeDeCaracteres(proveedor = this.proveedor(), hablantes = 1) {
        const p = PROVEEDORES[proveedor] || {};
        return hablantes >= 2 && p.maxCharsDialogo
            ? Math.min(p.maxCharsDialogo, PROXY_MAX_CHARS)
            : PROXY_MAX_CHARS;
    },

    // Motivo por el que habría que partir, o '' si cabe de una. Se usa tanto
    // para decidir como para explicárselo a Juan antes de gastar la generación.
    motivoDeTroceo(texto, proveedor = this.proveedor(), hablantes = null) {
        const cfg = ESTILOS[document.getElementById('audio-tipo')?.value];
        const n = hablantes ?? (cfg?.hablantes || 1);
        const tope = this.topeDeCaracteres(proveedor, n);
        if (texto.length > tope) {
            return `el transcript son ${texto.length} caracteres y ${PROVEEDORES[proveedor]?.etiqueta.split(' —')[0] || 'el generador'} solo acepta ${tope} de una vez`;
        }
        if (this.unidades(texto).some(u => u.corteDespues)) return 'lo pediste tú con «---»';
        return '';
    },

    // Agrupa las unidades en partes parejas. El número de partes sale de una
    // división —no de un tope— para que todas queden del mismo tamaño: con 350
    // palabras salen 4 de ~88, no 3 de 120 y una de 30.
    //
    // Ya NO se parte por ser largo (ver el comentario de arriba): solo si no
    // cabe en el generador o si hay un "---" puesto a mano.
    trocear(texto) {
        const total = this.palabrasNarradas(texto);
        const us = this.unidades(texto);
        if (!this.motivoDeTroceo(texto)) return [texto.trim()];

        const n = Math.max(1, Math.round(total / TROCEO_OBJETIVO));
        const objetivo = total / n;
        const partes = [];
        let buffer = [], palabras = 0;
        const cerrar = () => { if (buffer.length) { partes.push(buffer.join('\n')); buffer = []; palabras = 0; } };

        for (const u of us) {
            const p = this.palabrasNarradas(u.texto);
            // Se cierra ANTES de añadir si al añadir nos pasaríamos más de lo que
            // nos falta: reparte el sobrante en vez de acumularlo en la última.
            if (buffer.length && palabras + p - objetivo > objetivo - palabras) cerrar();
            buffer.push(u.texto);
            palabras += p;
            if (u.corteDespues) cerrar();
        }
        cerrar();
        return partes.length ? partes : [texto.trim()];
    },

    // El preámbulo es lo que fija el estilo. Va idéntico en todas las partes; lo
    // único que cambia es la nota de continuidad, que le dice al modelo que esto
    // es la continuación de algo y no una grabación nueva.
    preambulo(instruccion, i, n) {
        if (n < 2) return instruccion;
        const continuidad = ` (This is part ${i + 1} of ${n} of one single continuous recording: keep exactly the same voice, pace, tone and recording conditions as the other parts — same speaker, same energy, no new introduction, no fade in or out.)`;
        return instruccion + continuidad;
    },

    // ── 1. Generar (llama al proxy, que agrega la clave del TTS) ────────────
    // Una llamada por parte. La configuración (voces, instrucción, tipo) se
    // congela al empezar: si Juan cambia un select a mitad de camino, las partes
    // ya generadas y las que faltan seguirían perteneciendo al mismo clip y
    // sonarían distintas.
    async generar() {
        const texto = document.getElementById('audio-texto').value.trim();
        if (!texto) return this.aviso('Escribe el transcript que se va a narrar.', 'error');

        const tipo = document.getElementById('audio-tipo').value;
        const cfg = ESTILOS[tipo];

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

        const acento = document.getElementById('audio-acento').value;
        const sesion = {
            tipo, cfg, voces, acento,
            proveedor: this.proveedor(),
            wpm: this.wpmObjetivo(),
            instruccion: [this.instruccionActual(), ACENTOS[acento]?.frase].filter(Boolean).join(' '),
            transcript: texto
        };

        // Las tomas solo son comparables si son del MISMO encargo. Si cambió el
        // transcript, las voces o la instrucción, lo anterior ya no es "otra
        // toma de esto": es otro clip, y apilarlas juntas invitaría a guardar la
        // de un texto viejo creyendo que es la buena.
        if (this.firma(this.sesion) && this.firma(sesion) !== this.firma(this.sesion)) this.limpiarTomas();

        this.tomas.push({ n: this.tomas.length + 1, sesion, partes: [], audio: null, duracionSeg: 0 });
        this.tomaActiva = this.tomas.length - 1;
        this.partes = this.trocear(texto).map((t, i) => ({ i, texto: t, estado: 'pendiente' }));

        document.getElementById('audio-btn-guardar').disabled = true;
        document.getElementById('audio-preview-wrap').classList.add('hidden');
        this.pintarRitmo(null);
        this.pintarPartes();
        this.pintarTomas();

        const n = this.partes.length;
        const motivo = this.motivoDeTroceo(texto, sesion.proveedor, cfg.hablantes);
        this.aviso(n > 1
            ? `Va por partes porque ${motivo}. Se generan ${n} y se pegan en un solo clip; cada una se mide por separado, así que si alguna sale atropellada se rehace sola.`
            : (this.tomas.length > 1 ? `Generando la toma ${this.tomas.length}. Las anteriores se conservan para comparar.` : 'Generando el audio.'), 'info');
        await this.correrPendientes();
    },

    // Identidad del encargo: dos generaciones con la misma firma son tomas
    // alternativas de lo mismo y se pueden comparar; con firma distinta, no.
    firma(s) {
        if (!s) return '';
        return [s.tipo, s.proveedor, s.wpm, s.acento, (s.voces || []).map(v => v.voice).join('+'), s.instruccion, s.transcript].join(' ');
    },

    limpiarTomas() {
        for (const t of this.tomas) {
            for (const p of t.partes || []) {
                if (p.url) URL.revokeObjectURL(p.url);
                if (p.corregido?.url) URL.revokeObjectURL(p.corregido.url);
            }
            if (t.url) URL.revokeObjectURL(t.url);
        }
        this.tomas = [];
        this.tomaActiva = -1;
    },

    // Lanza las partes pendientes de a CONCURRENCIA y pega el resultado.
    async correrPendientes() {
        const boton = document.getElementById('audio-btn-generar');
        boton.disabled = true;
        boton.textContent = 'Generando…';
        try {
            const cola = this.partes.filter(p => p.estado === 'pendiente');
            const obreros = Array.from({ length: Math.min(CONCURRENCIA, cola.length) }, async () => {
                for (;;) {
                    const parte = cola.shift();
                    if (!parte) return;
                    await this.generarParte(parte);
                }
            });
            await Promise.all(obreros);
            await this.ensamblar();
        } catch (e) {
            this.aviso(`No se pudo generar: ${e.message}`, 'error');
        } finally {
            boton.disabled = false;
            this.pintarBotonGenerar();
        }
    },

    // El mismo botón sirve para la primera generación y para pedir otra toma;
    // lo que cambia es el nombre, para que se entienda que no pisa la anterior.
    pintarBotonGenerar() {
        const boton = document.getElementById('audio-btn-generar');
        if (!boton) return;
        const texto = document.getElementById('audio-texto')?.value.trim() || '';
        const mismoEncargo = this.toma?.audio && this.sesion?.transcript === texto;
        boton.textContent = mismoEncargo ? 'Otra toma' : 'Generar audio';
        boton.title = mismoEncargo
            ? 'Genera otra versión del mismo texto sin perder las anteriores: se apilan abajo y eliges cuál guardar.'
            : '';
    },

    async generarParte(parte) {
        const s = this.sesion;
        parte.estado = 'generando';
        parte.error = '';
        this.pintarPartes();
        try {
            const token = await auth.currentUser.getIdToken();
            const respuesta = await fetch(PROXY_TTS, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    proveedor: s.proveedor,
                    texto: parte.texto,
                    voces: s.voces,
                    instruccion: this.preambulo(s.instruccion, parte.i, this.partes.length)
                })
            });
            if (!respuesta.ok) {
                const detalle = await respuesta.json().catch(() => ({}));
                throw new Error(detalle.error || `el generador respondió ${respuesta.status}`);
            }
            parte.blob = await respuesta.blob();
            // Una URL por parte, no una por repintado: el tablero se redibuja
            // varias veces por generación y cada createObjectURL retiene el blob.
            if (parte.url) URL.revokeObjectURL(parte.url);
            parte.url = URL.createObjectURL(parte.blob);
            parte.duracionSeg = Number(respuesta.headers.get('X-Duracion-Aprox-Seg') || 0)
                || await this.medirDuracion(parte.blob);
            parte.ritmo = this.evaluarRitmo(parte.texto, parte.duracionSeg, { wpm: s.wpm });
            parte.estado = 'listo';
        } catch (e) {
            parte.estado = 'error';
            parte.error = e.message;
        }
        this.pintarPartes();
    },

    // Rehacer una sola parte: es toda la ventaja del troceo. Las demás no se
    // tocan (y no se vuelven a pagar).
    async regenerarParte(i) {
        const parte = this.partes?.[i];
        if (!parte || !this.sesion) return;
        parte.estado = 'pendiente';
        await this.correrPendientes();
    },

    // ── 2. Ensamblar: pegar las partes en un solo clip ──────────────────────
    // Se pega en PCM decodificado, no concatenando archivos: pegar MP3 por
    // bytes deja huecos audibles en las junturas. Y se iguala el volumen de
    // cada parte, porque una parte más fuerte se oye como otra grabación.
    async ensamblar() {
        const listas = this.partes.filter(p => p.estado === 'listo' && p.blob);
        if (!listas.length) { this.aviso('Ninguna parte se generó.', 'error'); return; }
        if (listas.length < this.partes.length) {
            this.aviso(`Faltan ${this.partes.length - listas.length} parte(s) por generar; el clip todavía no está completo.`, 'error');
            return;
        }

        const boton = document.getElementById('audio-btn-generar');
        boton.textContent = 'Montando…';
        const s = this.sesion;
        let aviso;
        // De cada parte, la toma que Juan haya aceptado.
        const tomaDe = p => (p.usarCorregido && p.corregido ? p.corregido.blob : p.blob);

        // Una sola parte con ElevenLabs sin corregir: ya viene en MP3, recomprimir
        // solo degradaría. Se deja tal cual, como antes del troceo.
        if (listas.length === 1 && !PROVEEDORES[s.proveedor].comprimirEnCliente && !listas[0].usarCorregido) {
            this.ultimoAudio = listas[0].blob;
            this.ultimaDuracion = listas[0].duracionSeg;
            aviso = `Audio listo: ${this.formatoPeso(this.ultimoAudio.size)}.`;
        } else {
            try {
                const { blob, duracion, crudo } = await this.pegar(listas.map(tomaDe));
                this.ultimoAudio = blob;
                this.ultimaDuracion = duracion;
                const ahorro = crudo ? Math.round((1 - blob.size / crudo) * 100) : 0;
                aviso = `Audio listo: ${this.formatoDuracion(duracion)} · ${this.formatoPeso(blob.size)}`
                    + (listas.length > 1 ? ` · ${listas.length} partes unidas` : '')
                    + (ahorro > 0 ? ` (${ahorro}% menos que sin comprimir).` : '.');
            } catch (e) {
                // Sin compresor no se puede pegar: mejor decirlo que guardar a medias.
                this.aviso(`Las partes se generaron pero no se pudieron unir: ${e.message}. Vuelve a intentarlo; no hay que regenerarlas.`, 'error');
                return;
            }
        }

        // Una URL por toma, no una por ensamblado: la toma se remonta cada vez
        // que se rehace una parte, y cada createObjectURL retiene su blob.
        const t = this.toma;
        if (t.url) URL.revokeObjectURL(t.url);
        t.url = URL.createObjectURL(this.ultimoAudio);
        document.getElementById('audio-preview').src = t.url;
        document.getElementById('audio-preview-wrap').classList.remove('hidden');
        document.getElementById('audio-btn-guardar').disabled = false;
        this.aviso(`${aviso} Escúchalo entero antes de guardarlo${listas.length > 1 ? ' — sobre todo las junturas entre partes' : ''}.`, 'ok');

        // El ritmo global se mide igual que antes (palabras ÷ minutos) y puede
        // bloquear el guardado, así que va después de habilitarlo.
        //
        // ⚠️ Y aquí está la trampa del ajuste de ritmo: si una parte se alarga,
        // este número baja solo y el semáforo se pone verde sin que el generador
        // haya hecho nada mejor. Se calcula también el ritmo DE ORIGEN (con las
        // duraciones tal como salieron) y es ese el que juzga la toma; el otro
        // solo describe el archivo que se va a subir.
        const segOrigen = listas.reduce((n, p) => n + (p.duracionSeg || 0), 0);
        t.ritmo = this.evaluarRitmo(s.transcript, this.ultimaDuracion, { wpm: s.wpm });
        t.ritmoOrigen = this.evaluarRitmo(s.transcript, segOrigen, { wpm: s.wpm });
        t.ajustadas = listas.filter(p => p.usarCorregido).length;
        this.pintarRitmo(t.ritmo, { corregidas: t.ajustadas, origen: t.ritmoOrigen });
        this.pintarTomas();
    },

    // ── Tablero de tomas ────────────────────────────────────────────────────
    // Aparece desde la segunda: con una sola no hay nada que comparar y sería
    // ruido. La activa es la que se guarda, y se dice explícitamente.
    pintarTomas() {
        const wrap = document.getElementById('audio-tomas-wrap');
        const caja = document.getElementById('audio-tomas');
        if (!wrap || !caja) return;
        if (this.tomas.length < 2) { wrap.classList.add('hidden'); return; }
        wrap.classList.remove('hidden');

        // El que juzga es el ritmo de ORIGEN, por lo mismo de siempre: si una
        // parte se ajustó, el del archivo describe el maquillaje, no la toma.
        const juzga = t => t.ritmoOrigen || t.ritmo;
        const buenas = this.tomas.filter(t => juzga(t) && juzga(t).factor < this.RITMO_SOSPECHA);
        const mejor = buenas.sort((a, b) => Math.abs(juzga(a).factor - 1) - Math.abs(juzga(b).factor - 1))[0];
        document.getElementById('audio-tomas-resumen').textContent =
            `${this.tomas.length} tomas · se guarda la que esté marcada`;

        caja.innerHTML = this.tomas.map((t, i) => {
            const r = juzga(t);
            const activa = i === this.tomaActiva;
            const color = !r ? 'border-gray-200'
                : r.factor >= this.RITMO_ALERTA ? 'border-red-300 bg-red-50'
                : r.factor >= this.RITMO_SOSPECHA ? 'border-amber-300 bg-amber-50'
                : 'border-green-300 bg-green-50';
            const dato = t.audio
                ? `<b>${r ? r.wpm + ' wpm' : '—'}</b> · ${this.formatoDuracion(t.duracionSeg)} · ${this.formatoPeso(t.audio.size)}`
                  + (t.ajustadas ? ` · ${t.ajustadas} parte(s) ajustada(s)` : '')
                  + (mejor && t === mejor && this.tomas.length > 1 ? ' · <b>la más fiel al ritmo</b>' : '')
                : '<span class="text-gray-400">sin montar</span>';
            return `
            <div class="border ${activa ? 'border-2 border-brand-500' : color} rounded-xl px-4 py-3">
                <div class="flex items-center justify-between gap-3 flex-wrap">
                    <div class="min-w-0">
                        <p class="text-sm font-bold">Toma ${t.n}${activa ? ' · <span class="text-brand-600">es la que se guarda</span>' : ''}</p>
                        <p class="text-xs text-gray-600 mt-0.5">${dato}</p>
                    </div>
                    <div class="flex items-center gap-3 shrink-0">
                        ${t.url ? `<audio controls src="${t.url}" class="h-8"></audio>` : ''}
                        ${activa ? '' : `<button onclick="audioLogic.elegirToma(${i})" class="text-xs font-bold text-green-700 hover:underline">Usar esta</button>`}
                        <button onclick="audioLogic.descartarToma(${i})" class="text-xs font-bold text-gray-400 hover:underline">Descartar</button>
                    </div>
                </div>
            </div>`;
        }).join('');
    },

    elegirToma(i) {
        const t = this.tomas[i];
        if (!t) return;
        this.tomaActiva = i;
        document.getElementById('audio-preview').src = t.url || '';
        document.getElementById('audio-preview-wrap').classList.toggle('hidden', !t.url);
        document.getElementById('audio-btn-guardar').disabled = !t.audio;
        this.pintarRitmo(t.ritmo, { corregidas: t.ajustadas, origen: t.ritmoOrigen });
        this.pintarPartes();
        this.pintarTomas();
        this.aviso(`Toma ${t.n} elegida: es la que se guarda en el banco.`, 'ok');
    },

    descartarToma(i) {
        const t = this.tomas[i];
        if (!t) return;
        if (t.url) URL.revokeObjectURL(t.url);
        for (const p of t.partes || []) {
            if (p.url) URL.revokeObjectURL(p.url);
            if (p.corregido?.url) URL.revokeObjectURL(p.corregido.url);
        }
        this.tomas.splice(i, 1);
        this.tomas.forEach((x, k) => { x.n = k + 1; });
        // Si se cae la activa, manda la última que quede: es la más reciente.
        if (this.tomaActiva === i) {
            this.tomaActiva = Math.min(i, this.tomas.length - 1);
            if (this.tomaActiva >= 0) return this.elegirToma(this.tomaActiva);
            document.getElementById('audio-preview-wrap').classList.add('hidden');
            document.getElementById('audio-btn-guardar').disabled = true;
            this.pintarRitmo(null);
        } else if (this.tomaActiva > i) {
            this.tomaActiva--;
        }
        this.pintarPartes();
        this.pintarTomas();
    },

    async pegar(blobs) {
        await this.cargarEncoder();
        const Contexto = window.AudioContext || window.webkitAudioContext;
        let ctx;
        try { ctx = new Contexto({ sampleRate: 24000 }); } catch { ctx = new Contexto(); }

        let bytesCrudos = 0;
        const canales = [];
        for (const b of blobs) {
            bytesCrudos += b.size;
            const buffer = await ctx.decodeAudioData(await b.arrayBuffer());
            canales.push(buffer.getChannelData(0));
        }
        const tasa = ctx.sampleRate;
        ctx.close();

        // Volumen parejo: se lleva cada parte al RMS mediano del conjunto. La
        // mediana y no la media, para que una parte anómala no arrastre a todas.
        const rms = canales.map(c => {
            let suma = 0;
            for (let i = 0; i < c.length; i++) suma += c[i] * c[i];
            return Math.sqrt(suma / (c.length || 1)) || 1e-6;
        });
        const referencia = [...rms].sort((a, b) => a - b)[Math.floor(rms.length / 2)];

        const silencio = canales.length > 1 ? Math.round(tasa * PAUSA_ENTRE_PARTES_MS / 1000) : 0;
        const total = canales.reduce((n, c) => n + c.length, 0) + silencio * (canales.length - 1);
        const pcm = new Int16Array(total);
        let cursor = 0;
        canales.forEach((c, k) => {
            // Ganancia acotada: corregir el volumen no debe reinventar la toma.
            const ganancia = Math.min(2, Math.max(0.5, referencia / rms[k]));
            for (let i = 0; i < c.length; i++) {
                const s = Math.max(-1, Math.min(1, c[i] * ganancia));
                pcm[cursor++] = s < 0 ? s * 0x8000 : s * 0x7fff;
            }
            if (k < canales.length - 1) cursor += silencio; // el silencio ya es 0
        });

        return {
            blob: this.codificarMp3(pcm, tasa),
            duracion: Math.round(total / tasa),
            crudo: bytesCrudos
        };
    },

    codificarMp3(pcm, tasa) {
        const encoder = new lamejs.Mp3Encoder(1, tasa, MP3_KBPS);
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

    async decodificar(blob) {
        const Contexto = window.AudioContext || window.webkitAudioContext;
        let ctx;
        try { ctx = new Contexto({ sampleRate: 24000 }); } catch { ctx = new Contexto(); }
        const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
        const canal = buffer.getChannelData(0).slice();
        const tasa = ctx.sampleRate;
        ctx.close();
        return { canal, tasa };
    },

    // ── Rescate: bajar el ritmo de una parte que salió rápida ───────────────
    // Escalón 1 — alargar solo las pausas. No toca ninguna sílaba, así que no
    // puede degradar la voz. Se rellena repitiendo el propio silencio (el ruido
    // de sala) y no con ceros, para que no se oiga un escalón de nivel.
    pausasDe(canal, tasa) {
        const paso = Math.round(tasa * 0.01);        // ventanas de 10 ms
        const minVentanas = Math.round(SILENCIO_MIN_MS / 10);
        const pausas = [];
        let arranque = -1, n = 0;
        for (let v = 0; v * paso < canal.length; v++) {
            let pico = 0;
            const fin = Math.min((v + 1) * paso, canal.length);
            for (let i = v * paso; i < fin; i++) pico = Math.max(pico, Math.abs(canal[i]));
            if (pico < SILENCIO_UMBRAL) { if (arranque < 0) { arranque = v * paso; n = 0; } n++; }
            else { if (arranque >= 0 && n >= minVentanas) pausas.push({ inicio: arranque, fin: v * paso }); arranque = -1; }
        }
        if (arranque >= 0 && n >= minVentanas) pausas.push({ inicio: arranque, fin: canal.length });
        return pausas;
    },

    estirarPausas(canal, tasa, muestrasQueFaltan) {
        const pausas = this.pausasDe(canal, tasa);
        // Las de los extremos no cuentan: alargar el silencio inicial o final no
        // cambia cómo se oye el habla, solo infla el archivo.
        const utiles = pausas.filter(p => p.inicio > 0 && p.fin < canal.length);
        const total = utiles.reduce((n, p) => n + (p.fin - p.inicio), 0);
        if (!total || muestrasQueFaltan <= 0) return { canal, puesto: 0 };

        // Tope por pausa: 2,5× lo que ya dura. Una pausa estirada sin límite deja
        // un agujero que se oye como un corte de cinta.
        const puedePoner = Math.min(muestrasQueFaltan, Math.round(total * 1.5));
        const salida = new Float32Array(canal.length + puedePoner);
        let cursor = 0, previo = 0, puesto = 0;
        for (const p of utiles) {
            salida.set(canal.subarray(previo, p.fin), cursor);
            cursor += p.fin - previo;
            const extra = Math.round(puedePoner * ((p.fin - p.inicio) / total));
            const patron = canal.subarray(p.inicio, p.fin);
            for (let i = 0; i < extra; i++) salida[cursor + i] = patron[i % patron.length];
            cursor += extra; puesto += extra; previo = p.fin;
        }
        salida.set(canal.subarray(previo), cursor);
        return { canal: salida.subarray(0, cursor + (canal.length - previo)), puesto };
    },

    // Escalón 2 — WSOLA: solapar y sumar buscando por correlación el punto de
    // empalme que mejor continúa la onda anterior. Es lo que permite alargar sin
    // bajar el tono; sin la búsqueda de empalme quedarían clics en cada juntura.
    wsola(canal, tasa, factor) {
        if (factor <= 1.001) return canal;
        const N = Math.round(tasa * WSOLA_VENTANA_MS / 1000);
        const Hs = Math.round(N / 2);                    // salto de síntesis
        const Ha = Math.max(1, Math.round(Hs / factor)); // salto de análisis
        const B = Math.round(tasa * WSOLA_BUSQUEDA_MS / 1000);
        const ventana = new Float32Array(N);
        for (let i = 0; i < N; i++) ventana[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));

        const salida = new Float32Array(Math.ceil(canal.length * factor) + N);
        let ta = 0, ts = 0;
        let esperado = canal.subarray(0, N);             // cómo debería seguir la onda
        while (ta + N + B < canal.length) {
            // Mejor desplazamiento dentro de ±B (a pasos de 2: la mitad de cuentas
            // y el máximo de correlación en voz es demasiado ancho para perderse).
            let mejor = 0, mejorPuntaje = -Infinity;
            for (let d = -B; d <= B; d += 2) {
                const base = ta + d;
                if (base < 0 || base + N > canal.length) continue;
                let suma = 0;
                for (let i = 0; i < N; i += 2) suma += canal[base + i] * esperado[i];
                if (suma > mejorPuntaje) { mejorPuntaje = suma; mejor = d; }
            }
            const base = Math.max(0, ta + mejor);
            for (let i = 0; i < N; i++) salida[ts + i] += canal[base + i] * ventana[i];
            ts += Hs;
            ta = base + Ha;
            esperado = canal.subarray(Math.min(base + Hs, canal.length - N), Math.min(base + Hs + N, canal.length));
        }
        return salida.subarray(0, ts + N);
    },

    // El botón del tablero. Deja el resultado a un lado (A/B) en vez de pisar el
    // original: la corrección es una apuesta y hay que poder compararla.
    async ajustarRitmo(i) {
        const parte = this.partes?.[i];
        if (!parte?.blob || !parte.ritmo) return;
        const objetivo = this.sesion.wpm;
        const factor = parte.ritmo.wpm / objetivo;      // >1 = va rápido
        if (factor <= 1.01) return this.aviso('Esa parte ya va al ritmo objetivo.', 'info');

        this.aviso(`Ajustando la parte ${i + 1}…`, 'info');
        try {
            await this.cargarEncoder();
            const { canal, tasa } = await this.decodificar(parte.blob);
            const faltan = Math.round(canal.length * (factor - 1));

            // 1. Las pausas primero: es gratis en calidad.
            const { canal: conPausas, puesto } = this.estirarPausas(canal, tasa, faltan);

            // 2. Lo que quede, estirando el habla, y solo hasta el tope.
            const restante = (canal.length + faltan) / conPausas.length;
            const estirado = Math.min(ESTIRADO_MAX, Math.max(1, restante));
            const final = this.wsola(conPausas, tasa, estirado);

            const pcm = new Int16Array(final.length);
            for (let k = 0; k < final.length; k++) {
                const s = Math.max(-1, Math.min(1, final[k]));
                pcm[k] = s < 0 ? s * 0x8000 : s * 0x7fff;
            }
            const blob = this.codificarMp3(pcm, tasa);
            const duracionSeg = Math.round(final.length / tasa);
            const wpm = Math.round(this.palabrasNarradas(parte.texto) / (duracionSeg / 60));

            if (parte.corregido?.url) URL.revokeObjectURL(parte.corregido.url);
            parte.corregido = {
                blob, url: URL.createObjectURL(blob), duracionSeg, wpm,
                pausasMs: Math.round(puesto / tasa * 1000),
                estirado
            };
            parte.usarCorregido = false;
            this.pintarPartes();

            const alcanzo = wpm <= objetivo * this.RITMO_SOSPECHA;
            this.aviso(
                `Parte ${i + 1}: ${parte.ritmo.wpm} → ${wpm} wpm `
                + `(+${parte.corregido.pausasMs} ms de pausas`
                + (estirado > 1.005 ? `, habla estirada ${Math.round((estirado - 1) * 100)}%` : ', sin tocar el habla') + '). '
                + (alcanzo
                    ? 'Compara los dos: si el corregido no suena arrastrado, úsalo.'
                    : 'No alcanzó el objetivo sin pasarse del tope de estirado — esta parte conviene rehacerla, no maquillarla.'),
                alcanzo ? 'ok' : 'error');
        } catch (e) {
            this.aviso(`No se pudo ajustar: ${e.message}`, 'error');
        }
    },

    usarCorregido(i, usar) {
        const parte = this.partes?.[i];
        if (!parte?.corregido) return;
        parte.usarCorregido = usar;
        this.pintarPartes();
        this.ensamblar();
    },

    // ── Tablero de partes ───────────────────────────────────────────────────
    pintarPartes() {
        const wrap = document.getElementById('audio-partes-wrap');
        const caja = document.getElementById('audio-partes');
        if (!wrap || !caja) return;
        const partes = this.partes || [];
        // Con una sola parte el tablero solo estorba… salvo que esa parte haya
        // salido rápida: entonces es donde vive el botón de ajustarla.
        const rescatable = partes.some(p => p.corregido || (p.ritmo && p.ritmo.factor >= this.RITMO_SOSPECHA));
        if (partes.length < 2 && !rescatable) { wrap.classList.add('hidden'); return; }
        wrap.classList.remove('hidden');

        const listas = partes.filter(p => p.estado === 'listo').length;
        const malas = partes.filter(p => p.ritmo && p.ritmo.factor >= this.RITMO_ALERTA).length;
        document.getElementById('audio-partes-resumen').innerHTML =
            `${listas} de ${partes.length} generadas` + (malas ? ` · <b class="text-red-600">${malas} atropellada(s)</b>` : '');

        const marca = {
            pendiente: '<span class="text-gray-400">en cola</span>',
            generando: '<span class="text-amber-600">generando…</span>',
            error:     '<span class="text-red-600">falló</span>'
        };
        caja.innerHTML = partes.map(p => {
            const r = p.ritmo;
            const color = !r ? 'border-gray-200'
                : r.factor >= this.RITMO_ALERTA ? 'border-red-300 bg-red-50'
                : r.factor >= this.RITMO_SOSPECHA ? 'border-amber-300 bg-amber-50'
                : 'border-green-300 bg-green-50';
            const dato = p.estado === 'listo'
                ? `${this.formatoDuracion(p.duracionSeg || 0)}${r ? ` · <b>${r.wpm} wpm</b>` : ''} · ${this.palabrasNarradas(p.texto)} palabras`
                : (marca[p.estado] || '');
            // El ajuste solo se ofrece cuando hay algo que ajustar: es un rescate,
            // no un paso normal del flujo.
            const ofreceAjuste = p.estado === 'listo' && r && r.factor >= this.RITMO_SOSPECHA && !p.corregido;
            const c = p.corregido;
            return `
            <div class="border ${color} rounded-xl px-4 py-3">
                <div class="flex items-start justify-between gap-3 flex-wrap">
                    <div class="min-w-0">
                        <p class="text-xs font-bold text-gray-500">Parte ${p.i + 1} de ${partes.length}</p>
                        <p class="text-xs text-gray-600 mt-0.5">${dato}</p>
                        ${p.error ? `<p class="text-xs text-red-600 mt-0.5">${this.escapar(p.error)}</p>` : ''}
                    </div>
                    <div class="flex items-center gap-3 shrink-0">
                        ${p.url ? `<audio controls src="${p.url}" class="h-8"></audio>` : ''}
                        ${ofreceAjuste ? `<button onclick="audioLogic.ajustarRitmo(${p.i})" class="text-xs font-bold text-amber-700 hover:underline">Ajustar el ritmo</button>` : ''}
                        <button onclick="audioLogic.regenerarParte(${p.i})" class="text-xs font-bold text-brand-600 hover:underline" ${p.estado === 'generando' ? 'disabled' : ''}>Rehacer</button>
                    </div>
                </div>
                ${c ? `
                <div class="mt-2 border-t border-gray-200 pt-2">
                    <div class="flex items-center justify-between gap-3 flex-wrap">
                        <p class="text-xs text-gray-600">
                            Ajustada: <b>${c.wpm} wpm</b> · ${this.formatoDuracion(c.duracionSeg)} ·
                            +${c.pausasMs} ms de pausas${c.estirado > 1.005 ? ` · habla estirada ${Math.round((c.estirado - 1) * 100)}%` : ' · habla intacta'}
                        </p>
                        <div class="flex items-center gap-3 shrink-0">
                            <audio controls src="${c.url}" class="h-8"></audio>
                            <button onclick="audioLogic.usarCorregido(${p.i}, ${!p.usarCorregido})" class="text-xs font-bold ${p.usarCorregido ? 'text-red-600' : 'text-green-700'} hover:underline">
                                ${p.usarCorregido ? 'Volver al original' : 'Usar la ajustada'}
                            </button>
                        </div>
                    </div>
                    ${p.usarCorregido ? '<p class="text-xs text-green-700 mt-1">Esta parte entra ajustada en el clip final.</p>' : ''}
                </div>` : ''}
                <details class="mt-2">
                    <summary class="text-xs text-gray-500 cursor-pointer">Ver su texto</summary>
                    <pre class="mt-1 text-xs whitespace-pre-wrap text-gray-600">${this.escapar(p.texto)}</pre>
                </details>
            </div>`;
        }).join('');
    },

    // ── Medidor en vivo (antes de gastar una generación) ────────────────────
    // Lo que se puede saber del clip sin pagarlo: cuánto va a durar al ritmo
    // objetivo, en cuántas partes va a salir y si el texto se pasa del tope.
    onTextoInput() {
        const caja = document.getElementById('audio-medidor');
        if (!caja) return;
        const texto = document.getElementById('audio-texto').value;
        const palabras = this.palabrasNarradas(texto);
        if (!palabras) { caja.innerHTML = ''; return; }

        const wpm = this.wpmObjetivo();
        const segundos = Math.round(palabras / wpm * 60);
        const cfg = ESTILOS[document.getElementById('audio-tipo').value];
        const motivo = this.motivoDeTroceo(texto.trim());
        const partes = motivo ? this.trocear(texto.trim()).length : 1;
        const chars = texto.length;
        const tope = this.topeDeCaracteres(this.proveedor(), cfg?.hablantes || 1);
        const chip = (t, tono = 'bg-gray-100 text-gray-700') => `<span class="px-2 py-1 rounded-lg ${tono}">${t}</span>`;
        caja.innerHTML = [
            chip(`${palabras} palabras habladas`),
            chip(`≈ ${this.formatoDuracion(segundos)} a ${wpm} wpm`),
            partes > 1
                ? chip(`${partes} partes — ${this.escapar(motivo)}`, 'bg-amber-100 text-amber-800')
                : chip('una sola generación'),
            chip(`${chars}/${tope} caracteres`, chars > tope * 0.95 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700')
        ].join(' ');
        this.pintarBotonGenerar();
    },

    // Inserta un "---" donde está el cursor: corte a mano cuando el automático
    // parte por donde no conviene (un cambio de tema, una pausa del guion).
    insertarCorte() {
        const campo = document.getElementById('audio-texto');
        const pos = campo.selectionStart ?? campo.value.length;
        campo.value = campo.value.slice(0, pos).replace(/\s*$/, '') + '\n---\n' + campo.value.slice(pos).replace(/^\s*/, '');
        campo.focus();
        this.onTextoInput();
    },

    // ── Instrucción de estilo y ritmo, editables ────────────────────────────
    instruccionActual() {
        const campo = document.getElementById('audio-instruccion');
        const valor = campo?.value.trim();
        return valor || ESTILOS[document.getElementById('audio-tipo').value]?.instruccion || '';
    },

    wpmObjetivo() {
        const valor = Number(document.getElementById('audio-wpm')?.value);
        return valor >= 80 && valor <= 220
            ? valor
            : (ESTILOS[document.getElementById('audio-tipo').value]?.wpm || 150);
    },

    restaurarInstruccion() {
        const cfg = ESTILOS[document.getElementById('audio-tipo').value];
        if (!cfg) return;
        document.getElementById('audio-instruccion').value = cfg.instruccion;
        document.getElementById('audio-wpm').value = cfg.wpm;
        this.onInstruccionInput();
        this.onTextoInput();
    },

    // Aviso al vuelo del error que ya nos costó un clip: pedir una duración en
    // segundos a la vez que un ritmo es una pinza que el modelo resuelve al azar.
    onInstruccionInput() {
        const cfg = ESTILOS[document.getElementById('audio-tipo').value];
        const campo = document.getElementById('audio-instruccion');
        const wrap = document.getElementById('audio-instruccion-wrap');
        if (!cfg || !campo || !wrap) return;
        const tocada = campo.value.trim() !== cfg.instruccion.trim();
        const pinza = /\b\d+\s*(seconds?|secondes?|segundos?|minutes?|minutos?)\b/i.test(campo.value);
        wrap.classList.toggle('border-amber-300', tocada && !pinza);
        wrap.classList.toggle('border-red-300', pinza);
        if (pinza) {
            this.aviso('Esa instrucción le pide al generador una duración en segundos. Es la pinza que ya nos dio clips atropellados: el modelo tiene que elegir entre el ritmo y la duración, y lo resuelve distinto en cada toma. Quítala.', 'error');
        }
    },

    // ── 2. Guardar (sube a Storage y cataloga la ficha en Firestore) ────────
    async guardar() {
        if (!this.ultimoAudio) return;
        const titulo = document.getElementById('audio-titulo').value.trim();
        if (!titulo) return this.aviso('Ponle un título al clip para reconocerlo después.', 'error');

        // Del clip generado, no de los selects: entre generar y guardar pueden
        // haber cambiado, y la ficha debe describir el audio que se sube.
        const tipo = this.sesion?.tipo || document.getElementById('audio-tipo').value;
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

            const s = this.sesion || {};
            await audioClipsCollection.doc(id).set({
                titulo,
                examen: cfg.examen,
                tipo,
                etiqueta: cfg.etiqueta,
                transcript: s.transcript || document.getElementById('audio-texto').value.trim(),
                acento: s.acento || '',
                voces: (s.voces || []).map(v => v.voice),
                // El DELF se escucha 2 veces y el TOEFL 1: el límite viaja con el
                // clip para que el reproductor del test no tenga que deducirlo.
                maxPlays: cfg.examen === 'delf' ? 2 : 1,
                proveedor: s.proveedor || this.proveedor(),
                duracionSeg: this.ultimaDuracion,
                bytes: this.ultimoAudio.size,
                formato: extension,
                audioUrl,
                audioStatus: 'generado',
                // Con qué se generó y cómo quedó partido. Sin esto, retocar una
                // parte meses después obligaría a rehacer el clip entero: es el
                // dato que hace reproducible una generación.
                wpmObjetivo: s.wpm || cfg.wpm || null,
                instruccion: s.instruccion || '',
                instruccionEditada: !!(s.instruccion && cfg.instruccion && !s.instruccion.startsWith(cfg.instruccion)),
                // El wpm de ORIGEN queda guardado aunque la parte se haya
                // ajustado: es lo único que dice cómo habló el generador, y sin
                // él el semáforo del banco mediría el maquillaje, no la toma.
                partes: (this.partes || []).map(p => ({
                    texto: p.texto,
                    duracionSeg: (p.usarCorregido && p.corregido ? p.corregido.duracionSeg : p.duracionSeg) || 0,
                    duracionOrigenSeg: p.duracionSeg || 0,
                    wpm: (p.usarCorregido && p.corregido ? p.corregido.wpm : p.ritmo?.wpm) || 0,
                    wpmOrigen: p.ritmo?.wpm || 0,
                    ajustada: !!p.usarCorregido,
                    estirado: p.usarCorregido ? (p.corregido?.estirado || 1) : 1
                })),
                ritmoAjustado: (this.partes || []).some(p => p.usarCorregido),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Se van TODAS las tomas, no solo la guardada: las otras eran
            // alternativas de este mismo clip y quedarse con ellas invitaría a
            // guardar dos veces lo mismo sin darse cuenta.
            this.limpiarTomas();
            document.getElementById('audio-btn-guardar').disabled = true;
            document.getElementById('audio-preview-wrap').classList.add('hidden');
            document.getElementById('audio-titulo').value = '';
            this.pintarPartes();
            this.pintarTomas();
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
        this.pintarLista();
    },

    // El ritmo de los clips YA guardados se recalcula aquí con el mismo dato de
    // siempre (palabras ÷ minutos). Así se ve de un vistazo cuáles de los que
    // están en el banco salieron atropellados — antes había que escucharlos uno
    // por uno para enterarse.
    pintarLista() {
        const lista = document.getElementById('audio-lista');
        const resumen = document.getElementById('audio-lista-resumen');
        if (!lista) return;
        if (!this.clips.length) {
            lista.innerHTML = '<p class="text-sm text-gray-500">Todavía no hay clips. El primero que generes aparecerá aquí.</p>';
            if (resumen) resumen.textContent = '';
            return;
        }

        const fExamen = document.getElementById('audio-filtro-examen')?.value || '';
        const fTipo = document.getElementById('audio-filtro-tipo')?.value || '';
        const fProv = document.getElementById('audio-filtro-proveedor')?.value || '';
        const busca = (document.getElementById('audio-filtro-texto')?.value || '').toLowerCase().trim();

        // Si el clip lleva partes ajustadas, el semáforo juzga con la duración
        // DE ORIGEN: alargar el audio baja el wpm del archivo pero no mejora la
        // toma, y un verde ahí sería exactamente el autoengaño que este medidor
        // existe para evitar.
        const conRitmo = this.clips.map(c => {
            const objetivo = { wpm: c.wpmObjetivo || ESTILOS[c.tipo]?.wpm };
            const segOrigen = (c.partes || []).reduce((n, p) => n + (p.duracionOrigenSeg || p.duracionSeg || 0), 0);
            const base = c.ritmoAjustado && segOrigen ? segOrigen : (c.duracionSeg || 0);
            return { ...c, ritmo: this.evaluarRitmo(c.transcript || '', base, objetivo) };
        });
        const visibles = conRitmo.filter(c =>
            (!fExamen || c.examen === fExamen) &&
            (!fTipo || c.tipo === fTipo) &&
            (!fProv || (c.proveedor || 'gemini') === fProv) &&
            (!busca || `${c.titulo || ''} ${c.transcript || ''}`.toLowerCase().includes(busca)));

        if (resumen) {
            const malos = conRitmo.filter(c => c.ritmo && c.ritmo.factor >= this.RITMO_ALERTA).length;
            const total = conRitmo.reduce((n, c) => n + (c.duracionSeg || 0), 0);
            resumen.innerHTML = `${visibles.length} de ${this.clips.length} clips · ${this.formatoDuracion(total)} de audio`
                + (malos ? ` · <b class="text-red-600">${malos} atropellado(s)</b>` : '');
        }
        if (!visibles.length) {
            lista.innerHTML = '<p class="text-sm text-gray-500">Ningún clip coincide con el filtro.</p>';
            return;
        }

        lista.innerHTML = visibles.map(c => {
            const r = c.ritmo;
            const sello = !r ? ''
                : r.factor >= this.RITMO_ALERTA ? `<span class="px-2 py-0.5 rounded-lg text-xs bg-red-100 text-red-700">${r.wpm} wpm · atropellado</span>`
                : r.factor >= this.RITMO_SOSPECHA ? `<span class="px-2 py-0.5 rounded-lg text-xs bg-amber-100 text-amber-800">${r.wpm} wpm · algo rápido</span>`
                : `<span class="px-2 py-0.5 rounded-lg text-xs bg-green-100 text-green-700">${r.wpm} wpm</span>`;
            return `
            <div class="border border-gray-200 rounded-xl p-4">
                <div class="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                        <div class="flex items-center gap-2 flex-wrap">
                            <p class="font-bold text-sm">${this.escapar(c.titulo || c.id)}</p>
                            ${sello}
                            ${c.instruccionEditada ? '<span class="px-2 py-0.5 rounded-lg text-xs bg-purple-100 text-purple-700">instrucción editada</span>' : ''}
                            ${c.ritmoAjustado ? '<span class="px-2 py-0.5 rounded-lg text-xs bg-blue-100 text-blue-700">ritmo ajustado</span>' : ''}
                        </div>
                        <p class="text-xs text-gray-500 mt-0.5">
                            ${this.escapar(c.etiqueta || '')} ·
                            ${this.formatoDuracion(c.duracionSeg || 0)} ·
                            ${this.formatoPeso(c.bytes || 0)} ·
                            ${c.proveedor === 'elevenlabs' ? 'ElevenLabs' : 'Gemini'} ·
                            ${(c.voces || []).join(' + ')}
                            ${c.acento ? ' · ' + (ACENTOS[c.acento]?.etiqueta || c.acento) : ''} ·
                            ${(c.partes || []).length > 1 ? (c.partes.length + ' partes · ') : ''}se escucha ${c.maxPlays === 1 ? '1 vez' : c.maxPlays + ' veces'}
                        </p>
                    </div>
                    <div class="flex items-center gap-2">
                        <button onclick="audioLogic.reabrir('${c.id}')" class="text-xs font-bold text-gray-600 hover:underline">Cargar en el estudio</button>
                        <button onclick="audioLogic.copiarId('${c.id}')" class="text-xs font-bold text-brand-600 hover:underline">Copiar id</button>
                        <button onclick="audioLogic.eliminar('${c.id}')" class="text-xs font-bold text-red-600 hover:underline">Eliminar</button>
                    </div>
                </div>
                <audio controls preload="none" src="${c.audioUrl}" class="w-full mt-3 h-9"></audio>
                <details class="mt-2">
                    <summary class="text-xs text-gray-500 cursor-pointer">Ver transcript</summary>
                    <pre class="mt-2 text-xs whitespace-pre-wrap text-gray-600">${this.escapar(c.transcript || '')}</pre>
                </details>
            </div>`;
        }).join('');
    },

    // Rehacer un clip que salió mal no debería obligar a volver a pegar el
    // transcript y reconfigurarlo todo de memoria.
    reabrir(id) {
        const c = this.clips.find(x => x.id === id);
        if (!c) return;
        document.getElementById('audio-proveedor').value = c.proveedor || 'gemini';
        this.onProveedorChange().then(() => {
            document.getElementById('audio-tipo').value = c.tipo;
            this.onTipoChange();
            document.getElementById('audio-titulo').value = c.titulo || '';
            document.getElementById('audio-texto').value = c.transcript || '';
            if (c.acento) document.getElementById('audio-acento').value = c.acento;
            if (c.wpmObjetivo) document.getElementById('audio-wpm').value = c.wpmObjetivo;
            if (c.instruccion) document.getElementById('audio-instruccion').value = c.instruccion;
            (c.voces || []).forEach((v, i) => {
                const sel = document.getElementById(i === 0 ? 'audio-voz1' : 'audio-voz2');
                if (sel && [...sel.options].some(o => o.value === v)) sel.value = v;
            });
            this.onTextoInput();
            this.aviso(`Cargado "${c.titulo}" en el estudio. Al generar y guardar se crea un clip NUEVO: el viejo sigue en el banco hasta que lo elimines.`, 'info');
            document.getElementById('audio-texto').scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
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
        const filtroTipo = document.getElementById('audio-filtro-tipo');
        if (filtroTipo && !filtroTipo.options.length) {
            filtroTipo.innerHTML = '<option value="">Todos los tipos</option>' + Object.entries(ESTILOS)
                .map(([id, cfg]) => `<option value="${id}">${cfg.etiqueta}</option>`).join('');
        }
        this.onTipoChange();
        this.onTextoInput();
        this.pintarTomas();
        this.cargar();
    }
};
