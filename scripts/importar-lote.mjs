// scripts/importar-lote.mjs — Sube un lote de preguntas a Firestore desde la
// terminal, sin abrir el navegador.
//
//   node scripts/importar-lote.mjs lotes/piloto-2026-08-07.json [--ensayo]
//
// Autenticación: usa el token de `gcloud auth print-access-token` de la cuenta
// que ya está en el equipo. Ese token entra por la API de administración, así
// que NO pasa por las reglas de Firestore — por eso el script no es un atajo
// para saltarse nada: escribe exactamente los mismos campos que el importador
// del navegador, con `revisado: false`, y nada llega a un estudiante sin que
// una persona lo apruebe en el panel.
//
// Las validaciones NO se replican aquí: se carga admin-icfes.js y se usan las
// suyas. Si mañana cambia una regla allá, este script la usa sola.
//
// --ensayo: valida y muestra qué escribiría, sin escribir nada.

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createContext, runInContext } from 'node:vm';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const PROYECTO = 'red-egresados-65a1a';
const APP_ID = '1:874010522484:web:28881821d110defd3b7221';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROYECTO}/databases/(default)/documents/artifacts/${encodeURIComponent(APP_ID)}/public/data`;

const ruta = process.argv[2];
const ensayo = process.argv.includes('--ensayo');
if (!ruta) { console.error('Uso: node scripts/importar-lote.mjs <archivo.json> [--ensayo]'); process.exit(1); }

// ── Cargar las validaciones reales del admin ────────────────────────────────
const contexto = {
    sanitizeHTML: s => String(s ?? ''), console,
    document: { getElementById: () => null, createElement: () => ({}) },
    auth: { currentUser: null }, state: { user: null },
    firebase: { firestore: { FieldValue: { serverTimestamp: () => null } } },
    examItemsCollection: null, examStimuliCollection: null,
    fetch: () => { throw new Error('el validador no llama a la red'); },
};
contexto.window = contexto;
createContext(contexto);
for (const f of ['icfes-data.js', 'icfes-visual.js', 'admin-icfes.js']) {
    runInContext(readFileSync(RAIZ + f, 'utf8'), contexto, { filename: f });
}
runInContext('globalThis.__api = { icfesAdmin, icfesVisual, ICFES_AFIRMACIONES };', contexto);
const { icfesAdmin, icfesVisual } = contexto.__api;

// ── Firestore REST: valores tipados ─────────────────────────────────────────
// Firestore NO admite arrays dentro de arrays ("Nested arrays are not
// allowed"). El material visual llega ya serializado como texto por eso mismo;
// esta función solo tiene que traducir tipos simples.
function valor(v) {
    if (v === null || v === undefined) return { nullValue: null };
    if (typeof v === 'boolean') return { booleanValue: v };
    if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    if (Array.isArray(v)) {
        if (v.some(Array.isArray)) throw new Error('array anidado: Firestore no lo admite');
        return { arrayValue: { values: v.map(valor) } };
    }
    if (typeof v === 'object') return { mapValue: { fields: campos(v) } };
    return { stringValue: String(v) };
}
const campos = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, valor(v)]));

const TOKEN = ensayo ? '' : execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8', shell: true }).trim();

async function crear(coleccion, doc) {
    const r = await fetch(`${BASE}/${coleccion}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: campos(doc) }),
    });
    const cuerpo = await r.json();
    if (!r.ok) throw new Error(cuerpo?.error?.message || `HTTP ${r.status}`);
    return cuerpo.name.split('/').pop();
}

// Borra lo que ya se importó de ESTE archivo. Corregir una pregunta y volver a
// importar sin esto deja las dos versiones en la cola, y la vieja se ve igual de
// legítima que la nueva. Solo borra lo que aún no ha aprobado una persona: lo
// aprobado ya es decisión suya y no se toca desde un script.
async function borrarDelArchivo(nombre) {
    let tok = null, borrados = 0, respetados = 0;
    do {
        const r = await fetch(`${BASE}/examItems?pageSize=300${tok ? '&pageToken=' + tok : ''}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
        const j = await r.json();
        for (const d of (j.documents || [])) {
            if (d.fields?.loteArchivo?.stringValue !== nombre) continue;
            if (d.fields?.revisado?.booleanValue === true) { respetados++; continue; }
            await fetch(`https://firestore.googleapis.com/v1/${d.name}`, { method: 'DELETE', headers: { Authorization: `Bearer ${TOKEN}` } });
            borrados++;
        }
        tok = j.nextPageToken;
    } while (tok);
    if (borrados || respetados) console.log(`  reemplazo: ${borrados} borrada(s) sin revisar` + (respetados ? `, ${respetados} ya aprobada(s) que NO se tocaron` : ''));
}

// ── Importar ────────────────────────────────────────────────────────────────
const nombreArchivo = ruta.split(/[\\/]/).pop();
if (process.argv.includes('--reemplazar') && !ensayo) await borrarDelArchivo(nombreArchivo);
const paquete = JSON.parse(readFileSync(ruta, 'utf8'));
const lotes = Array.isArray(paquete) ? paquete : (paquete.lotes || [paquete]);

let nItems = 0, nEst = 0, conAvisos = 0;
const todas = [];

for (const [n, lote] of lotes.entries()) {
    let estimuloId = null;
    if (lote.estimulo) {
        const est = {
            prueba: lote.prueba, tipoTexto: lote.tipoTexto || '',
            titulo: lote.estimulo.titulo || '',
            texto: icfesAdmin.limpiarTexto(lote.estimulo.texto || '', lote.estimulo.titulo || ''),
            visual: lote.estimulo.visual ? JSON.stringify(lote.estimulo.visual) : null,
            // La fuente se fija en el código, nunca se acepta del contenido.
            fuente: 'Texto original para práctica · Sinapsis',
            createdAt: new Date().toISOString(),
        };
        estimuloId = ensayo ? `(ensayo-${++nEst})` : await crear('examStimuli', est);
        if (!ensayo) nEst++;
    }

    for (const it of (lote.items || [])) {
        const item = {
            ...it,
            prueba: lote.prueba,
            afirmacion: it.afirmacion || lote.afirmacion,
            evidencia: it.evidencia || lote.evidencia,
            dificultad: it.dificultad || lote.dificultad || 2,
        };
        // La correcta se guarda siempre primera: el orden que ve el estudiante
        // lo decide el motor al presentar. Mismo criterio que el importador del
        // navegador.
        const k = Number(item.clave) || 0;
        if (k > 0 && Array.isArray(item.opciones) && item.opciones[k] !== undefined) {
            const orden = [k, ...item.opciones.map((_, i) => i).filter(i => i !== k)];
            item.opciones = orden.map(i => item.opciones[i]);
            item.justificaciones = orden.map(i => (item.justificaciones || [])[i] || '');
            item.clave = 0;
        }
        todas.push(item);
        const fallos = [
            ...icfesAdmin.validar(item, { prueba: lote.prueba, hayEstimulo: !!estimuloId }),
            ...icfesAdmin.revisarAtribuciones(lote.estimulo?.texto || ''),
        ];
        if (fallos.length) { conAvisos++; console.log(`  ⚠️  lote ${n + 1}, "${String(item.enunciado).slice(0, 45)}…": ${fallos.join(' · ')}`); }

        const doc = {
            exam: 'ICFES',
            prueba: item.prueba, afirmacion: item.afirmacion, evidencia: item.evidencia,
            tipoTexto: lote.prueba === 'lectura_critica' ? (lote.tipoTexto || '') : '',
            categoria: lote.prueba === 'matematicas' ? (lote.categoria || '') : '',
            contexto: lote.prueba === 'matematicas' ? (lote.contexto || '') : '',
            generico: lote.prueba === 'matematicas' ? (lote.generico ?? null) : null,
            componente: lote.prueba === 'ciencias' ? (item.componente || lote.componente || '') : '',
            forma: item.forma || '',
            estimuloId,
            visual: item.visual ? JSON.stringify(item.visual) : null,
            enunciado: item.enunciado || '',
            // El modelo mete la letra dentro de la opción; se limpia igual que en el admin.
            opciones: (item.opciones || []).map(o => String(o).replace(/^\s*[A-D][.)]\s+/, '').trim()),
            clave: Number(item.clave) || 0,
            justificaciones: item.justificaciones || [],
            dificultad: item.dificultad,
            origen: 'claude',
            loteArchivo: nombreArchivo,
            validaciones: fallos,
            revisado: false,        // ← el gate: nadie lo ve hasta que una persona lo apruebe
            school: '', active: true,
            createdAt: new Date().toISOString(),
        };
        if (!ensayo) await crear('examItems', doc);
        nItems++;
    }
}

for (const a of icfesAdmin.validarLote(todas, '_global')) console.log(`  ⚠️  en el conjunto: ${a}`);

// Dónde cae la correcta PARA EL ESTUDIANTE. En las de opciones numéricas es su
// posición al ordenarlas de menor a mayor; en las demás la sortea el motor con
// la semilla de cada sesión, así que aquí no hay nada que contar.
const claves = [0, 0, 0, 0];
let numericas = 0;
for (const i of todas) {
    const vals = (i.opciones || []).map(o => {
        const m = String(o).match(/^[^\d]*?(-?\d[\d.,]*)/);
        return m ? Number(m[1].replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')) : null;
    });
    if (vals.length !== 4 || vals.some(v => v === null || !Number.isFinite(v))) continue;
    const orden = vals.map((_, k) => k).sort((a, b) => vals[a] - vals[b]);
    claves[orden.indexOf(Number(i.clave) || 0)]++;
    numericas++;
}

console.log(`\n${ensayo ? '[ENSAYO — no se escribió nada] ' : ''}${nItems} preguntas y ${nEst} texto(s) base de ${nombreArchivo}`);
console.log(`Dónde cae la correcta en las ${numericas} de opciones numéricas: ${claves.map((n, i) => `${'ABCD'[i]}=${n}`).join('  ')}`);
console.log(`Las otras ${nItems - numericas} se barajan en cada sesión.`);
console.log(`Con avisos: ${conAvisos}/${nItems}`);
console.log(ensayo ? '' : 'Todas quedaron con revisado:false — hay que aprobarlas en Admin → Saber 11.\n');
