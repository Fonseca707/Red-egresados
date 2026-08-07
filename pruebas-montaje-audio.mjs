// Valida el MONTAJE del listening sin navegador: qué documento del examen
// encuentra su audio, cuál no, y qué se le enseña al alumno en consecuencia.
//
// Por qué existe: el emparejamiento clip↔documento es invisible en producción
// (pasa dentro de una consulta) y falla en silencio — un documento sin audio no
// da error, simplemente no suena. Lo único que puede avisar a tiempo es un test.
import fs from 'node:fs';

const R = './';
const leer = f => fs.readFileSync(R + f, 'utf8');

let ok = 0, fallos = 0;
const comprobar = (t, c, d = '') => {
    if (c) { ok++; console.log(`  ok   ${t}`); } else { fallos++; console.log(`  FALLA ${t} ${d}`); }
};

// ── Sandbox: el estudio de audio, sin navegador ni Firebase ──────────────────
const encadenable = () => ({ collection: encadenable, doc: encadenable });
const elementos = {};
const stubEl = () => ({ value: '', textContent: '', innerHTML: '', classList: { add() {}, remove() {}, toggle() {} }, scrollIntoView() {} });
const sandbox = {
    document: { getElementById: id => (elementos[id] ||= stubEl()), createElement: () => stubEl() },
    window: {}, artifactsRoot: encadenable(),
    firebase: { firestore: () => ({ batch: () => ({ update() {}, commit: async () => {} }) }) },
    localStorage: { getItem: () => null, setItem() {} },
    sessionStorage: { getItem: () => null, setItem() {} },
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    confirm: () => true, alert: () => {}, console
};
const fabricar = new Function(...Object.keys(sandbox),
    leer('delf-data.js') + '\n' + leer('admin-audio.js') +
    '\n return { audioLogic, DELF_TESTS, DELF_CO_MATCH, ESTILOS };');
const { audioLogic: A, DELF_TESTS, DELF_CO_MATCH, ESTILOS } = fabricar(...Object.values(sandbox));
// A propósito NO se pone `window.DELF_TESTS`: `delf-data.js` lo declara con
// `const`, que en un script clásico NO cuelga del objeto global. El estudio
// tiene que encontrarlo por nombre; si alguien vuelve a escribir
// `window.DELF_TESTS`, este test se queda sin documentos y falla en el acto.
const docs = DELF_TESTS[0].co.documents;

// Un clip del banco, como lo guarda el estudio.
const clip = (o = {}) => ({
    id: o.id || 'c1', examen: 'delf', tipo: o.tipo || 'delf-dialogo',
    titulo: o.titulo || 'clip', transcript: o.transcript ?? '', audioUrl: 'https://x/y.mp3',
    createdAt: { seconds: o.seconds ?? 1000 }, ...o
});

console.log('\n1) La regla de emparejamiento vive en UN solo sitio');
comprobar('delf-practice.js ya no lleva su propia normalización',
    !/normalizarTranscript\s*\(/.test(leer('delf-practice.js')));
comprobar('delf-practice.js usa DELF_CO_MATCH', leer('delf-practice.js').includes('DELF_CO_MATCH.buscar'));
comprobar('admin-audio.js usa DELF_CO_MATCH', leer('admin-audio.js').includes('DELF_CO_MATCH.buscar'));
comprobar('el estudio lee los documentos del EXAMEN, no una copia suya',
    leer('admin-audio.js').includes('DELF_TESTS'));

console.log('\n2) Prioridad: montado a mano > transcript > tipo');
const d1 = docs[0];
comprobar('sin banco, falta', DELF_CO_MATCH.buscar(d1, []).via === 'falta');
comprobar('mismo transcript → montado por transcript',
    DELF_CO_MATCH.buscar(d1, [clip({ transcript: d1.transcript })]).via === 'transcript');
comprobar('mismo tipo con OTRO texto → solo "tipo" (no cuenta como montado)',
    DELF_CO_MATCH.buscar(d1, [clip({ transcript: 'texto que no es' })]).via === 'tipo');
{
    const banco = [clip({ id: 'aMano', transcript: 'otro', montadoEn: d1.id }), clip({ id: 'porTexto', transcript: d1.transcript })];
    const r = DELF_CO_MATCH.buscar(d1, banco);
    comprobar('el montaje a mano gana al emparejamiento por transcript', r.via === 'montado' && r.clip.id === 'aMano');
}
comprobar('un montaje de OTRO documento no se roba este',
    DELF_CO_MATCH.buscar(d1, [clip({ id: 'x', transcript: 'otro', montadoEn: 'co3' })]).via === 'tipo');
comprobar('el transcript se compara ignorando quién habla',
    DELF_CO_MATCH.buscar(d1, [clip({ transcript: d1.transcript.replace(/^Sophie:/gm, 'Marie:') })]).via === 'transcript');

console.log('\n3) El tablero cuenta lo mismo que oiría el alumno');
const conBanco = (clips) => { A.clips = clips; return A.estadoMontaje(); };
{
    const e = conBanco([]);
    comprobar(`banco vacío: 0 de ${docs.length} y NO listo`, e.montados === 0 && e.listo === false && e.total === docs.length);
}
{
    // ⭐ El caso que motivó el tablero: hay un clip del tipo correcto pero con
    // otro texto. Suena algo, así que "hay audio" — y sin embargo el alumno
    // leería una cosa y oiría otra. Tiene que contar como FALTA.
    const e = conBanco(docs.map(d => clip({ id: d.id, tipo: d.clipTipo, transcript: 'no es el texto' })));
    comprobar('3 clips del tipo correcto pero con otro texto → 0 montados', e.montados === 0);
    comprobar('…y la prueba NO se abre', e.listo === false);
    comprobar('…y el tablero lo marca en rojo, no en verde', e.docs.every(x => x.via === 'tipo'));
}
{
    const e = conBanco(docs.slice(0, 2).map(d => clip({ id: d.id, tipo: d.clipTipo, transcript: d.transcript })));
    comprobar('2 de 3 montados → sigue sin abrirse', e.montados === 2 && e.listo === false);
}
{
    const e = conBanco(docs.map(d => clip({ id: d.id, tipo: d.clipTipo, transcript: d.transcript })));
    comprobar('los 3 montados → listo', e.montados === 3 && e.listo === true);
}
{
    // Dos tomas del mismo documento: gana la más nueva, igual que en el motor.
    const d = docs[0];
    const e = conBanco([
        clip({ id: 'vieja', tipo: d.clipTipo, transcript: d.transcript, seconds: 10 }),
        clip({ id: 'nueva', tipo: d.clipTipo, transcript: d.transcript, seconds: 99 })
    ]);
    comprobar('con dos tomas del mismo documento gana la más nueva', e.docs[0].clip.id === 'nueva');
}
comprobar('los clips de otro examen no montan un documento del DELF',
    conBanco([clip({ id: 't', examen: 'toefl', tipo: docs[0].clipTipo, transcript: docs[0].transcript })]).montados === 0);

console.log('\n4) Cada documento del examen tiene su preset en el estudio');
for (const d of docs) {
    comprobar(`${d.id} → ${d.clipTipo} existe y es del DELF`,
        !!ESTILOS[d.clipTipo] && ESTILOS[d.clipTipo].examen === 'delf');
}

console.log('\n5) Lo que ve el alumno depende de ese estado');
const prep = leer('preparacion.html');
comprobar('la tarjeta de la CO pregunta por state.coListo', /get status\(\)[^}]*coListo/.test(prep));
comprobar('sin audios no hay botón de practicar', /get action\(\)[^}]*coListo \|\| state\.coSoloAdmin\) \? "delfLogic\.start\('co'\)" : null/.test(prep));
// El superadmin es la excepción deliberada: tiene que poder probar la prueba
// antes de abrirla, porque es el único que puede montarle los audios.
comprobar('…salvo para el superadmin, que sí entra', /coSoloAdmin = !state\.coListo && typeof isAdminUser/.test(prep));
comprobar('y a él se le dice que solo la ve él', /Sin audios · solo la ves tú/.test(prep));
comprobar('el estado se consulta antes de pintar el catálogo',
    prep.indexOf('coEstaListo()') < prep.indexOf("if (state.view === 'exam-modules') examModulesLogic.render();"));
comprobar('se lee UN documento resumen, no el banco entero',
    /collection\('config'\)\.doc\('listening'\)/.test(leer('delf-practice.js')));
comprobar('si la lectura falla, la prueba NO se abre',
    /catch[\s\S]{0,200}return false;/.test(leer('delf-practice.js')));

console.log('\n6) El resumen que lee el alumno se puede escribir');
comprobar('hay regla de Firestore para public/data/config',
    /match \/public\/data\/config\/\{docId\}/.test(leer('docs/firestore.rules')));
comprobar('…de lectura pública y escritura solo superadmin',
    /match \/public\/data\/config\/\{docId\} \{\s*allow read: if true;\s*allow write: if isSuperAdmin\(\);/.test(leer('docs/firestore.rules')));
comprobar('el estudio solo escribe el resumen si cambió',
    /if \(igual\) return;/.test(leer('admin-audio.js')));

console.log(`\n${ok} ok · ${fallos} fallas`);
process.exit(fallos ? 1 : 0);
