// Panel admin — Mensajes de terceros (colección public/data/contactos).
// Solo superadmin. Lista los contactos que llegan desde la landing
// (empresas/aliados/general), permite marcarlos leídos, archivarlos y borrarlos.
// Reutiliza artifactsRoot y sanitizeHTML de shared.js.

const _contactosCol = artifactsRoot.collection('public').doc('data').collection('contactos');

const TIPO_META = {
    empresa: { label: 'Empresa', icon: 'ph-briefcase', badge: 'bg-brand-50 text-brand-700 border-brand-100' },
    aliado:  { label: 'Aliado / Institución', icon: 'ph-handshake', badge: 'bg-sun-50 text-sun-600 border-sun-200' },
    general: { label: 'General', icon: 'ph-chat-teardrop-text', badge: 'bg-gray-100 text-gray-600 border-gray-200' }
};

const contactosAdminLogic = {
    _items: [],
    _filter: 'nuevo',

    load: async () => {
        try {
            const snap = await _contactosCol.orderBy('createdAt', 'desc').limit(300).get();
            contactosAdminLogic._items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
            console.error('No se pudieron cargar los mensajes de contacto:', e);
            contactosAdminLogic._items = [];
        }
        contactosAdminLogic.render();
        contactosAdminLogic.updateBadge();
    },

    updateBadge: () => {
        const nuevos = contactosAdminLogic._items.filter(c => (c.estado || 'nuevo') === 'nuevo').length;
        const badge = document.getElementById('tab-contactos-badge');
        if (!badge) return;
        if (nuevos > 0) { badge.textContent = nuevos; badge.classList.remove('hidden'); }
        else badge.classList.add('hidden');
    },

    setFilter: (f) => {
        contactosAdminLogic._filter = f;
        document.querySelectorAll('.contacto-filter-btn').forEach(btn => {
            const active = btn.dataset.filter === f;
            btn.className = 'contacto-filter-btn px-4 py-2 rounded-xl text-xs font-bold transition ' +
                (active ? 'bg-brand-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200');
        });
        contactosAdminLogic.render();
    },

    _fmtFecha: (ts) => {
        try {
            const d = ts && ts.toDate ? ts.toDate() : null;
            return d ? d.toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
        } catch { return '—'; }
    },

    render: () => {
        const cont = document.getElementById('admin-contactos-list');
        if (!cont) return;
        const f = contactosAdminLogic._filter;
        const items = contactosAdminLogic._items.filter(c => {
            const estado = c.estado || 'nuevo';
            if (f === 'all') return true;
            if (f === 'nuevo') return estado === 'nuevo';
            if (f === 'archivado') return estado === 'archivado';
            return estado === f;
        });

        if (!items.length) {
            cont.innerHTML = `
                <div class="flex flex-col items-center justify-center py-16 text-center">
                    <i class="ph ph-tray text-5xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500 font-semibold">Sin mensajes ${f === 'nuevo' ? 'nuevos' : f === 'archivado' ? 'archivados' : ''}</p>
                    <p class="text-gray-400 text-sm mt-1">Cuando una empresa o aliado escriba desde la página de inicio, aparecerá aquí.</p>
                </div>`;
            return;
        }

        cont.innerHTML = items.map(c => {
            const meta = TIPO_META[c.tipo] || TIPO_META.general;
            const estado = c.estado || 'nuevo';
            const esNuevo = estado === 'nuevo';
            const nombre = sanitizeHTML(c.nombre || 'Sin nombre');
            const org = c.organizacion ? sanitizeHTML(c.organizacion) : '';
            const email = sanitizeHTML(c.email || '');
            const tel = c.telefono ? sanitizeHTML(c.telefono) : '';
            const mensaje = sanitizeHTML(c.mensaje || '');
            const asunto = encodeURIComponent(`Sinapsis · respuesta a tu mensaje`);
            return `
                <div class="bg-white rounded-2xl border ${esNuevo ? 'border-brand-200 ring-1 ring-brand-100' : 'border-gray-100'} shadow-sm p-5">
                    <div class="flex flex-wrap items-start justify-between gap-3 mb-3">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide border ${meta.badge}"><i class="ph-bold ${meta.icon}"></i> ${meta.label}</span>
                            ${esNuevo ? '<span class="px-2 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide bg-brand-600 text-white">Nuevo</span>' : ''}
                            ${estado === 'archivado' ? '<span class="px-2 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide bg-gray-100 text-gray-500 border border-gray-200">Archivado</span>' : ''}
                        </div>
                        <span class="text-xs text-gray-400 shrink-0">${contactosAdminLogic._fmtFecha(c.createdAt)}</span>
                    </div>
                    <div class="mb-3">
                        <p class="font-bold text-gray-900">${nombre}${org ? ` <span class="font-normal text-gray-400">·</span> <span class="font-semibold text-gray-600">${org}</span>` : ''}</p>
                        <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 mt-1">
                            <a href="mailto:${email}?subject=${asunto}" class="inline-flex items-center gap-1 text-brand-600 font-semibold hover:underline"><i class="ph-bold ph-envelope-simple"></i> ${email}</a>
                            ${tel ? `<a href="https://wa.me/${tel.replace(/[^0-9]/g, '')}" target="_blank" rel="noopener" class="inline-flex items-center gap-1 hover:text-brand-600"><i class="ph-bold ph-phone"></i> ${tel}</a>` : ''}
                        </div>
                    </div>
                    <p class="text-gray-600 text-sm leading-relaxed bg-gray-50 border border-gray-100 rounded-xl p-4 whitespace-pre-wrap break-words">${mensaje}</p>
                    <div class="flex flex-wrap gap-2 mt-4 justify-end">
                        <a href="mailto:${email}?subject=${asunto}" class="px-4 py-2 bg-brand-600 text-white text-xs font-bold rounded-lg hover:bg-brand-700 transition inline-flex items-center gap-1.5"><i class="ph-bold ph-arrow-bend-up-left"></i> Responder</a>
                        ${esNuevo ? `<button onclick="contactosAdminLogic.marcar('${c.id}','leido')" class="px-4 py-2 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-200 transition inline-flex items-center gap-1.5"><i class="ph-bold ph-check"></i> Marcar leído</button>` : ''}
                        ${estado !== 'archivado' ? `<button onclick="contactosAdminLogic.marcar('${c.id}','archivado')" class="px-4 py-2 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-200 transition inline-flex items-center gap-1.5"><i class="ph-bold ph-archive"></i> Archivar</button>` : `<button onclick="contactosAdminLogic.marcar('${c.id}','nuevo')" class="px-4 py-2 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-200 transition inline-flex items-center gap-1.5"><i class="ph-bold ph-arrow-counter-clockwise"></i> Reabrir</button>`}
                        <button onclick="contactosAdminLogic.eliminar('${c.id}')" class="px-4 py-2 bg-red-50 text-red-600 text-xs font-bold rounded-lg hover:bg-red-100 transition inline-flex items-center gap-1.5"><i class="ph-bold ph-trash"></i> Eliminar</button>
                    </div>
                </div>`;
        }).join('');
    },

    marcar: async (id, estado) => {
        try {
            await _contactosCol.doc(id).update({ estado });
            const item = contactosAdminLogic._items.find(c => c.id === id);
            if (item) item.estado = estado;
            contactosAdminLogic.render();
            contactosAdminLogic.updateBadge();
        } catch (e) {
            alert('No se pudo actualizar el mensaje: ' + (e.code || e.message || 'error'));
        }
    },

    eliminar: async (id) => {
        if (!confirm('¿Eliminar este mensaje de forma permanente?')) return;
        try {
            await _contactosCol.doc(id).delete();
            contactosAdminLogic._items = contactosAdminLogic._items.filter(c => c.id !== id);
            contactosAdminLogic.render();
            contactosAdminLogic.updateBadge();
        } catch (e) {
            alert('No se pudo eliminar el mensaje: ' + (e.code || e.message || 'error'));
        }
    }
};

window.contactosAdminLogic = contactosAdminLogic;
