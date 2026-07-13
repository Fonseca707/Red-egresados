// ─────────────────────────────────────────────────────────────────────────────
// Generación de rutas desde datos existentes (IA) — herramienta de UNA sola vez.
// Para egresados registrados por el flujo viejo (sin hitos): la IA lee sus
// campos planos (estudios, cargo, estado, bio…) y propone hitos SOLO con lo
// que está explícito en el texto. Nada se escribe sin revisión: primero
// "Analizar" (borrador en pantalla, editable por selección) y luego "Aplicar".
//
// Garantías anti-invención:
//  - Al modelo solo se le permite extraer; el prompt lo prohíbe y ADEMÁS cada
//    organización/rol propuesto se valida mecánicamente contra el texto
//    original (si no aparece, se descarta).
//  - Solo se proponen rutas con >=2 hitos (el hito de colegio solo no aporta
//    nada sobre la ruta derivada que ya se muestra).
//  - Solo perfiles con hitosCount == 0. Los hitos creados llevan
//    fuente:'migracion-ia' para poder auditarlos o revertirlos.
//
// Privacidad: a la IA se envían solo los campos del perfil (sin nombre, sin
// correo). Motor: DeepSeek (clave local de ia-config.local.js o localStorage).
// ─────────────────────────────────────────────────────────────────────────────

const rutasIaLogic = {
    proposals: [],  // {user, hitos:[...], incluir:true}
    skipped: [],    // {user, motivo}
    running: false,

    getKey() { return window.SINAPSIS_IA_KEY || localStorage.getItem('sinapsis_ia_key') || ''; },

    // ── Normalización para validar contra el texto fuente ───────────────────
    norm(str) {
        return String(str || '').toLowerCase()
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    },
    appearsInSource(fragment, source) {
        const frag = this.norm(fragment);
        if (!frag) return false;
        if (source.includes(frag)) return true;
        // Acepta si la mayoría de sus palabras significativas están en la fuente
        const words = frag.split(' ').filter(w => w.length >= 4);
        if (!words.length) return false;
        const hits = words.filter(w => source.includes(w)).length;
        return hits / words.length >= 0.6;
    },

    sourceTextOf(user) {
        return this.norm([user.studies, user.role, user.statusLabel, user.area === 'General' ? '' : user.area, user.bio === 'Sin biografía disponible.' ? '' : user.bio].filter(Boolean).join(' | '));
    },

    hasUsableData(user) {
        const bio = user.bio && user.bio !== 'Sin biografía disponible.' ? user.bio : '';
        const role = user.role && user.role !== 'Sin rol' ? user.role : '';
        return Boolean(user.studies || role || bio);
    },

    // ── Análisis (borrador, no escribe nada) ─────────────────────────────────
    async analyze() {
        if (this.running) return;
        if (!this.getKey()) {
            alert('No hay clave de IA configurada en este navegador (ia-config.local.js o localStorage sinapsis_ia_key). Ejecuta esta herramienta desde el equipo de desarrollo.');
            return;
        }
        this.running = true;
        this.proposals = [];
        this.skipped = [];
        const candidates = adminLogic.getVisibleUsers().filter(u => (u.hitosCount || 0) === 0);
        const status = document.getElementById('rutas-ia-status');
        let done = 0;

        for (const user of candidates) {
            done++;
            if (status) status.textContent = `Analizando ${done}/${candidates.length}… (${this.proposals.length} rutas posibles)`;
            if (!this.hasUsableData(user)) {
                this.skipped.push({ user, motivo: 'Sin datos de estudios, cargo ni biografía' });
                continue;
            }
            try {
                const extracted = await this.extractHitos(user);
                const hitos = this.assembleRuta(user, extracted);
                if (hitos.length >= 2) this.proposals.push({ user, hitos, incluir: true });
                else this.skipped.push({ user, motivo: 'Datos insuficientes para una ruta real (no se inventa)' });
            } catch (e) {
                this.skipped.push({ user, motivo: `Error de IA: ${String(e.message || e).slice(0, 80)}` });
            }
        }
        this.running = false;
        this.renderReport();
    },

    async extractHitos(user) {
        const perfil = {
            promocion_colegio: user.graduationYear || null,
            estudios: user.studies || null,
            cargo_o_rol: user.role !== 'Sin rol' ? user.role : null,
            estado_actual: user.statusLabel || null,
            area: user.area !== 'General' ? user.area : null,
            biografia: user.bio !== 'Sin biografía disponible.' ? user.bio : null
        };
        const system = `Extraes hitos de trayectoria desde los datos de un perfil de egresado. REGLAS ESTRICTAS:
- SOLO extrae lo que está EXPLÍCITO en los datos. PROHIBIDO inventar organizaciones, años, cargos o estudios que no aparezcan textualmente.
- Si un dato no está, usa null. Si no hay información suficiente para ningún hito, devuelve la lista vacía.
- NO incluyas el colegio (eso se agrega aparte).
- Tipos permitidos: educacion (estudios superiores), practica, empleo, emprendimiento, logro.
- En "educacion", el campo "rol" es la carrera o programa (ej. "Medicina") si aparece en los datos.
- "actual" es true solo si el texto indica que sigue en eso (ej. estado "Estudiando" o "Trabajando").
Devuelve JSON: {"hitos":[{"tipo":"...","organizacion":"...o null","rol":"...o null","anioInicio":null,"anioFin":null,"actual":false}]}`;
        const res = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.getKey()}` },
            body: JSON.stringify({
                model: 'deepseek-v4-flash',
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: JSON.stringify(perfil) }
                ],
                temperature: 0,
                max_tokens: 500,
                response_format: { type: 'json_object' },
                thinking: { type: 'disabled' }
            })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const parsed = JSON.parse(data?.choices?.[0]?.message?.content || '{}');
        return Array.isArray(parsed.hitos) ? parsed.hitos : [];
    },

    assembleRuta(user, extracted) {
        const source = this.sourceTextOf(user);
        const valid = [];
        const tiposOk = ['educacion', 'practica', 'empleo', 'emprendimiento', 'logro'];
        for (const h of extracted.slice(0, 4)) {
            if (!tiposOk.includes(h.tipo)) continue;
            // Validación mecánica anti-invención: lo propuesto debe estar en la fuente
            const org = h.organizacion && this.appearsInSource(h.organizacion, source) ? String(h.organizacion).trim() : '';
            const rol = h.rol && this.appearsInSource(h.rol, source) ? String(h.rol).trim() : '';
            if (!org && !rol) continue;
            const anioInicio = Number(h.anioInicio);
            const anioFin = Number(h.anioFin);
            valid.push({
                tipo: h.tipo,
                organizacion: org,
                rol: rol,
                anioInicio: anioInicio >= 1990 && anioInicio <= 2035 ? anioInicio : null,
                anioFin: anioFin >= 1990 && anioFin <= 2035 ? anioFin : null,
                actual: Boolean(h.actual),
                descripcion: ''
            });
        }
        if (!valid.length) return [];
        // Hito de colegio: determinista, desde datos duros del perfil
        const colegio = {
            tipo: 'colegio',
            organizacion: user.school || DEFAULT_SCHOOL,
            rol: 'Bachiller',
            anioInicio: null,
            anioFin: Number(user.graduationYear) || null,
            actual: false,
            descripcion: ''
        };
        return [colegio, ...valid];
    },

    // ── Reporte y aplicación ─────────────────────────────────────────────────
    toggleProposal(i) {
        this.proposals[i].incluir = !this.proposals[i].incluir;
        this.renderReport();
    },

    renderReport() {
        const holder = document.getElementById('rutas-ia-report');
        const status = document.getElementById('rutas-ia-status');
        if (status) status.textContent = '';
        if (!holder) return;
        const n = this.proposals.filter(p => p.incluir).length;
        holder.innerHTML = `
            <div class="space-y-3 mt-4">
                <p class="text-sm font-bold text-gray-900">${this.proposals.length} ruta${this.proposals.length === 1 ? '' : 's'} posible${this.proposals.length === 1 ? '' : 's'} · ${this.skipped.length} omitidos (sin datos suficientes — no se inventa nada)</p>
                ${this.proposals.map((p, i) => `
                    <label class="flex items-start gap-3 p-3 rounded-xl border ${p.incluir ? 'border-brand-200 bg-brand-50/50' : 'border-gray-100 bg-gray-50 opacity-60'} cursor-pointer transition">
                        <input type="checkbox" ${p.incluir ? 'checked' : ''} onchange="rutasIaLogic.toggleProposal(${i})" class="accent-brand-600 mt-1 shrink-0">
                        <div class="min-w-0">
                            <p class="text-sm font-bold text-gray-900">${sanitizeHTML(p.user.name)} <span class="text-xs font-semibold text-gray-400">· promoción ${sanitizeHTML(String(p.user.year || '—'))}</span></p>
                            <div class="flex items-center gap-1.5 flex-wrap mt-1.5">
                                ${p.hitos.map(h => `<span class="px-2 py-0.5 rounded-md bg-white border border-gray-200 text-[11px] font-semibold text-gray-600">${sanitizeHTML(hitoTypeInfo(h.tipo).label)}: ${sanitizeHTML([h.rol, h.organizacion].filter(Boolean).join(' · ') || '—')}</span>`).join('<i class="ph-bold ph-arrow-right text-[10px] text-brand-500"></i>')}
                            </div>
                        </div>
                    </label>`).join('')}
                ${this.skipped.length ? `
                    <details class="text-xs text-gray-400">
                        <summary class="cursor-pointer font-bold hover:text-gray-600">Ver los ${this.skipped.length} omitidos</summary>
                        <ul class="mt-2 space-y-1 pl-4">${this.skipped.map(s => `<li>• ${sanitizeHTML(s.user.name)} — ${sanitizeHTML(s.motivo)}</li>`).join('')}</ul>
                    </details>` : ''}
                ${this.proposals.length ? `
                    <button onclick="rutasIaLogic.apply()" ${n ? '' : 'disabled'}
                        class="px-6 py-3 rounded-xl font-bold transition ${n ? 'bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-600/20' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}">
                        <i class="ph-bold ph-check-circle"></i> Aplicar ${n} ruta${n === 1 ? '' : 's'} seleccionada${n === 1 ? '' : 's'}
                    </button>` : ''}
            </div>`;
    },

    async apply() {
        const toApply = this.proposals.filter(p => p.incluir);
        if (!toApply.length || this.running) return;
        if (!confirm(`Se crearán las rutas de ${toApply.length} egresado(s). Cada hito quedará marcado como generado por migración y el egresado podrá editarlo o borrarlo desde su perfil. ¿Continuar?`)) return;
        this.running = true;
        const status = document.getElementById('rutas-ia-status');
        let ok = 0;
        for (const p of toApply) {
            try {
                if (status) status.textContent = `Escribiendo ruta de ${p.user.name}… (${ok}/${toApply.length})`;
                const col = hitosCollection(p.user.id);
                for (const h of p.hitos) {
                    await col.add({
                        tipo: h.tipo,
                        organizacion: h.organizacion,
                        organizacionId: slugifyOrgName(h.organizacion) || '',
                        rol: h.rol,
                        anioInicio: h.anioInicio,
                        anioFin: h.actual ? null : h.anioFin,
                        actual: h.actual,
                        descripcion: '',
                        fuente: 'migracion-ia',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    if (h.organizacion) await upsertOrganization(h.organizacion, h.tipo).catch(() => {});
                }
                await syncHitosCount(p.user.id, p.hitos.length);
                ok++;
            } catch (e) {
                if (status) status.textContent = `Error con ${p.user.name}: ${e.message}`;
            }
        }
        this.running = false;
        if (status) status.textContent = `Listo: ${ok} de ${toApply.length} rutas creadas.`;
        this.proposals = [];
        this.skipped = [];
        await loadAlumni();
        adminLogic.renderUsers();
        setTimeout(() => this.renderDone(ok), 400);
    },

    renderDone(ok) {
        const holder = document.getElementById('rutas-ia-report');
        if (holder) holder.innerHTML = `
            <div class="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 font-bold">
                <i class="ph-bold ph-check-circle"></i> ${ok} rutas creadas. Los egresados pueden ajustarlas desde "Mi Ruta" en su perfil. Esta herramienta era de una sola pasada: los perfiles que ya tienen hitos no se vuelven a tocar.
            </div>`;
    }
};
window.rutasIaLogic = rutasIaLogic;
