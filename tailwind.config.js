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
 * Recompilar con:  npx tailwindcss -i tailwind.src.css -o tailwind.css --minify
 */
module.exports = {
    content: ['./*.html', './*.js'],
    theme: {
        extend: {
            fontFamily: { sans: ['"Plus Jakarta Sans"', 'sans-serif'] },
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
