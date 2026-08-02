// ─────────────────────────────────────────────────────────────────────────────
// Karla — asistente de Sinapsis (burbuja de chat). Orienta a estudiantes sobre
// carrera apoyándose en las rutas REALES de los egresados del colegio, y guía en
// el uso de la plataforma. Fase "amortiguador del cold start": útil desde el
// día 1 y mejora a medida que la red crece.
//
// Depende de: shared.js (state, loadAlumni, loadHitos, deriveLegacyHitos,
// formatHitoYears, sanitizeHTML).
//
// Motor: DeepSeek (deepseek-v4-flash, thinking desactivado) a través del
// proxy SINAPSIS_IA_PROXY (shared.js): el navegador nunca maneja la clave.
// ─────────────────────────────────────────────────────────────────────────────

const ORIENTADORA_MODEL = localStorage.getItem('sinapsis_ia_model') || 'deepseek-v4-flash';
const KARLA_NOMBRE = 'Karla';
const KARLA_SALUDO_KEY = 'sinapsis_karla_saludo_visto';

const orientadoraLogic = {
    open: false,
    busy: false,
    messages: [],   // {role: 'user'|'model', text}
    context: null,  // rutas + resumen de la red (se construye una vez por sesión)

    // ── Montaje ──────────────────────────────────────────────────────────────
    mount() {
        if (document.getElementById('orientadora-bubble')) return;
        const wrap = document.createElement('div');
        wrap.innerHTML = `
            <div id="karla-nudge" class="hidden fixed bottom-36 md:bottom-24 right-4 md:right-6 z-50 max-w-[15rem] cursor-pointer"
                 onclick="orientadoraLogic.openFromNudge()">
                <div class="relative bg-white rounded-2xl rounded-br-sm border border-gray-200 shadow-xl px-4 py-3 text-sm text-gray-700 leading-snug">
                    <button onclick="event.stopPropagation(); orientadoraLogic.dismissNudge()"
                        class="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gray-100 border border-gray-200 text-gray-500 flex items-center justify-center hover:bg-gray-200 transition text-xs" title="Cerrar">
                        <i class="ph-bold ph-x"></i>
                    </button>
                    <p><strong class="text-brand-700">Hola, soy ${KARLA_NOMBRE}.</strong> Estoy aquí para ayudarte a explorar qué estudiar y a moverte por la plataforma. ¿Hablamos?</p>
                </div>
            </div>
            <button id="orientadora-bubble" onclick="orientadoraLogic.toggle()" title="${KARLA_NOMBRE}, tu asistente"
                class="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 w-14 h-14 rounded-full bg-brand-600 text-white shadow-xl shadow-brand-600/30 flex items-center justify-center text-2xl hover:scale-105 transition">
                <i class="ph-duotone ph-chats-circle"></i>
            </button>
            <div id="orientadora-panel" class="hidden fixed bottom-36 md:bottom-24 right-4 md:right-6 z-50 w-[calc(100vw-2rem)] max-w-sm h-[28rem] bg-white rounded-3xl border border-gray-200 shadow-2xl flex flex-col overflow-hidden"></div>`;
        document.body.appendChild(wrap);
        this.maybeShowNudge();
    },

    // Saludo proactivo: aparece una vez por navegador, ~1.5 s tras cargar.
    maybeShowNudge() {
        if (localStorage.getItem(KARLA_SALUDO_KEY)) return;
        setTimeout(() => {
            if (this.open) return;
            const nudge = document.getElementById('karla-nudge');
            if (nudge) nudge.classList.remove('hidden');
        }, 1500);
    },

    dismissNudge() {
        const nudge = document.getElementById('karla-nudge');
        if (nudge) nudge.classList.add('hidden');
        localStorage.setItem(KARLA_SALUDO_KEY, '1');
    },

    openFromNudge() {
        this.dismissNudge();
        if (!this.open) this.toggle();
    },

    toggle() {
        this.open = !this.open;
        if (this.open) this.dismissNudge();
        const panel = document.getElementById('orientadora-panel');
        panel.classList.toggle('hidden', !this.open);
        if (this.open) {
            if (!this.messages.length) {
                this.messages.push({ role: 'model', text: this.greeting() });
            }
            this.renderPanel();
        }
    },

    // Saludo personalizado con el nombre del estudiante si hay sesión.
    greeting() {
        const nombre = (state?.profile?.firstName || '').trim();
        const hola = nombre ? `Hola, ${nombre}.` : 'Hola.';
        return `${hola} Soy ${KARLA_NOMBRE}, tu asistente en Sinapsis. Te ayudo con dos cosas: explorar qué estudiar apoyándome en las rutas reales de los egresados del colegio, y moverte por la plataforma (directorio, perfil, trayectorias, novedades, mensajes, práctica de TOEFL y DELF). ¿Con qué empezamos?`;
    },

    // ── Render ───────────────────────────────────────────────────────────────
    renderPanel() {
        const panel = document.getElementById('orientadora-panel');
        if (!panel) return;
        panel.innerHTML = `
            <div class="px-4 py-3 bg-brand-600 text-white flex items-center justify-between gap-2 shrink-0">
                <div class="flex items-center gap-2 min-w-0">
                    <i class="ph-duotone ph-chats-circle text-xl"></i>
                    <div class="min-w-0">
                        <p class="font-extrabold text-sm leading-tight">${KARLA_NOMBRE}</p>
                        <p class="text-[11px] opacity-80 leading-tight">Tu asistente en Sinapsis</p>
                    </div>
                </div>
                <button onclick="orientadoraLogic.toggle()" class="p-1.5 rounded-lg hover:bg-white/15 transition shrink-0"><i class="ph-bold ph-x"></i></button>
            </div>
            <div id="orientadora-messages" class="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/70">
                ${this.messages.map(m => this.bubbleHTML(m)).join('')}
                ${this.busy ? `<div class="flex"><div class="px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-white border border-gray-200 text-gray-400 text-sm"><i class="ph-bold ph-dots-three animate-pulse text-xl leading-none"></i></div></div>` : ''}
            </div>
            <form onsubmit="orientadoraLogic.send(event)" class="p-3 border-t border-gray-200 bg-white flex gap-2 shrink-0">
                <input id="orientadora-input" type="text" placeholder="Escribe tu pregunta…" autocomplete="off" ${this.busy ? 'disabled' : ''}
                    class="flex-1 rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition">
                <button type="submit" ${this.busy ? 'disabled' : ''} class="w-11 h-11 rounded-xl bg-brand-600 text-white flex items-center justify-center hover:bg-brand-700 transition disabled:opacity-50 shrink-0">
                    <i class="ph-bold ph-paper-plane-right"></i>
                </button>
            </form>`;
        const box = document.getElementById('orientadora-messages');
        if (box) box.scrollTop = box.scrollHeight;
        if (!this.busy) document.getElementById('orientadora-input')?.focus();
    },

    bubbleHTML(m) {
        const isUser = m.role === 'user';
        return `
            <div class="flex ${isUser ? 'justify-end' : ''}">
                <div class="max-w-[85%] px-3.5 py-2.5 rounded-2xl ${isUser
                    ? 'bg-brand-600 text-white rounded-br-md'
                    : 'bg-white border border-gray-200 text-gray-700 rounded-bl-md'} text-sm leading-relaxed">${this.formatText(m.text)}</div>
            </div>`;
    },

    formatText(text) {
        // Markdown mínimo: negrita y saltos de línea, sobre texto ya escapado
        return sanitizeHTML(text)
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');
    },

    // ── Contexto: rutas reales + resumen de la red ───────────────────────────
    async buildContext() {
        if (this.context !== null) return this.context;
        try {
            // ⚠️ NO vale con `if (!state.data.alumni.length)`. Desde que la portada
            // pide solo sus 4 historias y el directorio pagina de a 12, esa lista
            // casi nunca está vacía pero casi nunca es la red entera: Karla habría
            // dicho «Red actual: 4 egresados registrados» con toda seriedad, y las
            // rutas que cita saldrían de esos cuatro. Karla es de las pocas que sí
            // necesita la colección completa —resume la red— y la pide explícita.
            // `hayMasDirectorio()` es falso cuando ya se leyó entera (o está en
            // caché), así que esto no repite la lectura.
            // Karla necesita DOS cosas y cada una tiene su fuente barata: los
            // números de la red salen de `resumen/red` (1 lectura) y las rutas, de
            // los perfiles que tienen hitos (18 como mucho). Antes leía los 68
            // perfiles enteros para las dos: ~68 lecturas cada vez que un egresado
            // abría el chat, y Karla la puede usar cualquiera con cuenta.
            const red = await loadResumenRed();
            let resumen;
            if (red && red.total) {
                const promoRango = red.promoMin && red.promoMax ? `${red.promoMin}–${red.promoMax}` : 'sin dato';
                const areasTop = (red.areasTop || []).join(', ');
                resumen = `Red actual: ${red.total} egresados registrados. Promociones: ${promoRango}.${areasTop ? ` Áreas más frecuentes: ${areasTop}.` : ''}`;
            } else {
                // Todavía no hay resumen escrito (el admin no ha entrado desde que
                // existe). Antes que mentir con un número parcial, se calcula leyendo
                // la red entera, como se hacía hasta hoy.
                if (hayMasDirectorio()) await loadAlumni();
                resumen = `Red actual: ${state.data.alumni.length} egresados registrados.`;
            }

            // Rutas detalladas: quien tiene hitos es quien tiene ruta que contar.
            const top = await loadAlumniConRutas({ limite: 18 });
            const lines = await Promise.all(top.map(async (alum) => {
                let hitos = alum.hitosCount > 0 ? await loadHitos(alum.id) : [];
                if (!hitos.length) hitos = deriveLegacyHitos(alum);
                if (!hitos.length) return null;
                const ruta = hitos.map(h => {
                    const partes = [h.rol, h.organizacion].filter(Boolean).join(' en ');
                    const anios = formatHitoYears(h);
                    return partes ? `${partes}${anios ? ` (${anios})` : ''}` : null;
                }).filter(Boolean).join(' → ');
                if (!ruta) return null;
                const area = alum.area && alum.area !== 'General' ? ` [área: ${alum.area}]` : '';
                const estudios = alum.studies ? ` [estudió: ${alum.studies}]` : '';
                return `- ${alum.firstName || alum.name} (promoción ${alum.year}):${area}${estudios} ${ruta}`;
            }));
            const rutas = lines.filter(Boolean).join('\n');
            this.context = `${resumen}\n\nRutas reales de egresados:\n${rutas || '(la red aún no tiene rutas detalladas)'}`;
        } catch (e) {
            this.context = '';
        }
        return this.context;
    },

    // Contexto del propio estudiante (personalización) — solo lo que ya es suyo.
    userContext() {
        const p = state?.profile;
        if (!p || !p.firstName) return '';
        const campos = [
            ['Nombre', p.firstName],
            ['Promoción', p.graduationYear],
            ['Situación', p.status],
            ['Estudios/rol', [p.studies, p.role].filter(Boolean).join(' · ')],
            ['Área de interés', p.area && p.area !== 'General' ? p.area : ''],
            ['Temas que le interesan', p.topics],
            ['Habilidades', p.skills],
            ['Qué espera de la red', p.expectations],
        ].filter(([, v]) => v && String(v).trim());
        if (!campos.length) return '';
        return campos.map(([k, v]) => `- ${k}: ${v}`).join('\n');
    },

    systemPrompt(rutas) {
        const perfil = this.userContext();
        const bloquePerfil = perfil
            ? `\n\nPerfil de la persona con la que hablas (úsalo para personalizar; salúdala por su nombre y conecta tus consejos con sus intereses reales, sin repetirle datos que ya conoce):\n${perfil}`
            : '\n\n(La persona no ha iniciado sesión o no tiene perfil: no asumas datos suyos y, si es útil, invítala a completar su perfil.)';

        return `Eres ${KARLA_NOMBRE}, la asistente de Sinapsis, la red de egresados del Liceo Campestre de Pereira (Colombia). Acompañas a estudiantes y egresados: orientas sobre qué estudiar y qué camino seguir, y guías en el uso de la plataforma.

Tu forma de trabajar:
- Preséntate como Karla si te preguntan quién eres. Tono profesional, cercano y directo: sin emojis, sin exclamaciones ni entusiasmo artificial. Como una buena consejera, no como una animadora.
- Respuestas breves (máximo ~120 palabras). Cuando orientes sobre carrera, haz UNA pregunta a la vez para conocer gustos, materias favoritas y motivaciones antes de recomendar.
- Personaliza: usa el nombre y los intereses de la persona (si están abajo) para que tus respuestas se sientan hechas para ella.
- Apóyate en los DATOS REALES de la red que aparecen abajo: cita rutas de egresados por su nombre y promoción cuando alguien del colegio ya recorrió un camino parecido, y usa el resumen de la red para dar contexto. NUNCA inventes egresados, cifras ni detalles que no estén en los datos. Si ninguna ruta real aplica, dilo con naturalidad y orienta con conocimiento general.
- No des consejos financieros ni garantices resultados; eres una guía para explorar opciones.
- Responde siempre en español.

Cómo funciona la plataforma Sinapsis (usa esto SOLO cuando la pregunta sea sobre cómo usar la plataforma; explica el paso concreto, no todo el menú):
- Directorio: busca y filtra egresados por promoción, área e intereses para encontrar referentes.
- Mi perfil: la persona edita sus datos y registra su Trayectoria real (hitos: rol, organización y años). Un perfil completo hace que la red le sea más útil y que aparezca mejor para otros.
- Trayectorias reales: rutas de egresados destacadas en la portada; sirven de ejemplo de caminos posibles.
- Novedades y eventos: publicaciones del colegio y de la red.
- Mensajes: chat 1 a 1 para contactar a un egresado desde su perfil o el directorio.
- Práctica de idiomas: exámenes TOEFL (Reading y Writing) y DELF B1, con calificación del writing por IA y respuesta modelo.
- Para editar datos o trayectoria: Mi perfil. Para escribirle a alguien: entra a su perfil y usa Mensajes.

Datos reales de la red disponibles:
${rutas || '(la red aún no tiene rutas registradas: orienta con conocimiento general e invita a completar perfiles)'}${bloquePerfil}`;
    },

    // ── Envío ────────────────────────────────────────────────────────────────
    async send(e) {
        e.preventDefault();
        const input = document.getElementById('orientadora-input');
        const text = (input?.value || '').trim();
        if (!text || this.busy) return;
        this.messages.push({ role: 'user', text });
        this.busy = true;
        this.renderPanel();
        try {
            const rutas = await this.buildContext();
            const reply = await this.callIA(this.systemPrompt(rutas));
            this.messages.push({ role: 'model', text: reply });
        } catch (err) {
            const detail = String(err?.message || err);
            // Al invitado se le dice qué le falta, no que algo salió mal: no es
            // un fallo, es que Karla es para miembros.
            const faltaCuenta = err?.motivo === 'sesion' || detail.includes('401');
            this.messages.push({
                role: 'model',
                text: faltaCuenta
                    ? 'Entra con tu cuenta para conversar conmigo. Si todavía no tienes, puedes crearla desde «Ingresar».'
                    : detail.includes('429')
                        ? 'Hay muchas consultas en este momento. Espera un minuto e inténtalo de nuevo.'
                        : 'No pude responder en este momento. Revisa tu conexión e inténtalo de nuevo.'
            });
        } finally {
            this.busy = false;
            this.renderPanel();
        }
    },

    async callIA(systemPrompt) {
        const messages = [
            { role: 'system', content: systemPrompt },
            ...this.messages
                .filter(m => m.role === 'user' || m.role === 'model')
                .slice(-12)
                .map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.text }))
        ];
        // Karla exige cuenta real desde el 2026-08-02 (el Worker responde 401 a
        // quien no la tiene). Se corta aquí para dar un mensaje entendible en vez
        // de un error de red: el visitante no ha hecho nada mal, le falta entrar.
        const token = await idTokenIA();
        if (!token) {
            const err = new Error('Entra con tu cuenta para conversar con Karla.');
            err.motivo = 'sesion';
            throw err;
        }
        const res = await fetch(SINAPSIS_IA_PROXY, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                model: ORIENTADORA_MODEL,
                messages,
                temperature: 0.7,
                max_tokens: 600,
                thinking: { type: 'disabled' }
            })
        });
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(`${res.status} ${body.slice(0, 200)}`);
        }
        const data = await res.json();
        const reply = (data?.choices?.[0]?.message?.content || '').trim();
        if (!reply) throw new Error('Respuesta vacía del modelo');
        return reply;
    }
};

document.addEventListener('DOMContentLoaded', () => orientadoraLogic.mount());
