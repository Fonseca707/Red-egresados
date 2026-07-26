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

const ICFES_PRUEBAS = {
    lectura_critica: { nombre: 'Lectura Crítica', preguntasExamen: 41, icono: 'ph-book-open' },
    matematicas:     { nombre: 'Matemáticas',     preguntasExamen: 50, icono: 'ph-math-operations' }
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
    }
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
    algebra_calculo: { nombre: 'Álgebra y cálculo', genericos: 'patrones y secuencias descritos en palabras, proporcionalidad directa', noGenericos: 'toda expresión algebraica, funciones, ecuaciones, tasas de cambio, límites' }
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

// Mínimo de ítems en forma veredicto+justificación dentro de una sesión de
// Matemáticas. Es la validación que impide que el módulo derive a un cuestionario
// de aritmética con pinta de ICFES.
const ICFES_MIN_VEREDICTO_MAT = 0.5;

// Niveles de desempeño oficiales (escala 0-100 por prueba).
const ICFES_NIVELES = [
    { nivel: 1, min: 0,  max: 35, nombre: 'Nivel 1', descripcion: 'Desempeño insuficiente: aún no muestra las habilidades mínimas de la prueba.' },
    { nivel: 2, min: 36, max: 50, nombre: 'Nivel 2', descripcion: 'Desempeño mínimo: resuelve situaciones sencillas y directas.' },
    { nivel: 3, min: 51, max: 65, nombre: 'Nivel 3', descripcion: 'Desempeño satisfactorio: resuelve situaciones que exigen relacionar información.' },
    { nivel: 4, min: 66, max: 100, nombre: 'Nivel 4', descripcion: 'Desempeño avanzado: interpreta, argumenta y resuelve situaciones complejas.' }
];

function icfesNivelDesempeno(puntaje0a100) {
    const p = Math.max(0, Math.min(100, Number(puntaje0a100) || 0));
    return ICFES_NIVELES.find(n => p >= n.min && p <= n.max) || ICFES_NIVELES[0];
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
