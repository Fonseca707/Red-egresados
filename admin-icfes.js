// admin-icfes.js — Fábrica de ítems del Saber 11: generar con IA, validar,
// revisar a mano y publicar.
//
// La regla dura del módulo: un ítem que no aprobó una persona NUNCA se le sirve
// a un estudiante. La IA propone, las validaciones filtran lo peor de forma
// barata y automática, y el humano decide. Mismo patrón que el estudio de audio.
//
// ⚖️ Los cuadernillos oficiales prohíben el uso con fines de lucro y la
// transformación. De ellos sale la FORMA (cómo pregunta el ICFES), nunca el
// contenido: los textos y enunciados que se generan aquí son originales.

const PROXY_ITEMS = 'https://sinapsis-ia.sinapsis-lcp.workers.dev/items';

const icfesAdmin = {
    propuestas: [],   // ítems generados, aún sin guardar
    estimulo: null,   // texto compartido del lote (solo Lectura Crítica)
    banco: [],

    // ── El prompt: aquí se juega la fidelidad ───────────────────────────────
    // Se genera contra una EVIDENCIA concreta, no contra una competencia
    // genérica. Y se impone la forma "veredicto + justificación", que es como
    // pregunta el examen real y lo que una IA nunca produce por su cuenta: su
    // instinto es "calcule el valor de x" con cuatro números, que tiene la
    // apariencia correcta y el fondo equivocado.
    construirPrompt({ prueba, afirmacion, evidencia, cuantos, tipoTexto, categoria, contexto, generico, dificultad }) {
        const a = ICFES_AFIRMACIONES[afirmacion];
        const comun = `
Genera ${cuantos} preguntas ORIGINALES para la prueba de ${ICFES_PRUEBAS[prueba].nombre} del examen Saber 11 del ICFES (Colombia).

MARCO OFICIAL (respétalo al pie de la letra):
- Competencia/afirmación: ${a.nombre}
- Evidencia que debe quedar demostrada: ${a.evidencias[evidencia] || evidencia}
- Dificultad objetivo: ${dificultad} de 4.

REGLAS INNEGOCIABLES:
- Exactamente 4 opciones (A, B, C, D) y UNA sola correcta.
- Prohibido "todas las anteriores" y "ninguna de las anteriores": el ICFES no los usa.
- Las 4 opciones deben ser de largo parecido. Si la correcta es siempre la más larga, el examen se vuelve adivinable sin leer.
- Los distractores deben ser errores PLAUSIBLES de un estudiante de grado 11, no opciones absurdas.
- Contenido 100% original. No copies ni parafrasees textos de cuadernillos publicados.
- Español de Colombia, natural, sin tecnicismos innecesarios.
- Para CADA opción escribe una justificación breve que explique por qué es correcta o por qué es un error tentador. Esa justificación es lo que el estudiante lee después de responder.`;

        const especifico = prueba === 'lectura_critica' ? `
TEXTO BASE: escribe UN texto original de tipo "${ICFES_TIPOS_TEXTO[tipoTexto]?.nombre}" (${ICFES_TIPOS_TEXTO[tipoTexto]?.ayuda}) de 180 a 300 palabras, y que las ${cuantos} preguntas se respondan LEYENDO ESE TEXTO.
${tipoTexto === 'info_filosofico' ? 'IMPORTANTE: un texto filosófico evalúa estructura, ideas y argumentos. NO preguntes por historia de la filosofía ni por qué sostenía tal autor.' : ''}
${tipoTexto.includes('discontinuo') ? 'Al ser discontinuo, descríbelo en palabras de forma que se entienda sin imagen (por ejemplo, una tabla escrita con sus filas, o la descripción de las viñetas de una caricatura).' : ''}` : `
CONTEXTO: la situación debe ser real y concreta (${ICFES_CONTEXTOS[contexto]}), con datos presentados en una tabla escrita o en el enunciado. Nunca un ejercicio pelado tipo "resuelva la ecuación".
CONTENIDO: ${ICFES_CATEGORIAS_MAT[categoria]?.nombre} — ${generico ? 'usa solo conocimientos genéricos: ' + ICFES_CATEGORIAS_MAT[categoria]?.genericos : 'puedes usar contenidos no genéricos: ' + ICFES_CATEGORIAS_MAT[categoria]?.noGenericos}.

FORMA DE LA PREGUNTA (lo más importante): al menos la mitad deben ser de tipo VEREDICTO + JUSTIFICACIÓN, como el examen real. Es decir: alguien AFIRMA algo sobre la situación y el estudiante juzga si es correcto y por qué. Las opciones se ven así:
  A. Sí, porque el promedio subió en los tres cursos.
  B. Sí, porque la muestra es representativa.
  C. No, porque el aumento se dio solo en un curso.
  D. No, porque los datos no permiten comparar.
El ICFES casi nunca pregunta "¿cuánto da?". Pregunta "¿es válido este razonamiento?".`;

        return `${comun}\n${especifico}\n
Responde SOLO con este JSON, sin markdown ni explicaciones:
{${prueba === 'lectura_critica' ? '\n  "estimulo": { "titulo": "...", "texto": "...", "fuente": "texto original para práctica" },' : ''}
  "items": [
    {
      "enunciado": "...",
      "opciones": ["...", "...", "...", "..."],
      "clave": 0,
      "justificaciones": ["por qué A", "por qué B", "por qué C", "por qué D"],
      "forma": "${prueba === 'matematicas' ? 'veredicto_justificacion' : 'interpretacion_dato'}",
      "dificultad": ${dificultad}
    }
  ]
}`;
    },

    // ── Validaciones automáticas ────────────────────────────────────────────
    // Baratas, deterministas y ejecutadas ANTES de la cola humana: atrapan lo
    // peor de la IA sin gastar la atención de quien revisa.
    validar(item, contexto = {}) {
        const fallos = [];
        const ops = item.opciones || [];

        if (ops.length !== 4) fallos.push('No tiene exactamente 4 opciones.');
        if (!(item.clave >= 0 && item.clave <= 3)) fallos.push('La clave no apunta a una opción válida.');
        if (ops.some(o => !String(o || '').trim())) fallos.push('Hay opciones vacías.');
        if (new Set(ops.map(o => String(o).trim().toLowerCase())).size !== ops.length) fallos.push('Hay opciones repetidas.');
        if (!String(item.enunciado || '').trim()) fallos.push('El enunciado está vacío.');

        const prohibidas = /(todas|ninguna) de las anteriores|ambas son correctas/i;
        if (ops.some(o => prohibidas.test(String(o)))) fallos.push('Usa "todas/ninguna de las anteriores": el ICFES no los usa.');

        // Sesgo clásico: si la correcta es notoriamente la más larga, el test se
        // acierta sin leer el texto.
        const largos = ops.map(o => String(o).length);
        const correcta = largos[item.clave] || 0;
        const otras = largos.filter((_, i) => i !== item.clave);
        if (otras.length && correcta > Math.max(...otras) * 1.6) {
            fallos.push('La opción correcta es mucho más larga que las demás (se vuelve adivinable).');
        }

        if ((item.justificaciones || []).filter(j => String(j || '').trim()).length !== 4) {
            fallos.push('Faltan justificaciones: se necesitan las 4, son la retroalimentación del estudiante.');
        }
        if (contexto.prueba === 'lectura_critica' && !contexto.hayEstimulo) {
            fallos.push('Lectura Crítica sin texto base: toda pregunta debe apoyarse en un texto.');
        }
        return fallos;
    },

    // Validación del LOTE, no del ítem: la cuota de forma solo tiene sentido
    // mirando el conjunto.
    validarLote(items, prueba) {
        const avisos = [];
        if (prueba === 'matematicas' && items.length >= 2) {
            const veredicto = items.filter(i => i.forma === 'veredicto_justificacion').length;
            if (veredicto / items.length < ICFES_MIN_VEREDICTO_MAT) {
                avisos.push(`Solo ${veredicto} de ${items.length} preguntas son de "veredicto + justificación". El examen real pregunta casi siempre así — revisa si estas se parecen de verdad al ICFES.`);
            }
        }
        return avisos;
    },

    // ── Generar ─────────────────────────────────────────────────────────────
    async generar() {
        const prueba = document.getElementById('icfes-prueba').value;
        const afirmacion = document.getElementById('icfes-afirmacion').value;
        const evidencia = document.getElementById('icfes-evidencia').value;
        const cuantos = Number(document.getElementById('icfes-cuantos').value) || 3;
        const dificultad = Number(document.getElementById('icfes-dificultad').value) || 2;
        const tipoTexto = document.getElementById('icfes-tipo-texto').value;
        const categoria = document.getElementById('icfes-categoria').value;
        const contexto = document.getElementById('icfes-contexto').value;
        const generico = document.getElementById('icfes-generico').value === 'si';

        const boton = document.getElementById('icfes-btn-generar');
        boton.disabled = true; boton.textContent = 'Generando…';
        this.aviso('Generando preguntas contra el blueprint oficial. Tarda entre 20 y 60 segundos.', 'info');
        try {
            const token = await auth.currentUser.getIdToken();
            const respuesta = await fetch(PROXY_ITEMS, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    instruccion: this.construirPrompt({ prueba, afirmacion, evidencia, cuantos, tipoTexto, categoria, contexto, generico, dificultad })
                })
            });
            const datos = await respuesta.json();
            if (!respuesta.ok) throw new Error(datos.error || `respondió ${respuesta.status}`);

            const crudo = String(datos.texto || '').replace(/^```(json)?|```$/gm, '').trim();
            let parseado;
            try { parseado = JSON.parse(crudo); }
            catch { throw new Error('El generador no devolvió JSON válido. Vuelve a intentar.'); }

            this.estimulo = parseado.estimulo || null;
            this.propuestas = (parseado.items || []).map((it, i) => ({
                ...it,
                _id: `p${Date.now()}_${i}`,
                prueba, afirmacion, evidencia, dificultad: it.dificultad || dificultad,
                tipoTexto: prueba === 'lectura_critica' ? tipoTexto : '',
                categoria: prueba === 'matematicas' ? categoria : '',
                contexto: prueba === 'matematicas' ? contexto : '',
                generico: prueba === 'matematicas' ? generico : null,
                _fallos: this.validar(it, { prueba, hayEstimulo: !!parseado.estimulo })
            }));

            const avisos = this.validarLote(this.propuestas, prueba);
            const limpias = this.propuestas.filter(p => !p._fallos.length).length;
            this.aviso(`${this.propuestas.length} preguntas generadas · ${limpias} pasaron las validaciones automáticas. Ahora revísalas una por una: ninguna llega al estudiante hasta que la apruebes.${avisos.length ? ' ⚠️ ' + avisos.join(' ') : ''}`, avisos.length ? 'info' : 'ok');
            this.pintarPropuestas();
        } catch (e) {
            this.aviso(`No se pudo generar: ${e.message}`, 'error');
        } finally {
            boton.disabled = false; boton.textContent = 'Generar preguntas';
        }
    },

    // ── Cola de revisión ────────────────────────────────────────────────────
    pintarPropuestas() {
        const caja = document.getElementById('icfes-propuestas');
        if (!caja) return;
        if (!this.propuestas.length) { caja.innerHTML = ''; return; }

        const cabecera = this.estimulo ? `
            <div class="bg-gray-50 border border-gray-200 rounded-2xl p-5 mb-4">
                <p class="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Texto base del lote</p>
                <p class="font-bold text-gray-900 mb-2">${this.escapar(this.estimulo.titulo || '')}</p>
                <p class="text-sm text-gray-700 whitespace-pre-line leading-relaxed">${this.escapar(this.estimulo.texto || '')}</p>
            </div>` : '';

        caja.innerHTML = cabecera + this.propuestas.map((p, indice) => {
            const opciones = (p.opciones || []).map((o, i) => `
                <div class="flex items-start gap-2 ${i === p.clave ? 'text-green-700 font-bold' : 'text-gray-600'}">
                    <span class="shrink-0">${'ABCD'[i]}.</span>
                    <span class="flex-1">${this.escapar(o)}
                        <span class="block text-xs font-normal text-gray-400 mt-0.5">${this.escapar((p.justificaciones || [])[i] || '')}</span>
                    </span>
                </div>`).join('');
            return `
            <div class="border ${p._fallos.length ? 'border-red-200 bg-red-50/30' : 'border-gray-200'} rounded-2xl p-5 mb-3">
                <div class="flex items-start justify-between gap-3 mb-3 flex-wrap">
                    <p class="text-sm font-bold text-gray-900 flex-1 min-w-[240px]">${this.escapar(p.enunciado || '')}</p>
                    <div class="flex gap-2 shrink-0">
                        <button onclick="icfesAdmin.aprobar('${p._id}')" class="px-4 py-2 bg-brand-600 text-white text-xs font-bold rounded-lg hover:bg-brand-700 transition">Aprobar y publicar</button>
                        <button onclick="icfesAdmin.descartar('${p._id}')" class="px-3 py-2 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-200 transition">Descartar</button>
                    </div>
                </div>
                <div class="space-y-2 text-sm">${opciones}</div>
                ${p._fallos.length ? `
                <div class="mt-3 pt-3 border-t border-red-200">
                    <p class="text-xs font-bold text-red-700 mb-1">No pasó las validaciones automáticas:</p>
                    <ul class="text-xs text-red-600 list-disc list-inside">${p._fallos.map(f => `<li>${this.escapar(f)}</li>`).join('')}</ul>
                    <p class="text-[11px] text-red-500 mt-1">Puedes aprobarla igual si a tu juicio está bien, pero míralo dos veces.</p>
                </div>` : ''}
            </div>`;
        }).join('');
    },

    async aprobar(id) {
        const p = this.propuestas.find(x => x._id === id);
        if (!p) return;
        try {
            // El estímulo se guarda UNA vez por lote: en Lectura Crítica un mismo
            // texto alimenta varias preguntas y duplicarlo haría que el motor lo
            // mostrara como si fueran textos distintos.
            if (this.estimulo && !this.estimulo._guardadoId) {
                const ref = await examStimuliCollection.add({
                    prueba: p.prueba, tipoTexto: p.tipoTexto,
                    titulo: this.estimulo.titulo || '', texto: this.estimulo.texto || '',
                    fuente: this.estimulo.fuente || 'Texto original para práctica',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                this.estimulo._guardadoId = ref.id;
            }
            await examItemsCollection.add({
                exam: 'ICFES',
                prueba: p.prueba, afirmacion: p.afirmacion, evidencia: p.evidencia,
                tipoTexto: p.tipoTexto || '', categoria: p.categoria || '',
                contexto: p.contexto || '', generico: p.generico,
                forma: p.forma || '', estimuloId: this.estimulo?._guardadoId || null,
                enunciado: p.enunciado, opciones: p.opciones, clave: p.clave,
                justificaciones: p.justificaciones || [],
                dificultad: p.dificultad || 2,
                origen: 'ia',
                revisado: true,                       // lo aprobó una persona: es el gate
                revisadoPor: state.user?.email || '',
                revisadoAt: firebase.firestore.FieldValue.serverTimestamp(),
                school: '', active: true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            this.propuestas = this.propuestas.filter(x => x._id !== id);
            this.pintarPropuestas();
            this.aviso('Pregunta publicada. Ya entra en las sesiones de entrenamiento.', 'ok');
            this.cargarBanco();
        } catch (e) {
            this.aviso(`No se pudo publicar: ${e.message}`, 'error');
        }
    },

    descartar(id) {
        this.propuestas = this.propuestas.filter(x => x._id !== id);
        this.pintarPropuestas();
    },

    // ── Banco publicado (camino de visualización) ────────────────────────────
    // Sin esto no se sabe si el banco alcanza para una sesión ni si la cuota
    // oficial se está cumpliendo — que es justo lo que hace fiel al módulo.
    async cargarBanco() {
        const caja = document.getElementById('icfes-banco');
        if (!caja) return;
        try {
            const snap = await examItemsCollection.where('exam', '==', 'ICFES').get();
            this.banco = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
            caja.innerHTML = `<p class="text-sm text-red-600">No se pudo leer el banco: ${this.escapar(e.message)}</p>`;
            return;
        }
        if (!this.banco.length) {
            caja.innerHTML = '<p class="text-sm text-gray-500">El banco está vacío. Genera y aprueba preguntas para que los estudiantes puedan entrenar.</p>';
            return;
        }
        caja.innerHTML = Object.keys(ICFES_PRUEBAS).map(prueba => {
            const items = this.banco.filter(i => i.prueba === prueba && i.revisado);
            if (!items.length) return '';
            const filas = icfesAfirmacionesDe(prueba).map(a => {
                const n = items.filter(i => i.afirmacion === a.codigo).length;
                const idealPct = Math.round(a.cuota * 100);
                const realPct = Math.round((n / items.length) * 100);
                const desviado = Math.abs(realPct - idealPct) > 12;
                return `
                    <div class="flex items-center justify-between gap-3 text-sm py-1">
                        <span class="text-gray-700">${this.escapar(a.corto)}</span>
                        <span class="shrink-0 ${desviado ? 'text-amber-600 font-bold' : 'text-gray-500'}">
                            ${n} · ${realPct}% <span class="text-gray-300">/ ${idealPct}% oficial</span>
                        </span>
                    </div>`;
            }).join('');
            return `
                <div class="border border-gray-200 rounded-2xl p-4 mb-3">
                    <p class="font-bold text-sm text-gray-900 mb-2">${this.escapar(ICFES_PRUEBAS[prueba].nombre)} · ${items.length} preguntas publicadas</p>
                    ${filas}
                    <p class="text-[11px] text-gray-400 mt-2">En ámbar, las competencias que se alejan más de 12 puntos de la cuota oficial: ahí conviene generar más.</p>
                </div>`;
        }).join('') || '<p class="text-sm text-gray-500">Aún no hay preguntas aprobadas.</p>';
    },

    // ── UI reactiva del formulario ──────────────────────────────────────────
    onPruebaChange() {
        const prueba = document.getElementById('icfes-prueba').value;
        const esLC = prueba === 'lectura_critica';
        document.getElementById('icfes-lc-campos').classList.toggle('hidden', !esLC);
        document.getElementById('icfes-mat-campos').classList.toggle('hidden', esLC);

        const sel = document.getElementById('icfes-afirmacion');
        sel.innerHTML = icfesAfirmacionesDe(prueba)
            .map(a => `<option value="${a.codigo}">${this.escapar(a.corto)} — ${Math.round(a.cuota * 100)}% del examen</option>`).join('');
        this.onAfirmacionChange();
    },

    onAfirmacionChange() {
        const a = ICFES_AFIRMACIONES[document.getElementById('icfes-afirmacion').value];
        const sel = document.getElementById('icfes-evidencia');
        sel.innerHTML = Object.entries(a?.evidencias || {})
            .map(([cod, texto]) => `<option value="${cod}">${cod} — ${this.escapar(texto)}</option>`).join('');
    },

    aviso(texto, tipo) {
        const caja = document.getElementById('icfes-aviso');
        if (!caja) return;
        const colores = { ok: 'bg-green-50 text-green-800 border-green-200', error: 'bg-red-50 text-red-700 border-red-200', info: 'bg-blue-50 text-blue-800 border-blue-200' };
        caja.className = `text-sm border rounded-xl px-4 py-3 ${colores[tipo] || colores.info}`;
        caja.textContent = texto;
        caja.classList.remove('hidden');
    },

    escapar(t) {
        return String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },

    montar() {
        const prueba = document.getElementById('icfes-prueba');
        if (prueba && !prueba.options.length) {
            prueba.innerHTML = Object.entries(ICFES_PRUEBAS).map(([id, p]) => `<option value="${id}">${p.nombre}</option>`).join('');
            document.getElementById('icfes-tipo-texto').innerHTML = Object.entries(ICFES_TIPOS_TEXTO)
                .map(([id, t]) => `<option value="${id}">${t.nombre} — ${Math.round(t.cuota * 100)}%</option>`).join('');
            document.getElementById('icfes-categoria').innerHTML = Object.entries(ICFES_CATEGORIAS_MAT)
                .map(([id, c]) => `<option value="${id}">${c.nombre}</option>`).join('');
            document.getElementById('icfes-contexto').innerHTML = Object.entries(ICFES_CONTEXTOS)
                .map(([id, c]) => `<option value="${id}">${c}</option>`).join('');
            this.onPruebaChange();
        }
        this.cargarBanco();
    }
};

window.icfesAdmin = icfesAdmin;
