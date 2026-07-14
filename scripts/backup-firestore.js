// ─────────────────────────────────────────────────────────────────────────────
// Backup local de Firestore (colecciones públicas) — correr con:
//   node scripts/backup-firestore.js
// Genera backups/backup-AAAA-MM-DD.json con alumni (+hitos), organizaciones,
// news y usernames. Los chats no se incluyen (son privados, requieren auth).
// Recomendación: correrlo una vez al mes o antes de cambios grandes.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');

const PROJECT = 'red-egresados-65a1a';
const APP_ID = '1:874010522484:web:28881821d110defd3b7221';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const ROOT = `artifacts/${encodeURIComponent(APP_ID)}`;

function parseValue(v) {
    if (v == null) return null;
    if ('stringValue' in v) return v.stringValue;
    if ('integerValue' in v) return Number(v.integerValue);
    if ('doubleValue' in v) return v.doubleValue;
    if ('booleanValue' in v) return v.booleanValue;
    if ('timestampValue' in v) return v.timestampValue;
    if ('nullValue' in v) return null;
    if ('arrayValue' in v) return (v.arrayValue.values || []).map(parseValue);
    if ('mapValue' in v) return parseFields(v.mapValue.fields || {});
    return v;
}
function parseFields(fields) {
    const out = {};
    for (const [k, v] of Object.entries(fields || {})) out[k] = parseValue(v);
    return out;
}

async function fetchCollection(relPath) {
    const docs = [];
    let pageToken = '';
    do {
        const url = `${BASE}/${relPath}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${relPath}: HTTP ${res.status}`);
        const data = await res.json();
        for (const doc of data.documents || []) {
            docs.push({ _id: doc.name.split('/').pop(), ...parseFields(doc.fields) });
        }
        pageToken = data.nextPageToken || '';
    } while (pageToken);
    return docs;
}

(async () => {
    console.log('Respaldando Firestore (colecciones públicas)…');
    const backup = { fecha: new Date().toISOString(), proyecto: PROJECT };

    backup.alumni = await fetchCollection(`${ROOT}/public/data/alumni`);
    console.log(`  alumni: ${backup.alumni.length}`);

    let totalHitos = 0;
    for (const alum of backup.alumni) {
        try {
            alum._hitos = await fetchCollection(`${ROOT}/public/data/alumni/${alum._id}/hitos`);
            totalHitos += alum._hitos.length;
        } catch { alum._hitos = []; }
    }
    console.log(`  hitos: ${totalHitos}`);

    for (const col of ['organizaciones', 'news']) {
        try {
            backup[col] = await fetchCollection(`${ROOT}/public/data/${col}`);
            console.log(`  ${col}: ${backup[col].length}`);
        } catch (e) { console.log(`  ${col}: no disponible (${e.message})`); }
    }
    try {
        backup.usernames = await fetchCollection(`${ROOT}/usernames`);
        console.log(`  usernames: ${backup.usernames.length}`);
    } catch (e) { console.log(`  usernames: no disponible (${e.message})`); }

    const dir = path.join(__dirname, '..', 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `backup-${new Date().toISOString().slice(0, 10)}.json`);
    fs.writeFileSync(file, JSON.stringify(backup, null, 1), 'utf8');
    console.log(`\nBackup guardado en: ${file}`);
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
