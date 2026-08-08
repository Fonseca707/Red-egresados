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
    propuestas: [],       // pendientes de revisión (leídas de Firestore)
    estimulos: {},        // textos base de esas pendientes, por id
    editandoId: null,     // tarjeta abierta en modo edición
    banco: [],
    filtroOrigen: 'claude', // la cola arranca mostrando las escritas a mano

    // ── El prompt: aquí se juega la fidelidad ───────────────────────────────
    // Se genera contra una EVIDENCIA concreta, no contra una competencia
    // genérica. Y se impone la forma "veredicto + justificación", que es como
    // pregunta el examen real y lo que una IA nunca produce por su cuenta: su
    // instinto es "calcule el valor de x" con cuatro números, que tiene la
    // apariencia correcta y el fondo equivocado.
    construirPrompt({ prueba, afirmacion, evidencia, cuantos, tipoTexto, categoria, contexto, generico, dificultad }) {
        const a = ICFES_AFIRMACIONES[afirmacion];
        // Las evidencias que más se confunden son las de la MISMA afirmación: se
        // le enseñan al modelo como lo que NO debe hacer, porque el fallo más
        // frecuente de la primera tanda fue etiquetar 3.5 lo que era 3.1 o 3.3.
        const hermanas = Object.entries(a.evidencias || {})
            .filter(([cod]) => cod !== evidencia)
            .map(([cod, texto]) => `  · ${cod} (NO es esta): ${texto}`)
            .join(String.fromCharCode(10));

        const comun = `
Genera ${cuantos} preguntas ORIGINALES para la prueba de ${ICFES_PRUEBAS[prueba].nombre} del examen Saber 11 del ICFES (Colombia).

MARCO OFICIAL (respétalo al pie de la letra):
- Competencia/afirmación: ${a.nombre}
- Evidencia que debe quedar demostrada: **${evidencia}** — ${a.evidencias[evidencia] || evidencia}
- CUIDADO, estas son las evidencias vecinas con las que se confunde. Tu pregunta NO debe caer en ninguna de ellas:
${hermanas || '  (no hay vecinas)'}
- Dificultad objetivo: ${dificultad} de 4.

REGLAS INNEGOCIABLES:
- Exactamente 4 opciones (A, B, C, D) y UNA sola correcta.
- Prohibido "todas las anteriores" y "ninguna de las anteriores": el ICFES no los usa.
- Las 4 opciones deben ser de largo parecido. Si la correcta es siempre la más larga, el examen se vuelve adivinable sin leer.
- Los distractores deben ser errores PLAUSIBLES de un estudiante de grado 11, no opciones absurdas.
- Contenido 100% original. No copies ni parafrasees textos de cuadernillos publicados.
- NUNCA atribuyas el texto ni sus datos a algo real. Esto vale TAMBIÉN dentro del texto, no solo al pie: nada de "un estudio de la Universidad de Pittsburgh", "según el Ministerio de Salud", "como sostiene Byung-Chul Han", "publicado en Nature". Respaldar una cifra inventada con una institución o un autor que existen es fabricar evidencia falsa. Si necesitas un dato, preséntalo sin fuente ("una encuesta reciente en el colegio…", "los registros del conjunto residencial…") o usa entidades claramente ficticias.
- NO escribas la letra de la opción dentro del texto de la opción: escribe "Cada ejemplo pertenece…", no "A. Cada ejemplo pertenece…".
- Español de Colombia, natural, sin tecnicismos innecesarios.
- Cada pregunta debe demostrar EXACTAMENTE la evidencia pedida arriba, no una parecida. Si la evidencia es sobre relaciones entre partes del texto, no sirve preguntar por un dato literal; si es sobre un dato local, no sirve preguntar por la idea global. En el campo "comoDemuestraLaEvidencia" explica en una frase por qué tu pregunta la demuestra.
- Para CADA opción escribe una justificación breve que explique por qué es correcta o por qué es un error tentador. Esa justificación es lo que el estudiante lee después de responder.`;

        const especifico = prueba === 'lectura_critica' ? `
TEXTO BASE: escribe UN texto original de tipo "${ICFES_TIPOS_TEXTO[tipoTexto]?.nombre}" (${ICFES_TIPOS_TEXTO[tipoTexto]?.ayuda}) de 180 a 300 palabras, y que las ${cuantos} preguntas se respondan LEYENDO ESE TEXTO.
- El texto debe tener **párrafos separados por una línea en blanco** (

). Si una pregunta habla de "el primer párrafo" o "el último párrafo", esos párrafos tienen que existir de verdad y ser distinguibles.
- Escribe el texto UNA sola vez, completo y seguido: no repitas el título a mitad ni reinicies el texto.
${tipoTexto === 'info_filosofico' ? 'IMPORTANTE: un texto filosófico evalúa estructura, ideas y argumentos. NO preguntes por historia de la filosofía ni por qué sostenía tal autor.' : ''}
${tipoTexto.includes('discontinuo') ? 'Al ser discontinuo, descríbelo en palabras de forma que se entienda sin imagen (por ejemplo, una tabla escrita con sus filas, o la descripción de las viñetas de una caricatura).' : ''}` : `
CONTEXTO: la situación debe ser real y concreta (${ICFES_CONTEXTOS[contexto]}), con datos presentados en una tabla escrita o en el enunciado. Nunca un ejercicio pelado tipo "resuelva la ecuación".
CONTENIDO: ${ICFES_CATEGORIAS_MAT[categoria]?.nombre} — ${generico ? 'usa solo conocimientos genéricos: ' + ICFES_CATEGORIAS_MAT[categoria]?.genericos : 'puedes usar contenidos no genéricos: ' + ICFES_CATEGORIAS_MAT[categoria]?.noGenericos}.

FORMA DE LA PREGUNTA (medido en el cuadernillo oficial 2026, no supuesto):
- Aproximadamente 1 de cada 6 preguntas es de VEREDICTO + JUSTIFICACIÓN: alguien AFIRMA algo y el estudiante juzga si es correcto y por qué ("Sí, porque…" / "No, porque…"). NO abuses de esta forma: pasarse aleja el banco del examen real tanto como no usarla.
- Las demás piden un valor, una conclusión o la lectura de una representación.
- LAS OPCIONES SON CORTAS. En el cuadernillo la mediana es de 27 caracteres: muchas son solo una cifra ("526.000 pesos.", "Se duplica.", "15°."). Si tus cuatro opciones parecen párrafos, no se parecen al examen.
- PROHIBIDO que una opción empiece con una expresión vaga ("cerca de", "más de", "aproximadamente", "un poco menos"): ninguna de las 344 opciones del cuadernillo lo hace. Si el resultado no da exacto, escribe "aproximadamente" EN EL ENUNCIADO y deja las opciones como cantidades concretas.
- Ordena las opciones numéricas de menor a mayor, como el original.`;

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
      "comoDemuestraLaEvidencia": "una frase: qué tiene que hacer el estudiante para responder, y por qué eso ES la evidencia pedida",
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

        // La clave tampoco puede ser la unica "prudente": si tres opciones son
        // absolutas y solo la correcta lleva matices, se acierta por forma.
        const MATIZ = /(generalmente|puede|podr[íi]a|algunos|en parte|suele|no siempre|depende|tiende)/i;
        const ABSOLUTO = /(siempre|nunca|todos|ninguno|jam[áa]s|exclusivamente|[úu]nicamente)/i;
        if (ops.length === 4 && MATIZ.test(String(ops[item.clave] || ''))
            && ops.every((o, i) => i === item.clave || !MATIZ.test(String(o)))
            && ops.filter((o, i) => i !== item.clave && ABSOLUTO.test(String(o))).length >= 2) {
            fallos.push('La correcta es la única con matices frente a opciones absolutas: se adivina por forma.');
        }

        if ((item.justificaciones || []).filter(j => String(j || '').trim()).length !== 4) {
            fallos.push('Faltan justificaciones: se necesitan las 4, son la retroalimentación del estudiante.');
        }
        if (contexto.prueba === 'lectura_critica' && !contexto.hayEstimulo) {
            fallos.push('Lectura Crítica sin texto base: toda pregunta debe apoyarse en un texto.');
        }
        // La tabla o el gráfico del ítem: un material mal formado se ve roto, y
        // descubrirlo revisando gasta la atención de quien revisa, que es el
        // recurso escaso del módulo.
        if (item.visual) fallos.push(...icfesVisual.validar(item.visual));
        return fallos;
    },

    // El modelo respalda cifras inventadas citando instituciones y autores que
    // existen ("un estudio de la Universidad de Pittsburgh"). Prohibirlo en el
    // prompt no basta: reincide. Esto lo detecta para que no pase de la cola.
    revisarAtribuciones(texto) {
        const patrones = [
            /(universidad|instituto|ministerio|secretar[íi]a|alcald[íi]a|gobernaci[óo]n|fundaci[óo]n|OMS|ONU|UNESCO|DANE|ICFES)/i,
            /seg[úu]n (un |una |el |la )?(estudio|investigaci[óo]n|informe|encuesta|reporte) (de|del|de la|realizado)/i,
            /(investigadores|cient[íi]ficos|expertos) de (la|el)/i,
            /publicad[oa] en/i,
            /\((19|20)\d{2}\)/
        ];
        return patrones.some(re => re.test(String(texto || '')))
            ? ['El texto respalda datos en una institución, autor o publicación que parece real. Un texto de práctica no puede atribuir cifras inventadas a entidades que existen: reescríbelo sin esa fuente.']
            : [];
    },

    // Validación del LOTE, no del ítem: hay sesgos que ninguna pregunta suelta
    // delata y que solo se ven mirando el conjunto.
    validarLote(items, prueba) {
        const avisos = [];
        // La cuota de forma se mide SOLO sobre argumentación y formulación, que
        // es donde el ICFES pregunta "¿es válido este razonamiento?". En
        // interpretación y representación la tarea es leer una gráfica o una
        // tabla, y ahí exigir veredicto+justificación es pedir algo que el
        // examen real tampoco hace: el aviso saltaba en lotes correctos y
        // presionaba a deformarlos para callarlo. Una vara mal puesta no
        // protege la fidelidad, la erosiona.
        // Solo tiene sentido sobre un conjunto grande: un lote de una sola
        // competencia puede legítimamente no traer ninguna de veredicto (las de
        // interpretación piden leer una gráfica, no juzgar un razonamiento), y
        // avisar ahí es empujar a deformarlo para callar la alarma.
        if (prueba === 'matematicas' && items.length >= 12) {
            const veredicto = items.filter(i => i.forma === 'veredicto_justificacion').length;
            const proporcion = veredicto / items.length;
            if (proporcion > ICFES_VEREDICTO_MAT.max) {
                avisos.push(`${veredicto} de ${items.length} preguntas son de "veredicto + justificación" (${Math.round(proporcion * 100)} %). En el cuadernillo oficial son el ${Math.round(ICFES_VEREDICTO_MAT.real * 100)} %: pasarse también aleja el banco del examen real.`);
            } else if (proporcion < ICFES_VEREDICTO_MAT.min) {
                avisos.push(`Solo ${veredicto} de ${items.length} son de "veredicto + justificación". El examen real trae alrededor del ${Math.round(ICFES_VEREDICTO_MAT.real * 100)} %.`);
            }
        }

        // Opciones vagas: cero de las 344 del cuadernillo empieza así.
        const conVagas = items.filter(i => (i.opciones || []).some(o => ICFES_OPCION_VAGA.test(String(o))));
        if (conVagas.length) {
            avisos.push(`${conVagas.length} pregunta(s) tienen opciones que empiezan con una expresión vaga ("cerca de", "más de", "aproximadamente"). El ICFES no las usa nunca: si el resultado no es exacto, se dice "aproximadamente" en el enunciado y las opciones siguen siendo cantidades concretas.`);
        }

        // Opciones que parecen párrafos: delatan contenido generado.
        const referencia = ICFES_LARGO_OPCION[prueba];
        if (referencia && items.length >= 4) {
            const largos = items.flatMap(i => (i.opciones || []).map(o => String(o).length));
            const mediana = largos.sort((a, b) => a - b)[Math.floor(largos.length / 2)];
            if (mediana > referencia.p90) {
                avisos.push(`Las opciones son largas: mediana de ${mediana} caracteres, cuando en el cuadernillo oficial de ${ICFES_PRUEBAS[prueba]?.nombre || prueba} es ${referencia.mediana}. Opciones que parecen párrafos delatan contenido generado.`);
            }
        }

        // ── Sesgo de posición de la clave ───────────────────────────────────
        // El más probable cuando UN SOLO autor escribe el banco entero: sin
        // darse cuenta, tiende a poner la correcta en la misma letra. Un
        // estudiante que lo note contesta sin leer, y el puntaje deja de medir
        // lo que dice medir. No se detecta pregunta por pregunta: solo el lote
        // lo delata.
        // Solo cuenta para las preguntas cuya posición SÍ es la que verá el
        // estudiante: las de opciones numéricas, que el motor ordena de menor a
        // mayor en vez de barajar. En las demás la posición guardada es una
        // convención (la correcta va primera) y el orden se sortea al presentar,
        // así que contarlas aquí sería medir algo que nadie ve.
        // Y se cuenta la posición EFECTIVA —la que verá el estudiante tras
        // ordenar por valor—, no la guardada. Desde que la correcta se almacena
        // siempre primera, contar la guardada daría "todas en la A" en cualquier
        // lote correcto: mediría la convención de almacenamiento, no el examen.
        const valorDe = (o) => {
            const m = String(o).match(/^[^\d]*?(-?\d[\d.,]*)/);
            return m ? Number(m[1].replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')) : null;
        };
        const posicionEfectiva = (i) => {
            const valores = (i.opciones || []).map(valorDe);
            if (valores.length !== 4 || valores.some(v => v === null || !Number.isFinite(v))) return null;
            const orden = valores.map((_, k) => k).sort((a, b) => valores[a] - valores[b]);
            return orden.indexOf(Number(i.clave) || 0);
        };
        const conPosicionFija = items
            .map(i => ({ item: i, pos: posicionEfectiva(i) }))
            .filter(x => x.pos !== null);
        if (conPosicionFija.length >= 8) {
            const conteo = [0, 0, 0, 0];
            conPosicionFija.forEach(x => conteo[x.pos]++);
            const esperado = conPosicionFija.length / 4;
            conteo.forEach((n, i) => {
                if (n > esperado * 1.6) avisos.push(`La respuesta correcta cae ${n} veces en la ${'ABCD'[i]} de ${conPosicionFija.length} preguntas con opciones numéricas (lo parejo sería ~${Math.round(esperado)}). Reparte las claves o el examen se vuelve adivinable.`);
                if (n === 0) avisos.push(`Ninguna respuesta correcta es la ${'ABCD'[i]}. Un estudiante que lo note descarta esa opción sin leerla.`);
            });
            // Rachas: cuatro seguidas en la misma letra se nota aunque el
            // reparto total esté perfecto.
            let racha = 1;
            for (let i = 1; i < conPosicionFija.length; i++) {
                racha = conPosicionFija[i].pos === conPosicionFija[i - 1].pos ? racha + 1 : 1;
                if (racha >= 4) { avisos.push(`Hay ${racha} preguntas seguidas con la misma letra correcta. Intercálalas.`); break; }
            }
        }

        // ── Sesgo socioeconómico y de contexto ──────────────────────────────
        // Un ítem ambientado en algo que solo vive parte de la población mide
        // familiaridad, no competencia: el que nunca ha viajado en avión gasta
        // su atención en entender el escenario. Es la *fairness review* que el
        // ICFES hace con panel humano y aquí no existe; esto no la reemplaza,
        // pero atrapa lo más burdo antes de la cola.
        const EXCLUYENTE = /(tarjeta de cr[ée]dito|acciones en (la )?bolsa|club social|viaj[ea] (en avi[óo]n|a (europa|miami|estados unidos))|empleada dom[ée]stica|conductor privado|apartaestudio en el norte|colegio biling[üu]e|casa de campo|finca de recreo)/i;
        const conSesgo = items.filter(i => EXCLUYENTE.test(String(i.enunciado || '')));
        if (conSesgo.length) {
            avisos.push(`${conSesgo.length} pregunta(s) usan un contexto que no toda la población conoce (tarjetas de crédito, viajes al exterior, servicio doméstico). Eso mide familiaridad, no matemáticas: cámbialo por una situación que le pase a cualquiera.`);
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
    // ── Importar un lote escrito a mano ─────────────────────────────────────
    // Las preguntas que escribe Claude no pueden entrar por el generador: el
    // proxy solo habla con DeepSeek. Y escribirlas directo en Firestore desde
    // fuera exigiría una llave de servidor que este repo no tiene (ni debe
    // tener). Así que entran por aquí, pegadas como JSON, y pasan EXACTAMENTE
    // por el mismo camino que lo generado: mismas validaciones, misma cola,
    // mismo `revisado: false`. El gate humano no se salta por ser mías.
    // Los lotes se leen del disco, no de una URL del sitio: publicarlos dejaría
    // el banco con sus claves en una dirección que cualquier estudiante puede
    // adivinar. Por eso `lotes/**` está fuera del hosting y el archivo se elige
    // aquí, desde el computador.
    async importarArchivos(input) {
        const archivos = [...(input?.files || [])];
        if (!archivos.length) return;
        for (const archivo of archivos) {
            try {
                const texto = await archivo.text();
                await this.importarLote(texto, archivo.name);
            } catch (e) {
                this.aviso(`No se pudo leer ${archivo.name}: ${e.message}`, 'error');
            }
        }
        input.value = '';   // permite volver a elegir el mismo archivo
    },

    async importarLote(textoCrudo = null, nombreArchivo = '') {
        const caja = document.getElementById('icfes-import-json');
        const boton = document.getElementById('icfes-btn-importar');
        const crudo = String(textoCrudo ?? caja?.value ?? '').trim();
        if (!crudo) { this.aviso('Elige un archivo de lote o pega su JSON.', 'error'); return; }

        let paquete;
        try {
            paquete = JSON.parse(crudo);
        } catch (e) {
            this.aviso(`El JSON ${nombreArchivo ? 'de ' + nombreArchivo + ' ' : ''}no se pudo leer: ${e.message}`, 'error');
            return;
        }
        const lotes = Array.isArray(paquete) ? paquete : (paquete.lotes || [paquete]);
        if (!lotes.length) { this.aviso('El JSON no trae ningún lote.', 'error'); return; }

        // Importar dos veces el mismo archivo llenaría la cola de duplicados y
        // eso solo se descubre revisando, que es lo caro. Se avisa antes.
        if (nombreArchivo) {
            const yaEstan = this.propuestas.filter(p => p.loteArchivo === nombreArchivo).length
                          + (this.banco || []).filter(p => p.loteArchivo === nombreArchivo).length;
            if (yaEstan && !confirm(`Ya hay ${yaEstan} pregunta(s) de "${nombreArchivo}" en el sistema. ¿Importarlo otra vez? Quedarían repetidas.`)) return;
        }

        if (boton) { boton.disabled = true; boton.textContent = 'Importando…'; }
        let total = 0, limpias = 0;
        const avisos = [];
        try {
            for (const [n, lote] of lotes.entries()) {
                const faltan = ['prueba', 'afirmacion', 'evidencia'].filter(k => !lote[k]);
                if (faltan.length) { avisos.push(`Lote ${n + 1}: le falta ${faltan.join(', ')}.`); continue; }
                if (!Array.isArray(lote.items) || !lote.items.length) { avisos.push(`Lote ${n + 1}: sin preguntas.`); continue; }

                const items = lote.items.map(it => ({
                    ...it,
                    prueba: lote.prueba,
                    // Un mismo texto alimenta preguntas de afirmaciones distintas,
                    // igual que en el examen real ("responda las preguntas 1 a 3
                    // según el siguiente texto"). Por eso la pregunta puede traer
                    // la suya y solo hereda la del lote si no la trae.
                    afirmacion: it.afirmacion || lote.afirmacion,
                    evidencia: it.evidencia || lote.evidencia,
                    dificultad: it.dificultad || lote.dificultad || 2,
                    tipoTexto: lote.prueba === 'lectura_critica' ? (lote.tipoTexto || '') : '',
                    categoria: lote.prueba === 'matematicas' ? (lote.categoria || '') : '',
                    contexto: lote.prueba === 'matematicas' ? (lote.contexto || '') : '',
                    generico: lote.prueba === 'matematicas' ? (lote.generico ?? null) : null,
                    componente: lote.prueba === 'ciencias' ? (it.componente || lote.componente || '') : '',
                }));

                const guardados = await this.guardarPendientes(items, lote.estimulo || null, lote.prueba, lote.tipoTexto || '', 'claude', nombreArchivo);
                total += guardados.length;
                limpias += guardados.filter(p => !p._fallos.length).length;
                avisos.push(...this.validarLote(items, lote.prueba).map(a => `Lote ${n + 1}: ${a}`));
            }

            // El sesgo de posición de la clave se mide sobre TODO lo importado,
            // no lote por lote: repartir bien dentro de cada lote de 3 y mal en
            // el conjunto es exactamente el error que hay que ver.
            const todas = lotes.flatMap(l => (Array.isArray(l.items) ? l.items : []));
            avisos.push(...this.validarLote(todas, '_global').map(a => `En el conjunto — ${a}`));

            this.aviso(`${nombreArchivo ? nombreArchivo + ': ' : ''}${total} preguntas importadas · ${limpias} pasaron limpias las validaciones. Están en la cola con revisado:false — ninguna llega a un estudiante hasta que la apruebes.${avisos.length ? ' ⚠️ ' + avisos.join(' ') : ''}`, avisos.length ? 'info' : 'ok');
            if (caja && !nombreArchivo) caja.value = '';
            await this.cargarPendientes();
        } catch (e) {
            this.aviso(`Se cortó la importación: ${e.message}. Lo que alcanzó a entrar ya está en la cola.`, 'error');
        } finally {
            if (boton) { boton.disabled = false; boton.textContent = 'Importar lo pegado'; }
        }
    },

    async guardarPendientes(items, estimulo, prueba, tipoTexto, origen = 'ia', loteArchivo = '') {
        let estimuloId = null;
        let avisoTexto = [];
        // El texto se guarda UNA vez por lote: en Lectura Crítica un mismo texto
        // alimenta varias preguntas y duplicarlo haría que el motor lo mostrara
        // como si fueran textos distintos.
        if (estimulo) {
            const ref = await examStimuliCollection.add({
                prueba, tipoTexto: tipoTexto || '',
                titulo: estimulo.titulo || '',
                // El modelo a veces reinicia el texto repitiendo su propio título
                // a mitad: se corta ahí, porque un texto duplicado vuelve
                // incontestables las preguntas que hablan de "el último párrafo".
                texto: this.limpiarTexto(estimulo.texto || '', estimulo.titulo || ''),
                // Tabla o gráfico del texto base. Los discontinuos del ICFES
                // (infografía, tabla, diagrama) son el 8% oficial y antes había
                // que describirlos en palabras porque no había cómo dibujarlos.
                visual: estimulo.visual ? JSON.stringify(estimulo.visual) : null,
                // La fuente NO se toma del modelo: firmó un texto inventado como
                // "Manual de la Alcaldía de Bogotá, 2023". Un texto de práctica no
                // puede presentarse como documento de una entidad real.
                fuente: 'Texto original para práctica · Sinapsis',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            estimuloId = ref.id;
            avisoTexto = this.revisarAtribuciones(estimulo.texto || '');
        }
        const guardados = [];
        for (const it of items) {
            // La correcta se guarda SIEMPRE primera. El orden que ve el
            // estudiante lo decide el motor al presentar (baraja, o ordena por
            // valor si son cifras), así que la posición guardada no es la que
            // se muestra: es solo una convención que quita de en medio el sesgo
            // de "siempre la C" al escribir.
            const k = Number(it.clave) || 0;
            if (k > 0 && Array.isArray(it.opciones) && it.opciones[k] !== undefined) {
                const orden = [k, ...it.opciones.map((_, i) => i).filter(i => i !== k)];
                it.opciones = orden.map(i => it.opciones[i]);
                it.justificaciones = orden.map(i => (it.justificaciones || [])[i] || '');
                it.clave = 0;
            }
            // El modelo mete la letra dentro de la opción ("A. Cada ejemplo…") y
            // la UI le antepone otra, quedando "A. A. Cada ejemplo…".
            it.opciones = (it.opciones || []).map(o => String(o).replace(/^\s*[A-D][.)]\s+/, '').trim());
            const fallos = [...this.validar(it, { prueba, hayEstimulo: !!estimuloId }), ...avisoTexto];
            const doc = {
                exam: 'ICFES',
                prueba: it.prueba, afirmacion: it.afirmacion, evidencia: it.evidencia,
                tipoTexto: it.tipoTexto || '', categoria: it.categoria || '',
                contexto: it.contexto || '', generico: it.generico ?? null,
                // Solo Ciencias: la tabla 31 cruza competencia x componente
                // (biologico/fisico/quimico/CTS), no son dos listas aparte.
                componente: it.componente || '',
                forma: it.forma || '', estimuloId,
                visual: it.visual ? JSON.stringify(it.visual) : null,   // serializado: ver icfesVisual.normalizar
                enunciado: it.enunciado || '', opciones: it.opciones || [],
                clave: Number(it.clave) || 0, justificaciones: it.justificaciones || [],
                dificultad: it.dificultad || 2,
                origen,                   // 'ia' = DeepSeek · 'claude' = escritas a mano
                loteArchivo,              // de qué archivo vino: sirve para no importarlo dos veces
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

    limpiarTexto(texto, titulo) {
        let t = String(texto || '').trim();
        if (titulo) {
            const repetido = t.indexOf(titulo, 30);
            if (repetido > 0) t = t.slice(0, repetido).trim();
        }
        return t;
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

        // La cola mezcla dos bancos de procedencia distinta y revisarlos juntos
        // confunde. El filtro NO borra nada: las de DeepSeek siguen ahí, sin
        // publicar, y el contador dice cuántas se están ocultando para que no
        // parezca que se perdieron.
        const visibles = this.filtroOrigen && this.filtroOrigen !== 'todas'
            ? this.propuestas.filter(p => (p.origen || 'ia') === this.filtroOrigen)
            : this.propuestas;
        const ocultas = this.propuestas.length - visibles.length;

        // Agrupadas por texto base: revisar seguidas las preguntas de un mismo
        // texto es mucho más rápido que saltar de un texto a otro.
        const grupos = {};
        visibles.forEach(p => { (grupos[p.estimuloId || '_sin'] = grupos[p.estimuloId || '_sin'] || []).push(p); });

        caja.innerHTML = `
            <div class="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <p class="text-sm font-bold text-gray-900">
                    ${visibles.length} preguntas esperando tu revisión
                    ${ocultas ? `<span class="font-normal text-gray-400">· ${ocultas} ocultas por el filtro</span>` : ''}
                </p>
                <div class="flex items-center gap-3">
                    <select onchange="icfesAdmin.filtrarPorOrigen(this.value)" class="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white">
                        <option value="claude" ${this.filtroOrigen === 'claude' ? 'selected' : ''}>Escritas a mano</option>
                        <option value="ia" ${this.filtroOrigen === 'ia' ? 'selected' : ''}>Generadas con DeepSeek</option>
                        <option value="todas" ${this.filtroOrigen === 'todas' ? 'selected' : ''}>Todas</option>
                    </select>
                    <button onclick="icfesAdmin.cargarPendientes()" class="text-xs font-bold text-brand-600 hover:underline">Actualizar</button>
                </div>
            </div>
            ${!visibles.length ? '<p class="text-sm text-gray-500 mb-4">Ninguna pregunta de esa procedencia. Cambia el filtro para ver el resto.</p>' : ''}` +
            Object.entries(grupos).map(([eid, items]) => {
                const est = this.estimulos && this.estimulos[eid];
                const cabecera = est ? `
                    <div class="bg-gray-50 border border-gray-200 rounded-2xl p-5 mb-3">
                        <p class="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Texto base · ${items.length} pregunta(s)</p>
                        <p class="font-semibold text-gray-900 mb-2">${this.escapar(est.titulo || '')}</p>
                        ${est.texto ? `<p class="text-sm text-gray-700 whitespace-pre-line leading-relaxed">${this.escapar(est.texto)}</p>` : ''}
                        ${est.visual ? icfesVisual.render(est.visual) : ''}
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
            <div class="flex items-start gap-2 ${i === p.clave ? 'text-green-600 font-bold' : 'text-gray-600'}">
                <span class="shrink-0">${'ABCD'[i]}.</span>
                <span class="flex-1">${this.escapar(o)}
                    <span class="block text-xs font-normal text-gray-400 mt-0.5">${this.escapar((p.justificaciones || [])[i] || '')}</span>
                </span>
            </div>`).join('');

        return `
            <div class="border ${fallos.length ? 'border-red-200 bg-red-50/30' : 'border-gray-200'} rounded-2xl p-5 mb-3">
                <div class="flex items-start justify-between gap-3 mb-3 flex-wrap">
                    <div class="flex-1 min-w-[240px]">
                        <p class="text-[11px] text-gray-400 mb-1">${this.escapar(a ? a.corto : '')} · dificultad ${p.dificultad || 2}</p>
                        <div class="flex items-center gap-2 mb-2">
                            <span class="text-[11px] text-gray-400 shrink-0">Evalúa:</span>
                            <select onchange="icfesAdmin.reetiquetar('${p.id}', this.value)" class="text-[11px] border border-gray-200 rounded-lg px-2 py-1 bg-white max-w-full">
                                ${Object.entries(a ? a.evidencias : {}).map(([cod, txt]) =>
                                    `<option value="${cod}" ${cod === p.evidencia ? 'selected' : ''}>${cod} — ${this.escapar(String(txt).slice(0, 70))}…</option>`).join('')}
                            </select>
                        </div>
                        <p class="text-sm font-medium text-gray-900 leading-relaxed">${this.escapar(p.enunciado || '')}</p>
                    </div>
                    <div class="flex gap-2 shrink-0">
                        <button onclick="icfesAdmin.aprobar('${p.id}')" class="px-4 py-2 bg-brand-600 text-white text-xs font-bold rounded-lg hover:bg-brand-700 transition">Aprobar</button>
                        <button onclick="icfesAdmin.editar('${p.id}')" class="px-3 py-2 bg-amber-100 text-amber-700 text-xs font-bold rounded-lg hover:bg-amber-200 transition">Editar</button>
                        <button onclick="icfesAdmin.descartar('${p.id}')" class="px-3 py-2 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-200 transition">Descartar</button>
                    </div>
                </div>
                ${p.visual ? icfesVisual.render(p.visual) : ''}
                <div class="space-y-2 text-sm">${opciones}</div>
                ${fallos.length ? `
                <div class="mt-3 pt-3 border-t border-red-200">
                    <p class="text-xs font-bold text-red-700 mb-1">No pasó las validaciones automáticas:</p>
                    <ul class="text-xs text-red-600 list-disc list-inside">${fallos.map(f => '<li>' + this.escapar(f) + '</li>').join('')}</ul>
                    <p class="text-[11px] text-red-500 mt-1">Puedes aprobarla igual si a tu juicio está bien, pero míralo dos veces.</p>
                </div>` : ''}
            </div>`;
    },

    // El fallo más frecuente de la revisión fue la evidencia mal etiquetada, y
    // casi siempre con una VECINA de la misma afirmación. La pregunta suele estar
    // bien: lo que está mal es la etiqueta, y de ella dependen la cuota oficial y
    // el diagnóstico por competencia. Cambiarla en un clic evita tirar una
    // pregunta buena — o, peor, publicarla mintiendo sobre lo que mide.
    async reetiquetar(id, evidencia) {
        try {
            await examItemsCollection.doc(id).update({ evidencia, reetiquetadoPor: state.user?.email || '' });
            const p = this.propuestas.find(x => x.id === id);
            if (p) p.evidencia = evidencia;
            this.aviso('Evidencia actualizada a ' + evidencia + '.', 'ok');
        } catch (e) { this.aviso('No se pudo reetiquetar: ' + e.message, 'error'); }
    },

    filtrarPorOrigen(valor) { this.filtroOrigen = valor; this.pintarPropuestas(); },

    // ── Preguntas que reportaron los estudiantes ────────────────────────────
    // Sin esta pantalla, el botón de reportar sería un buzón sin destinatario:
    // el estudiante avisa y nadie se entera. Aquí es donde el reporte se
    // convierte en una corrección — o en un descarte.
    async cargarReportes() {
        const caja = document.getElementById('icfes-reportes');
        if (!caja) return;
        caja.innerHTML = '<p class="text-sm text-gray-400">Cargando…</p>';
        let reportes = [];
        try {
            const snap = await examItemReportsCollection.where('atendido', '==', false).get();
            reportes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
            caja.innerHTML = `<p class="text-sm text-red-600">No se pudo leer: ${this.escapar(e.message)}</p>`;
            return;
        }
        if (!reportes.length) {
            caja.innerHTML = '<p class="text-sm text-gray-500">Ningún estudiante ha reportado una pregunta.</p>';
            return;
        }

        // Agrupadas por pregunta: tres reportes sobre el mismo ítem son una
        // señal mucho más fuerte que tres sobre ítems distintos, y así se ve.
        const porItem = {};
        reportes.forEach(r => { (porItem[r.itemId] = porItem[r.itemId] || []).push(r); });
        const orden = Object.entries(porItem).sort((a, b) => b[1].length - a[1].length);

        const enunciadoDe = (id) => {
            const p = this.propuestas.find(x => x.id === id) || (this.banco || []).find(x => x.id === id);
            return p ? p.enunciado : '(la pregunta ya no está en el banco)';
        };

        caja.innerHTML = orden.map(([itemId, rs]) => `
            <div class="border ${rs.length > 1 ? 'border-amber-300 bg-amber-50/40' : 'border-gray-200'} rounded-2xl p-4 mb-3">
                <div class="flex items-start justify-between gap-3 flex-wrap">
                    <p class="text-sm text-gray-900 flex-1 min-w-[240px]">${this.escapar(String(enunciadoDe(itemId)).slice(0, 140))}…</p>
                    <span class="text-xs font-bold ${rs.length > 1 ? 'text-amber-700' : 'text-gray-500'} shrink-0">
                        ${rs.length} reporte${rs.length === 1 ? '' : 's'}
                    </span>
                </div>
                <ul class="mt-2 space-y-1">
                    ${rs.map(r => `<li class="text-xs text-gray-600">
                        · <strong>${this.escapar(icfesLogic.MOTIVOS_REPORTE?.[r.motivo] || r.motivo || '')}</strong>
                        ${r.comentario ? '— ' + this.escapar(r.comentario) : ''}
                    </li>`).join('')}
                </ul>
                <div class="flex gap-2 justify-end mt-3">
                    <button onclick="icfesAdmin.irAPregunta('${this.escapar(itemId)}')" class="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-bold rounded-lg hover:border-gray-300 transition">Ver la pregunta</button>
                    <button onclick="icfesAdmin.atenderReportes('${this.escapar(itemId)}')" class="px-3 py-1.5 bg-gray-900 text-white text-xs font-bold rounded-lg hover:bg-gray-800 transition">Marcar como atendido</button>
                </div>
            </div>`).join('');
    },

    irAPregunta(itemId) {
        const p = this.propuestas.find(x => x.id === itemId);
        if (!p) { this.aviso('Esa pregunta ya no está en la cola de revisión: puede estar aprobada o descartada.', 'info'); return; }
        this.filtroOrigen = 'todas';
        this.editandoId = itemId;
        this.pintarPropuestas();
        document.getElementById('icfes-propuestas')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    async atenderReportes(itemId) {
        try {
            const snap = await examItemReportsCollection.where('itemId', '==', itemId).get();
            for (const d of snap.docs) await d.ref.update({ atendido: true, atendidoPor: state.user?.email || '' });
            await this.cargarReportes();
            this.aviso('Reportes marcados como atendidos.', 'ok');
        } catch (e) { this.aviso('No se pudo actualizar: ' + e.message, 'error'); }
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
