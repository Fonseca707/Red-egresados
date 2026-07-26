# Estándares de calidad de un ítem del Saber 11 (Sinapsis)

Rúbrica única contra la que se juzga **toda** pregunta antes de servírsela a un estudiante. La usan tanto la revisión automática (subagentes) como la persona que da el visto bueno final.

Derivada de la Guía de orientación Saber 11.º 2026 del ICFES y de los defectos reales que aparecieron al generar el primer banco (2026-07-26).

> **Regla que no se negocia:** los subagentes **filtran**, no publican. Una pregunta llega a un estudiante solo cuando una persona la aprobó. Lo que el filtro automático hace es que esa persona revise 20 preguntas dudosas en vez de 100 crudas.

---

## Veredicto por ítem

Cada revisión termina en uno de tres veredictos, y **siempre** con la razón:

| Veredicto | Cuándo |
|---|---|
| `aprobar` | Cumple los 10 estándares. Pasa a la lista de visto bueno humano. |
| `corregir` | El fondo sirve pero algo concreto está mal. **Obliga a proponer el texto corregido.** |
| `descartar` | Falla E1, E3 o E10, o acumula tres fallos menores. No se arregla: se genera otra. |

**Ante la duda, `corregir` — nunca `aprobar`.** Un ítem malo publicado le enseña mal a un estudiante y le cuesta la credibilidad al colegio; un ítem bueno descartado solo cuesta una generación de vuelta.

---

## Los 10 estándares

### E1 · Alineación con la evidencia declarada — *eliminatorio*
La pregunta debe demostrar **la evidencia que dice evaluar**, no una parecida. Si el ítem dice evaluar `2.3` (relaciones entre partes del texto) pero en realidad pregunta por un dato literal, **está mal clasificado**: se descarta o se reclasifica. Importa porque la cuota oficial y el diagnóstico por competencia se calculan con ese campo: mal etiquetado, el reporte al colegio miente.

### E2 · Forma fiel al examen real
- **Matemáticas:** la forma dominante es **veredicto + justificación** — alguien afirma algo y el estudiante juzga si es válido *y por qué*. Las opciones son «Sí, porque…» / «No, porque…», no cuatro números. Un ítem de «calcule el valor de x» con opciones numéricas es infiel aunque sea correcto.
- **Lectura Crítica:** la pregunta debe responderse **leyendo el texto**. Si se puede acertar con cultura general sin leerlo, es infiel.
- Enunciado siempre en **situación concreta**, nunca un ejercicio pelado.

### E3 · La clave es inequívocamente correcta — *eliminatorio*
Verificar **la cuenta, el dato y la inferencia**, no la apariencia. En Matemáticas, rehacer la operación. Falla también si hay **dos opciones defendibles** o si la «correcta» solo lo es bajo un supuesto que el enunciado no da. Este es el estándar que más ítems debería tumbar.

### E4 · Distractores plausibles y no adivinables
- Cada distractor debe corresponder a **un error real** de un estudiante de grado 11 (confundir promedio con mediana, leer la columna equivocada), no ser absurdo.
- **Nada de pistas de forma**: la correcta no puede ser la más larga, la más específica, ni la única con matices («generalmente», «puede»).
- Sin «todas/ninguna de las anteriores» (el ICFES no los usa).

### E5 · La justificación no regala la respuesta
Las justificaciones se muestran **después** de responder: son el valor del entrenamiento. Fallan si:
- revelan el procedimiento dentro de la propia opción («Sí, porque 120+130+…=810 y 810/6=135» **dentro de la opción** convierte la pregunta en un trámite);
- se limitan a repetir «es correcta» sin explicar por qué el distractor tentaba;
- contradicen la clave.

### E6 · Texto base autosuficiente y sin fuente atribuida — *eliminatorio si atribuye*
- Se entiende **sin imagen** (los discontinuos se describen: la tabla escrita, las viñetas narradas).
- **Prohibido atribuirlo a una entidad, autor, publicación o año reales.** Ya pasó: un texto inventado salió firmado como «Manual de la Alcaldía de Bogotá, 2023». Eso es contenido falso presentado como documento de una institución real. La única fuente válida es *«Texto original para práctica»*.

### E7 · Lenguaje y contenido apropiados
Español de Colombia, natural, sin tecnicismos que no se evalúan. Sin estereotipos de género, región, clase o etnia. Contextos reconocibles para un estudiante colombiano de 16-17 años. En textos filosóficos: se evalúan **estructura, ideas y argumentos**, nunca historia de la filosofía ni «qué sostenía tal autor».

### E8 · Dificultad coherente con la declarada
1 = directa y literal · 2 = exige una inferencia o un paso · 3 = varios pasos o inferencia no evidente · 4 = análisis o razonamiento encadenado. En Matemáticas, **toda expresión algebraica es contenido no genérico** → sube la dificultad por definición.

### E9 · Independencia y no repetición
La pregunta se responde sola (salvo el texto base compartido, que es legítimo). No repite otra del banco con las palabras cambiadas, ni pregunta lo mismo que otra del mismo texto.

### E10 · Originalidad — *eliminatorio*
Ni el texto ni el enunciado ni las opciones pueden reproducir o parafrasear material publicado del ICFES. Los cuadernillos oficiales prohíben el uso con fines de lucro **y** la transformación en obra derivada; Sinapsis le cobra al colegio. De los cuadernillos se toma la **forma de preguntar**, jamás el contenido.

---

## Cómo se aplica

1. **Exportar** las preguntas en cola (`revisado: false`) a JSON.
2. **Repartirlas entre subagentes**, cada uno con esta rúbrica completa y un lote pequeño (para que lea cada ítem de verdad, no en diagonal).
3. Cada subagente devuelve, **por ítem**: veredicto, estándares incumplidos, motivo en una frase y —si es `corregir`— el texto corregido.
4. **Aplicar**: los `descartar` se borran, los `corregir` se actualizan y vuelven a la cola, los `aprobar` quedan marcados como *listos para visto bueno*.
5. **La persona aprueba** — en bloque los limpios, uno a uno los dudosos.

> Los ítems de Matemáticas se revisan **rehaciendo la cuenta**, no leyéndola. La mayoría de los errores de un generador de ítems no son de estilo: son aritméticos y se ven bien.
