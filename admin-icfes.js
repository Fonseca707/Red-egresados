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
    propuestas: [],   // pendientes de revisión (leídas de Firestore)
    estimulos: {},    // textos base de esas pendientes, por id
    editandoId: null, // tarjeta abierta en modo edición
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
- NUNCA atribuyas el texto a una fuente real (ni entidad, ni autor, ni publicación, ni año). Nada de "Alcaldía de…", "Ministerio de…", "según El Tiempo". El texto es original para práctica y así debe quedar.
- NO escribas la letra de la opción dentro del texto de la opción: escribe "Cada ejemplo pertenece…", no "A. Cada ejemplo pertenece…".
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

    // Saca el JSON aunque el modelo lo envuelva. Un `JSON.parse` a secas tira
    // el lote entero por un ``` de más o una frase de cortesía delante, y ese
    // lote ya se pagó: en la primera tanda se perdieron 2 de 9 así.
    extraerJSON(texto) {
        const limpio = texto.replace(/```(json)?/gi, '').trim();
        const intentos = [limpio];

        // Bloque balanceado: sirve cuando el modelo escribe algo antes o después.
        const inicio = limpio.indexOf('{');
        if (inicio >= 0) {
            let nivel = 0, enCadena = false, escapado = false;
            for (let i = inicio; i < limpio.length; i++) {
                const c = limpio[i];
                if (escapado) { escapado = false; continue; }
                if (c === '\\') { escapado = true; continue; }
                if (c === '"') enCadena = !enCadena;
                if (enCadena) continue;
                if (c === '{') nivel++;
                else if (c === '}' && --nivel === 0) { intentos.push(limpio.slice(inicio, i + 1)); break; }
            }
        }
        // Comillas tipográficas: el modelo las mete al escribir en español y
        // rompen el JSON aunque el contenido esté perfecto.
        intentos.push(...intentos.map(s => s.replace(/[\u201C\u201D]/g, '\\"').replace(/[\u2018\u2019]/g, "'")));

        for (const candidato of intentos) {
            try {
                const obj = JSON.parse(candidato);
                if (obj && Array.isArray(obj.items) && obj.items.length) return obj;
            } catch (e) { /* siguiente intento */ }
        }
        throw new Error('El generador no devolvió JSON utilizable (puede haberse cortado por longitud). Prueba con menos preguntas por lote.');
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

            const parseado = this.extraerJSON(String(datos.texto || ''));

            const lote = (parseado.items || []).map(it => ({
                ...it,
                prueba, afirmacion, evidencia, dificultad: it.dificultad || dificultad,
                tipoTexto: prueba === 'lectura_critica' ? tipoTexto : '',
                categoria: prueba === 'matematicas' ? categoria : '',
                contexto: prueba === 'matematicas' ? contexto : '',
                generico: prueba === 'matematicas' ? generico : null
            }));

            const guardados = await this.guardarPendientes(lote, parseado.estimulo || null, prueba, tipoTexto);
            const avisos = this.validarLote(lote, prueba);
            const limpias = guardados.filter(p => !p._fallos.length).length;
            this.aviso(`${guardados.length} preguntas generadas · ${limpias} pasaron las validaciones automáticas. Quedaron guardadas en la cola de revisión: ninguna llega a un estudiante hasta que la apruebes, y puedes revisarlas cuando quieras, desde cualquier equipo.${avisos.length ? ' ⚠️ ' + avisos.join(' ') : ''}`, avisos.length ? 'info' : 'ok');
            await this.cargarPendientes();
        } catch (e) {
            this.aviso(`No se pudo generar: ${e.message}`, 'error');
        } finally {
            boton.disabled = false; boton.textContent = 'Generar preguntas';
        }
    },

    // ── Cola de revisión (vive en Firestore, no en la pestaña) ──────────────
    // Antes las propuestas solo existían en memoria: cerrar la pestaña las
    // perdía y no se podía generar hoy para revisar mañana. Ahora nacen
    // guardadas con `revisado: false`, que es exactamente lo que el motor exige
    // para NO servírselas a un estudiante. La cola es la lista de pendientes.
    async guardarPendientes(items, estimulo, prueba, tipoTexto) {
        let estimuloId = null;
        // El texto se guarda UNA vez por lote: en Lectura Crítica un mismo texto
        // alimenta varias preguntas y duplicarlo haría que el motor lo mostrara
        // como si fueran textos distintos.
        if (estimulo) {
            const ref = await examStimuliCollection.add({
                prueba, tipoTexto: tipoTexto || '',
                titulo: estimulo.titulo || '', texto: estimulo.texto || '',
                // La fuente NO se toma del modelo: firmó un texto inventado como
                // "Manual de la Alcaldía de Bogotá, 2023". Un texto de práctica no
                // puede presentarse como documento de una entidad real.
                fuente: 'Texto original para práctica · Sinapsis',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            estimuloId = ref.id;
        }
        const guardados = [];
        for (const it of items) {
            // El modelo mete la letra dentro de la opción ("A. Cada ejemplo…") y
            // la UI le antepone otra, quedando "A. A. Cada ejemplo…".
            it.opciones = (it.opciones || []).map(o => String(o).replace(/^\s*[A-D][.)]\s+/, '').trim());
            const fallos = this.validar(it, { prueba, hayEstimulo: !!estimuloId });
            const doc = {
                exam: 'ICFES',
                prueba: it.prueba, afirmacion: it.afirmacion, evidencia: it.evidencia,
                tipoTexto: it.tipoTexto || '', categoria: it.categoria || '',
                contexto: it.contexto || '', generico: it.generico ?? null,
                forma: it.forma || '', estimuloId,
                enunciado: it.enunciado || '', opciones: it.opciones || [],
                clave: Number(it.clave) || 0, justificaciones: it.justificaciones || [],
                dificultad: it.dificultad || 2,
                origen: 'ia',
                revisado: false,          // ← el gate: sin aprobación humana no se sirve
                validaciones: fallos,     // se guardan para que la cola las muestre
                school: '', active: true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            const ref = await examItemsCollection.add(doc);
            guardados.push({ id: ref.id, ...doc, _fallos: fallos });
        }
        return guardados;
    },

    async cargarPendientes() {
        const caja = document.getElementById('icfes-propuestas');
        if (!caja) return;
        try {
            const snap = await examItemsCollection.where('exam', '==', 'ICFES').where('revisado', '==', false).get();
            this.propuestas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
            caja.innerHTML = '<p class="text-sm text-red-600">No se pudo leer la cola: ' + this.escapar(e.message) + '</p>';
            return;
        }
        // Los textos base de las pendientes, sin los cuales no se puede juzgar
        // una pregunta de Lectura Crítica.
        this.estimulos = {};
        const ids = [...new Set(this.propuestas.map(p => p.estimuloId).filter(Boolean))];
        for (const id of ids) {
            try {
                const d = await examStimuliCollection.doc(id).get();
                if (d.exists) this.estimulos[id] = d.data();
            } catch (e) { /* si falta el texto, la pregunta se muestra igual */ }
        }
        this.pintarPropuestas();
    },

    pintarPropuestas() {
        const caja = document.getElementById('icfes-propuestas');
        if (!caja) return;
        if (!this.propuestas.length) {
            caja.innerHTML = '<p class="text-sm text-gray-500 mt-4">No hay preguntas esperando revisión.</p>';
            return;
        }

        // Agrupadas por texto base: revisar seguidas las preguntas de un mismo
        // texto es mucho más rápido que saltar de un texto a otro.
        const grupos = {};
        this.propuestas.forEach(p => { (grupos[p.estimuloId || '_sin'] = grupos[p.estimuloId || '_sin'] || []).push(p); });

        caja.innerHTML = `
            <div class="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <p class="text-sm font-bold text-gray-900">${this.propuestas.length} preguntas esperando tu revisión</p>
                <button onclick="icfesAdmin.cargarPendientes()" class="text-xs font-bold text-brand-600 hover:underline">Actualizar</button>
            </div>` +
            Object.entries(grupos).map(([eid, items]) => {
                const est = this.estimulos && this.estimulos[eid];
                const cabecera = est ? `
                    <div class="bg-gray-50 border border-gray-200 rounded-2xl p-5 mb-3">
                        <p class="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Texto base · ${items.length} pregunta(s)</p>
                        <p class="font-bold text-gray-900 mb-2">${this.escapar(est.titulo || '')}</p>
                        <p class="text-sm text-gray-700 whitespace-pre-line leading-relaxed">${this.escapar(est.texto || '')}</p>
                    </div>` : '';
                return cabecera + items.map(p => this.tarjeta(p)).join('');
            }).join('');
    },

    tarjeta(p) {
        const a = ICFES_AFIRMACIONES[p.afirmacion];
        const fallos = p.validaciones || p._fallos || [];

        if (this.editandoId === p.id) {
            // Edición en la propia tarjeta: para arreglar una coma o cambiar la
            // clave no hace falta volver a generar (ni volver a pagar).
            return `
            <div class="border-2 border-brand-400 rounded-2xl p-5 mb-3 bg-brand-50/20">
                <label class="input-label">Enunciado</label>
                <textarea id="ed-enunciado" class="input-field text-sm" rows="3">${this.escapar(p.enunciado)}</textarea>
                ${(p.opciones || []).map((o, i) => `
                    <div class="mt-3">
                        <label class="input-label flex items-center gap-2">
                            <input type="radio" name="ed-clave" value="${i}" ${i === p.clave ? 'checked' : ''}> Opción ${'ABCD'[i]}${i === p.clave ? ' (correcta)' : ''}
                        </label>
                        <input id="ed-op-${i}" class="input-field text-sm" value="${this.escapar(o)}">
                        <input id="ed-just-${i}" class="input-field text-xs mt-1" placeholder="Por qué esta opción está bien o mal" value="${this.escapar((p.justificaciones || [])[i] || '')}">
                    </div>`).join('')}
                <div class="flex justify-end gap-2 mt-4">
                    <button onclick="icfesAdmin.guardarEdicion('${p.id}')" class="px-4 py-2 bg-brand-600 text-white text-xs font-bold rounded-lg hover:bg-brand-700 transition">Guardar cambios</button>
                    <button onclick="icfesAdmin.cancelarEdicion()" class="px-3 py-2 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-200 transition">Cancelar</button>
                </div>
            </div>`;
        }

        const opciones = (p.opciones || []).map((o, i) => `
            <div class="flex items-start gap-2 ${i === p.clave ? 'text-green-700 font-bold' : 'text-gray-600'}">
                <span class="shrink-0">${'ABCD'[i]}.</span>
                <span class="flex-1">${this.escapar(o)}
                    <span class="block text-xs font-normal text-gray-400 mt-0.5">${this.escapar((p.justificaciones || [])[i] || '')}</span>
                </span>
            </div>`).join('');

        return `
            <div class="border ${fallos.length ? 'border-red-200 bg-red-50/30' : 'border-gray-200'} rounded-2xl p-5 mb-3">
                <div class="flex items-start justify-between gap-3 mb-3 flex-wrap">
                    <div class="flex-1 min-w-[240px]">
                        <p class="text-[11px] text-gray-400 mb-1">${this.escapar(a ? a.corto : '')} · evidencia ${this.escapar(p.evidencia || '')} · dificultad ${p.dificultad || 2}</p>
                        <p class="text-sm font-bold text-gray-900">${this.escapar(p.enunciado || '')}</p>
                    </div>
                    <div class="flex gap-2 shrink-0">
                        <button onclick="icfesAdmin.aprobar('${p.id}')" class="px-4 py-2 bg-brand-600 text-white text-xs font-bold rounded-lg hover:bg-brand-700 transition">Aprobar</button>
                        <button onclick="icfesAdmin.editar('${p.id}')" class="px-3 py-2 bg-amber-100 text-amber-700 text-xs font-bold rounded-lg hover:bg-amber-200 transition">Editar</button>
                        <button onclick="icfesAdmin.descartar('${p.id}')" class="px-3 py-2 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-200 transition">Descartar</button>
                    </div>
                </div>
                <div class="space-y-2 text-sm">${opciones}</div>
                ${fallos.length ? `
                <div class="mt-3 pt-3 border-t border-red-200">
                    <p class="text-xs font-bold text-red-700 mb-1">No pasó las validaciones automáticas:</p>
                    <ul class="text-xs text-red-600 list-disc list-inside">${fallos.map(f => '<li>' + this.escapar(f) + '</li>').join('')}</ul>
                    <p class="text-[11px] text-red-500 mt-1">Puedes aprobarla igual si a tu juicio está bien, pero míralo dos veces.</p>
                </div>` : ''}
            </div>`;
    },

    editar(id) { this.editandoId = id; this.pintarPropuestas(); },
    cancelarEdicion() { this.editandoId = null; this.pintarPropuestas(); },

    async guardarEdicion(id) {
        const p = this.propuestas.find(x => x.id === id);
        if (!p) return;
        const opciones = p.opciones.map((_, i) => document.getElementById('ed-op-' + i).value.trim());
        const justificaciones = p.opciones.map((_, i) => document.getElementById('ed-just-' + i).value.trim());
        const enunciado = document.getElementById('ed-enunciado').value.trim();
        const marcada = document.querySelector('input[name="ed-clave"]:checked');
        const clave = marcada ? Number(marcada.value) : p.clave;

        // Se revalida lo editado: corregir a mano puede introducir otro problema
        // (dejar dos opciones iguales, alargar la correcta, borrar una justificación).
        const fallos = this.validar({ ...p, enunciado, opciones, justificaciones, clave },
            { prueba: p.prueba, hayEstimulo: !!p.estimuloId });
        try {
            await examItemsCollection.doc(id).update({
                enunciado, opciones, justificaciones, clave,
                validaciones: fallos, editadoPor: state.user?.email || ''
            });
            this.editandoId = null;
            await this.cargarPendientes();
            this.aviso(fallos.length
                ? 'Cambios guardados, pero siguen los avisos: ' + fallos.join(' ')
                : 'Cambios guardados.', fallos.length ? 'info' : 'ok');
        } catch (e) {
            this.aviso('No se pudo guardar: ' + e.message, 'error');
        }
    },

    async aprobar(id) {
        try {
            await examItemsCollection.doc(id).update({
                revisado: true,
                revisadoPor: state.user?.email || '',
                revisadoAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            this.propuestas = this.propuestas.filter(x => x.id !== id);
            this.pintarPropuestas();
            this.aviso('Pregunta aprobada. Ya entra en las sesiones de entrenamiento.', 'ok');
            this.cargarBanco();
        } catch (e) {
            this.aviso('No se pudo aprobar: ' + e.message, 'error');
        }
    },

    async descartar(id) {
        if (!confirm('¿Descartar esta pregunta? Se borra del banco.')) return;
        try {
            await examItemsCollection.doc(id).delete();
            this.propuestas = this.propuestas.filter(x => x.id !== id);
            this.pintarPropuestas();
        } catch (e) {
            this.aviso('No se pudo descartar: ' + e.message, 'error');
        }
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

    // ── Reporte por competencia (lo que el colegio compra) ──────────────────
    // Es lo que sostiene la renovación de la suscripción: el rector no quiere
    // ver preguntas, quiere ver en qué está flojo su curso. Se calcula BAJO
    // DEMANDA (un botón) porque recorre los intentos de cada alumno: son muchas
    // lecturas y no tiene sentido pagarlas cada vez que se abre la pestaña.
    async calcularReporte(boton) {
        const caja = document.getElementById('icfes-reporte');
        if (!caja) return;
        if (boton) { boton.disabled = true; boton.textContent = 'Calculando…'; }
        caja.innerHTML = '<p class="text-sm text-gray-500">Leyendo el progreso de los estudiantes…</p>';
        try {
            // Los sub-admins solo ven su colegio; el superadmin ve todo. Mismo
            // criterio de aislamiento que el resto del panel.
            let consulta = alumniCollection;
            if (state.adminRole === 'subadmin' && state.adminSchool) {
                consulta = alumniCollection.where('school', '==', state.adminSchool);
            }
            const alumnos = await consulta.get();

            const porCompetencia = {};
            let totalIntentos = 0;
            let alumnosActivos = 0;

            for (const doc of alumnos.docs) {
                const intentos = await itemAttemptsCollection(doc.id).limit(300).get();
                if (intentos.empty) continue;
                alumnosActivos++;
                intentos.docs.forEach(d => {
                    const a = d.data();
                    const k = a.afirmacion;
                    if (!k) return;
                    porCompetencia[k] = porCompetencia[k] || { total: 0, aciertos: 0 };
                    porCompetencia[k].total++;
                    if (a.correcta) porCompetencia[k].aciertos++;
                    totalIntentos++;
                });
            }

            if (!totalIntentos) {
                caja.innerHTML = '<p class="text-sm text-gray-500">Todavía ningún estudiante ha entrenado. El reporte aparece en cuanto empiecen a responder.</p>';
                return;
            }

            const filas = Object.keys(ICFES_PRUEBAS).map(prueba => {
                const afirmaciones = icfesAfirmacionesDe(prueba).filter(a => porCompetencia[a.codigo]);
                if (!afirmaciones.length) return '';
                const barras = afirmaciones.map(a => {
                    const v = porCompetencia[a.codigo];
                    const pct = Math.round((v.aciertos / v.total) * 100);
                    const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';
                    return `
                        <div class="mb-3">
                            <div class="flex items-baseline justify-between gap-3 mb-1">
                                <p class="text-sm font-bold text-gray-800">${this.escapar(a.corto)}</p>
                                <p class="text-sm shrink-0 ${pct < 40 ? 'text-red-600 font-bold' : 'text-gray-500'}">${pct}% · ${v.total} respuestas</p>
                            </div>
                            <div class="h-2 rounded-full bg-gray-100 overflow-hidden"><div class="h-full ${color}" style="width:${pct}%"></div></div>
                            <p class="text-[11px] text-gray-400 mt-1">${this.escapar(a.nombre)}</p>
                        </div>`;
                }).join('');
                return `
                    <div class="border border-gray-200 rounded-2xl p-4 mb-3">
                        <p class="font-bold text-sm text-gray-900 mb-3">${this.escapar(ICFES_PRUEBAS[prueba].nombre)}</p>
                        ${barras}
                    </div>`;
            }).join('');

            // La conclusión explícita: sin esto el rector ve barras y no sabe qué hacer.
            const peor = Object.entries(porCompetencia)
                .filter(([, v]) => v.total >= 5)
                .sort((a, b) => (a[1].aciertos / a[1].total) - (b[1].aciertos / b[1].total))[0];

            caja.innerHTML = `
                <p class="text-xs text-gray-500 mb-3">${alumnosActivos} estudiante(s) han entrenado · ${totalIntentos} respuestas registradas</p>
                ${filas}
                ${peor ? `
                <div class="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                    <p class="text-sm font-bold text-amber-900 mb-1">Dónde está la mayor debilidad del grupo</p>
                    <p class="text-sm text-amber-800"><strong>${this.escapar(ICFES_AFIRMACIONES[peor[0]]?.corto || '')}</strong> — ${Math.round((peor[1].aciertos / peor[1].total) * 100)}% de acierto en ${peor[1].total} respuestas. Es la competencia por la que conviene empezar a reforzar en clase.</p>
                </div>` : ''}`;
        } catch (e) {
            caja.innerHTML = `<p class="text-sm text-red-600">No se pudo calcular: ${this.escapar(e.message)}</p>`;
        } finally {
            if (boton) { boton.disabled = false; boton.textContent = 'Calcular reporte'; }
        }
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
        this.cargarPendientes();
    }
};

window.icfesAdmin = icfesAdmin;
