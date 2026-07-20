// ─────────────────────────────────────────────────────────────────────────────
// IA calificadora de escritura (TOEFL y DELF) — vía el proxy SINAPSIS_IA_PROXY
// (shared.js): el navegador nunca maneja claves.
//
// Devuelve SIEMPRE la misma forma, sea cual sea el examen:
//   { band, criterios:[{clave,label,puntos,max,comentario}], fortalezas:[],
//     mejoras:[{cita, problema, sugerencia}], resumen }
// Si la IA falla, el motor cae a la autoevaluación con rúbrica (nunca se
// bloquea la práctica).
// ─────────────────────────────────────────────────────────────────────────────

const iaCalificadora = {
    disponible: true,

    // ── Guardia de idioma (determinista) ────────────────────────────────────
    // La IA es indulgente con textos escritos en el idioma equivocado (probado:
    // un email en español sacaba banda 4). En el examen real eso es banda 1 /
    // 0 puntos, así que se detecta aquí y NO se manda a calificar.
    _palabras: {
        en: ['the', 'and', 'is', 'are', 'to', 'of', 'in', 'that', 'have', 'it', 'for', 'not', 'with', 'you', 'this', 'but', 'his', 'they', 'i', 'my', 'would', 'because', 'about'],
        fr: ['le', 'la', 'les', 'de', 'des', 'et', 'est', 'que', 'qui', 'dans', 'pour', 'pas', 'plus', 'ce', 'je', 'nous', 'vous', 'mais', 'avec', 'sur', 'être', 'avoir', 'cette'],
        es: ['el', 'la', 'los', 'las', 'de', 'que', 'y', 'en', 'un', 'una', 'por', 'con', 'para', 'no', 'es', 'son', 'como', 'pero', 'porque', 'yo', 'mi', 'muy', 'este', 'esta']
    },
    _puntaje(texto, idioma) {
        const tokens = String(texto).toLowerCase().match(/[a-záéíóúüàèùçñ']+/g) || [];
        if (!tokens.length) return 0;
        const set = new Set(this._palabras[idioma]);
        return tokens.filter(t => set.has(t)).length / tokens.length;
    },
    // Devuelve true si el texto NO está en el idioma esperado
    idiomaIncorrecto(texto, esperado) {
        const t = String(texto || '').trim();
        if (t.split(/\s+/).filter(Boolean).length < 8) return false; // muy corto: que juzgue la IA
        const esperadoP = this._puntaje(t, esperado);
        const espanolP = this._puntaje(t, 'es');
        // El español gana claramente y el idioma esperado casi no aparece
        return espanolP > esperadoP * 1.5 && espanolP > 0.12;
    },
    // ── TOEFL: bandas 1-6 sobre la rúbrica oficial ──────────────────────────
    async calificarToefl(kind, task, texto) {
        if (this.idiomaIncorrecto(texto, 'en')) {
            return {
                band: 1,
                criterios: [
                    { clave: 'task', label: 'Cumplimiento de la tarea', puntos: 1, max: 6, comentario: 'La respuesta debe escribirse en inglés.' },
                    { clave: 'development', label: 'Desarrollo y organización', puntos: 1, max: 6, comentario: '' },
                    { clave: 'language', label: 'Gramática y vocabulario', puntos: 1, max: 6, comentario: '' }
                ],
                fortalezas: [],
                mejoras: [],
                resumen: 'Escribiste en español. En el TOEFL, una respuesta que no está en inglés recibe la banda mínima, sin importar su contenido.'
            };
        }
        const consigna = kind === 'email'
            ? `Scenario: ${task.scenario}\n${task.recipient}\nPuntos a cubrir:\n- ${task.bullets.join('\n- ')}\nObjetivo: ${task.targetWords[0]}-${task.targetWords[1]} palabras.`
            : `Professor (${task.professor.name}): ${task.professor.post}\n\nRespuestas de estudiantes:\n${task.students.map(s => `${s.name}: ${s.post}`).join('\n')}\n\nEl estudiante debe referirse a ambos y aportar un argumento NUEVO. Objetivo: ${task.targetWords[0]}-${task.targetWords[1]} palabras.`;

        const system = `Eres un evaluador oficial del TOEFL iBT (formato 2026). Calificas la tarea "${kind === 'email' ? 'Write an Email' : 'Write for an Academic Discussion'}" en la escala oficial de bandas 1 a 6 (se permiten medias bandas: 4.5).

Criterios (banda 5-6 exige: cumple toda la tarea, ideas desarrolladas, vocabulario preciso, estructuras complejas casi sin errores, registro apropiado):
- task: cumplimiento de la tarea (¿cubre TODOS los puntos pedidos? ¿registro correcto?)
- development: desarrollo y organización de las ideas (¿argumenta o solo enuncia? ¿conectores?)
- language: gramática, vocabulario y precisión

REGLAS:
- Sé riguroso y honesto: no infles la nota. Un texto correcto pero simple es banda 3-4, no 5.
- Si el texto está vacío, es incomprensible o está en otro idioma, banda 1.
- Las citas en "mejoras" deben ser fragmentos LITERALES del texto del estudiante.
- Comentarios en ESPAÑOL (el estudiante es hispanohablante); las citas y correcciones sugeridas, en inglés.
- Máximo 3 mejoras, las más importantes.

Devuelve JSON:
{"band": 4.5,
 "criterios":[{"clave":"task","puntos":4,"comentario":"..."},{"clave":"development","puntos":5,"comentario":"..."},{"clave":"language","puntos":4,"comentario":"..."}],
 "fortalezas":["...","..."],
 "mejoras":[{"cita":"fragmento literal","problema":"qué está mal","sugerencia":"cómo se escribiría mejor"}],
 "resumen":"una frase con lo esencial"}`;

        const data = await this._pedir(system, `CONSIGNA:\n${consigna}\n\nTEXTO DEL ESTUDIANTE:\n${texto || '(no escribió nada)'}`);
        const etiquetas = { task: 'Cumplimiento de la tarea', development: 'Desarrollo y organización', language: 'Gramática y vocabulario' };
        return {
            band: this._clamp(data.band, 1, 6),
            criterios: (data.criterios || []).map(c => ({
                clave: c.clave,
                label: etiquetas[c.clave] || c.clave,
                puntos: this._clamp(c.puntos, 1, 6),
                max: 6,
                comentario: String(c.comentario || '')
            })),
            fortalezas: (data.fortalezas || []).slice(0, 3).map(String),
            mejoras: (data.mejoras || []).slice(0, 3),
            resumen: String(data.resumen || '')
        };
    },

    // ── DELF B1: grilla oficial sobre 25 puntos ─────────────────────────────
    async calificarDelf(task, texto) {
        if (this.idiomaIncorrecto(texto, 'fr')) {
            return {
                band: 0,
                criterios: task.criteria.map(c => ({ clave: c.key, label: c.label, puntos: 0, max: c.max, comentario: '' })),
                fortalezas: [],
                mejoras: [],
                resumen: 'Escribiste en español. En el DELF, una producción que no está en francés recibe 0 puntos.'
            };
        }
        // Anomalía determinista de la grille oficial: menos del 50 % de las palabras
        // pedidas = "manque de matière évaluable" → 0 en todos los criterios, sin llamar a la IA.
        const palabras = (texto || '').trim().split(/\s+/).filter(Boolean).length;
        const minEvaluable = task.anomalies?.minWordsEvaluable ?? Math.ceil(task.minWords / 2);
        if (palabras < minEvaluable) {
            return {
                band: 0,
                criterios: task.criteria.map(c => ({ clave: c.key, label: c.label, puntos: 0, max: c.max, comentario: '' })),
                fortalezas: [],
                mejoras: [],
                resumen: `Escribiste ${palabras} palabras. La grille oficial del DELF marca "manque de matière évaluable" por debajo de ${minEvaluable} (la mitad de las ${task.minWords} pedidas): la producción recibe 0 en todos los criterios.`
            };
        }

        const escala = (task.scale || []).map(n => `${n.pts} = ${n.label}`).join(' · ');
        const system = `Eres un corrector oficial del DELF B1 (nouveau format). Calificas la production écrite con la GRILLE D'ÉVALUATION OFICIAL de France Éducation International, sobre 25 puntos.

La grille tiene 5 criterios y cada uno se puntúa en una ESCALA DISCRETA de 4 niveles. Los únicos valores válidos son: ${escala}
NUNCA uses valores intermedios (nada de 2, 4 ni medios puntos): solo 0, 1, 3 o 5.

Criterios:
${task.criteria.map(c => `- ${c.key} (${c.label} — ${c.competence}). ${c.desc}`).join('\n')}

REGLAS:
- Sé riguroso y honesto: no infles la nota. El mínimo eliminatorio del DELF es 5/25 por épreuve.
- El nivel 3 es "au niveau ciblé B1" y el 5 es "B1+". Un texto correcto pero simple es 3, no 5.
- Anomalías oficiales, aplícalas si corresponde:
  · Hors-sujet thématique (habla de otro tema): ${task.anomalies?.horsSujetThematique || ''}
  · Hors-sujet discursif (no respeta el tipo de texto pedido): ${task.anomalies?.horsSujetDiscursif || ''}
  · Hors-sujet complet: ${task.anomalies?.horsSujetComplet || ''}
- Si está vacío, es incomprensible o no está en francés, todos los criterios en 0.
- Las citas en "mejoras" deben ser fragmentos LITERALES del texto del estudiante.
- Comentarios en ESPAÑOL; citas y correcciones sugeridas, en francés.
- Máximo 3 mejoras.

Devuelve JSON:
{"criterios":[{"clave":"tache","puntos":3,"comentario":"..."}, ... uno por cada criterio de la grilla],
 "fortalezas":["..."],
 "mejoras":[{"cita":"fragment littéral","problema":"...","sugerencia":"..."}],
 "resumen":"una frase"}`;

        const data = await this._pedir(system, `CONSIGNE:\n${task.consigne}\n\nTEXTE DE L'ÉTUDIANT:\n${texto || '(no escribió nada)'}`);
        const porClave = new Map((data.criterios || []).map(c => [c.clave, c]));
        // La grille solo admite 0/1/3/5: si la IA devuelve otra cosa, se ajusta al
        // nivel válido más cercano (hacia abajo en los empates, para no inflar).
        const niveles = (task.scale || []).map(n => n.pts);
        const aNivel = v => {
            const n = this._clamp(v, 0, 5);
            if (!niveles.length) return n;
            return niveles.reduce((mejor, p) =>
                Math.abs(p - n) < Math.abs(mejor - n) ? p : mejor, niveles[0]);
        };
        const criterios = task.criteria.map(c => {
            const dc = porClave.get(c.key) || {};
            return {
                clave: c.key,
                label: c.label,
                puntos: aNivel(dc.puntos),
                max: c.max,
                comentario: String(dc.comentario || '')
            };
        });
        const total = criterios.reduce((a, c) => a + c.puntos, 0);
        return {
            band: total,   // aquí "band" son los puntos /25 (siempre entero con la grille oficial)
            criterios,
            fortalezas: (data.fortalezas || []).slice(0, 3).map(String),
            mejoras: (data.mejoras || []).slice(0, 3),
            resumen: String(data.resumen || '')
        };
    },

    // ── Llamada al proxy ────────────────────────────────────────────────────
    async _pedir(system, user) {
        const res = await fetch(SINAPSIS_IA_PROXY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'deepseek-v4-flash',
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: user }
                ],
                temperature: 0,
                max_tokens: 1200,
                response_format: { type: 'json_object' },
                thinking: { type: 'disabled' }
            })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return JSON.parse(data?.choices?.[0]?.message?.content || '{}');
    },

    _clamp(v, min, max) {
        const n = Number(v);
        if (Number.isNaN(n)) return min;
        return Math.round(Math.min(max, Math.max(min, n)) * 2) / 2;
    },

    // ── UI compartida: tarjeta de resultado ─────────────────────────────────
    tarjetaHTML(r, { escala = '/6', acento = 'blue' } = {}) {
        const c = acento === 'purple'
            ? { texto: 'text-purple-600', suave: 'bg-purple-50 border-purple-100', barra: 'bg-purple-600' }
            : acento === 'teal'
            ? { texto: 'text-[#066A6E]', suave: 'bg-[#e8f2f2] border-[#cce0e1]', barra: 'bg-[#066A6E]' }
            : { texto: 'text-blue-600', suave: 'bg-blue-50 border-blue-100', barra: 'bg-blue-600' };
        return `
            <div class="rounded-2xl border ${c.suave} border p-5">
                <div class="flex items-start justify-between gap-4 mb-4">
                    <div>
                        <p class="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1"><i class="ph-duotone ph-robot"></i> Calificación de la IA</p>
                        <p class="text-4xl font-extrabold ${c.texto}">${r.band}<span class="text-lg text-gray-400">${escala}</span></p>
                    </div>
                    ${r.resumen ? `<p class="text-sm text-gray-600 italic max-w-sm text-right">“${sanitizeHTML(r.resumen)}”</p>` : ''}
                </div>

                <div class="space-y-2 mb-4">
                    ${r.criterios.map(cr => `
                        <div class="rounded-xl bg-white border border-gray-100 px-3 py-2">
                            <div class="flex items-center justify-between gap-2 mb-1">
                                <span class="text-xs font-bold text-gray-700">${sanitizeHTML(cr.label)}</span>
                                <span class="text-xs font-extrabold ${c.texto} shrink-0">${cr.puntos}/${cr.max}</span>
                            </div>
                            <div class="h-1.5 rounded-full bg-gray-100 overflow-hidden mb-1">
                                <div class="h-full rounded-full ${c.barra}" style="width:${Math.round((cr.puntos / cr.max) * 100)}%"></div>
                            </div>
                            ${cr.comentario ? `<p class="text-xs text-gray-500 leading-relaxed">${sanitizeHTML(cr.comentario)}</p>` : ''}
                        </div>`).join('')}
                </div>

                ${r.fortalezas.length ? `
                    <div class="mb-3">
                        <p class="text-[11px] font-bold uppercase tracking-widest text-green-600 mb-1.5"><i class="ph-bold ph-check-circle"></i> Lo que hiciste bien</p>
                        <ul class="space-y-1">${r.fortalezas.map(f => `<li class="text-xs text-gray-600 flex gap-1.5"><i class="ph-bold ph-plus text-green-500 mt-0.5 shrink-0"></i>${sanitizeHTML(f)}</li>`).join('')}</ul>
                    </div>` : ''}

                ${r.mejoras.length ? `
                    <div>
                        <p class="text-[11px] font-bold uppercase tracking-widest text-amber-600 mb-1.5"><i class="ph-bold ph-pencil-simple"></i> Qué corregir</p>
                        <div class="space-y-2">
                            ${r.mejoras.map(m => `
                                <div class="rounded-xl bg-white border border-gray-100 px-3 py-2">
                                    ${m.cita ? `<p class="text-xs text-gray-400 line-through mb-0.5">“${sanitizeHTML(m.cita)}”</p>` : ''}
                                    <p class="text-xs text-gray-600">${sanitizeHTML(m.problema || '')}</p>
                                    ${m.sugerencia ? `<p class="text-xs text-green-700 font-semibold mt-0.5"><i class="ph-bold ph-arrow-right"></i> ${sanitizeHTML(m.sugerencia)}</p>` : ''}
                                </div>`).join('')}
                        </div>
                    </div>` : ''}

                <p class="text-[11px] text-gray-400 mt-4 pt-3 border-t border-gray-100">Calificación automática orientativa: en el examen real la escala es la misma, pero el criterio puede variar. Compárala con la respuesta modelo.</p>
            </div>`;
    },

    cargandoHTML(mensaje = 'La IA está corrigiendo tu texto…') {
        return `
            <div class="rounded-2xl border border-gray-100 bg-gray-50 p-8 text-center">
                <i class="ph-duotone ph-robot text-3xl text-gray-300 animate-pulse"></i>
                <p class="text-sm font-bold text-gray-500 mt-2">${sanitizeHTML(mensaje)}</p>
                <p class="text-xs text-gray-400 mt-1">Suele tardar unos segundos.</p>
            </div>`;
    }
};
window.iaCalificadora = iaCalificadora;
