/* ═══════════════════════════════════════════════════════════════════════════
   SINAPSIS — sistema de movimiento
   Se carga en las 11 páginas, junto a theme.js y antes de shared.js.

   Qué resuelve: antes el sitio tenía tres keyframes sueltos y un puñado de
   `transition` sin duración ni curva, así que todo corría a los 150ms ease
   por defecto de Tailwind. Eso —más que cualquier color— es lo que hace que
   una web se sienta de plantilla: el movimiento no dice nada del producto.

   Aquí el movimiento tiene un solo tema, EL HILO: la trayectoria que se
   traza. El resto es mínimo y funcional.

   Reglas que este archivo respeta siempre:
   · Si el JS no llega, la web se ve completa (el ocultamiento vive bajo
     `html.motion`, y esa clase la pone este archivo).
   · `prefers-reduced-motion` se obedece: se muestra el resultado final, no la
     animación.
   · Nada de esto puede ser requisito para leer o usar la página.
   ═══════════════════════════════════════════════════════════════════════════ */

const motion = (() => {
    const quieto = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const soportaIO = typeof IntersectionObserver !== 'undefined';

    // Activa el modo animado. Se hace de inmediato (no en DOMContentLoaded)
    // para que no se vea el salto del contenido ya pintado.
    if (!quieto() && soportaIO) document.documentElement.classList.add('motion');

    /* ── 1. Aparición al entrar en pantalla ─────────────────────────────────
       Cada [data-surgir] aparece una vez. Si varios cuelgan de un mismo
       [data-surgir-grupo], entran escalonados: el ojo lee la lista como una
       secuencia y no como un bloque que parpadea.
       El escalón se acota a 6 elementos —a partir de ahí el último tardaría
       tanto que parecería roto— y baja a 45ms en listas largas.            */
    let observador = null;

    function iniciarObservador() {
        if (!soportaIO || quieto()) return;
        observador = new IntersectionObserver((entradas) => {
            entradas.forEach((e) => {
                if (!e.isIntersecting) return;
                e.target.setAttribute('data-visible', '');
                observador.unobserve(e.target);
            });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    }

    function registrar(raiz = document) {
        if (!observador) return;
        raiz.querySelectorAll('[data-surgir]:not([data-visible])').forEach((el) => {
            if (el.dataset.registrado) return;
            el.dataset.registrado = '1';
            observador.observe(el);
        });
    }

    function escalonar(contenedor, paso) {
        if (!contenedor) return;
        const hijos = [...contenedor.querySelectorAll('[data-surgir]')];
        const salto = paso || (hijos.length > 12 ? 45 : 70);
        hijos.forEach((el, i) => {
            el.style.setProperty('--retraso', `${Math.min(i, 6) * salto}ms`);
        });
        registrar(contenedor);
    }

    /* ── 2. El hilo ─────────────────────────────────────────────────────────
       Cada .hilo lleva --avance de 0 a 1 según cuánto de él ha pasado ya por
       la zona de lectura (el tercio superior de la pantalla). Los .hilo-hito
       que quedan por debajo del frente se marcan [data-alcanzado]; el último
       alcanzado es [data-activo] y es el único que se enciende con la señal.

       Se calcula en un rAF y sólo cuando algún .hilo está en pantalla: en
       páginas largas como el admin esto no puede costar scroll.            */
    const hilos = [];
    let pendiente = false;

    function medirHilo(hilo) {
        const caja = hilo.getBoundingClientRect();
        const alto = window.innerHeight || 1;
        const frente = alto * 0.68;                       // línea de lectura
        const recorrido = (frente - caja.top) / (caja.height || 1);
        const avance = Math.max(0, Math.min(1, recorrido));
        hilo.style.setProperty('--avance', avance.toFixed(4));

        const hitos = hilo.__hitos || (hilo.__hitos = [...hilo.querySelectorAll('.hilo-hito')]);
        let ultimo = -1;
        hitos.forEach((h, i) => {
            const alcanzado = h.getBoundingClientRect().top <= frente;
            if (alcanzado) { ultimo = i; h.setAttribute('data-alcanzado', ''); }
            else { h.removeAttribute('data-alcanzado'); }
            h.removeAttribute('data-activo');
        });
        if (ultimo >= 0 && hilo.__ultimo !== ultimo) {
            hilo.__ultimo = ultimo;
            hitos[ultimo].setAttribute('data-activo', '');
        } else if (ultimo >= 0) {
            hitos[ultimo].setAttribute('data-activo', '');
        }
    }

    function repintar() {
        pendiente = false;
        const alto = window.innerHeight || 0;
        hilos.forEach((h) => {
            const c = h.getBoundingClientRect();
            if (c.bottom < -200 || c.top > alto + 200) return;   // fuera de vista
            medirHilo(h);
        });
    }

    function pedirRepintado() {
        if (pendiente) return;
        pendiente = true;
        requestAnimationFrame(repintar);
    }

    function registrarHilos(raiz = document) {
        raiz.querySelectorAll('.hilo').forEach((h) => {
            if (h.dataset.hiloListo) return;
            h.dataset.hiloListo = '1';
            h.__hitos = null;
            hilos.push(h);
        });
        if (quieto()) {
            hilos.forEach((h) => {
                h.style.setProperty('--avance', '1');
                h.querySelectorAll('.hilo-hito').forEach((n) => n.setAttribute('data-alcanzado', ''));
            });
            return;
        }
        pedirRepintado();
    }

    /* ── 3. Contadores ──────────────────────────────────────────────────────
       Sube un número hasta su valor real cuando entra en pantalla. Se usa
       sólo con cifras verdaderas de la red (68 egresados, 12 promociones):
       animar un dato inventado sería peor que no animar nada.              */
    function contar(el, destino, ms = 900) {
        const fin = Number(destino);
        if (!Number.isFinite(fin)) { el.textContent = destino; return; }
        if (quieto()) { el.textContent = String(fin); return; }
        const inicio = performance.now();
        const paso = (ahora) => {
            const t = Math.min(1, (ahora - inicio) / ms);
            const suave = 1 - Math.pow(1 - t, 4);           // quint-ish out
            el.textContent = String(Math.round(fin * suave));
            if (t < 1) requestAnimationFrame(paso);
        };
        requestAnimationFrame(paso);
    }

    function contadores(raiz = document) {
        if (!soportaIO) return;
        const obs = new IntersectionObserver((entradas) => {
            entradas.forEach((e) => {
                if (!e.isIntersecting) return;
                contar(e.target, e.target.dataset.contador);
                obs.unobserve(e.target);
            });
        }, { threshold: 0.5 });
        raiz.querySelectorAll('[data-contador]').forEach((el) => obs.observe(el));
    }

    /* ── 4. API pública ─────────────────────────────────────────────────────
       `refrescar` es la que llaman las páginas después de pintar contenido
       traído de Firestore (el directorio, las historias del hero, la lista de
       chats). Sin esa llamada, lo nuevo se queda sin animar. */
    function refrescar(raiz = document) {
        registrar(raiz);
        registrarHilos(raiz);
        pedirRepintado();
    }

    function iniciar() {
        iniciarObservador();
        registrar(document);
        registrarHilos(document);
        contadores(document);
        window.addEventListener('scroll', pedirRepintado, { passive: true });
        window.addEventListener('resize', () => {
            hilos.forEach((h) => { h.__hitos = null; });
            pedirRepintado();
        }, { passive: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar);
    } else {
        iniciar();
    }

    return { refrescar, escalonar, registrar, contar, quieto };
})();

window.motion = motion;
