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
 * ── Sistema de diseño (2026-07-31) ────────────────────────────────────────
 * Los colores SEMANTICOS (paper/surface/ink/line/brand/signal) salen de
 * variables CSS declaradas en tailwind.src.css, en formato "R G B" para que
 * Tailwind pueda seguir aplicandoles opacidad (bg-surface/60).
 *
 * Por que importa: el tema oscuro de este repo NO usa `dark:`, sino una hoja
 * de overrides en theme.js que traduce clase por clase (~200 reglas con
 * !important). Cualquier clase de color nueva que no este ahi se ve mal en
 * oscuro y nadie lo nota. Con estos tokens el problema desaparece: `bg-surface`
 * ya es distinto en oscuro porque la VARIABLE cambia. theme.js se queda como
 * red de seguridad de las clases viejas (bg-white, text-gray-500, ...).
 *
 * REGLA: en UI nueva usar los semanticos, no bg-white/text-gray-*.
 */
module.exports = {
    content: ['./*.html', './*.js'],
    /* Las primitivas del sistema (tailwind.src.css) viven en @layer components,
     * asi que Tailwind las PURGA si no las ve escritas en un .html o .js. Eso
     * esta bien para clases sueltas, pero varias de estas se aplican desde
     * plantillas de JS o se agregan por classList, donde el escaner es fragil.
     * Aqui se fijan para que existan siempre: son ~30 reglas, no pesan. */
    safelist: [
        'hilo', 'hilo-h', 'hilo-hito', 'franja',
        'btn', 'btn-primario', 'btn-linea', 'btn-plano',
        'enlace', 'lienzo', 'lienzo-interactivo', 'dato',
        'campo', 'etiqueta', 'esqueleto', 'fuente-display',
        'glass-nav', 'hide-scrollbar'
    ],
    theme: {
        extend: {
            fontFamily: {
                // UI, datos y navegacion.
                sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
                // Titulares y voz narrativa. Newsreader es un serif de texto
                // (opsz variable), no un didone de alto contraste: se lee como
                // publicacion institucional, no como plantilla de landing.
                display: ['Newsreader', 'Georgia', 'serif'],
                // Datos tabulares: promociones, años, puntajes.
                mono: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif']
            },
            colors: {
                // ── Semanticos (cambian solos en tema oscuro) ──
                paper: 'rgb(var(--paper) / <alpha-value>)',
                surface: 'rgb(var(--surface) / <alpha-value>)',
                'surface-alt': 'rgb(var(--surface-alt) / <alpha-value>)',
                ink: 'rgb(var(--ink) / <alpha-value>)',
                'ink-soft': 'rgb(var(--ink-soft) / <alpha-value>)',
                'ink-mute': 'rgb(var(--ink-mute) / <alpha-value>)',
                line: 'rgb(var(--line) / <alpha-value>)',
                'line-soft': 'rgb(var(--line-soft) / <alpha-value>)',
                signal: 'rgb(var(--signal) / <alpha-value>)',

                // ── Marca ──
                // Verde bosque, no el verde Tailwind #22c55e de fabrica: ese
                // brillo es media identidad del look "generado". Mismo rol,
                // mismos numeros, tono institucional.
                brand: { 50:'#f1f6f2',100:'#dce9e0',200:'#b9d3c2',300:'#8cb69c',400:'#589476',500:'#2e7a57',600:'#1b6144',700:'#134b35',800:'#0f3a29',900:'#0c2c20',950:'#061a13' },

                // Neutro calido-verdoso: los grises frios de Tailwind al lado
                // del verde bosque se ven azules.
                stone: { 50:'#fbfbf8',100:'#f4f5f2',200:'#e3e7e2',300:'#cbd2cc',400:'#9aa69e',500:'#78857c',600:'#5c6a61',700:'#47564d',800:'#2b352f',900:'#101a14' },

                // Acento calido heredado (avisos, empresas/aliados).
                sun: { 50:'#fdf8ed',100:'#f8ecd0',200:'#f0d79c',400:'#d9a441',500:'#c08a2c',600:'#9c6c20' }
            },
            borderRadius: {
                // Escala corta y contenida. El rounded-3xl / rounded-[3rem] de
                // antes es de los tics mas delatores; aqui el radio maximo de
                // una superficie es 12px y solo los avatares son circulares.
                DEFAULT: '4px', sm: '3px', md: '6px', lg: '8px', xl: '10px', '2xl': '12px', '3xl': '14px'
            },
            boxShadow: {
                // Sin sombras de color (shadow-brand-500/30) ni shadow-2xl.
                // La separacion la hace la linea, no el desenfoque.
                sm: '0 1px 2px rgb(16 26 20 / 0.04)',
                DEFAULT: '0 1px 2px rgb(16 26 20 / 0.05)',
                md: '0 2px 6px rgb(16 26 20 / 0.06)',
                lg: '0 6px 20px rgb(16 26 20 / 0.07)',
                xl: '0 12px 32px rgb(16 26 20 / 0.09)',
                '2xl': '0 20px 48px rgb(16 26 20 / 0.11)',
                alzado: '0 10px 30px -12px rgb(16 26 20 / 0.18)'
            },
            transitionTimingFunction: {
                // Easings con caracter. El default de Tailwind (ease-out,
                // 150ms) es lo que hace que todo se sienta barato e igual.
                salida: 'cubic-bezier(0.22, 1, 0.36, 1)',      // quint out: entra decidido, frena largo
                entrada: 'cubic-bezier(0.64, 0, 0.78, 0)',
                suave: 'cubic-bezier(0.65, 0, 0.35, 1)',
                resorte: 'cubic-bezier(0.34, 1.4, 0.64, 1)'     // rebote corto, para confirmaciones
            },
            transitionDuration: { 120:'120ms', 180:'180ms', 260:'260ms', 320:'320ms', 520:'520ms', 800:'800ms' },
            letterSpacing: { tightest:'-0.035em', tighter:'-0.022em', dato:'0.08em' },
            maxWidth: { lectura:'68ch' },
            keyframes: {
                fadeIn: { '0%':{opacity:'0'}, '100%':{opacity:'1'} },
                slideUp: { '0%':{transform:'translateY(20px)',opacity:'0'}, '100%':{transform:'translateY(0)',opacity:'1'} },
                slideInRight: { '0%':{transform:'translateX(100%)'}, '100%':{transform:'translateX(0)'} },
                // Aparicion del sistema nuevo: 10px, no 20 — a 20 se nota el
                // truco. Con ease-salida el ojo lee "colocado", no "volando".
                surgir: { '0%':{opacity:'0',transform:'translateY(10px)'}, '100%':{opacity:'1',transform:'translateY(0)'} },
                // Nodo del hilo al activarse: la carga que llega.
                pulsoNodo: { '0%':{transform:'scale(1)',boxShadow:'0 0 0 0 rgb(var(--signal) / 0.55)'}, '70%':{transform:'scale(1.12)',boxShadow:'0 0 0 8px rgb(var(--signal) / 0)'}, '100%':{transform:'scale(1)',boxShadow:'0 0 0 0 rgb(var(--signal) / 0)'} },
                // Carga: barrido de luz sobre el esqueleto, en vez de spinner.
                brillo: { '0%':{backgroundPosition:'-200% 0'}, '100%':{backgroundPosition:'200% 0'} }
            },
            animation: {
                'fade-in': 'fadeIn 0.3s ease-out',
                'slide-up': 'slideUp 0.4s ease-out',
                'slide-in-right': 'slideInRight 0.42s cubic-bezier(0.22,1,0.36,1)',
                surgir: 'surgir 0.52s cubic-bezier(0.22,1,0.36,1) both',
                'pulso-nodo': 'pulsoNodo 1.6s cubic-bezier(0.22,1,0.36,1)',
                brillo: 'brillo 1.4s linear infinite'
            }
        }
    }
};
