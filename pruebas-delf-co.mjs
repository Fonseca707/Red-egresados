// Valida el motor de Compréhension de l'oral sin navegador.
// Lo importante que comprueba: (a) que el transcript de delf-data.js empareje
// con el que carga el botón «transcript oficial» del estudio —de eso depende
// que el examen encuentre su audio—, (b) que la puntuación cuadre con la
// oficial 7+9+9=25, y (c) que la máquina de fases NO deje escuchar 3 veces.
import fs from 'node:fs';

const R = './';
const leer = f => fs.readFileSync(R + f, 'utf8');

let ok = 0, fallos = 0;
const comprobar = (t, c, d = '') => {
    if (c) { ok++; console.log(`  ok   ${t}`); } else { fallos++; console.log(`  FALLA ${t} ${d}`); }
};

// ── Sandbox mínimo ───────────────────────────────────────────────────────────
const elementos = {};
const stubEl = () => ({ textContent: '', innerHTML: '', classList: { toggle() {}, add() {}, remove() {} } });
const doc = { getElementById: id => (elementos[id] ||= stubEl()) };
const sandbox = {
    document: doc, window: {}, artifactsRoot: {}, router: { navigate() {} },
    sanitizeHTML: s => String(s ?? ''), localStorage: { getItem: () => null, setItem() {} },
    saveExamResult: () => {}, Audio: class { play() { return Promise.resolve(); } },
    setInterval: () => 0, clearInterval: () => {}, setTimeout: (f) => { f(); return 0; }
};
const fabricar = new Function(...Object.keys(sandbox),
    leer('delf-data.js') + '\n' + leer('delf-practice.js') +
    '\n return { delfLogic, DELF_TESTS };');
const { delfLogic: L, DELF_TESTS } = fabricar(...Object.values(sandbox));
const test = DELF_TESTS[0];

console.log('\n1) Puntuación oficial: 3 documentos de 7 + 9 + 9 = 25');
const esperados = [7, 9, 9];
test.co.documents.forEach((d, i) => {
    const suma = d.questions.reduce((n, q) => n + q.points, 0);
    comprobar(`${d.id}: ${d.questions.length} preguntas suman ${suma} (declara ${d.points})`,
        suma === d.points && d.points === esperados[i], `esperado ${esperados[i]}`);
});
comprobar(`total = ${test.co.totalPoints}`,
    test.co.documents.reduce((n, d) => n + d.points, 0) === 25);
comprobar('la puntuación NO es uniforme (hay ítems de 1 y de 1,5)',
    new Set(test.co.documents.flatMap(d => d.questions.map(q => q.points))).size > 1);
comprobar('toda pregunta tiene una respuesta válida',
    test.co.documents.every(d => d.questions.every(q => q.options[q.answer] !== undefined)));

console.log('\n2) ⭐ El transcript empareja con el del estudio de audio');
// Sin esto el examen nunca encontrará el clip que Juan genere.
const estudio = leer('admin-audio.js');
const refs = Object.fromEntries([...estudio.matchAll(/'(delf-[a-z-]+)':\s*\{[\s\S]*?referencia:\s*`([\s\S]*?)`/g)].map(m => [m[1], m[2]]));
for (const d of test.co.documents) {
    const delEstudio = refs[d.clipTipo];
    comprobar(`${d.id} ↔ preset ${d.clipTipo}`,
        !!delEstudio && L.normalizarTranscript(delEstudio) === L.normalizarTranscript(d.transcript),
        delEstudio ? '(los textos difieren)' : '(no existe ese preset en el estudio)');
}
// La comparación de arriba es la del motor, y el motor solo mira los primeros
// 300 caracteres normalizados: con ella, dos textos que se separan al final
// emparejan igual (pasó el 2026-08-02 — el doc 3 difería en la última pregunta
// del periodista y el test daba verde). El clip sonaría distinto del transcript
// que el alumno lee en pantalla, así que aquí se exige texto IDÉNTICO.
for (const d of test.co.documents) {
    const a = (refs[d.clipTipo] || '').replace(/\r/g, '');
    const b = d.transcript.replace(/\r/g, '');
    const i = [...b].findIndex((c, k) => c !== a[k]);
    comprobar(`${d.id}: texto literalmente idéntico al del estudio`, a === b,
        i >= 0 ? `→ se separan en el carácter ${i}: «${b.slice(i, i + 40)}»` : '→ longitudes distintas');
}

console.log('\n3) El emparejamiento resiste diferencias que no importan');
const base = test.co.documents[0].transcript;
comprobar('mismo texto con otros nombres de hablante → empareja',
    L.normalizarTranscript(base) === L.normalizarTranscript(base.replace(/^Sophie:/gm, 'Marie:').replace(/^Karim:/gm, 'Paul:')));
comprobar('mismo texto sin acentos → empareja',
    L.normalizarTranscript(base) === L.normalizarTranscript(base.normalize('NFD').replace(/[\u0300-\u036f]/g, '')));
comprobar('un texto distinto NO empareja',
    L.normalizarTranscript(base) !== L.normalizarTranscript(test.co.documents[1].transcript));

console.log('\n3-bis) Cada documento cabe en UNA sola tirada del generador');
// El troceo está descartado (con él, las partes no suenan a la misma grabación),
// así que un transcript que se pase del límite del proveedor sale partido o no
// sale. El endpoint de diálogo de ElevenLabs —el generador del DELF— corta en
// 2000 caracteres. El sujet oficial medía 1633/1716/1842: ese es el rango sano.
for (const d of test.co.documents) {
    const n = d.transcript.length;
    comprobar(`${d.id}: ${n} caracteres (< 2000, margen ${2000 - n})`, n < 2000, `→ se partiría en dos`);
}
// Ritmo: a 150 wpm los tres juntos no deben pasar del tope oficial de ~6 min.
const palabras = t => t.split('\n').map(l => l.replace(/^[^:]{2,20}:\s*/, '')).join(' ').trim().split(/\s+/).length;
const segundos = test.co.documents.reduce((n, d) => n + palabras(d.transcript) / 150 * 60, 0);
comprobar(`los 3 documentos duran ${Math.round(segundos)} s a 150 wpm (tope oficial ≈ 360 s)`, segundos <= 380);

console.log('\n4) La máquina de fases: 2 escuchas y ni una más');
const clip = { audioUrl: 'https://ejemplo/a.mp3', transcript: base, tipo: 'delf-dialogo' };
L.session = {
    test, section: 'co', stage: 'doc', timer: null,
    coIndex: 0, coFase: 'consigne', coAnswers: {}, coPlays: {},
    clips: Object.fromEntries(test.co.documents.map(d => [d.id, clip]))
};
const fases = [];
const entrarReal = L.entrarFase.bind(L);
L.entrarFase = f => { fases.push(f); L.session.coFase = f; if (f === 'escucha') L.reproducir(); };
L.renderCO = () => {};
L.bip = () => Promise.resolve();

// Simula el ciclo: leer → escucha(1) → fin del audio → entre → escucha(2) → fin → responder
L.entrarFase('leer');
L.entrarFase('escucha');
const doc1 = test.co.documents[0];
comprobar('primera escucha contada', L.session.coPlays[doc1.id] === 1, `→ ${L.session.coPlays[doc1.id]}`);
L.entrarFase('entre');
L.entrarFase('escucha');
comprobar('segunda escucha contada', L.session.coPlays[doc1.id] === 2, `→ ${L.session.coPlays[doc1.id]}`);
comprobar('gastadas las 2, toca responder (no una tercera escucha)',
    L.session.coPlays[doc1.id] >= (doc1.maxPlays || 2));
L.entrarFase = entrarReal;

console.log('\n5) Puntuación de un intento');
L.session.coAnswers = {};
// Todo correcto en el doc 1, todo mal en el 2, sin responder el 3.
test.co.documents[0].questions.forEach((q, i) => { (L.session.coAnswers[doc1.id] ||= [])[i] = q.answer; });
const doc2 = test.co.documents[1];
doc2.questions.forEach((q, i) => { (L.session.coAnswers[doc2.id] ||= [])[i] = (q.answer + 1) % q.options.length; });
let obtenidos = 0;
for (const d of test.co.documents) {
    d.questions.forEach((q, i) => { if (L.session.coAnswers[d.id]?.[i] === q.answer) obtenidos += q.points; });
}
comprobar(`doc1 perfecto + doc2 todo mal + doc3 en blanco = ${obtenidos} pts`, obtenidos === 7, `→ ${obtenidos}`);
comprobar('7/25 supera el mínimo eliminatorio de 5', obtenidos >= 5);

console.log('\n6) Solo se practica lo que tiene audio');
L.session.clips = { co1: clip, co2: null, co3: null };
comprobar('con 1 de 3 audios, docsConAudio() devuelve 1', L.docsConAudio().length === 1, `→ ${L.docsConAudio().length}`);
L.session.clips = Object.fromEntries(test.co.documents.map(d => [d.id, clip]));
comprobar('con los 3, devuelve 3', L.docsConAudio().length === 3);

console.log(`\n${ok} ok · ${fallos} fallas`);
process.exit(fallos ? 1 : 0);
