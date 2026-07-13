// ─────────────────────────────────────────────────────────────────────────────
// Correos desde el panel admin — selección de egresados + envío por lotes.
// Sin backend: la plataforma es estática, así que el envío real sale del
// correo del PROPIO admin (Gmail web o cliente de correo) con los egresados
// en CCO/BCC — así nadie ve los correos de los demás. Los lotes respetan el
// límite de longitud de URL.
// Depende de: shared.js (state, sanitizeHTML) y adminLogic (getVisibleUsers).
// ─────────────────────────────────────────────────────────────────────────────

const CORREOS_BATCH_SIZE = 40;      // destinatarios por lote (límite práctico de URL)
const SYNTHETIC_DOMAINS = ['users.sinapsis.app', 'sinapsis.local'];

const correosLogic = {
    selected: new Set(),
    search: '',
    yearFilter: 'all',
    prepared: null, // [{emails:[...]}] lotes listos para abrir

    // ── Destinatarios válidos ────────────────────────────────────────────────
    isRealEmail(email) {
        const e = String(email || '').toLowerCase().trim();
        return e.includes('@') && !SYNTHETIC_DOMAINS.some(d => e.endsWith('@' + d));
    },
    bestEmail(user) {
        if (this.isRealEmail(user.contactEmail)) return user.contactEmail.toLowerCase().trim();
        if (this.isRealEmail(user.email)) return user.email.toLowerCase().trim();
        return '';
    },
    isTestEmail(email) {
        return /example\.com$|prueba/i.test(String(email || ''));
    },

    allRecipients() {
        return adminLogic.getVisibleUsers()
            .map(u => ({ ...u, sendEmail: this.bestEmail(u) }))
            .filter(u => u.sendEmail && u.accountStatus !== ACCOUNT_STATUS.SUSPENDIDO);
    },

    filteredRecipients() {
        const term = this.search.toLowerCase().trim();
        return this.allRecipients().filter(u => {
            if (this.yearFilter !== 'all' && String(u.year) !== this.yearFilter) return false;
            if (!term) return true;
            return u.name.toLowerCase().includes(term) || u.sendEmail.includes(term);
        });
    },

    // ── Render ───────────────────────────────────────────────────────────────
    render() {
        const holder = document.getElementById('admin-correos-list');
        if (!holder) return;
        this.prepared = null;
        const all = this.allRecipients();
        const filtered = this.filteredRecipients();
        const years = [...new Set(all.map(u => String(u.year)).filter(y => y && y !== '---'))].sort();

        const yearSel = document.getElementById('correos-year-filter');
        if (yearSel && yearSel.options.length <= 1) {
            yearSel.innerHTML = `<option value="all">Todas las promociones</option>` +
                years.map(y => `<option value="${y}">Promoción ${y}</option>`).join('');
            yearSel.value = this.yearFilter;
        }

        const allFilteredSelected = filtered.length > 0 && filtered.every(u => this.selected.has(u.id));
        document.getElementById('correos-select-all').checked = allFilteredSelected;
        document.getElementById('correos-count').textContent =
            `${this.selected.size} seleccionado${this.selected.size === 1 ? '' : 's'} de ${all.length} con correo`;

        holder.innerHTML = filtered.length ? filtered.map(u => `
            <label class="flex items-center gap-3 px-4 py-2.5 rounded-xl border ${this.selected.has(u.id) ? 'border-brand-300 bg-brand-50' : 'border-gray-100 bg-white hover:bg-gray-50'} cursor-pointer transition">
                <input type="checkbox" ${this.selected.has(u.id) ? 'checked' : ''} onchange="correosLogic.toggle('${sanitizeHTML(u.id)}')" class="accent-brand-600 shrink-0">
                <img src="${sanitizeHTML(u.img)}" alt="" class="w-9 h-9 rounded-lg object-cover shrink-0">
                <div class="min-w-0 flex-1">
                    <p class="text-sm font-bold text-gray-900 truncate">${sanitizeHTML(u.name)}</p>
                    <p class="text-xs text-gray-500 truncate">${sanitizeHTML(u.sendEmail)}${this.isTestEmail(u.sendEmail) ? ' <span class="text-amber-600 font-bold">(prueba)</span>' : ''}</p>
                </div>
                <span class="text-[11px] font-bold text-brand-600 shrink-0">${sanitizeHTML(String(u.year || '—'))}</span>
            </label>`).join('')
            : '<p class="text-sm text-gray-400 text-center py-8">Ningún egresado coincide con el filtro.</p>';

        this.renderSendArea();
    },

    renderSendArea() {
        const area = document.getElementById('correos-send-area');
        if (!area) return;
        const subject = document.getElementById('correos-subject')?.value.trim() || '';
        const body = document.getElementById('correos-body')?.value.trim() || '';
        const n = this.selected.size;

        if (!this.prepared) {
            const ready = n > 0 && subject && body;
            area.innerHTML = `
                <button onclick="correosLogic.prepare()" ${ready ? '' : 'disabled'}
                    class="w-full md:w-auto px-6 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 ${ready ? 'bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-600/20' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}">
                    <i class="ph-bold ph-paper-plane-tilt"></i> Preparar envío a ${n} egresado${n === 1 ? '' : 's'}
                </button>
                ${!ready && n > 0 ? '<p class="text-xs text-gray-400 mt-2">Completa asunto y mensaje para continuar.</p>' : ''}`;
            return;
        }

        area.innerHTML = `
            <div class="rounded-2xl border border-brand-100 bg-brand-50 p-4 space-y-3">
                <p class="text-sm font-bold text-gray-900"><i class="ph-bold ph-info text-brand-600"></i> ${this.prepared.length === 1 ? 'Listo: 1 lote' : `Listo: ${this.prepared.length} lotes (límite de ${CORREOS_BATCH_SIZE} por correo)`} — se abre tu correo con los destinatarios en <strong>CCO</strong> (nadie ve los correos de los demás). Solo pulsa Enviar en cada uno.</p>
                <div class="flex flex-wrap gap-2">
                    ${this.prepared.map((b, i) => `
                        <button onclick="correosLogic.openBatch(${i}, 'gmail')" id="correos-batch-${i}"
                            class="px-4 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-bold hover:bg-brand-700 transition flex items-center gap-2">
                            <i class="ph-bold ph-envelope-simple"></i> Abrir en Gmail — lote ${i + 1} (${b.emails.length})
                        </button>`).join('')}
                </div>
                <div class="flex flex-wrap gap-3 items-center">
                    <button onclick="correosLogic.openBatch(0, 'mailto', true)" class="text-xs font-bold text-gray-500 hover:text-brand-600 transition"><i class="ph-bold ph-envelope"></i> Usar mi aplicación de correo (mailto)</button>
                    <button onclick="correosLogic.copyEmails()" id="correos-copy-btn" class="text-xs font-bold text-gray-500 hover:text-brand-600 transition"><i class="ph-bold ph-copy"></i> Copiar los ${this.selected.size} correos</button>
                    <button onclick="correosLogic.prepared = null; correosLogic.renderSendArea()" class="text-xs font-bold text-gray-400 hover:text-red-500 transition">Cancelar</button>
                </div>
            </div>`;
    },

    // ── Interacciones ────────────────────────────────────────────────────────
    toggle(id) {
        if (this.selected.has(id)) this.selected.delete(id);
        else this.selected.add(id);
        this.render();
    },
    toggleAll() {
        const filtered = this.filteredRecipients();
        const allSelected = filtered.length > 0 && filtered.every(u => this.selected.has(u.id));
        filtered.forEach(u => allSelected ? this.selected.delete(u.id) : this.selected.add(u.id));
        this.render();
    },
    onSearch(value) { this.search = value; this.render(); },
    onYearFilter(value) { this.yearFilter = value; this.render(); },
    onComposeInput() { if (!this.prepared) this.renderSendArea(); },

    selectedEmails() {
        const byId = new Map(this.allRecipients().map(u => [u.id, u.sendEmail]));
        return [...this.selected].map(id => byId.get(id)).filter(Boolean);
    },

    prepare() {
        const emails = this.selectedEmails();
        if (!emails.length) return;
        this.prepared = [];
        for (let i = 0; i < emails.length; i += CORREOS_BATCH_SIZE) {
            this.prepared.push({ emails: emails.slice(i, i + CORREOS_BATCH_SIZE) });
        }
        this.renderSendArea();
    },

    openBatch(index, mode, allInOne = false) {
        const subject = document.getElementById('correos-subject')?.value.trim() || '';
        const body = document.getElementById('correos-body')?.value.trim() || '';
        const emails = allInOne ? this.selectedEmails() : (this.prepared?.[index]?.emails || []);
        if (!emails.length) return;
        const bcc = emails.join(',');
        if (mode === 'gmail') {
            const url = `https://mail.google.com/mail/?view=cm&fs=1&bcc=${encodeURIComponent(bcc)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            window.open(url, '_blank');
            const btn = document.getElementById(`correos-batch-${index}`);
            if (btn) {
                btn.className = btn.className.replace('bg-brand-600', 'bg-green-600').replace('hover:bg-brand-700', 'hover:bg-green-700');
                btn.innerHTML = `<i class="ph-bold ph-check"></i> Lote ${index + 1} abierto (${emails.length})`;
            }
        } else {
            window.location.href = `mailto:?bcc=${encodeURIComponent(bcc)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        }
    },

    async copyEmails() {
        const emails = this.selectedEmails().join(', ');
        try {
            await navigator.clipboard.writeText(emails);
            const btn = document.getElementById('correos-copy-btn');
            if (btn) btn.innerHTML = '<i class="ph-bold ph-check"></i> Copiados';
        } catch {
            prompt('Copia los correos:', emails);
        }
    }
};
window.correosLogic = correosLogic;
