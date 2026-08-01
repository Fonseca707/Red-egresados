// Valida el medidor de lecturas sin navegador ni Firebase real.
// Comprueba lo que de verdad importa: que cuente los documentos (no las
// llamadas), que agrupe rutas con id variable, que sobreviva a la navegación
// entre páginas vía sessionStorage, que no rompa lo que envuelve, y que
// loadNews deje de leer dos veces por carga.
import fs from 'node:fs';

const SRC = fs.readFileSync('./shared.js', 'utf8');

let ok = 0, fallos = 0;
const comprobar = (t, c, d = '') => {
    if (c) { ok++; console.log(`  ok   ${t}`); } else { fallos++; console.log(`  FALLA ${t} ${d}`); }
};

// ── Firestore de mentira, con la misma forma que el compat SDK ───────────────
function construirFirebase() {
    class Query {
        constructor(path) { this.path = path; }
        orderBy() { return this; }
        where() { return this; }
        limit() { return this; }
        // Los docs traen `ref.parent.path` como los de verdad: es de ahí de donde
        // el medidor saca la ruta cuando la Query no expone `.path`.
        async get() {
            // __realPath simula el caso real: la Query no expone `.path`, pero
            // los documentos que devuelve sí saben de qué colección salieron.
            const path = this.__realPath ?? this.path;
            return {
                docs: Array.from({ length: this._n ?? 3 }, (_, i) => ({ id: 'd' + i, ref: { parent: { path } }, data: () => ({}) })),
                metadata: { fromCache: false }
            };
        }
        onSnapshot(cb) { cb({ docs: [{ id: 'a', data: () => ({}) }, { id: 'b', data: () => ({}) }], metadata: { fromCache: false } }); return () => {}; }
    }
    class CollectionReference extends Query {
        doc(id) { return new DocumentReference(this.path + '/' + id); }
    }
    class DocumentReference {
        constructor(path) { this.path = path; }
        collection(name) { return new CollectionReference(this.path + '/' + name); }
        async get() { return { exists: this._existe !== false, id: 'x', ref: { path: this.path }, data: () => ({}), metadata: { fromCache: false } }; }
        onSnapshot(cb) { cb({ exists: true, metadata: { fromCache: false } }); return () => {}; }
    }
    const firestore = () => ({ collection: n => new CollectionReference(n) });
    firestore.Query = Query;
    firestore.DocumentReference = DocumentReference;
    firestore.CollectionReference = CollectionReference;
    firestore.FieldValue = { serverTimestamp: () => 'ts' };
    return { apps: [{}], initializeApp() {}, auth: () => ({ onAuthStateChanged() {} }), firestore };
}

// ── Entorno mínimo de navegador ─────────────────────────────────────────────
function construirEntorno(pagina, almacen) {
    const nodos = [];
    const doc = {
        readyState: 'complete',
        body: { appendChild: n => nodos.push(n) },
        getElementById: () => nodos.find(n => n.id === 'medidor-lecturas') || null,
        createElement: () => ({ id: '', style: {}, set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html || ''; } }),
        addEventListener() {}, querySelectorAll: () => []
    };
    return {
        firebase: construirFirebase(),
        document: doc,
        location: { search: '?lecturas=1', pathname: '/' + pagina },
        sessionStorage: {
            getItem: k => (k in almacen ? almacen[k] : null),
            setItem: (k, v) => { almacen[k] = String(v); },
            removeItem: k => { delete almacen[k]; }
        },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        navigator: { clipboard: { writeText: async () => {} } },
        console: { log() {}, warn() {} },
        window: {}, URLSearchParams
    };
}

// Solo el bloque del medidor: el resto de shared.js necesita el DOM completo.
const bloque = SRC.slice(SRC.indexOf('const MEDIDOR_CLAVE'), SRC.indexOf('const _appId'));

function cargarMedidor(pagina, almacen) {
    const env = construirEntorno(pagina, almacen);
    const fn = new Function(...Object.keys(env), bloque + '\n return { medidorLecturas, db: firebase.firestore() };');
    return fn(...Object.values(env));
}

console.log('\n1) Cuenta DOCUMENTOS, no llamadas');
const almacen = {};
let { medidorLecturas: M, db } = cargarMedidor('index.html', almacen);
comprobar('arranca activo con ?lecturas=1', M.activo === true);
const alumni = db.collection('artifacts').doc('app1').collection('public').doc('data').collection('alumni');
await alumni.get();
comprobar('una consulta de 3 docs cuenta 3 lecturas', M.total() === 3, `→ ${M.total()}`);
await alumni.get();
comprobar('dos consultas iguales cuentan 6', M.total() === 6, `→ ${M.total()}`);
await alumni.doc('u1').get();
comprobar('un documento suelto suma 1 (total 7)', M.total() === 7, `→ ${M.total()}`);

console.log('\n2) La ruta se agrupa por patrón, no por id');
const r = M.resumen();
comprobar('la ruta pierde el prefijo artifacts/{id}/public/data',
    r.some(x => x.ruta === 'alumni'), `→ ${r.map(x => x.ruta).join(', ')}`);
comprobar('el doc concreto sale como alumni/{id}',
    r.some(x => x.ruta === 'alumni/{id}'), `→ ${r.map(x => x.ruta).join(', ')}`);
await alumni.doc('u2').collection('hitos').get();
await alumni.doc('u3').collection('hitos').get();
const hitos = M.resumen().find(x => x.ruta === 'alumni/{id}/hitos');
comprobar('dos personas distintas agrupan en alumni/{id}/hitos con 2 llamadas',
    hitos?.llamadas === 2, `→ ${hitos?.llamadas}`);

console.log('\n3) Los listeners también cuentan');
const antes = M.total();
db.collection('chats').onSnapshot(() => {});
comprobar('onSnapshot suma los docs de su primera entrega (2)', M.total() === antes + 2, `→ ${M.total() - antes}`);
comprobar('queda marcado como listener', M.registros.some(x => x.tipo === 'listener'));

console.log('\n4) Envolver NO rompe lo envuelto');
const res = await alumni.get();
comprobar('get() sigue devolviendo el snapshot con sus docs', res.docs?.length === 3);
let recibido = null;
const off = db.collection('chats').onSnapshot(s => { recibido = s; });
comprobar('el callback del listener recibe el snapshot', recibido?.docs?.length === 2);
comprobar('onSnapshot devuelve la función para desuscribirse', typeof off === 'function');

console.log('\n5) ⭐ Sobrevive a la navegación entre páginas');
const totalIndex = M.total();
({ medidorLecturas: M, db } = cargarMedidor('directory.html', almacen));   // otra página, mismo sessionStorage
comprobar(`al cargar directory.html conserva las ${totalIndex} lecturas de la portada`,
    M.total() === totalIndex, `→ ${M.total()}`);
await db.collection('artifacts').doc('a').collection('public').doc('data').collection('alumni').get();
comprobar('y sigue sumando encima', M.total() === totalIndex + 3, `→ ${M.total()}`);
comprobar('el informe muestra el recorrido de páginas',
    /index\.html → directory\.html/.test(await M.copiar()));

console.log('\n6) Se puede apagar');
const almacen2 = { [Object.keys(almacen).find(k => k.endsWith('_lecturas')) || 'sinapsis_medidor_lecturas']: '1' };
const env = construirEntorno('index.html', almacen2);
env.location.search = '?lecturas=0';
const apagado = new Function(...Object.keys(env), bloque + '\n return { medidorLecturas };')(...Object.values(env));
comprobar('con ?lecturas=0 no se activa', apagado.medidorLecturas.activo === false);
comprobar('y borra lo guardado', Object.keys(almacen2).length === 0);

console.log('\n7) loadNews deja de leer dos veces por carga');
comprobar('acepta { forzar }', /async function loadNews\(\{ forzar = false \} = \{\}\)/.test(SRC));
comprobar('reusa la carga en vuelo', /if \(!forzar && _newsEnVuelo\) return _newsEnVuelo/.test(SRC));
comprobar('reusa la carga reciente por TTL', /Date\.now\(\) - _newsCargadas < NEWS_TTL_MS/.test(SRC));
const admin = fs.readFileSync('./admin.html', 'utf8');
comprobar('el admin fuerza la recarga tras publicar y tras borrar',
    (admin.match(/loadNews\(\{ forzar: true \}\)/g) || []).length === 2);

console.log('\n8) Lo que Firestore FACTURA (arreglado tras el primer informe real)');
{
    const alm = {};
    const { medidorLecturas: M2, db: db2 } = cargarMedidor('index.html', alm);
    const ref = db2.collection('x').doc('y');
    ref._existe = false;                 // el mock responde "no existe" DESDE EL PROTOTIPO
    await ref.get();
    comprobar('un get de documento INEXISTENTE cuenta 1 lectura', M2.total() === 1, `→ ${M2.total()}`);
    const q = db2.collection('z');
    q._n = 0;                            // consulta sin resultados
    await q.get();
    comprobar('una consulta VACÍA cuenta 1 (mínimo de Firestore)', M2.total() === 2, `→ ${M2.total()}`);
}

console.log('\n9) La ruta sale del RESULTADO, no de los internos del SDK');
{
    const alm = {};
    const { medidorLecturas: M3, db: db3 } = cargarMedidor('index.html', alm);
    // Una Query con where/orderBy no expone .path en el compat: es el caso que
    // en el primer informe dejó 250 documentos como '?'.
    const q = db3.collection('artifacts').doc('a').collection('public').doc('data').collection('news');
    const conPath = q.path;
    Object.defineProperty(q, 'path', { get: () => undefined });   // como una Query con where
    q._n = 1;
    q.__realPath = conPath;
    await q.get();
    comprobar('una consulta sin .path se identifica por docs[0].ref.parent.path',
        M3.resumen()[0].ruta === 'news', `→ ${M3.resumen()[0].ruta}`);
}

console.log('\n10) El medidor ya no se lee a sí mismo');
comprobar('el origen se filtra por ARCHIVO, no por nombre de función (que el SDK minifica)',
    /fichero\.startsWith\('firebase-'\)/.test(SRC) && /fichero === 'shared\.js'/.test(SRC));
comprobar('queda escrito por qué la v1 devolvía el propio wrapper',
    /el nombre de este propio wrapper/.test(SRC));

console.log(`\n${ok} ok · ${fallos} fallas`);
process.exit(fallos ? 1 : 0);
