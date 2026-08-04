# El diseño de la portada de Sinapsis

Descripción completa de cómo está construida y por qué. Los valores son los que
hay en el código (`index.html`, bloque `<style>` con prefijo `.hp-`, e
`historias.js`), no aproximaciones.

Última revisión: 2026-08-03 · Rama `hero-samsung`.

---

## 1. De dónde sale la dirección

La referencia la eligió Juan: **samsung.com**. Lo que se copió de ahí, mirando el
sitio y no de memoria:

- **Bloques a sangre**: lo visual llega al borde de la pantalla, sin contenedor
  centrado ni esquinas redondeadas.
- **Tipografía en peso medio (600), no negrita extrema.**
- **El color lo pone el contenido**, no un degradado de fondo.
- **Botones de píldora**, discretos, sin sombras de color saturado.
- **Barra de navegación transparente** sobre la primera pantalla.

Lo propio de Sinapsis: donde Samsung pone su producto, esta portada pone **una
trayectoria real de la plataforma**. Esa es la pieza que define todo lo demás.

**Tres reglas que gobiernan el diseño entero:**

1. **Nada inventado.** Ni cifras, ni testimonios, ni clientes, ni rostros
   generados. Si el dato no existe, el elemento no se muestra.
2. **La caja se gana su sitio.** Solo hay superficie con borde donde el elemento
   se pulsa. Un párrafo no lleva recuadro.
3. **Cada sección se maqueta distinta.** Es lo que evita que al bajar sin leer
   todo parezca el mismo bloque repetido.

---

## 2. Color

Tres familias, todas presentes antes del rediseño. **No se añadió ninguna nueva**
(se probó un azul tinta y se descartó).

### Verde — el color de la marca

| Uso | Valor |
| --- | --- |
| Acción principal, rótulos, iconos | `#16a34a` |
| Verde vivo (nodo «hoy», acentos) | `#22c55e` |
| Verde oscuro (texto sobre claro, avatares) | `#14532d` / `#15803d` |
| Fondo del hero | `#dcfce7` |
| Segundo plano del corte diagonal | `#bbf7d0` |
| Banda suave («Para quién es») | `#f0fdf4` |
| Banda más tenue (Historias) | `#f7fcf9` |

### Ámbar — acento escaso

`#d97706` en iconos alternos y `#b45309` sobre `#fef3c7` en la etiqueta **HOY** de
la trayectoria.

> ⚠️ El ámbar funciona **como acento en un punto pequeño**. Como superficie
> grande choca con el verde frío de la marca y el fondo se lee sucio: se probó un
> crema `#fffbeb` de fondo en Historias y hubo que quitarlo.

### Teal — tercer acento

`#0d9488` / `#0f766e` en el rótulo de «Qué encuentras aquí», un icono de cada
rejilla y la banda `#f0fdfa` de Preparación.

### Neutros

Texto `#1c1917`, secundario `#57534e`, terciario `#78716c` y `#a8a29e`. Bordes
`#ebeae8` y `#e7e5e4`. Fondo general `#fafaf9`.

### Cómo se reparte

El color **alterna con franjas claras** para que no sea una mancha continua:

```
hero (verde) → historias (verde tenue) → cómo funciona (claro) →
para quién es (verde suave) → qué encuentras (claro) →
preparación (teal) → propósito (ilustración) → contacto (claro) → cierre (verde pleno)
```

**El 56 % de la altura de la página tiene color de fondo.** Antes de repartirlo
era el 27 %, con 2645 px seguidos sin una sola superficie de color.

**Prohibido:** degradados de fondo decorativos, manchas de color desenfocadas
(`blur`), sombras de color saturado bajo los botones, y la combinación
morado-azul.

---

## 3. Tipografía

**Una sola familia: Plus Jakarta Sans** (Google Fonts, pesos 300-800; en la
práctica se usan 400, 500 y 600).

| Elemento | Tamaño | Peso | Notas |
| --- | --- | --- | --- |
| `h1` del hero | `clamp(2.5rem, 4.6vw, 4rem)` | 600 | `letter-spacing: -.035em`, `line-height: 1.05` |
| Título de sección | `clamp(1.85rem, 3.1vw, 2.6rem)` | 600 | `-.032em` |
| Cita del propósito | `clamp(1.5rem, 3vw, 2.5rem)` | 600 | |
| Título de cierre | `clamp(1.75rem, 3.2vw, 2.6rem)` | 600 | |
| Rótulo de sección | `.78rem` | 600 | Mayúsculas, `letter-spacing: .14em` |
| Entrada del hero | `clamp(1.02rem, 1.15vw, 1.2rem)` | 400 | |
| Cuerpo | `.92rem`–`1.03rem` | 400 | `line-height` 1.6-1.68 |

**El peso 600 es el techo.** La portada anterior tenía 51 elementos en peso 700 y
era su rasgo más delator. Aquí no hay ni un 700 ni un 800.

---

## 4. Forma

- **Radios:** solo cuatro valores. `999px` (píldoras y avatares), `20px` (bloques
  de color), `14px` (la ventana y paneles), `12px` (tarjetas), `6px` (etiquetas).
  Antes convivían seis radios distintos sin criterio.
- **Sombras:** una sola receta, en **tres capas** — contacto + difusa + una línea
  de 1 px que hace de borde:
  ```
  0 1px 1px rgba(12,10,9,.04),
  0 18px 36px -12px rgba(12,10,9,.16),
  0 48px 90px -30px rgba(12,10,9,.28),
  0 0 0 1px rgba(12,10,9,.05)
  ```
  Esa tercera capa es lo que hace que la ventana se lea como **un objeto** y no
  como un recuadro. Una sola sombra grande es lo que da aspecto de plantilla.
- **Ritmo vertical:** un único patrón, `clamp(2.5rem, 4.5vw, 4rem)` por sección.
  Antes había cinco paddings distintos sin relación entre sí.
- **Curva de animación:** siempre la misma, `cubic-bezier(.16, 1, .3, 1)`.

---

## 5. La primera pantalla

Dos columnas asimétricas (`1.05fr / 1fr`), alto `min(86vh, 46rem)`, **a sangre**:
se sale del contenedor con márgenes negativos que anulan el `padding` del `main`
(nunca con `100vw`, que cuenta la barra de desplazamiento de más y provoca
desplazamiento horizontal).

**Izquierda:** rótulo, `h1` a dos líneas («Cultiva tu red / *Cosecha tu futuro*»,
la segunda en verde), entrada de tres líneas, dos botones de píldora (verde
relleno + contorno) y una fila de iniciales con el número real de promociones.

**Derecha — la pieza central del diseño:** un bloque verde plano con un **corte
diagonal** (`clip-path`) en un verde de la misma familia, y encima **una ventana**
con barra de navegador y, dentro, **una trayectoria real** de un egresado:
avatar, nombre, promoción y sus hitos con nodos, la línea que los une y la
etiqueta HOY en ámbar.

Detalles que importan:

- **Se dibuja en HTML, no es una captura.** Queda nítida en cualquier pantalla,
  pesa lo que pesa el texto y se actualiza sola con los datos.
- **Perspectiva:** `perspective(1800px)` con `rotateY(-7deg)` y `rotateX(1.2deg)`
  en reposo.
- **Sigue al cursor** por toda la primera pantalla: la inclinación se calcula
  respecto al **centro de la ventana** (no del hero, o el punto neutro cae en
  medio del texto y el movimiento se siente raro). Rango: unos 13° en horizontal
  y 9° en vertical, con el campo estirado 120 px por arriba y 320 por abajo.
  Solo con ratón real: `(hover: hover) and (pointer: fine)`.
- **Mientras llegan los datos** se ve un esqueleto **con la forma exacta de la
  ficha**, para que al llenarse no dé un salto. Y si ya visitaste la página, la
  ficha anterior se restituye durante el parseo: aparece al instante.

La barra de navegación va **transparente** sobre el hero y toma fondo al
desplazarse — solo en escritorio; en móvil las celdas oscuras le pasaban por
debajo y el logo se cruzaba con el contenido.

---

## 6. Las secciones, una por una

**Ninguna se maqueta como la anterior.** Es la regla que más se nota al bajar.

| Sección | Composición | Color |
| --- | --- | --- |
| **Historias** | Cabecera al margen izquierdo; 2 o 3 columnas **según cuántas historias haya de verdad** | Verde muy tenue |
| **Cómo funciona** | **La única centrada.** Cuatro pasos dibujados como una **trayectoria**: nodos unidos por una línea (horizontal en escritorio, vertical en móvil) | Claro |
| **Para quién es** | **Partida**: el título se queda fijo a un lado mientras los tres públicos pasan por el otro, apilados y separados por una línea | Verde suave |
| **Qué encuentras aquí** | Título al margen y **lista numerada** 01/02/03 con separadores; cada fila termina en un destino real | Claro |
| **Preparación** | Cabecera al margen; tres exámenes con una **barra de color** que se extiende al pasar el cursor | Teal muy claro |
| **Propósito** | Dos columnas sobre una **ilustración**: la cita a gran tamaño y, al lado, la forma de una trayectoria genérica | Ilustración |
| **Contacto + Preguntas** | Sin cabecera propia: el título entra **dentro** de la columna del acordeón; las vías de contacto en un panel al lado | Claro |
| **Cierre** | Centrado, **verde pleno** con su corte diagonal y botón blanco | Verde `#16a34a` |

Notas de contenido:

- **La ilustración del propósito** se generó a medida (rutas que salen de un punto
  y se abren, curvas de nivel en verdes). Es lo que dice el texto, dibujado.
  WebP de 78 KB, con medidas declaradas y carga diferida.
- **La trayectoria genérica** del propósito (Colegio → Universidad → Primer
  trabajo → Hoy) no lleva nombres ni datos: es el concepto, no el perfil de
  nadie.
- **Los datos de los exámenes** son la estructura oficial (2 módulos, 4 épreuves,
  sesiones de 10). **No se publica cuántas preguntas tiene el banco propio**,
  porque ese número cambia y la portada quedaría desactualizada sin que nadie se
  entere.
- **El listening no se menciona**: sigue en construcción.

---

## 7. Movimiento

**Solo se anima `opacity` y `transform`.** Nada que mueva la maquetación: un
elemento que empuja a los de al lado al pasar por encima se siente roto, no vivo.

**Al cargar:** el texto del hero entra escalonado (60-370 ms), la ventana aparece
con un desplazamiento leve y los hitos de la trayectoria se encadenan.

**Al bajar:** cada bloque aparece cuando entra en pantalla, escalonado dentro de
cada rejilla, y el bloque visual del hero se desplaza más despacio que la página.

> ⚠️ El revelado **no usa `IntersectionObserver`**. Ese solo avisa cuando *cambia*
> la intersección, así que un salto de scroll —arrastrar la barra, un ancla,
> recargar a media página— se salta bloques que **quedan invisibles para
> siempre**. Es un barrido de pendientes con freno **por tiempo**, no con
> `requestAnimationFrame`: rAF no corre en pestañas de fondo y dejaba el
> mecanismo bloqueado. Los bloques que llegan tarde de la base de datos se
> registran con `hpObservar()`.

**Al pasar el cursor:** las filas se tiñen y se desplazan, su número crece, los
iconos suben y escalan, el nodo del paso pasa a 1,55× con halo, las tarjetas se
levantan 6 px, la barra de cada examen se extiende y los botones escalan.

**Todo respeta `prefers-reduced-motion`**: con esa preferencia activa no hay
entrada, ni parallax, ni seguimiento del cursor, y el contenido se ve completo.

---

## 8. Adaptación a pantallas

- **Cortes:** 640 px, 768 px, 900 px y 1024 px.
- En móvil el hero pasa a una columna, la ventana pierde la perspectiva, los pasos
  se unen con una línea vertical y las columnas con separador vertical pasan a
  filas con separador horizontal.
- **Cero desplazamiento horizontal**, verificado en escritorio y a 390 px. Los
  bloques a sangre usan márgenes negativos contra el `padding` del contenedor,
  nunca `100vw`.

---

## 9. Rendimiento

- El panel del hero se pinta en **2,2 s** la primera visita e **instantáneo** en
  las siguientes (se guarda y se restituye durante el parseo). Antes tardaba ~6 s
  porque las trayectorias se pedían en cadena; ahora van en paralelo, en tandas
  del tamaño de lo que se pinta.
- Iconos con `defer` y `preconnect` a los tres dominios del arranque:
  `domInteractive` bajó de 838 a 308 ms.
- La ilustración pesa 78 KB (WebP) con medidas declaradas: **no mueve la página al
  cargar**.
- **Cero lecturas nuevas de base de datos** respecto a la portada anterior.

---

## 10. Accesibilidad

Un solo `h1`. Estructura de encabezados correcta. Los elementos pulsables son
`<button>` o `<a>` de verdad, con foco visible. Las imágenes decorativas van con
`alt=""` y `aria-hidden`. Los iconos no transmiten información por sí solos.
`prefers-reduced-motion` respetado en todo.

---

## 11. Lo que aún depende de decisiones externas

1. **No hay una sola foto de egresado.** Ninguno tiene `photoURL`, así que todos
   salen con iniciales sobre el verde de la marca. El código **ya prioriza la
   foto**: el día que alguien suba una, entra sola. Sin fotos reales, la portada
   no puede apoyar su peso visual en personas.
2. **El texto todavía nombra un solo colegio.** El cuerpo se neutralizó («el
   colegio», «un colegio de la red»), pero **el `h1`, el rótulo del hero, la
   `meta description` y el pie siguen diciendo «Liceo Campestre de Pereira»**. Con
   la red apuntando a toda Colombia, es una decisión de producto pendiente.
