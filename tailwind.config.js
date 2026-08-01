/** Config de Tailwind del sitio.
 *
 * Antes vivia inline en cada una de las 11 paginas junto al Play CDN
 * (cdn.tailwindcss.com), que compilaba el CSS EN EL NAVEGADOR en cada visita.
 * Cuando ese script no llegaba —red movil, ahorro de datos, un bloqueador— la
 * web se pintaba sin un solo estilo. Ahora el CSS se compila aqui y se sirve
 * como tailwind.css desde el propio hosting.
 *
 * OJO: `content` tiene que incluir los .js. La mitad de las clases del sitio
 * se escriben dentro de plantillas de shared.js, admin.html y compania; si un
 * archivo no esta listado aqui, sus clases NO entran al CSS y esa parte de la
 * interfaz se ve rota.
 *
 * Recompilar con:  npx tailwindcss@3 -i tailwind.src.css -o tailwind.css --minify
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * SISTEMA DE DISENO (2026-08-01)
 *
 * Sale de MEDIR stripe.com y linear.app con el mismo script que esta pagina
 * (ver el vault: proyectos/red-egresados/diseno-referencias.md). Los cuatro
 * numeros que salieron de ahi, y que son los que se corrigen aqui:
 *
 *  1. PESOS. El peso 700 era el estilo mas usado de nuestra portada (51
 *     elementos), mas 19 en 800. Stripe ENTERA se dibuja con 300 y 400;
 *     Linear no pasa de 590. Cuando todo lo importante esta en negrita, nada
 *     destaca: solo sube el ruido. La jerarquia se hace con TAMANO y ESPACIO.
 *     -> aqui el tope es 600, y 600 es para titulares.
 *
 *  2. ESCALA. Linear salta de 64px a 14px (4.6x). El truco no es agrandar el
 *     titular: es hacer el resto mas pequeno.
 *
 *  3. RADIOS. Convivian seis (8, 12, 16, 24, 48 y pildora) sin regla de cual
 *     le toca a que. -> dos valores y una regla: 'control' para lo pulsable,
 *     'superficie' para lo que contiene. Y la pildora solo en avatares.
 *
 *  4. RITMO. Los paddings de seccion iban 80, 48, 64, 96, 48, 96, 48, 64:
 *     cinco valores sin patron. -> `seccion` y `seccion-sm`, nada mas.
 * ═══════════════════════════════════════════════════════════════════════════
 */
module.exports = {
    content: ['./*.html', './*.js'],
    theme: {
        extend: {
            fontFamily: { sans: ['"Plus Jakarta Sans"', 'sans-serif'] },

            // ── 1. PESOS ────────────────────────────────────────────────────
            // Se dejan solo cuatro y el tope es 600. No se BORRAN los de
            // Tailwind (font-bold sigue existiendo para no romper las 10
            // paginas que aun no se han tocado), pero la UI nueva usa estos.
            fontWeight: {
                normal: '400',      // cuerpo
                medio: '500',       // enfasis dentro de un parrafo, etiquetas
                fuerte: '600',      // titulares y botones: el tope
                // 700/800 siguen accesibles como font-bold/font-extrabold
                // solo para lo que todavia no se ha migrado.
            },

            // ── 2. ESCALA TIPOGRAFICA ───────────────────────────────────────
            // Cada paso lleva ya su line-height y su tracking: el tracking
            // negativo tiene que CRECER con el tamano (a 60px, -0.025em; a
            // 14px, 0). Es lo que hace que un titular grande se vea compuesto
            // en vez de suelto.
            fontSize: {
                'micro':   ['0.75rem',  { lineHeight: '1rem',     letterSpacing: '0.06em'  }], // 12 — etiquetas
                'menor':   ['0.8125rem',{ lineHeight: '1.25rem',  letterSpacing: '0'       }], // 13 — apoyos
                'base':    ['0.9375rem',{ lineHeight: '1.6',      letterSpacing: '0'       }], // 15 — cuerpo
                'lectura': ['1.0625rem',{ lineHeight: '1.65',     letterSpacing: '-0.005em'}], // 17 — parrafo destacado
                'titulo3': ['1.375rem', { lineHeight: '1.3',      letterSpacing: '-0.012em'}], // 22
                'titulo2': ['2rem',     { lineHeight: '1.15',     letterSpacing: '-0.018em'}], // 32
                'titulo1': ['2.75rem',  { lineHeight: '1.08',     letterSpacing: '-0.022em'}], // 44
                'gran':    ['4rem',     { lineHeight: '1.02',     letterSpacing: '-0.028em'}], // 64 — el hero
            },

            // ── 3. RADIOS ───────────────────────────────────────────────────
            borderRadius: {
                control: '6px',      // botones, campos, chips: lo pulsable
                superficie: '10px',  // lo que contiene algo
                // `rounded-full` se queda SOLO para avatares.
            },

            // ── 4. RITMO VERTICAL ───────────────────────────────────────────
            // Dos valores para separar secciones y se acabo. Todo lo demas
            // sale de la escala de 8 que Tailwind ya trae.
            spacing: {
                seccion: '7rem',      // 112 — separacion entre secciones
                'seccion-sm': '4rem', // 64  — la misma en movil
            },

            colors: {
                brand: { 50:'#f0fdf4',100:'#dcfce7',200:'#bbf7d0',300:'#86efac',400:'#4ade80',500:'#22c55e',600:'#16a34a',700:'#15803d',800:'#166534',900:'#14532d',950:'#052e16' },
                stone: { 50:'#fafaf9',100:'#f5f5f4',200:'#e7e5e4',300:'#d6d3d1',400:'#a8a29e',500:'#78716c',600:'#57534e',700:'#44403c',800:'#292524',900:'#1c1917' },
                sun: { 50:'#fffbeb',100:'#fef3c7',200:'#fde68a',400:'#fbbf24',500:'#f59e0b',600:'#d97706' }
            },
            animation: { 'fade-in':'fadeIn 0.3s ease-out','slide-up':'slideUp 0.4s ease-out','slide-in-right':'slideInRight 0.4s cubic-bezier(0.16,1,0.3,1)' },
            keyframes: { fadeIn:{'0%':{opacity:'0'},'100%':{opacity:'1'}},slideUp:{'0%':{transform:'translateY(20px)',opacity:'0'},'100%':{transform:'translateY(0)',opacity:'1'}},slideInRight:{'0%':{transform:'translateX(100%)'},'100%':{transform:'translateX(0)'}} }
        }
    }
};
