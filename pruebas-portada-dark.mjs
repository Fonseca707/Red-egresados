// El tema oscuro de la portada, comprobado sin navegador.
//
// Por qué existe: el modo oscuro no da error nunca. Un texto invisible y un
// fondo de la familia equivocada se ven igual de "correctos" para el código, y
// solo se descubren mirando. Lo que sí se puede automatizar es lo que se midió
// el 2026-08-07 al arreglarlo: que ningún color de la portada baje del suelo de
// contraste, y que el tema global (azul, de las otras 10 páginas) no vuelva a
// pintar el suelo de esta.
import fs from 'node:fs';

const HTML = fs.readFileSync('./index.html', 'utf8');
const THEME = fs.readFileSync('./theme.js', 'utf8');

let ok = 0, fallos = 0;
const comprobar = (t, c, d = '') => {
    if (c) { ok++; console.log(`  ok   ${t}`); } else { fallos++; console.log(`  FALLA ${t} ${d}`); }
};

// ── Contraste (WCAG) ────────────────────────────────────────────────────────
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const lum = ([r, g, b]) => {
    const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
    return .2126 * f(r) + .7152 * f(g) + .0722 * f(b);
};
const ratio = (a, b) => {
    const [x, y] = [lum(rgb(a)), lum(rgb(b))].sort((p, q) => q - p);
    return +((x + .05) / (y + .05)).toFixed(2);
};

const SUELO = '#1c1917';      // fondo base de la portada en oscuro
const TARJETA = '#221f1d';    // superficie elevada

console.log('\n1) El suelo de la portada es CÁLIDO, no el azul del tema global');
// theme.js viste las 11 páginas de gama slate; la portada se diseñó en stone.
// Sin esta regla, el hero salía cálido y todo lo demás azul: dos webs pegadas.
comprobar('el <body> lleva la clase que gana en especificidad', /<body class="hp-portada/.test(HTML));
comprobar('body y main se pintan con el fondo cálido',
    /html\.dark body\.hp-portada,\s*\n?\s*html\.dark body\.hp-portada main \{ background: #1c1917 !important/.test(HTML));
comprobar('la barra ya no cambia de familia al desplazarse',
    /html\.dark body\.hp-portada \.glass-nav \{ background: rgba\(28,25,23/.test(HTML));
// 2026-08-07, segunda vuelta: arreglar solo la portada movió el corte de sitio
// — Juan: «el modo oscuro de home tiene fondo café, pero el resto azul». Así
// que el tema global se pasó ENTERO a la gama cálida y ya no hay dos webs.
comprobar('el tema global también es cálido', /html\.dark body \{ background:#1c1917/.test(THEME));
const azules = [...new Set((THEME.match(/#(0b1120|0f172a|111827|1e293b|334155|263244|1f2937|172033|475569|f8fafc|e5e7eb|cbd5e1|94a3b8|64748b)/g) || []))];
comprobar('no quedan neutros azulados en theme.js', azules.length === 0, azules.join(' '));
// Los azules que SÍ deben quedar son los acentos: bg-blue-50 y bg-purple-50
// tienen que seguir siendo azul y morado en oscuro, no un café.
comprobar('los acentos azul y morado sobreviven',
    /bg-blue-50"\] \{ background-color:#0b2545/.test(THEME) && /bg-purple-50"\] \{ background-color:#2e1065/.test(THEME));
// Si alguna regla nueva se escribiera sin `hp-portada` ni `.hp-`, alcanzaría a
// las otras 10 páginas — que ahora comparten gama, pero no composición.
const reglasDark = [...HTML.matchAll(/^\s*(html\.dark [^{]+)\{/gm)].map(m => m[1].trim());
comprobar(`las ${reglasDark.length} reglas oscuras son SOLO de la portada`,
    reglasDark.every(r => r.split(',').every(s => /\.hp-|hp-portada|hp-js/.test(s))),
    reglasDark.filter(r => !/\.hp-|hp-portada|hp-js/.test(r)).join(' | '));

console.log('\n2) Contraste: nada por debajo del suelo');
// El «01» quedó en #2a3a30 sobre el fondo: 1,48. No se veía. Y no era una
// decisión de bajo contraste — el 02 y el 03 se habían quedado claros.
const num = (HTML.match(/html\.dark \.hp-fila-n \{ color: (#[0-9a-f]{6})/i) || [])[1];
comprobar(`el número de la lista da ${num ? ratio(num, SUELO) : '?'} (mínimo 3 para texto grande)`,
    !!num && ratio(num, SUELO) >= 3, `color ${num}`);
comprobar('…y no volvió a ser el #2a3a30 que medía 1,48', num !== '#2a3a30');

// Blanco sobre el verde de marca da 3,30 y AA pide 4,5 para texto normal: es
// el mismo fallo que ya se corrigió en el tema claro.
const av = HTML.match(/html\.dark \.hp-ficha-avatar,\s*\n?\s*html\.dark \.hp-historia-iniciales \{ background: (#[0-9a-f]{6}); color: (#[0-9a-f]{6})/i);
comprobar(`las iniciales dan ${av ? ratio(av[2], av[1]) : '?'} sobre su disco (mínimo 4,5)`,
    !!av && ratio(av[2], av[1]) >= 4.5, av ? `${av[2]} sobre ${av[1]}` : 'no se encontró la regla');

// #78716c se eligió por dar 4,59 sobre BLANCO; sobre oscuro da 3,42.
const gris = (HTML.match(/html\.dark \.hp-ruta-anio,\s*\n?\s*html\.dark \.hp-examen-nivel \{ color: (#[0-9a-f]{6})/i) || [])[1];
comprobar(`el gris secundario da ${gris ? ratio(gris, TARJETA) : '?'} sobre la tarjeta (mínimo 4,5)`,
    !!gris && ratio(gris, TARJETA) >= 4.5, `color ${gris}`);
comprobar('…y no es el gris pensado para fondo blanco', gris !== '#78716c');

console.log('\n3) Los colores del tema claro NO se tocaron');
// El aspecto claro es lo aprobado tras trece vueltas: este arreglo es del
// oscuro y no debe rozarlo.
comprobar('el número sigue siendo #86efac en claro', /\.hp-fila-n \{[^}]*color: #86efac/.test(HTML));
comprobar('el 02 sigue ámbar y el 03 teal', /\.hp-fila:nth-child\(2\) \.hp-fila-n \{ color: #fcd34d/.test(HTML)
    && /\.hp-fila:nth-child\(3\) \.hp-fila-n \{ color: #5eead4/.test(HTML));
comprobar('las iniciales en claro siguen sobre el verde de marca', /\.hp-historia-iniciales \{[^}]*background: #16a34a/.test(HTML));

console.log(`\n${ok} ok · ${fallos} fallas`);
process.exit(fallos ? 1 : 0);
