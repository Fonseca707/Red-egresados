// admin-colegios.js — pestaña "Colegios" del panel (solo superadmin).
// Gestiona los colegios de la red (multi-tenant): módulos pagados por colegio
// (TOEFL/DELF) y códigos de invitación (la ÚNICA vía para que un registro
// nazca con tag de colegio; las reglas de Firestore validan código→colegio).

const colegiosAdminLogic = {
    items: [],
    codigosPorColegio: {},

    load: async () => {
        if (state.adminRole !== 'superadmin') return;
        // Semilla: garantiza que LCP exista como colegio de primera clase.
        try {
            const lcp = await colegiosCollection.doc(DEFAULT_SCHOOL).get();
            if (!lcp.exists) {
                await colegiosCollection.doc(DEFAULT_SCHOOL).set({
                    nombre: 'Liceo Campestre de Pereira',
                    modulos: { ...MODULOS_DEFAULT },
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        } catch (e) {}
        colegiosAdminLogic.items = await loadColegios();
        try {
            const snap = await codigosCollection.get();
            const by = {};
            snap.docs.forEach(d => {
                const c = { id: d.id, ...d.data() };
                (by[c.colegioId] = by[c.colegioId] || []).push(c);
            });
            colegiosAdminLogic.codigosPorColegio = by;
        } catch (e) { colegiosAdminLogic.codigosPorColegio = {}; }
        colegiosAdminLogic.render();
    },

    crear: async (e) => {
        e.preventDefault();
        const feedback = document.getElementById('colegio-feedback');
        const tag = document.getElementById('colegio-tag').value.trim().toUpperCase();
        const nombre = document.getElementById('colegio-nombre-input').value.trim();
        if (!/^[A-Z0-9-]{2,15}$/.test(tag)) {
            feedback.textContent = 'El tag debe tener 2-15 caracteres (letras, números o guion).';
            return;
        }
        if (nombre.length < 3) {
            feedback.textContent = 'Escribe el nombre completo del colegio.';
            return;
        }
        try {
            const existing = await colegiosCollection.doc(tag).get();
            if (existing.exists) { feedback.textContent = `Ya existe un colegio con el tag ${tag}.`; return; }
            await colegiosCollection.doc(tag).set({
                nombre,
                // Un colegio nace sin nada contratado: los módulos se activan uno
                // a uno desde esta misma pestaña.
                modulos: { ...MODULOS_DEFAULT },
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            e.target.reset();
            feedback.textContent = `Colegio ${nombre} (${tag}) creado. Genera su código de invitación para que puedan registrarse.`;
            await colegiosAdminLogic.load();
        } catch (err) {
            feedback.textContent = `No se pudo crear el colegio: ${err.message}`;
        }
    },

    toggleModulo: async (colegioId, modulo, actual) => {
        try {
            await colegiosCollection.doc(colegioId).update({
                ['modulos.' + modulo]: !actual,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await colegiosAdminLogic.load();
        } catch (e) { alert(`No se pudo cambiar el módulo: ${e.message}`); }
    },

    // Borrar un colegio es irreversible y arrastra cosas que no están a la
    // vista, así que va con tres frenos:
    //  1. El colegio semilla no se borra: `load()` lo volvería a crear en el
    //     acto y quedaría un colegio "nuevo" sin sus módulos ni sus códigos.
    //  2. Si tiene usuarios, no se borra. Sus perfiles quedarían con un tag que
    //     ya no existe: no perderían la cuenta, pero sí el colegio, los módulos
    //     y el aislamiento de su sub-admin, y nada en la interfaz lo explicaría.
    //  3. Hay que escribir el tag a mano. Un `confirm()` se acepta sin leer.
    // Y se borran TAMBIÉN sus códigos de invitación: un código huérfano sigue
    // pareciendo válido y vincularía un registro nuevo a un colegio inexistente.
    eliminar: async (colegioId) => {
        if (colegioId === DEFAULT_SCHOOL) {
            alert(`${colegioId} es el colegio semilla de la red: si se borra, la próxima carga del panel lo vuelve a crear vacío. No se puede eliminar desde aquí.`);
            return;
        }
        const usuarios = (state.data.alumni || []).filter(u => u.school === colegioId).length;
        if (usuarios > 0) {
            alert(`No se puede eliminar ${colegioId}: tiene ${usuarios} usuario${usuarios === 1 ? '' : 's'} con ese tag.\n\nSus perfiles quedarían apuntando a un colegio que ya no existe y perderían módulos y aislamiento. Primero hay que mover o dar de baja a esas personas.`);
            return;
        }
        const codigos = colegiosAdminLogic.codigosPorColegio[colegioId] || [];
        const escrito = prompt(
            `Vas a eliminar el colegio ${colegioId}.\n\n` +
            `Se borrará también ${codigos.length === 1 ? 'su código de invitación' : `sus ${codigos.length} códigos de invitación`}. No se puede deshacer.\n\n` +
            `Escribe ${colegioId} para confirmar:`);
        if (escrito !== colegioId) {
            if (escrito !== null) alert('El texto no coincide. No se eliminó nada.');
            return;
        }
        try {
            // Primero los códigos: si algo falla a mitad, es preferible un
            // colegio sin códigos (inofensivo) que códigos sin colegio.
            for (const c of codigos) await codigosCollection.doc(c.id).delete();
            await colegiosCollection.doc(colegioId).delete();
            await colegiosAdminLogic.load();
            alert(`Colegio ${colegioId} eliminado, junto con ${codigos.length} código(s).`);
        } catch (e) {
            alert(`No se pudo eliminar: ${e.message}`);
            await colegiosAdminLogic.load();
        }
    },

    generarCodigo: async (colegioId) => {
        // 6 caracteres alfanuméricos en mayúscula, aleatoriedad criptográfica
        // (antes Math.random(), no apto para un identificador de acceso).
        const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const bytes = new Uint8Array(6);
        crypto.getRandomValues(bytes);
        const sufijo = Array.from(bytes, b => ALFABETO[b % ALFABETO.length]).join('');
        const codigo = `${colegioId}-${sufijo}`;
        try {
            await codigosCollection.doc(codigo).set({
                colegioId,
                activo: true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await colegiosAdminLogic.load();
        } catch (e) { alert(`No se pudo generar el código: ${e.message}`); }
    },

    toggleCodigo: async (codigo, activo) => {
        const accion = activo ? 'desactivar' : 'reactivar';
        if (!confirm(`¿${accion.charAt(0).toUpperCase() + accion.slice(1)} el código ${codigo}? ${activo ? 'Los enlaces que lo usen dejarán de vincular al colegio (útil si se filtró).' : ''}`)) return;
        try {
            await codigosCollection.doc(codigo).update({
                activo: !activo,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await colegiosAdminLogic.load();
        } catch (e) { alert(`No se pudo actualizar el código: ${e.message}`); }
    },

    enlaceDeCodigo: (codigo) => {
        return `${window.location.origin}${window.location.pathname.replace(/admin\.html$/, 'register.html')}?codigo=${encodeURIComponent(codigo)}`;
    },

    copiarEnlace: async (codigo, btn) => {
        const enlace = colegiosAdminLogic.enlaceDeCodigo(codigo);
        try {
            await navigator.clipboard.writeText(enlace);
            const original = btn.innerHTML;
            btn.innerHTML = '<i class="ph-bold ph-check"></i> Copiado';
            setTimeout(() => { btn.innerHTML = original; }, 1800);
        } catch (e) { prompt('Copia el enlace de invitación:', enlace); }
    },

    render: () => {
        const list = document.getElementById('admin-colegios-list');
        if (!list) return;
        if (!colegiosAdminLogic.items.length) {
            list.innerHTML = '<div class="p-6 text-sm text-gray-500 bg-white rounded-2xl border border-gray-100">Aún no hay colegios registrados.</div>';
            return;
        }
        list.innerHTML = colegiosAdminLogic.items.map(colegio => {
            const usuarios = (state.data.alumni || []).filter(u => u.school === colegio.id).length;
            const modulos = { ...MODULOS_DEFAULT, ...(colegio.modulos || {}) };
            const codigos = colegiosAdminLogic.codigosPorColegio[colegio.id] || [];
            const moduloToggle = (key, label) => `
                <button onclick="colegiosAdminLogic.toggleModulo('${sanitizeHTML(colegio.id)}', '${key}', ${modulos[key]})"
                    class="px-3 py-1.5 rounded-lg text-xs font-bold border transition ${modulos[key]
                        ? 'bg-brand-50 text-brand-700 border-brand-200 hover:bg-brand-100'
                        : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'}"
                    title="${modulos[key] ? 'Módulo activo — clic para desactivar' : 'Módulo inactivo — clic para activar'}">
                    <i class="ph-bold ${modulos[key] ? 'ph-check-circle' : 'ph-circle'}"></i> ${label}
                </button>`;
            const codigosHTML = codigos.length ? codigos.map(c => `
                <div class="flex flex-wrap items-center gap-2 rounded-xl border ${c.activo ? 'border-gray-100 bg-gray-50/70' : 'border-gray-100 bg-gray-50/40 opacity-60'} px-3 py-2">
                    <code class="text-xs font-bold ${c.activo ? 'text-gray-800' : 'text-gray-400 line-through'}">${sanitizeHTML(c.id)}</code>
                    <span class="px-2 py-0.5 rounded-md text-[10px] font-bold ${c.activo ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-gray-100 text-gray-500 border border-gray-200'}">${c.activo ? 'Activo' : 'Inactivo'}</span>
                    <span class="flex-1"></span>
                    ${c.activo ? `<button onclick="colegiosAdminLogic.copiarEnlace('${sanitizeHTML(c.id)}', this)" class="px-3 py-1 rounded-lg text-xs font-bold bg-white border border-gray-200 text-gray-600 hover:text-brand-600 hover:border-brand-200 transition"><i class="ph-bold ph-link"></i> Copiar enlace</button>` : ''}
                    <button onclick="colegiosAdminLogic.toggleCodigo('${sanitizeHTML(c.id)}', ${Boolean(c.activo)})" class="px-3 py-1 rounded-lg text-xs font-bold transition ${c.activo ? 'text-amber-600 hover:bg-amber-50' : 'text-green-600 hover:bg-green-50'}">
                        <i class="ph-bold ${c.activo ? 'ph-pause-circle' : 'ph-play-circle'}"></i> ${c.activo ? 'Desactivar' : 'Reactivar'}
                    </button>
                </div>`).join('')
                : '<p class="text-xs text-gray-400">Sin códigos. Genera uno para que este colegio pueda invitar a su comunidad.</p>';
            return `
                <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <div class="flex items-center gap-2">
                                <h4 class="font-extrabold text-gray-900">${sanitizeHTML(colegio.nombre || colegio.id)}</h4>
                                <span class="px-2.5 py-1 text-xs font-bold rounded-lg border bg-brand-50 text-brand-700 border-brand-100">${sanitizeHTML(colegio.id)}</span>
                            </div>
                            <p class="text-xs text-gray-500 mt-1"><i class="ph-bold ph-users"></i> ${usuarios} usuario${usuarios === 1 ? '' : 's'} con este tag</p>
                        </div>
                        ${colegio.id === DEFAULT_SCHOOL ? '' : `
                        <button onclick="colegiosAdminLogic.eliminar('${sanitizeHTML(colegio.id)}')"
                                class="px-3 py-1.5 rounded-lg text-xs font-bold text-gray-400 hover:text-red-600 hover:bg-red-50 transition order-last"
                                title="${usuarios ? 'Tiene usuarios: hay que moverlos antes' : 'Eliminar este colegio y sus códigos'}">
                            <i class="ph-bold ph-trash"></i> Eliminar
                        </button>`}
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] font-bold uppercase tracking-widest text-gray-400">Módulos:</span>
                            ${moduloToggle('toefl', 'TOEFL')}
                            ${moduloToggle('delf', 'DELF')}
                            ${moduloToggle('icfes', 'Saber 11')}
                        </div>
                    </div>
                    <div class="space-y-2">
                        <div class="flex items-center justify-between gap-2">
                            <p class="text-[10px] font-bold uppercase tracking-widest text-gray-400">Códigos de invitación</p>
                            <button onclick="colegiosAdminLogic.generarCodigo('${sanitizeHTML(colegio.id)}')" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-brand-600 text-white hover:bg-brand-700 transition"><i class="ph-bold ph-plus"></i> Generar código</button>
                        </div>
                        ${codigosHTML}
                    </div>
                </div>`;
        }).join('');
    }
};
window.colegiosAdminLogic = colegiosAdminLogic;
