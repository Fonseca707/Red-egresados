// Prueba de humo del estudio de audio, sin navegador. Comprueba lo que se acaba
// de tocar: que el módulo carga, que silenciarAudios PARA los audios (que era el
// bug) y que el tablero de montaje ofrece salida en las tres vías.
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const RAIZ = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const col = () => ({ doc: () => ({}), where: () => col(), get: async () => ({ docs: [] }), add: async () => ({}) });

const ctx = {
    console,
    sanitizeHTML: s => String(s ?? ''),
    artifactsRoot: { collection: () => ({ doc: () => ({ collection: col }) }) },
    audioClipsCollection: col(), examTestsCollection: col(),
    firebase: { firestore: Object.assign(() => ({ batch: () => ({ update() {}, commit: async () => {} }) }), { FieldValue: { delete: () => null, serverTimestamp: () => null } }), storage: () => ({ ref: () => ({ delete: async () => {} }) }) },
    state: { user: {} },
    DELF_TESTS: [{ co: { documents: [
        { id: 'doc1', title: 'Ejercicio 1', points: 7, maxPlays: 2, clipTipo: 'dialogo', transcript: 'Bonjour Sophie' },
    ] } }],
    DELF_CO_MATCH: { buscar: (doc, banco) => ({ clip: banco[0] || null, via: banco[0] ? 'transcript' : 'falta' }) },
    document: {
        getElementById: (id) => ({ id, innerHTML: '', textContent: '', classList: { toggle() {}, add() {}, remove() {} }, querySelectorAll: () => [] }),
        querySelectorAll: () => [],
        // `escapar()` del panel crea un div para escapar HTML.
        createElement: () => ({ set textContent(v) { this._v = String(v); }, get innerHTML() { return this._v || ''; } }),
    },
};
ctx.window = ctx;
createContext(ctx);

for (const f of ['icfes-data.js']) { try { runInContext(readFileSync(RAIZ + f, 'utf8'), ctx, { filename: f }); } catch {} }
runInContext(readFileSync(RAIZ + 'admin-audio.js', 'utf8'), ctx, { filename: 'admin-audio.js' });
runInContext('globalThis.__a = audioLogic;', ctx);
const a = ctx.__a;

let ok = 0, mal = 0;
const prueba = (nombre, cond) => { if (cond) { ok++; console.log('  ✓', nombre); } else { mal++; console.log('  ✗', nombre); } };

console.log('\nEstudio de audio — prueba de humo\n');
prueba('el módulo carga', !!a);
prueba('existe silenciarAudios', typeof a.silenciarAudios === 'function');
prueba('existe pintarEn', typeof a.pintarEn === 'function');

// El bug: un <audio> sonando debe quedar pausado y rebobinado.
const sonando = { paused: false, currentTime: 12, pause() { this.paused = true; } };
const quieto = { paused: true, currentTime: 5, pause() { throw new Error('no debe tocar los ya pausados'); } };
a.silenciarAudios({ querySelectorAll: () => [sonando, quieto] });
prueba('para el audio que estaba sonando', sonando.paused === true);
prueba('lo rebobina a 0', sonando.currentTime === 0);
prueba('no toca los que ya estaban pausados', quieto.currentTime === 5);

// El tablero debe ofrecer salida siempre que haya un clip puesto.
const html = [];
a.clips = [{ id: 'c1', examen: 'delf', titulo: 'Clip 1', audioUrl: 'x', duracionSeg: 60, proveedor: 'elevenlabs' }];
const getEl = ctx.document.getElementById;
ctx.document.getElementById = (id) => ({ ...getEl(id), id, get innerHTML() { return ''; }, set innerHTML(v) { html.push(v); }, classList: { toggle() {}, add() {}, remove() {} }, querySelectorAll: () => [] });
try { a.pintarMontaje(); } catch (e) { console.log('  ✗ pintarMontaje reventó:', e.message); mal++; }
const salida = html.join('');
prueba('el tablero pinta', salida.length > 0);
prueba('avisa de por qué no está el TOEFL', salida.includes('TOEFL Listening todavía no aparece'));
prueba('con clip emparejado por transcript, ofrece borrarlo', salida.includes('Borrar este audio'));

console.log(`\n${ok} bien · ${mal} mal\n`);
process.exit(mal ? 1 : 0);
