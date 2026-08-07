// icfes-visual.js — Tablas y gráficos de los ítems del Saber 11.
//
// Por qué existe: hasta ahora un "gráfico" o una "tabla" en una pregunta era
// texto plano con espacios (icfes-engine.js pintaba el estímulo con
// whitespace-pre-line). En un celular de 390 px eso se parte y el estudiante
// pierde el dato, que es justo lo que la pregunta le está midiendo. Un ítem
// donde el dato no se lee no evalúa matemáticas: evalúa paciencia.
//
// Todo se dibuja aquí, sin librerías: SVG generado a mano. No hay CDN que se
// caiga (ya pasó con Tailwind el 31-jul) ni peso extra que cargar.
//
// ── Dos decisiones que se apartan de un dashboard normal, a propósito ────────
//
// 1. NO HAY TOOLTIP. En un tablero, pasar el mouse y ver el valor exacto es lo
//    correcto. En un examen es hacer trampa: si la pregunta es "¿cuál fue el
//    promedio de marzo?", un globo que lo diga al pasar por encima anula el
//    ítem. Y en un celular no hay hover, así que quien entra por computador
//    tendría una ayuda que el otro no: eso es sesgo de dispositivo.
//
// 2. EL VALOR VA ESCRITO EN LA MARCA, SIEMPRE. Un tablero rotula solo lo
//    destacado y deja que el eje sugiera el resto. Aquí no: estimar a ojo
//    contra una cuadrícula introduce un error de lectura que no es lo que se
//    está evaluando, y castiga al que ve peor o tiene la pantalla más chica.
//    El ICFES real también imprime los valores. De paso, esto es lo que cubre
//    el aviso de contraste de los tonos claros de la paleta: el dato nunca
//    depende de distinguir un color.
//
// Paleta: validada (banda de luminosidad, piso de croma, separación para
// daltonismo y contraste) contra la superficie blanca sobre la que se pinta.
// El peor par adyacente da ΔE 9.1 en protanopía, sobre el objetivo de 8.
// Casi todos los gráficos de examen son de UNA serie, y ahí ni se usa.

const ICFES_VIZ = {
    // Slots categóricos, en orden fijo. Nunca se ciclan ni se generan más.
    series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#4a3aa7'],
    tinta: '#0b0b0b',
    tintaSuave: '#52514e',
    tintaTenue: '#898781',
    rejilla: '#e1e0d9',
    eje: '#c3c2b7',
    superficie: '#ffffff',
    W: 380,        // Ancho de referencia: se diseña para el celular y se escala
                   // HACIA ARRIBA en pantallas grandes. Al revés (diseñar en
                   // 640 y encoger) el texto llega a 8 px y no se lee.
    maxAncho: 560, // Tope para que en escritorio no quede desproporcionado.
};

const icfesVisual = {

    // ── Utilidades ──────────────────────────────────────────────────────────

    esc(s) { return sanitizeHTML(s); },

    // Números en formato colombiano (1.234,5). Un gráfico que escribe "1,234.5"
    // le pide al estudiante traducir mientras resuelve.
    num(v, decimales = null) {
        if (v === null || v === undefined || v === '') return '';
        if (typeof v !== 'number') return String(v);
        const d = decimales !== null ? decimales : (Number.isInteger(v) ? 0 : (Math.abs(v) < 1 ? 2 : 1));
        return v.toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d });
    },

    // Escala "bonita": los cortes del eje caen en 1, 2, 2.5 o 5 por década.
    // Un eje que va 0 · 137 · 274 obliga a interpolar mentalmente y mete un
    // error de lectura que no es del tema evaluado.
    escala(max, min = 0, objetivo = 4) {
        if (max === min) max = min + 1;
        const bruto = (max - min) / objetivo;
        const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
        const norm = bruto / mag;
        const paso = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
        const desde = Math.floor(min / paso) * paso;
        const hasta = Math.ceil(max / paso) * paso;
        const cortes = [];
        // El épsilon evita que el último corte se pierda por error de coma flotante.
        for (let v = desde; v <= hasta + paso * 1e-9; v += paso) cortes.push(Number(v.toFixed(10)));
        return { desde, hasta, cortes, paso };
    },

    envolver(svg, alto) {
        // El alto va SOLO por CSS, nunca como atributo: height="auto" no es un
        // valor válido del atributo SVG y Chrome cae al alto por defecto de
        // 150 px, dejando el dibujo estirado y una franja vacía debajo.
        return `<div class="icfes-viz my-4" style="max-width:${ICFES_VIZ.maxAncho}px">
            <svg viewBox="0 0 ${ICFES_VIZ.W} ${alto}" preserveAspectRatio="xMinYMin meet"
                 xmlns="http://www.w3.org/2000/svg" role="img"
                 style="display:block;width:100%;height:auto;font-family:system-ui,-apple-system,'Segoe UI',sans-serif">
                ${svg}
            </svg>
        </div>`;
    },

    titulo(v, y = 16) {
        if (!v.titulo) return '';
        return `<text x="0" y="${y}" font-size="13" font-weight="600" fill="${ICFES_VIZ.tinta}">${this.esc(v.titulo)}</text>`;
    },

    nota(v, alto) {
        if (!v.nota) return '';
        return `<text x="0" y="${alto - 4}" font-size="10.5" fill="${ICFES_VIZ.tintaTenue}">${this.esc(v.nota)}</text>`;
    },

    // ── Punto de entrada ────────────────────────────────────────────────────

    // El material puede llegar como objeto (al escribirlo o al probarlo) o como
    // texto JSON (al venir de Firestore). Se guarda serializado porque una tabla
    // tiene `filas` como array de arrays y **Firestore no admite arrays
    // anidados**: rechaza el documento entero con "Nested arrays are not
    // allowed". Sin esto, ninguna pregunta con tabla podría guardarse, que es
    // justo la forma más común en Matemáticas.
    normalizar(v) {
        if (!v) return null;
        if (typeof v === 'string') {
            try { return JSON.parse(v); } catch (e) { return null; }
        }
        return v;
    },

    render(crudo) {
        const v = this.normalizar(crudo);
        if (!v || !v.tipo) return '';
        try {
            switch (v.tipo) {
                case 'tabla':            return this.tabla(v);
                case 'barras':           return this.barras(v);
                case 'barras_agrupadas': return this.barras(v);
                case 'lineas':           return this.lineas(v);
                case 'dispersion':       return this.dispersion(v);
                case 'circular':         return this.circular(v);
                default:                 return '';
            }
        } catch (e) {
            console.error('[icfes-visual] No se pudo dibujar', v?.tipo, e);
            return `<p class="text-xs text-red-600 my-3">No se pudo dibujar el material de esta pregunta.</p>`;
        }
    },

    // ── Tabla ───────────────────────────────────────────────────────────────
    // HTML de verdad, no SVG: se puede seleccionar, la lee un lector de
    // pantalla y el navegador la ajusta solo. Si no cabe, se desplaza SOLO
    // ella — la página nunca se mueve de lado.
    tabla(v) {
        const cols = (v.columnas || []).map(c => (typeof c === 'string' ? { nombre: c } : c));
        if (!cols.length) return '';
        const esNum = cols.map((c, i) =>
            c.tipo === 'numero' || (c.tipo === undefined && (v.filas || []).every(f => typeof f[i] === 'number')));

        const encabezado = cols.map((c, i) => `
            <th scope="col" class="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap ${esNum[i] ? 'text-right' : 'text-left'}">
                ${this.esc(c.nombre)}${c.unidad ? ` <span class="font-normal normal-case text-gray-400">(${this.esc(c.unidad)})</span>` : ''}
            </th>`).join('');

        const cuerpo = (v.filas || []).map((fila, fi) => {
            const destacada = v.destacarFila === fi;
            const celdas = fila.map((celda, ci) => `
                <${ci === 0 ? 'th scope="row"' : 'td'} class="px-3 py-2.5 text-sm ${esNum[ci] ? 'text-right tabular-nums text-gray-900' : 'text-left text-gray-700'} ${ci === 0 ? 'font-medium text-gray-900' : ''}">
                    ${this.esc(typeof celda === 'number' ? this.num(celda, cols[ci]?.decimales ?? null) : celda)}
                </${ci === 0 ? 'th' : 'td'}>`).join('');
            return `<tr class="border-t border-gray-100 ${destacada ? 'bg-amber-50' : ''}">${celdas}</tr>`;
        }).join('');

        return `
        <figure class="my-4">
            ${v.titulo ? `<figcaption class="text-sm font-semibold text-gray-900 mb-2">${this.esc(v.titulo)}</figcaption>` : ''}
            <div class="overflow-x-auto border border-gray-200">
                <table class="w-full border-collapse text-left">
                    <thead class="bg-gray-50"><tr>${encabezado}</tr></thead>
                    <tbody>${cuerpo}</tbody>
                </table>
            </div>
            ${v.nota ? `<p class="text-[11px] text-gray-400 mt-1.5">${this.esc(v.nota)}</p>` : ''}
        </figure>`;
    },

    // ── Barras (una serie o agrupadas) ──────────────────────────────────────
    // Se voltean a horizontal solas cuando las etiquetas no caben de pie. Es la
    // alternativa a rotar el texto 45°, que a 380 px es ilegible.
    barras(v) {
        const cats = v.categorias || [];
        const series = this.normalizarSeries(v);
        const horizontal = v.orientacion === 'horizontal'
            || cats.length > 6
            || cats.some(c => String(c).length > 9);
        return horizontal ? this.barrasH(v, cats, series) : this.barrasV(v, cats, series);
    },

    normalizarSeries(v) {
        if (Array.isArray(v.series) && v.series.length) {
            return v.series.map(s => ({ nombre: s.nombre || '', valores: s.valores || [] }));
        }
        return [{ nombre: v.nombreSerie || '', valores: v.valores || [] }];
    },

    barrasV(v, cats, series) {
        const hayLeyenda = series.length > 1;
        const margen = { arriba: v.titulo ? 30 : 10, der: 6, abajo: 34, izq: 34 };
        const altoPlot = 170;
        const altoLeyenda = hayLeyenda ? 22 : 0;
        const alto = margen.arriba + altoPlot + margen.abajo + altoLeyenda + (v.nota ? 14 : 0);
        const anchoPlot = ICFES_VIZ.W - margen.izq - margen.der;

        const todos = series.flatMap(s => s.valores).filter(n => typeof n === 'number');
        const esc = this.escala(Math.max(0, ...todos), Math.min(0, ...todos));
        const y = val => margen.arriba + altoPlot - ((val - esc.desde) / (esc.hasta - esc.desde)) * altoPlot;

        const rejilla = esc.cortes.map(c => `
            <line x1="${margen.izq}" y1="${y(c)}" x2="${ICFES_VIZ.W - margen.der}" y2="${y(c)}"
                  stroke="${ICFES_VIZ.rejilla}" stroke-width="1"/>
            <text x="${margen.izq - 6}" y="${y(c) + 3.5}" text-anchor="end" font-size="10"
                  fill="${ICFES_VIZ.tintaTenue}" style="font-variant-numeric:tabular-nums">${this.num(c)}</text>`).join('');

        const anchoGrupo = anchoPlot / cats.length;
        const GAP = 2;  // Separación por superficie entre barras vecinas: la
                        // skill pide un hueco, no un borde dibujado.
        const anchoBarra = Math.min(38, (anchoGrupo * 0.62 - GAP * (series.length - 1)) / series.length);

        const marcas = cats.map((cat, ci) => {
            const centro = margen.izq + anchoGrupo * ci + anchoGrupo / 2;
            const anchoTotal = anchoBarra * series.length + GAP * (series.length - 1);
            const barras = series.map((s, si) => {
                const val = s.valores[ci];
                if (typeof val !== 'number') return '';
                const x = centro - anchoTotal / 2 + si * (anchoBarra + GAP);
                const yTop = Math.min(y(val), y(0));
                const altoBarra = Math.abs(y(val) - y(0));
                const etiqueta = altoBarra > 16
                    ? `<text x="${x + anchoBarra / 2}" y="${yTop - 4}" text-anchor="middle" font-size="10"
                             font-weight="600" fill="${ICFES_VIZ.tintaSuave}"
                             style="font-variant-numeric:tabular-nums">${this.num(val, v.decimales)}</text>`
                    : '';
                return `<rect x="${x}" y="${yTop}" width="${anchoBarra}" height="${Math.max(altoBarra, 1)}"
                              fill="${ICFES_VIZ.series[si % ICFES_VIZ.series.length]}"/>
                        ${etiqueta}`;
            }).join('');
            return `${barras}
                <text x="${centro}" y="${margen.arriba + altoPlot + 15}" text-anchor="middle"
                      font-size="10.5" fill="${ICFES_VIZ.tintaSuave}">${this.esc(cat)}</text>`;
        }).join('');

        return this.envolver(`
            ${this.titulo(v)}
            ${rejilla}
            <line x1="${margen.izq}" y1="${y(esc.desde)}" x2="${ICFES_VIZ.W - margen.der}" y2="${y(esc.desde)}"
                  stroke="${ICFES_VIZ.eje}" stroke-width="1"/>
            ${marcas}
            ${v.ejeX?.titulo ? `<text x="${margen.izq + anchoPlot / 2}" y="${margen.arriba + altoPlot + 30}" text-anchor="middle" font-size="10.5" font-weight="600" fill="${ICFES_VIZ.tintaTenue}">${this.esc(v.ejeX.titulo)}</text>` : ''}
            ${hayLeyenda ? this.leyenda(series, margen.arriba + altoPlot + margen.abajo + 6) : ''}
            ${this.nota(v, alto)}
        `, alto);
    },

    // La etiqueta de cada categoría va ENCIMA de su barra, no a la izquierda.
    // Con la etiqueta al lado hay que reservarle un ancho fijo, y en cuanto un
    // nombre lo supera el texto se sale del lienzo y se corta: "Transporte
    // público" salía como "ransporte público". Encima, dispone del ancho
    // completo y ninguna categoría puede romperlo por larga que sea.
    barrasH(v, cats, series) {
        const hayLeyenda = series.length > 1;
        const margen = { arriba: v.titulo ? 26 : 4, der: 46 };
        const GAP = 2;
        const altoBarra = 15;
        const altoFila = 17 + series.length * altoBarra + (series.length - 1) * GAP + 11;
        const altoLeyenda = hayLeyenda ? 22 : 0;
        const alto = margen.arriba + cats.length * altoFila + altoLeyenda + (v.nota ? 14 : 0);
        const anchoPlot = ICFES_VIZ.W - margen.der;

        const todos = series.flatMap(s => s.valores).filter(n => typeof n === 'number');
        const esc = this.escala(Math.max(0, ...todos), 0);
        const x = val => ((val - esc.desde) / (esc.hasta - esc.desde)) * anchoPlot;

        const filas = cats.map((cat, ci) => {
            const yFila = margen.arriba + altoFila * ci;
            const barras = series.map((s, si) => {
                const val = s.valores[ci];
                if (typeof val !== 'number') return '';
                const yB = yFila + 17 + si * (altoBarra + GAP);
                const ancho = Math.max(x(val), 1);
                return `<rect x="0" y="${yB}" width="${ancho}" height="${altoBarra}"
                              fill="${ICFES_VIZ.series[si % ICFES_VIZ.series.length]}"/>
                        <text x="${ancho + 6}" y="${yB + altoBarra / 2 + 3.5}" font-size="10.5" font-weight="600"
                              fill="${ICFES_VIZ.tintaSuave}" style="font-variant-numeric:tabular-nums">${this.num(val, v.decimales)}</text>`;
            }).join('');
            return `<text x="0" y="${yFila + 11}" font-size="10.5" fill="${ICFES_VIZ.tintaSuave}">${this.esc(cat)}</text>
                    ${barras}`;
        }).join('');

        return this.envolver(`
            ${this.titulo(v, 13)}
            ${filas}
            ${hayLeyenda ? this.leyenda(series, margen.arriba + cats.length * altoFila) : ''}
            ${this.nota(v, alto)}
        `, alto);
    },

    // ── Líneas ──────────────────────────────────────────────────────────────
    lineas(v) {
        const cats = v.categorias || [];
        const series = this.normalizarSeries(v);
        const hayLeyenda = series.length > 1;
        const margen = { arriba: v.titulo ? 30 : 12, der: 12, abajo: 32, izq: 34 };
        const altoPlot = 160;
        const altoLeyenda = hayLeyenda ? 22 : 0;
        const alto = margen.arriba + altoPlot + margen.abajo + altoLeyenda + (v.nota ? 14 : 0);
        const anchoPlot = ICFES_VIZ.W - margen.izq - margen.der;

        const todos = series.flatMap(s => s.valores).filter(n => typeof n === 'number');
        const esc = this.escala(Math.max(...todos), v.desdeCero === false ? Math.min(...todos) : 0);
        const y = val => margen.arriba + altoPlot - ((val - esc.desde) / (esc.hasta - esc.desde)) * altoPlot;
        const x = i => margen.izq + (cats.length === 1 ? anchoPlot / 2 : (anchoPlot / (cats.length - 1)) * i);

        const rejilla = esc.cortes.map(c => `
            <line x1="${margen.izq}" y1="${y(c)}" x2="${ICFES_VIZ.W - margen.der}" y2="${y(c)}"
                  stroke="${ICFES_VIZ.rejilla}" stroke-width="1"/>
            <text x="${margen.izq - 6}" y="${y(c) + 3.5}" text-anchor="end" font-size="10"
                  fill="${ICFES_VIZ.tintaTenue}" style="font-variant-numeric:tabular-nums">${this.num(c)}</text>`).join('');

        // Dónde va la etiqueta de cada punto. Con una sola serie, siempre
        // arriba. Con varias, la de más arriba en esa columna se rotula arriba
        // y la de más abajo, abajo; las de en medio se callan. Y si las dos
        // están a menos de 22 px, ninguna se dibuja: dos números encimados
        // ("310" sobre "298") no se leen ni con buena vista, y el valor exacto
        // sigue disponible en la tabla que va debajo.
        const colocacion = (ci) => {
            const enColumna = series
                .map((s, si) => ({ si, val: s.valores[ci] }))
                .filter(p => typeof p.val === 'number')
                .sort((a, b) => b.val - a.val);
            if (enColumna.length === 1) return { [enColumna[0].si]: 'arriba' };
            const separacion = Math.abs(y(enColumna[0].val) - y(enColumna[enColumna.length - 1].val));
            if (separacion < 22) return {};
            const mapa = {};
            mapa[enColumna[0].si] = 'arriba';
            mapa[enColumna[enColumna.length - 1].si] = 'abajo';
            return mapa;
        };
        const colocaciones = cats.map((_, ci) => colocacion(ci));

        const trazos = series.map((s, si) => {
            const color = ICFES_VIZ.series[si % ICFES_VIZ.series.length];
            const puntos = s.valores.map((val, i) => (typeof val === 'number' ? `${x(i)},${y(val)}` : null)).filter(Boolean);
            // Anillo del color de la superficie: separa el punto de la línea sin
            // dibujarle un borde oscuro encima.
            const marcas = s.valores.map((val, i) => {
                if (typeof val !== 'number') return '';
                const donde = colocaciones[i][si];
                const etiqueta = donde
                    ? `<text x="${x(i)}" y="${y(val) + (donde === 'arriba' ? -9 : 15)}" text-anchor="middle"
                             font-size="9.5" font-weight="600" fill="${ICFES_VIZ.tintaSuave}"
                             style="font-variant-numeric:tabular-nums">${this.num(val, v.decimales)}</text>` : '';
                return `<circle cx="${x(i)}" cy="${y(val)}" r="4.5" fill="${color}"
                                stroke="${ICFES_VIZ.superficie}" stroke-width="2"/>${etiqueta}`;
            }).join('');
            return `<polyline points="${puntos.join(' ')}" fill="none" stroke="${color}"
                              stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${marcas}`;
        }).join('');

        const etiquetasX = cats.map((cat, i) => `
            <text x="${x(i)}" y="${margen.arriba + altoPlot + 15}" text-anchor="middle"
                  font-size="10.5" fill="${ICFES_VIZ.tintaSuave}">${this.esc(cat)}</text>`).join('');

        const grafico = this.envolver(`
            ${this.titulo(v)}
            ${rejilla}
            <line x1="${margen.izq}" y1="${margen.arriba + altoPlot}" x2="${ICFES_VIZ.W - margen.der}" y2="${margen.arriba + altoPlot}"
                  stroke="${ICFES_VIZ.eje}" stroke-width="1"/>
            ${trazos}
            ${etiquetasX}
            ${v.ejeX?.titulo ? `<text x="${margen.izq + anchoPlot / 2}" y="${margen.arriba + altoPlot + 29}" text-anchor="middle" font-size="10.5" font-weight="600" fill="${ICFES_VIZ.tintaTenue}">${this.esc(v.ejeX.titulo)}</text>` : ''}
            ${hayLeyenda ? this.leyenda(series, margen.arriba + altoPlot + margen.abajo + 4) : ''}
            ${this.nota(v, alto)}
        `, alto);

        // Con varias series el gráfico calla los valores que se encimarían, así
        // que la tabla deja de ser un adorno: es de dónde el estudiante saca la
        // cifra exacta. Y de paso el dato existe para un lector de pantalla.
        const tablaApoyo = hayLeyenda ? this.tabla({
            columnas: [{ nombre: v.ejeX?.titulo || '' },
                       ...series.map(s => ({ nombre: s.nombre, tipo: 'numero', decimales: v.decimales }))],
            filas: cats.map((c, i) => [c, ...series.map(s => s.valores[i])]),
        }) : '';

        return grafico + tablaApoyo;
    },

    // ── Dispersión ──────────────────────────────────────────────────────────
    dispersion(v) {
        const puntos = v.puntos || [];
        const margen = { arriba: v.titulo ? 30 : 12, der: 14, abajo: 34, izq: 36 };
        const altoPlot = 165;
        const alto = margen.arriba + altoPlot + margen.abajo + (v.nota ? 14 : 0);
        const anchoPlot = ICFES_VIZ.W - margen.izq - margen.der;

        const escX = this.escala(Math.max(...puntos.map(p => p.x)), Math.min(0, ...puntos.map(p => p.x)));
        const escY = this.escala(Math.max(...puntos.map(p => p.y)), Math.min(0, ...puntos.map(p => p.y)));
        const px = val => margen.izq + ((val - escX.desde) / (escX.hasta - escX.desde)) * anchoPlot;
        const py = val => margen.arriba + altoPlot - ((val - escY.desde) / (escY.hasta - escY.desde)) * altoPlot;

        const rejilla = escY.cortes.map(c => `
            <line x1="${margen.izq}" y1="${py(c)}" x2="${ICFES_VIZ.W - margen.der}" y2="${py(c)}"
                  stroke="${ICFES_VIZ.rejilla}" stroke-width="1"/>
            <text x="${margen.izq - 6}" y="${py(c) + 3.5}" text-anchor="end" font-size="10"
                  fill="${ICFES_VIZ.tintaTenue}" style="font-variant-numeric:tabular-nums">${this.num(c)}</text>`).join('')
            + escX.cortes.map(c => `
            <text x="${px(c)}" y="${margen.arriba + altoPlot + 15}" text-anchor="middle" font-size="10"
                  fill="${ICFES_VIZ.tintaTenue}" style="font-variant-numeric:tabular-nums">${this.num(c)}</text>`).join('');

        const marcas = puntos.map(p => `
            <circle cx="${px(p.x)}" cy="${py(p.y)}" r="5" fill="${ICFES_VIZ.series[0]}"
                    stroke="${ICFES_VIZ.superficie}" stroke-width="2"/>
            ${p.etiqueta ? `<text x="${px(p.x)}" y="${py(p.y) - 10}" text-anchor="middle" font-size="9.5"
                                  font-weight="600" fill="${ICFES_VIZ.tintaSuave}">${this.esc(p.etiqueta)}</text>` : ''}`).join('');

        return this.envolver(`
            ${this.titulo(v)}
            ${rejilla}
            <line x1="${margen.izq}" y1="${margen.arriba + altoPlot}" x2="${ICFES_VIZ.W - margen.der}" y2="${margen.arriba + altoPlot}" stroke="${ICFES_VIZ.eje}" stroke-width="1"/>
            <line x1="${margen.izq}" y1="${margen.arriba}" x2="${margen.izq}" y2="${margen.arriba + altoPlot}" stroke="${ICFES_VIZ.eje}" stroke-width="1"/>
            ${marcas}
            ${v.ejeX?.titulo ? `<text x="${margen.izq + anchoPlot / 2}" y="${alto - (v.nota ? 18 : 5)}" text-anchor="middle" font-size="10.5" font-weight="600" fill="${ICFES_VIZ.tintaTenue}">${this.esc(v.ejeX.titulo)}</text>` : ''}
            ${v.ejeY?.titulo ? `<text transform="translate(11,${margen.arriba + altoPlot / 2}) rotate(-90)" text-anchor="middle" font-size="10.5" font-weight="600" fill="${ICFES_VIZ.tintaTenue}">${this.esc(v.ejeY.titulo)}</text>` : ''}
            ${this.nota(v, alto)}
        `, alto);
    },

    // ── Circular ────────────────────────────────────────────────────────────
    // Solo para partes de un todo, máximo 6 porciones. Con más, las porciones
    // vecinas dejan de distinguirse y conviene una tabla o barras.
    circular(v) {
        const datos = (v.porciones || []).slice(0, 6);
        const total = datos.reduce((s, d) => s + d.valor, 0) || 1;
        const R = 62, cx = 74, cy = 82;
        const alto = 175 + (v.nota ? 14 : 0);

        let angulo = -Math.PI / 2;   // Arranca arriba, como se espera.
        // Sectores pegados, sin hueco entre ellos: la separación angular dejaba
        // rendijas blancas que se leían como si faltara un pedazo de la torta.
        // Los colores vecinos ya se distinguen solos (la paleta se validó para
        // eso), así que el hueco no estaba haciendo ninguna falta.
        const sectores = datos.map((d, i) => {
            const porcion = d.valor / total;
            const barrido = porcion * Math.PI * 2;
            const a0 = angulo, a1 = angulo + barrido;
            angulo += barrido;
            const x0 = cx + R * Math.cos(a0), y0 = cy + R * Math.sin(a0);
            const x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
            const largo = barrido > Math.PI ? 1 : 0;
            const medio = (a0 + a1) / 2;
            // El porcentaje solo entra en la porción si cabe; si no, vive en la
            // leyenda. Un número recortado por su propia porción es peor que
            // no ponerlo.
            const etiqueta = porcion > 0.08
                ? `<text x="${cx + R * 0.62 * Math.cos(medio)}" y="${cy + R * 0.62 * Math.sin(medio) + 4}"
                         text-anchor="middle" font-size="11" font-weight="600" fill="#ffffff"
                         style="font-variant-numeric:tabular-nums">${Math.round(porcion * 100)}%</text>` : '';
            return `<path d="M ${cx} ${cy} L ${x0} ${y0} A ${R} ${R} 0 ${largo} 1 ${x1} ${y1} Z"
                          fill="${ICFES_VIZ.series[i % ICFES_VIZ.series.length]}"/>${etiqueta}`;
        }).join('');

        const leyenda = datos.map((d, i) => `
            <g transform="translate(160,${28 + i * 21})">
                <rect width="11" height="11" fill="${ICFES_VIZ.series[i % ICFES_VIZ.series.length]}"/>
                <text x="17" y="9.5" font-size="10.5" fill="${ICFES_VIZ.tintaSuave}">${this.esc(d.nombre)}</text>
                <text x="${ICFES_VIZ.W - 160}" y="9.5" text-anchor="end" font-size="10.5" font-weight="600"
                      fill="${ICFES_VIZ.tinta}" style="font-variant-numeric:tabular-nums">${this.num(d.valor, v.decimales)}${v.unidad ? ' ' + this.esc(v.unidad) : ''}</text>
            </g>`).join('');

        return this.envolver(`
            ${this.titulo(v, 12)}
            <g transform="translate(0,${v.titulo ? 12 : 0})">${sectores}</g>
            ${leyenda}
            ${this.nota(v, alto)}
        `, alto);
    },

    // ── Leyenda ─────────────────────────────────────────────────────────────
    // Siempre presente con 2 o más series: la identidad no puede depender solo
    // del color.
    leyenda(series, y) {
        const anchoItem = ICFES_VIZ.W / Math.min(series.length, 3);
        return series.map((s, i) => `
            <g transform="translate(${(i % 3) * anchoItem},${y + Math.floor(i / 3) * 18})">
                <rect width="11" height="11" fill="${ICFES_VIZ.series[i % ICFES_VIZ.series.length]}"/>
                <text x="16" y="9.5" font-size="10.5" fill="${ICFES_VIZ.tintaSuave}">${this.esc(s.nombre)}</text>
            </g>`).join('');
    },

    // ── Validación ──────────────────────────────────────────────────────────
    // Corre en el admin ANTES de que un ítem llegue a la cola: un gráfico mal
    // formado se ve roto, y descubrirlo revisando cuesta la atención de quien
    // revisa, que es el recurso escaso del módulo.
    validar(crudo) {
        const fallos = [];
        const v = this.normalizar(crudo);
        if (!v) return fallos;
        const TIPOS = ['tabla', 'barras', 'barras_agrupadas', 'lineas', 'dispersion', 'circular'];
        if (!TIPOS.includes(v.tipo)) { fallos.push(`Tipo de material desconocido: "${v.tipo}".`); return fallos; }

        if (v.tipo === 'tabla') {
            const cols = v.columnas || [];
            if (cols.length < 2) fallos.push('La tabla necesita al menos 2 columnas.');
            if (!(v.filas || []).length) fallos.push('La tabla no tiene filas.');
            (v.filas || []).forEach((f, i) => {
                if (f.length !== cols.length) fallos.push(`La fila ${i + 1} tiene ${f.length} celdas y hay ${cols.length} columnas.`);
            });
        } else if (v.tipo === 'circular') {
            const p = v.porciones || [];
            if (p.length < 3) fallos.push('Un circular con menos de 3 porciones se lee mejor como dato suelto o barras.');
            if (p.length > 6) fallos.push('Más de 6 porciones: las vecinas dejan de distinguirse. Usa barras o tabla.');
            if (p.some(x => typeof x.valor !== 'number' || x.valor < 0)) fallos.push('Hay porciones sin valor numérico positivo.');
        } else if (v.tipo === 'dispersion') {
            if ((v.puntos || []).length < 4) fallos.push('Una dispersión con menos de 4 puntos no muestra ninguna relación.');
            if ((v.puntos || []).some(p => typeof p.x !== 'number' || typeof p.y !== 'number')) fallos.push('Hay puntos sin coordenadas numéricas.');
        } else {
            const cats = v.categorias || [];
            const series = this.normalizarSeries(v);
            if (!cats.length) fallos.push('Faltan las categorías del eje.');
            if (!series.length || !series.some(s => s.valores.length)) fallos.push('No hay datos que dibujar.');
            series.forEach(s => {
                if (s.valores.length !== cats.length) fallos.push(`La serie "${s.nombre || 'sin nombre'}" tiene ${s.valores.length} valores y hay ${cats.length} categorías.`);
            });
            if (series.length > 1 && series.some(s => !s.nombre)) fallos.push('Con más de una serie, cada una necesita nombre: la leyenda es lo que evita que el color sea la única pista.');
            if (series.length > 6) fallos.push('Más de 6 series: los colores dejan de ser distinguibles.');
        }
        return fallos;
    },

    // Texto equivalente del material, para la revisión y para dejar constancia
    // de que el dato existe fuera del dibujo.
    aTexto(crudo) {
        const v = this.normalizar(crudo);
        if (!v) return '';
        if (v.tipo === 'tabla') {
            const cols = (v.columnas || []).map(c => (typeof c === 'string' ? c : c.nombre));
            return [cols.join(' | '), ...(v.filas || []).map(f => f.join(' | '))].join('\n');
        }
        if (v.tipo === 'circular') return (v.porciones || []).map(p => `${p.nombre}: ${p.valor}`).join(', ');
        if (v.tipo === 'dispersion') return (v.puntos || []).map(p => `(${p.x}, ${p.y})`).join(' · ');
        const series = this.normalizarSeries(v);
        return series.map(s => `${s.nombre ? s.nombre + ': ' : ''}${(v.categorias || []).map((c, i) => `${c}=${s.valores[i]}`).join(', ')}`).join('\n');
    },
};
