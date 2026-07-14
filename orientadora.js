// ─────────────────────────────────────────────────────────────────────────────
// IA Orientadora de carrera — burbuja de chat para estudiantes (plan Sinapsis,
// fase "amortiguador del cold start": útil desde el día 1 y cita rutas reales
// de egresados a medida que la red crece).
// Depende de: shared.js (state, loadAlumni, loadHitos, deriveLegacyHitos,
// formatHitoYears, sanitizeHTML).
//
// Motor: DeepSeek (deepseek-v4-flash, thinking desactivado) a través del
// proxy SINAPSIS_IA_PROXY (shared.js): el navegador nunca maneja la clave.
// ─────────────────────────────────────────────────────────────────────────────

const ORIENTADORA_MODEL = localStorage.getItem('sinapsis_ia_model') || 'deepseek-v4-flash';

const orientadoraLogic = {
    open: false,
    busy: false,
    messages: [],   // {role: 'user'|'model', text}
    context: null,  // rutas reales compiladas (se construye una vez por sesión)

    // ── Montaje ──────────────────────────────────────────────────────────────
    mount() {
        if (document.getElementById('orientadora-bubble')) return;
        const wrap = document.createElement('div');
        wrap.innerHTML = `
            <button id="orientadora-bubble" onclick="orientadoraLogic.toggle()" title="Orientadora de carrera"
                class="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 w-14 h-14 rounded-full bg-brand-600 text-white shadow-xl shadow-brand-600/30 flex items-center justify-center text-2xl hover:scale-105 transition">
                <i class="ph-duotone ph-compass"></i>
            </button>
            <div id="orientadora-panel" class="hidden fixed bottom-36 md:bottom-24 right-4 md:right-6 z-50 w-[calc(100vw-2rem)] max-w-sm h-[28rem] bg-white rounded-3xl border border-gray-200 shadow-2xl flex flex-col overflow-hidden"></div>`;
        document.body.appendChild(wrap);
    },

    toggle() {
        this.open = !this.open;
        const panel = document.getElementById('orientadora-panel');
        panel.classList.toggle('hidden', !this.open);
        if (this.open) {
            if (!this.messages.length) {
                this.messages.push({ role: 'model', text: 'Hola. Soy la orientadora de carrera de Sinapsis. Cuéntame qué materias o actividades te interesan y te ayudo a explorar opciones, apoyándome en las rutas reales de los egresados del colegio.' });
            }
            this.renderPanel();
        }
    },

    // ── Render ───────────────────────────────────────────────────────────────
    renderPanel() {
        const panel = document.getElementById('orientadora-panel');
        if (!panel) return;
        panel.innerHTML = `
            <div class="px-4 py-3 bg-brand-600 text-white flex items-center justify-between gap-2 shrink-0">
                <div class="flex items-center gap-2 min-w-0">
                    <i class="ph-duotone ph-compass text-xl"></i>
                    <div class="min-w-0">
                        <p class="font-extrabold text-sm leading-tight">Orientadora de carrera</p>
                        <p class="text-[11px] opacity-80 leading-tight">Con rutas reales de egresados</p>
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

    // ── Contexto: rutas reales de egresados ──────────────────────────────────
    async buildContext() {
        if (this.context !== null) return this.context;
        try {
            if (!state.data.alumni.length) await loadAlumni();
            const top = [...state.data.alumni]
                .sort((a, b) => (b.profileCompleteness || 0) - (a.profileCompleteness || 0))
                .slice(0, 12);
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
                return `- ${alum.firstName || alum.name} (promoción ${alum.year}):${area} ${ruta}`;
            }));
            this.context = lines.filter(Boolean).join('\n');
        } catch (e) {
            this.context = '';
        }
        return this.context;
    },

    systemPrompt(rutas) {
        return `Eres la Orientadora de carrera de Sinapsis, la red de egresados del Liceo Campestre de Pereira (Colombia). Conversas con estudiantes del colegio que están explorando qué estudiar o qué camino seguir.

Tu forma de trabajar:
- Tono profesional, sereno y directo: sin emojis, sin exclamaciones, sin entusiasmo artificial. Como un buen consejero académico, no como un animador.
- Respuestas breves (máximo ~120 palabras). Haz UNA pregunta a la vez para conocer los gustos, materias favoritas y motivaciones del estudiante antes de recomendar.
- Orienta con tu conocimiento general sobre carreras, universidades y el mundo laboral colombiano.
- Cuando sea pertinente, cita las rutas REALES de egresados del colegio que aparecen abajo (por su nombre y promoción), por ejemplo para mostrar que alguien del colegio ya recorrió un camino parecido. NUNCA inventes egresados ni detalles que no estén en la lista.
- Si ninguna ruta real aplica, dilo con naturalidad y orienta solo con conocimiento general.
- No des consejos financieros ni garantices resultados; eres una guía para explorar opciones.
- Responde siempre en español.

Rutas reales de egresados disponibles:
${rutas || '(la red aún no tiene rutas registradas: orienta solo con conocimiento general)'}`;
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
            this.messages.push({
                role: 'model',
                text: detail.includes('429')
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
        const res = await fetch(SINAPSIS_IA_PROXY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
