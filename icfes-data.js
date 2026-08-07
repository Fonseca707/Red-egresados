// icfes-data.js — Blueprint oficial del Saber 11 (ICFES).
//
// CONSTANTES, NO CONTENIDO. Aquí no vive ni un solo ítem: los ítems se generan,
// se revisan a mano y viven en Firestore (`examItems`). Este archivo es el molde
// contra el que se generan y se validan.
//
// Fuente de verdad: Guía de orientación Saber 11.º 2026-1 del ICFES (tablas 17,
// 22, 23). NO los cuadernillos de práctica: se midió la distribución real de las
// 49 preguntas del cuadernillo de Lectura Crítica y dio 10/53/37, muy lejos del
// 25/42/33 oficial. El cuadernillo sirve para el ESTILO de los ítems; las cuotas
// salen de la Guía.
//
// ⚖️ Los cuadernillos del ICFES prohíben el uso con fines de lucro y la
// transformación (obra derivada). Sinapsis le cobra al colegio, así que de ellos
// se toma la FORMA — nunca un texto, un enunciado ni una opción, ni parafraseado.

// Las cuatro pruebas con puntaje que cubre el módulo. Inglés queda fuera por
// decisión de Juan (2026-08-07): ya hay dos módulos de idiomas.
const ICFES_PRUEBAS = {
    lectura_critica: { nombre: 'Lectura Crítica',       preguntasExamen: 41, icono: 'ph-book-open' },
    matematicas:     { nombre: 'Matemáticas',           preguntasExamen: 50, icono: 'ph-math-operations' },
    sociales:        { nombre: 'Sociales y Ciudadanas', preguntasExamen: 50, icono: 'ph-globe-stand' },
    ciencias:        { nombre: 'Ciencias Naturales',    preguntasExamen: 58, icono: 'ph-flask' }
};

// El ICFES diseña por evidencias: competencia → afirmación → evidencia → tarea.
// El generador produce contra una EVIDENCIA concreta. Pedirle "una pregunta de
// lectura crítica" da basura; pedirle "una que evidencie 2.3" da algo parecido
// al examen real.
const ICFES_AFIRMACIONES = {
    // Lectura Crítica: UNA competencia (comprensión lectora) con 3 afirmaciones.
    lc_local: {
        prueba: 'lectura_critica', cuota: 0.25,
        nombre: 'Identifica y entiende los contenidos locales que conforman un texto.',
        corto: 'Contenidos locales',
        evidencias: {
            '1.1': 'Entiende el significado de los elementos locales que constituyen un texto.',
            '1.2': 'Identifica los eventos narrados de manera explícita en un texto (literario, descriptivo, caricatura o cómic) y los personajes involucrados.'
        }
    },
    lc_global: {
        prueba: 'lectura_critica', cuota: 0.42,
        nombre: 'Comprende cómo se articulan las partes de un texto para darle un sentido global.',
        corto: 'Sentido global',
        evidencias: {
            '2.1': 'Comprende la estructura formal de un texto y la función de sus partes.',
            '2.2': 'Identifica y caracteriza las diferentes voces o situaciones presentes en un texto.',
            '2.3': 'Comprende las relaciones entre diferentes partes o enunciados de un texto.',
            '2.4': 'Identifica y caracteriza las ideas o afirmaciones presentes en un texto informativo.',
            '2.5': 'Identifica el tipo de relación existente entre diferentes elementos de un texto (discontinuo).'
        }
    },
    lc_evaluar: {
        prueba: 'lectura_critica', cuota: 0.33,
        nombre: 'Reflexiona a partir de un texto y evalúa su contenido.',
        corto: 'Reflexión y evaluación',
        evidencias: {
            '3.1': 'Establece la validez e implicaciones de un enunciado de un texto (argumentativo o expositivo).',
            '3.2': 'Establece relaciones entre un texto y otros textos o enunciados.',
            '3.3': 'Reconoce contenidos valorativos presentes en un texto.',
            '3.4': 'Reconoce las estrategias discursivas en un texto.',
            '3.5': 'Contextualiza adecuadamente un texto o la información contenida en este.'
        }
    },
    // Matemáticas: 3 competencias. La cuota oficial es POR COMPETENCIA — no hay
    // cuota por contenido (era una creencia falsa del diseño inicial).
    mat_interpretacion: {
        prueba: 'matematicas', cuota: 0.34,
        nombre: 'Interpretación y representación',
        corto: 'Interpretación',
        evidencias: {
            'i.1': 'Comprende y transforma la información cuantitativa y esquemática presentada en distintos formatos (tablas, gráficas, diagramas).',
            'i.2': 'Extrae de una representación la información que responde a una pregunta concreta.'
        }
    },
    mat_formulacion: {
        prueba: 'matematicas', cuota: 0.43,
        nombre: 'Formulación y ejecución',
        corto: 'Formulación',
        evidencias: {
            'f.1': 'Diseña y aplica estrategias para resolver un problema en un contexto real.',
            'f.2': 'Selecciona la operación, el modelo o el procedimiento adecuado a la situación.'
        }
    },
    mat_argumentacion: {
        prueba: 'matematicas', cuota: 0.23,
        nombre: 'Argumentación',
        corto: 'Argumentación',
        evidencias: {
            'a.1': 'Valida o refuta una afirmación a partir de datos, propiedades o procedimientos.',
            'a.2': 'Justifica la pertinencia de un procedimiento o de una conclusión.'
        }
    },

    // ── Sociales y Ciudadanas ───────────────────────────────────────────────
    // Cuotas de la Tabla 27 de la Guía 2026: 30 / 40 / 30. Afirmaciones y
    // evidencias transcritas de las tablas 24, 25 y 26 (desagregado de cada
    // competencia). Los códigos son los del documento oficial.
    soc_pensamiento: {
        prueba: 'sociales', cuota: 0.30,
        nombre: 'Pensamiento social',
        corto: 'Pensamiento social',
        evidencias: {
            '1.1': 'Identifica y usa conceptos sociales básicos (económicos, políticos, culturales y geográficos).',
            '1.2': 'Conoce el modelo de Estado Social de Derecho y su aplicación en Colombia.',
            '1.3': 'Conoce la organización del Estado: funciones y alcances de las ramas del poder y de los organismos de control.',
            '1.4': 'Conoce los mecanismos que los ciudadanos tienen a su disposición para participar en la democracia y garantizar el respeto de sus derechos.',
            '2.1': 'Localiza en el tiempo y en el espacio eventos históricos y prácticas sociales.',
            '2.2': 'Relaciona dimensiones históricas y geográficas de eventos y problemáticas sociales.',
            '2.3': 'Relaciona problemáticas o prácticas sociales con características del espacio geográfico.'
        }
    },
    soc_perspectivas: {
        prueba: 'sociales', cuota: 0.40,
        nombre: 'Interpretación y análisis de perspectivas',
        corto: 'Perspectivas',
        evidencias: {
            '3.1': 'Inscribe una fuente primaria dada en un contexto económico, político o cultural.',
            '3.2': 'Evalúa posibilidades y limitaciones del uso de una fuente para apoyar argumentos o explicaciones.',
            '3.3': 'Devela prejuicios e intenciones en enunciados o argumentos.',
            '4.1': 'Reconoce y compara perspectivas de actores y grupos sociales.',
            '4.2': 'Reconoce que las cosmovisiones, ideologías y roles sociales influyen en diferentes argumentos, posiciones y conductas.',
            '4.3': 'Establece relaciones entre las perspectivas de los individuos en una situación conflictiva y las propuestas de solución.'
        }
    },
    soc_reflexivo: {
        prueba: 'sociales', cuota: 0.30,
        nombre: 'Pensamiento reflexivo y sistémico',
        corto: 'Reflexivo y sistémico',
        evidencias: {
            '5.1': 'Analiza modelos conceptuales y sus usos en decisiones sociales.',
            '6.1': 'Establece relaciones que hay entre dimensiones presentes en una situación problemática.',
            '6.2': 'Analiza los efectos en distintas dimensiones que tendría una posible intervención.'
        }
    },

    // ── Ciencias Naturales ──────────────────────────────────────────────────
    // Cuotas de la Tabla 31: uso comprensivo 30 %, explicación 30 %,
    // indagación 40 %. Esa misma tabla cruza cada competencia con los
    // COMPONENTES (biológico, físico, químico y CTS) — ver ICFES_COMPONENTES_CN.
    cn_uso: {
        prueba: 'ciencias', cuota: 0.30,
        nombre: 'Uso comprensivo del conocimiento científico',
        corto: 'Uso comprensivo',
        evidencias: {
            '1.1': 'Explica algunos principios para mantener la salud individual y la pública, basado en principios biológicos, químicos y físicos.',
            '1.2': 'Explica cómo la explotación de un recurso o el uso de una tecnología tiene efectos positivos o negativos en las personas y en el entorno.',
            '1.3': 'Explica el uso correcto y seguro de una tecnología o artefacto en un contexto específico.',
            '2.1': 'Da las razones por las cuales una reacción describe un fenómeno y justifica las relaciones cuantitativas, teniendo en cuenta la ley de conservación de la masa.',
            '2.2': 'Reconoce las razones por las cuales la materia se puede diferenciar según su estructura y propiedades, y justifica las diferencias entre elementos, compuestos y mezclas.',
            '2.3': 'Reconoce los atributos que definen ciertos procesos fisicoquímicos simples (separación de mezclas, solubilidad, gases ideales, cambios de fase).',
            '2.4': 'Elabora explicaciones sobre un sistema electrónico a partir de los modelos básicos de circuitos.',
            '2.5': 'Elabora explicaciones sobre un sistema a partir de los modelos básicos de cinemática y dinámica newtoniana.',
            '2.6': 'Elabora explicaciones sobre un sistema a partir de los modelos básicos de la termodinámica.',
            '2.7': 'Elabora explicaciones sobre un sistema a partir de los modelos básicos de ondas.',
            '2.8': 'Analiza aspectos de los ecosistemas y da razón de cómo funcionan y de sus interrelaciones con los factores bióticos y abióticos.',
            '2.9': 'Analiza la dinámica interna de los organismos y da razón de cómo funcionan sus componentes para mantener la vida.',
            '3.1': 'Usa modelos físicos basados en dinámica clásica para comprender un fenómeno particular en un sistema.',
            '3.2': 'Identifica y usa modelos químicos para comprender fenómenos particulares de la naturaleza.',
            '3.3': 'Analiza y usa modelos biológicos para comprender la dinámica que se da en lo vivo y en el entorno.'
        }
    },
    cn_explicacion: {
        prueba: 'ciencias', cuota: 0.30,
        nombre: 'Explicación de fenómenos',
        corto: 'Explicación',
        evidencias: {
            '4.1': 'Relaciona los componentes de un circuito en serie y en paralelo con sus respectivos voltajes y corrientes.',
            '4.2': 'Relaciona los factores que determinan la dinámica de un sistema o fenómeno para identificar su comportamiento, según las leyes de la física.',
            '4.3': 'Relaciona los tipos de energía presentes en un objeto con las interacciones del sistema con su entorno.',
            '4.4': 'Establece relaciones entre fenómenos biológicos para comprender la dinámica de lo vivo.',
            '4.5': 'Establece relaciones entre fenómenos biológicos para comprender su entorno.',
            '4.6': 'Diferencia distintos tipos de reacciones químicas y realiza cálculos teniendo en cuenta la ley de conservación de la masa y la carga.',
            '4.7': 'Establece relaciones entre conceptos fisicoquímicos simples (separación de mezclas, solubilidad, gases ideales) y distintos fenómenos naturales.',
            '4.8': 'Establece relaciones entre las propiedades y la estructura de la materia con la formación de iones y moléculas.',
            '5.1': 'Identifica las características fundamentales de las ondas, así como algunos fenómenos asociados a ellas.',
            '5.2': 'Identifica las formas de energía presentes en un fenómeno físico y las transformaciones que se dan entre ellas.',
            '5.3': 'Identifica los diferentes tipos de fuerzas que actúan sobre los cuerpos que conforman un sistema.',
            '5.4': 'Identifica características de algunos procesos que se dan en los ecosistemas para comprender su dinámica interior.',
            '5.5': 'Identifica características de algunos procesos que se dan en los organismos para comprender la dinámica de lo vivo.',
            '5.6': 'Identifica las propiedades y estructura de la materia y diferencia elementos, compuestos y mezclas.',
            '5.7': 'Reconoce posibles cambios en el entorno por la explotación de un recurso o el uso de una tecnología.'
        }
    },
    cn_indagacion: {
        prueba: 'ciencias', cuota: 0.40,
        nombre: 'Indagación',
        corto: 'Indagación',
        evidencias: {
            '6.1': 'Analiza qué tipo de pregunta puede ser contestada a partir del contexto de una investigación científica.',
            '6.2': 'Reconoce la importancia de la evidencia para comprender fenómenos naturales.',
            '7.1': 'Comunica de forma apropiada el proceso y los resultados de una investigación en ciencias naturales.',
            '7.2': 'Determina si los resultados derivados de una investigación son suficientes y pertinentes para sacar conclusiones.',
            '7.3': 'Elabora conclusiones a partir de información o evidencias que las respalden.',
            '7.4': 'Hace predicciones basado en información, patrones y regularidades.',
            '8.1': 'Interpreta y analiza datos representados en texto, gráficas, dibujos, diagramas o tablas.',
            '8.2': 'Representa datos en gráficas y tablas.',
            '9.1': 'Da posibles explicaciones de eventos o fenómenos consistentes con conceptos de la ciencia.',
            '9.2': 'Diseña experimentos para dar respuesta a sus preguntas.',
            '9.3': 'Elige y utiliza instrumentos adecuados para reunir datos.',
            '9.4': 'Reconoce la necesidad de registrar y clasificar la información para realizar un buen análisis.',
            '9.5': 'Usa información adicional para evaluar una predicción.'
        }
    }
};

// Componentes de Ciencias Naturales (Tabla 31). La cuota es un CRUCE: cada
// competencia se reparte entre los cuatro componentes, no es una lista aparte.
// CTS = Ciencia, Tecnología y Sociedad.
const ICFES_COMPONENTES_CN = {
    biologico: { nombre: 'Biológico', cuota: 0.30 },
    fisico:    { nombre: 'Físico',    cuota: 0.30 },
    quimico:   { nombre: 'Químico',   cuota: 0.30 },
    cts:       { nombre: 'Ciencia, Tecnología y Sociedad', cuota: 0.10 }
};

// Cuota oficial por tipo de texto en Lectura Crítica (Tabla 22). Los
// discontinuos van partidos 8 + 8, no 16 en bloque.
const ICFES_TIPOS_TEXTO = {
    lit_continuo:        { cuota: 0.24, nombre: 'Literario continuo', ayuda: 'novela, cuento, poesía, canción, dramaturgia' },
    info_filosofico:     { cuota: 0.30, nombre: 'Informativo filosófico', ayuda: 'texto filosófico: se evalúan estructura, ideas y argumentos — NUNCA historia de la filosofía ni tecnicismos' },
    info_no_filosofico:  { cuota: 0.30, nombre: 'Informativo no filosófico', ayuda: 'ensayo, columna de opinión, crónica' },
    lit_discontinuo:     { cuota: 0.08, nombre: 'Literario discontinuo', ayuda: 'caricatura, cómic' },
    info_discontinuo:    { cuota: 0.08, nombre: 'Informativo discontinuo', ayuda: 'etiqueta, infografía, tabla, diagrama, aviso, manual, reglamento' }
};

// Contenidos de Matemáticas: 3 categorías partidas en genéricos / no genéricos.
// No existe la categoría "aritmética". Regla explícita de la guía: toda
// expresión algebraica cuenta como NO genérica → es el dial de dificultad.
const ICFES_CATEGORIAS_MAT = {
    estadistica:     { nombre: 'Estadística', genericos: 'tablas y gráficas, unión e intersección de conjuntos, promedio y rango, conteos simples, población y muestra', noGenericos: 'error, varianza, percentiles, mediana, correlación, combinaciones y permutaciones' },
    geometria:       { nombre: 'Geometría', genericos: 'formas, perímetros, áreas y volúmenes de figuras corrientes, planos y mapas', noGenericos: 'geometría analítica, semejanza y congruencia formal, trigonometría' },
    // ⚠️ "Cálculo" aquí NO es cálculo diferencial. El Saber 11 no evalúa
    // derivadas, integrales ni límites: un ítem que pida "el costo marginal
    // derivando C(x)" está fuera del examen aunque suene sofisticado. Se llegó a
    // generar uno así porque este campo decía "límites". Es variación en el
    // sentido de la guía: cómo cambia una cantidad respecto de otra.
    algebra_calculo: { nombre: 'Álgebra y variación', genericos: 'patrones y secuencias descritos en palabras, proporcionalidad directa', noGenericos: 'expresiones algebraicas, ecuaciones e inecuaciones, funciones lineales y cuadráticas, razones de cambio leídas de una tabla o una gráfica — NUNCA derivadas, integrales ni límites: no se evalúan en el Saber 11' }
};

// Los cuatro contextos oficiales. El ítem declara el suyo.
const ICFES_CONTEXTOS = {
    familiar:    'Familiar o personal — finanzas del hogar, transporte, salud, recreación',
    laboral:     'Laboral u ocupacional — tareas de trabajo, sin exigir conocimiento técnico del oficio',
    comunitario: 'Comunitario o social — política, economía, convivencia, medioambiente',
    matematico:  'Matemático o científico — situaciones abstractas, propias de las matemáticas'
};

// 🔑 La forma de la pregunta. Lo que MÁS se pierde al generar con IA: el ICFES
// casi nunca pregunta "¿cuánto da?", pregunta "¿es válido este razonamiento y
// por qué?". Las opciones no son números, son veredicto + justificación. El
// instinto de una IA es "calcule el valor de x" con cuatro números — un ítem así
// tiene la apariencia correcta y el fondo equivocado, que es la peor forma de
// fallar porque parece fiel y no lo es.
const ICFES_FORMAS = {
    veredicto_justificacion: {
        nombre: 'Veredicto + justificación',
        ayuda: 'Alguien afirma algo y el estudiante juzga si es correcto Y por qué. Las 4 opciones son "Sí, porque…" / "No, porque…". Es la forma dominante del examen real.'
    },
    calculo:             { nombre: 'Cálculo', ayuda: 'Pide un valor. Úsese con moderación: el examen real casi no la usa.' },
    interpretacion_dato: { nombre: 'Interpretación de dato', ayuda: 'Leer una tabla, gráfica o texto y extraer o comparar información.' }
};

// 🔴 CORREGIDO 2026-08-07 CONTRA EL CUADERNILLO, midiéndolo en vez de creerlo.
//
// Antes esto era `0.5` con el argumento de que "el ICFES casi siempre pregunta
// así". Esa conclusión salía de mirar las TRES primeras preguntas del cuadernillo
// —las tres de esa forma— y generalizar. Contadas las 37 preguntas con sus 4
// opciones, la forma veredicto+justificación aparece en 6: el **16 %**, no la
// mitad. Forzar el 50 % no protegía la fidelidad: la rompía, empujando el banco
// hacia una forma que el examen usa poco.
//
// Es el mismo error que ya se había cometido con las cuotas por tipo de texto, y
// la misma lección: una muestra de tres no es una distribución.
const ICFES_VEREDICTO_MAT = { min: 0.10, max: 0.35, real: 0.16 };

// Largo de las opciones, medido en el cuadernillo oficial (mediana / p90):
//   Matemáticas     27 / 91 caracteres   ← muchas son solo una cifra
//   Lectura Crítica 63 / 90 caracteres
// Sirve para avisar cuando un lote sale con opciones que parecen párrafos: eso
// delata contenido generado, no un examen.
// Medido en el cuadernillo de CADA prueba, no extrapolado de una a otra: las
// cuatro son muy distintas. Matemáticas responde con cifras (mediana 27) y
// Sociales con afirmaciones completas (80): usar un solo número para todas
// habría dado por buenas unas y por malas otras sin motivo.
const ICFES_LARGO_OPCION = {
    matematicas:     { mediana: 27, p90: 91 },
    lectura_critica: { mediana: 63, p90: 90 },
    ciencias:        { mediana: 68, p90: 91 },
    sociales:        { mediana: 80, p90: 85 }
};

// Proporción de la forma veredicto+justificación, contada en cada cuadernillo.
// Ninguna prueba se acerca a la mitad; era una creencia del diseño inicial.
const ICFES_VEREDICTO_REAL = { matematicas: 0.16, sociales: 0.13, ciencias: 0.07 };

// 🔴 CERO de las 344 opciones del cuadernillo empieza con una expresión vaga
// ("cerca de", "más de", "aproximadamente"). El ICFES sí usa aproximaciones,
// pero las declara en el ENUNCIADO ("¿de qué valor fue, aproximadamente, el
// bono?") y deja las opciones como cantidades concretas. Una opción vaga
// convierte una pregunta de matemáticas en una de intuición.
const ICFES_OPCION_VAGA = /^\s*(cerca de|casi|alrededor de|un poco (m[áa]s|menos)|aproximadamente|m[áa]s o menos|entre .* y )/i;

// Niveles de desempeño oficiales (escala 0-100 por prueba).
// ⚠️ LOS CORTES NO SON IGUALES EN LAS DOS PRUEBAS. Verificado 2026-07-26 contra
// los PDF oficiales del ICFES ("Niveles de desempeño prueba Lectura Crítica /
// Matemáticas Saber 11"): en Lectura Crítica el nivel 3 va de 51 a 65 y el 4
// empieza en 66; en Matemáticas el 3 llega hasta 70 y el 4 empieza en 71.
// Se había implementado un corte único para ambas, así que un 68 en Matemáticas
// mostraba "Nivel 4" cuando en el examen real es Nivel 3.
const ICFES_NIVELES = {
    lectura_critica: [
        { nivel: 1, min: 0,  max: 35,  nombre: 'Nivel 1', descripcion: 'Identifica elementos literales del texto, sin establecer relaciones de significado entre ellos.' },
        { nivel: 2, min: 36, max: 50,  nombre: 'Nivel 2', descripcion: 'Comprende textos de forma literal y reconoce información explícita relacionada con su contexto.' },
        { nivel: 3, min: 51, max: 65,  nombre: 'Nivel 3', descripcion: 'Jerarquiza la información del texto y reconoce relaciones entre sus partes.' },
        { nivel: 4, min: 66, max: 100, nombre: 'Nivel 4', descripcion: 'Valora y contrasta los elementos del texto, y resuelve problemas de interpretación.' }
    ],
    matematicas: [
        { nivel: 1, min: 0,  max: 35,  nombre: 'Nivel 1', descripcion: 'Reconoce datos sueltos en una representación, sin usarlos para resolver una situación.' },
        { nivel: 2, min: 36, max: 50,  nombre: 'Nivel 2', descripcion: 'Identifica valores representativos y compara probabilidades de eventos simples.' },
        { nivel: 3, min: 51, max: 70,  nombre: 'Nivel 3', descripcion: 'Selecciona y aplica procedimientos para resolver situaciones en contexto.' },
        { nivel: 4, min: 71, max: 100, nombre: 'Nivel 4', descripcion: 'Modela situaciones complejas y argumenta la validez de procedimientos y conclusiones.' }
    ]
};

function icfesNivelDesempeno(puntaje0a100, prueba = 'lectura_critica') {
    const p = Math.max(0, Math.min(100, Number(puntaje0a100) || 0));
    const escala = ICFES_NIVELES[prueba] || ICFES_NIVELES.lectura_critica;
    return escala.find(n => p >= n.min && p <= n.max) || escala[0];
}

// Afirmaciones de una prueba, con su cuota. Lo usan el selector de ítems (para
// respetar la cuota dentro de la sesión) y el validador del generador.
function icfesAfirmacionesDe(prueba) {
    return Object.entries(ICFES_AFIRMACIONES)
        .filter(([, a]) => a.prueba === prueba)
        .map(([codigo, a]) => ({ codigo, ...a }));
}

// Reparte n ítems entre las afirmaciones respetando la cuota oficial. Reparto
// por resto mayor: con 15 ítems de LC da 4/6/5 (25/42/33 %), no 5/5/5.
function icfesRepartirPorCuota(prueba, total) {
    const afirmaciones = icfesAfirmacionesDe(prueba);
    const exactos = afirmaciones.map(a => ({ codigo: a.codigo, exacto: a.cuota * total }));
    const reparto = {};
    let asignados = 0;
    exactos.forEach(e => { reparto[e.codigo] = Math.floor(e.exacto); asignados += reparto[e.codigo]; });
    exactos
        .sort((x, y) => (y.exacto - Math.floor(y.exacto)) - (x.exacto - Math.floor(x.exacto)))
        .slice(0, Math.max(0, total - asignados))
        .forEach(e => { reparto[e.codigo] += 1; });
    return reparto;
}
