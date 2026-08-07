// Rasteriza el logo de Sinapsis (logo.svg) a PNG para los CORREOS.
//
// Por qué existe: Gmail NO renderiza SVG en un correo, así que la neurona de la
// marca no puede ir como el `<svg>` inline que usan las 11 páginas. Y no hay
// librería de imagen en el proyecto (ni conviene añadir una para un archivo que
// se genera una vez), así que el PNG se escribe a mano: buffer RGBA →
// `zlib.deflateSync` → chunks IHDR/IDAT/IEND. Es la especificación PNG mínima.
//
// Se dibuja con supersampling 4× para que los bordes no salgan dentados: a 40 px
// de alto en un correo, el escalonado se nota más que en pantalla grande.
//
//   node scripts/logo-a-png.mjs img/logo-correo.png 160
import fs from 'node:fs';
import zlib from 'node:zlib';

const salida = process.argv[2] || 'img/logo-correo.png';
const LADO = Number(process.argv[3]) || 160;
const SS = 4;                       // supersampling
const N = LADO * SS;
const ESC = N / 32;                 // el viewBox del logo es 0 0 32 32

// Fondo: el verde de la cabecera del correo. Un PNG con transparencia se ve
// bien en Gmail, pero Outlook la rellena de blanco y aparecería un recuadro
// blanco sobre el verde. Con el fondo horneado no hay sorpresa en ningún cliente.
const FONDO = [22, 163, 74];
const buf = new Float64Array(N * N * 3);
const alpha = new Float64Array(N * N);
for (let i = 0; i < N * N; i++) { buf[i * 3] = FONDO[0]; buf[i * 3 + 1] = FONDO[1]; buf[i * 3 + 2] = FONDO[2]; alpha[i] = 1; }

const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
function pintar(x, y, color, op = 1) {
    if (x < 0 || y < 0 || x >= N || y >= N) return;
    const i = (y * N + x) * 3;
    buf[i] = buf[i] * (1 - op) + color[0] * op;
    buf[i + 1] = buf[i + 1] * (1 - op) + color[1] * op;
    buf[i + 2] = buf[i + 2] * (1 - op) + color[2] * op;
}
function circulo(cx, cy, r, color, op = 1) {
    const [x0, y0, x1, y1] = [cx - r, cy - r, cx + r, cy + r].map(v => Math.round(v * ESC));
    for (let y = y0 - 2; y <= y1 + 2; y++) for (let x = x0 - 2; x <= x1 + 2; x++) {
        const d = Math.hypot(x / ESC - cx, y / ESC - cy);
        if (d <= r) pintar(x, y, color, op);
    }
}
// Línea con extremos redondeados, como el `stroke-linecap="round"` del SVG.
function linea(ax, ay, bx, by, ancho, color, op = 1) {
    const pasos = Math.ceil(Math.hypot(bx - ax, by - ay) * ESC * 2);
    for (let k = 0; k <= pasos; k++) {
        const t = k / pasos;
        circulo(ax + (bx - ax) * t, ay + (by - ay) * t, ancho / 2, color, op);
    }
}

// ── El logo, con las coordenadas exactas de logo.svg ─────────────────────────
const NODOS = [[9, 4.6], [2.8, 11.8], [6, 26.2], [21.9, 27.4], [28.4, 11], [23.2, 5.4]];
const DENDRITAS = [[13.6, 12.6, 9.4, 5.6], [11, 15, 3.6, 12.2], [12.4, 19.6, 6.6, 25.4],
                   [17.6, 19.8, 21.4, 26.4], [19.4, 14.6, 27.4, 11.4], [18.2, 12.2, 22.6, 6.2]];
const ENTRE_NODOS = [[9.4, 5.6, 3.6, 12.2], [21.4, 26.4, 27.4, 11.4], [3.6, 12.2, 6.6, 25.4]];

// Sobre el verde de la cabecera, el verde de marca no se vería: la neurona va en
// BLANCO y sus tonos claros. Es el mismo logo, vestido para ese fondo.
for (const [ax, ay, bx, by] of ENTRE_NODOS) linea(ax, ay, bx, by, 1.1, hex('#bbf7d0'), .55);
for (const [ax, ay, bx, by] of DENDRITAS) linea(ax, ay, bx, by, 1.5, hex('#ffffff'), .8);
for (const [cx, cy] of NODOS) circulo(cx, cy, 2, hex('#ffffff'), .95);
circulo(15.6, 16.2, 5, hex('#ffffff'), 1);
circulo(15.6, 16.2, 2, hex('#15803d'), 1);

// ── Bajar del supersampling y escribir el PNG ────────────────────────────────
const px = Buffer.alloc(LADO * (LADO * 3 + 1));
for (let y = 0; y < LADO; y++) {
    px[y * (LADO * 3 + 1)] = 0;                       // filtro 0 (None) por fila
    for (let x = 0; x < LADO; x++) {
        let r = 0, g = 0, b = 0;
        for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
            const i = ((y * SS + sy) * N + (x * SS + sx)) * 3;
            r += buf[i]; g += buf[i + 1]; b += buf[i + 2];
        }
        const n = SS * SS, o = y * (LADO * 3 + 1) + 1 + x * 3;
        px[o] = Math.round(r / n); px[o + 1] = Math.round(g / n); px[o + 2] = Math.round(b / n);
    }
}
const crc32 = (b) => {
    let c = ~0;
    for (const byte of b) { c ^= byte; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); }
    return ~c >>> 0;
};
const chunk = (tipo, datos) => {
    const t = Buffer.from(tipo, 'ascii');
    const len = Buffer.alloc(4); len.writeUInt32BE(datos.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, datos])));
    return Buffer.concat([len, t, datos, crc]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(LADO, 0); ihdr.writeUInt32BE(LADO, 4);
ihdr[8] = 8; ihdr[9] = 2;                             // 8 bits, color RGB
const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(px, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
]);
fs.writeFileSync(salida, png);
console.log(`${salida} · ${LADO}×${LADO} · ${(png.length / 1024).toFixed(1)} KB`);
