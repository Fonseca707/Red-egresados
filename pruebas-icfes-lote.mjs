// pruebas-icfes-lote.mjs — Pasa un lote de preguntas por las MISMAS
// validaciones que corren en el admin, antes de que nadie lo importe.
//
//   node pruebas-icfes-lote.mjs lotes/mi-lote.json
//
// Por qué existe: escribir el banco y descubrir en la cola que la mitad tiene
// avisos es gastar la atención de quien revisa, que es el recurso escaso del
// módulo. Y porque replicar aquí las reglas de validación sería garantizar que
// se separen: esto CARGA admin-icfes.js y icfes-visual.js de verdad, con lo
// mínimo simulado para que corran fuera del navegador. Si mañana cambia una
// regla allá, esta prueba la usa sola.

import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const RAIZ = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const leer = f => readFileSync(RAIZ + f, 'utf8');

// ── Lo mínimo para que el código del navegador corra en Node ────────────────
// Nada de esto toca las reglas de validación: solo evita que reviente al
// definirse. Si un stub tuviera que crecer para que una validación "pase",
// eso sería señal de que la prueba dejó de medir lo real.
const contexto = {
    sanitizeHTML: s => String(s ?? ''),
    console,
    document: { getElementById: () => null, createElement: () => ({ set textContent(v) { this._v = v; }, get innerHTML() { return this._v; } }) },
    auth: { currentUser: null },
    state: { user: null },
    firebase: { firestore: { FieldValue: { serverTimestamp: () => null } } },
    examItemsCollection: null, examStimuliCollection: null,
    fetch: () => { throw new Error('la prueba no llama a la red'); },
};
contexto.window = contexto;
createContext(contexto);

// Los tres archivos se evalúan DENTRO del mismo contexto, en orden. Sus `const`
// de nivel superior quedan en el ámbito léxico del contexto, así que el
// siguiente archivo los ve igual que en el navegador con tres <script>.
for (const archivo of ['icfes-data.js', 'icfes-visual.js', 'admin-icfes.js']) {
    try {
        runInContext(leer(archivo), contexto, { filename: archivo });
    } catch (e) {
        console.error(`No se pudo cargar ${archivo}: ${e.message}`);
        process.exit(1);
    }
}
// Un `const` no se cuelga de globalThis: hay que sacarlos a mano.
runInContext('globalThis.__api = { icfesAdmin, icfesVisual, ICFES_AFIRMACIONES };', contexto);
const { icfesAdmin, icfesVisual, ICFES_AFIRMACIONES } = contexto.__api;

// ── La prueba ───────────────────────────────────────────────────────────────
const ruta = process.argv[2];
if (!ruta) { console.error('Uso: node pruebas-icfes-lote.mjs <archivo.json>'); process.exit(1); }

const paquete = JSON.parse(readFileSync(ruta, 'utf8'));
const lotes = Array.isArray(paquete) ? paquete : (paquete.lotes || [paquete]);

let totalItems = 0, conFallos = 0;
const problemas = [];
const todas = [];

lotes.forEach((lote, n) => {
    const etiqueta = `Lote ${n + 1} (${lote.prueba} · ${lote.evidencia})`;

    // La evidencia tiene que existir dentro de su afirmación: etiquetar mal fue
    // el fallo nº1 de las dos tandas de DeepSeek (18 casos), y de esa etiqueta
    // dependen la cuota oficial y el reporte al colegio.
    (lote.items || []).forEach((it, i) => {
        const codigoAf = it.afirmacion || lote.afirmacion;
        const codigoEv = it.evidencia || lote.evidencia;
        const af = ICFES_AFIRMACIONES[codigoAf];
        if (!af) problemas.push(`${etiqueta} · pregunta ${i + 1}: la afirmación "${codigoAf}" no existe.`);
        else if (af.prueba !== lote.prueba) problemas.push(`${etiqueta} · pregunta ${i + 1}: "${codigoAf}" es de ${af.prueba}, no de ${lote.prueba}.`);
        else if (codigoEv && !af.evidencias?.[codigoEv]) problemas.push(`${etiqueta} · pregunta ${i + 1}: la evidencia "${codigoEv}" no pertenece a ${codigoAf}.`);
    });

    if (lote.estimulo?.visual) {
        const f = icfesVisual.validar(lote.estimulo.visual);
        if (f.length) problemas.push(`${etiqueta} · material del texto base: ${f.join(' · ')}`);
    }

    (lote.items || []).forEach((it, i) => {
        totalItems++;
        todas.push({ ...it, prueba: lote.prueba });
        const fallos = icfesAdmin.validar(it, { prueba: lote.prueba, hayEstimulo: !!lote.estimulo });
        if (fallos.length) { conFallos++; problemas.push(`${etiqueta} · pregunta ${i + 1}: ${fallos.join(' · ')}`); }
    });

    icfesAdmin.validarLote(lote.items || [], lote.prueba).forEach(a => problemas.push(`${etiqueta}: ${a}`));
});

// Sobre el conjunto: el sesgo de posición de la clave no se ve lote por lote.
const globales = icfesAdmin.validarLote(todas, '_global');

// Reparto real de la clave, que es el número que hay que mirar.
const claves = [0, 0, 0, 0];
todas.forEach(i => { if (i.clave >= 0 && i.clave <= 3) claves[i.clave]++; });

console.log(`\n${totalItems} preguntas en ${lotes.length} lote(s)`);
console.log(`Reparto de la respuesta correcta:  ${claves.map((n, i) => `${'ABCD'[i]}=${n}`).join('  ')}   (lo parejo sería ~${(totalItems / 4).toFixed(1)} cada una)`);
console.log(`Sin ningún aviso: ${totalItems - conFallos}/${totalItems}\n`);

[...problemas, ...globales.map(a => `EN EL CONJUNTO: ${a}`)].forEach(p => console.log('  ⚠️  ' + p));

if (!problemas.length && !globales.length) console.log('  ✅ Ni un aviso.\n');
else console.log(`\n${problemas.length + globales.length} aviso(s).\n`);

process.exit(problemas.length || globales.length ? 1 : 0);
