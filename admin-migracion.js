// ─────────────────────────────────────────────────────────────────────────────
// Migración de contactos (solo superadmin, herramienta de UNA sola vez).
//
// Contexto: hasta ahora `phone` y `contactEmail` vivían en el documento público
// `alumni/{uid}`, legible por cualquiera sin sesión vía REST. El código nuevo
// ya escribe y lee esos campos en `alumni/{uid}/privado/contacto` (lectura
// solo para miembros con cuenta, escritura solo el dueño o el superadmin).
// Esta herramienta mueve los 68 perfiles que quedaron con el dato viejo.
//
// Garantías:
//  - Idempotente: correrla dos veces no duplica ni pierde nada. Si un perfil
//    ya no tiene phone/contactEmail en el documento público, se salta.
//  - NUNCA borra antes de escribir: primero se confirma la escritura del
//    documento privado (merge, no pisa lo que ya hubiera) y solo si esa
//    escritura sale bien se borran los campos del documento público. Si la
//    escritura privada falla, el usuario se salta con el motivo y el
//    documento público queda intacto.
//  - Modo simulación (no escribe nada) y modo ejecución (pide confirmación).
//  - Informe completo en pantalla: migrados, saltados (con motivo) y errores,
//    detalle por usuario. Nada se sabe solo por consola.
// ─────────────────────────────────────────────────────────────────────────────

const migracionContactosLogic = {
    results: [],   // {id, name, status: 'migrado'|'pendiente'|'saltado'|'error', motivo}
    running: false,
    lastMode: null, // 'simulacion' | 'ejecucion'

    // Documento privado destino: usa el helper de shared.js
    // (contactoPrivadoDoc = alumni/{uid}/privado/contacto) en vez de
    // construir la ruta a mano, para no divergir si cambia.
    privadoDoc(uid) {
        return contactoPrivadoDoc(uid);
    },

    // Qué campos del documento público hay que mover para este usuario.
    // Solo los que existen y no están vacíos: así una segunda pasada no
    // encuentra nada que hacer y el usuario se salta limpio.
    planFor(user) {
        const fields = {};
        if (user.phone) fields.phone = user.phone;
        if (user.contactEmail) fields.contactEmail = user.contactEmail;
        return fields;
    },

    simulate() {
        this.run(true);
    },

    execute() {
        if (this.running) return;
        if (!confirm('Esto copiará teléfono y/o correo de contacto de los perfiles al documento privado (alumni/{uid}/privado/contacto) y, solo tras confirmar que la copia salió bien, los borrará del documento público. ¿Continuar con la migración real?')) return;
        this.run(false);
    },

    async run(dryRun) {
        if (this.running) return;
        this.running = true;
        this.results = [];
        this.lastMode = dryRun ? 'simulacion' : 'ejecucion';
        const status = document.getElementById('migracion-contactos-status');
        this.renderReport();

        const users = adminLogic.getVisibleUsers(); // superadmin -> todos los alumni
        let i = 0;
        for (const user of users) {
            i++;
            if (status) status.textContent = `${dryRun ? 'Simulando' : 'Migrando'} ${i}/${users.length}…`;

            const fields = this.planFor(user);
            const campos = Object.keys(fields);

            if (!campos.length) {
                this.results.push({
                    id: user.id, name: user.name, status: 'saltado',
                    motivo: 'Sin phone ni contactEmail en el documento público (ya migrado o nunca los tuvo).'
                });
                continue;
            }

            if (dryRun) {
                this.results.push({
                    id: user.id, name: user.name, status: 'pendiente',
                    motivo: `Se escribiría ${campos.join(' y ')} en privado/contacto y luego se borraría del documento público.`
                });
                continue;
            }

            // 1) Escritura del documento privado. Usa el mismo helper que el
            //    resto del código (saveContactoPrivado, en shared.js): merge,
            //    trim y updatedAt, para no divergir del formato real.
            try {
                await saveContactoPrivado(user.id, fields);
            } catch (e) {
                this.results.push({
                    id: user.id, name: user.name, status: 'error',
                    motivo: `No se pudo escribir el documento privado, el usuario NO se toca: ${e.code || e.message || e}`
                });
                continue;
            }

            // 2) Solo si lo anterior salió bien, se borran del documento
            //    público. Si esto falla, el dato ya quedó a salvo en privado
            //    (no se pierde nada); queda duplicado hasta reintentar.
            try {
                const borrar = {};
                campos.forEach(k => { borrar[k] = firebase.firestore.FieldValue.delete(); });
                await alumniCollection.doc(user.id).update(borrar);
                this.results.push({
                    id: user.id, name: user.name, status: 'migrado',
                    motivo: `Migrado: ${campos.join(' y ')}.`
                });
            } catch (e) {
                this.results.push({
                    id: user.id, name: user.name, status: 'error',
                    motivo: `El dato ya quedó copiado en privado, pero no se pudo borrar del documento público (queda duplicado, sin pérdida): ${e.code || e.message || e}`
                });
            }
        }

        this.running = false;
        if (status) status.textContent = '';
        this.renderReport();
        if (!dryRun) {
            await loadAlumni();
            adminLogic.renderUsers();
        }
    },

    STATUS_META: {
        migrado:   { label: 'Migrado',            icon: 'ph-check-circle',      cls: 'text-green-700 bg-green-50 border-green-200' },
        pendiente: { label: 'Se migraría',         icon: 'ph-arrow-right',       cls: 'text-brand-700 bg-brand-50 border-brand-200' },
        saltado:   { label: 'Saltado',             icon: 'ph-skip-forward',      cls: 'text-gray-500 bg-gray-100 border-gray-200' },
        error:     { label: 'Error',               icon: 'ph-warning-circle',    cls: 'text-red-700 bg-red-50 border-red-200' }
    },

    renderReport() {
        const holder = document.getElementById('migracion-contactos-report');
        if (!holder) return;
        if (!this.results.length) { holder.innerHTML = ''; return; }

        const counts = { migrado: 0, pendiente: 0, saltado: 0, error: 0 };
        this.results.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });

        const modoLabel = this.lastMode === 'simulacion'
            ? 'Simulación (nada se escribió todavía)'
            : 'Ejecución real';

        holder.innerHTML = `
            <div class="space-y-3 mt-4">
                <p class="text-sm font-bold text-gray-900">${modoLabel} · ${this.results.length} perfiles revisados</p>
                <div class="flex flex-wrap gap-2">
                    ${Object.entries(counts).filter(([, n]) => n > 0).map(([k, n]) => {
                        const meta = this.STATUS_META[k];
                        return `<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border ${meta.cls}"><i class="ph-bold ${meta.icon}"></i> ${n} ${meta.label.toLowerCase()}</span>`;
                    }).join('')}
                </div>
                <details class="text-xs text-gray-500" ${this.results.length <= 15 ? 'open' : ''}>
                    <summary class="cursor-pointer font-bold hover:text-gray-700">Ver el detalle por usuario</summary>
                    <ul class="mt-2 space-y-1.5 max-h-80 overflow-y-auto pr-2">
                        ${this.results.map(r => {
                            const meta = this.STATUS_META[r.status];
                            return `<li class="flex items-start gap-2 border-b border-gray-50 pb-1.5">
                                <span class="inline-flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold border ${meta.cls}"><i class="ph-bold ${meta.icon}"></i> ${meta.label}</span>
                                <span><strong>${sanitizeHTML(r.name || r.id)}</strong> — ${sanitizeHTML(r.motivo)}</span>
                            </li>`;
                        }).join('')}
                    </ul>
                </details>
            </div>`;
    }
};
window.migracionContactosLogic = migracionContactosLogic;
