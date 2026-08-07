// Los tipos de miembro (egresado / profesor del colegio), sin navegador.
//
// Por qué existe: meter un documento que NO es un egresado en la colección
// `alumni` no rompe nada — la hace mentir. Seis consumidores daban por hecho
// que cada documento era un egresado, y ninguno de ellos lanza un error cuando
// deja de serlo: el contador de la portada sube, Karla cita a quien no tiene
// ruta, el correo le pide a un docente que "complete su trayectoria". Es el
// mismo fallo silencioso que ya costó una sesión cuando Karla creyó que la red
// eran 4 personas (ver lecturas-firestore en el vault).
import fs from 'node:fs';

const leer = f => fs.readFileSync('./' + f, 'utf8');
const SHARED = leer('shared.js');
const RULES = leer('docs/firestore.rules');

let ok = 0, fallos = 0;
const comprobar = (t, c, d = '') => {
    if (c) { ok++; console.log(`  ok   ${t}`); } else { fallos++; console.log(`  FALLA ${t} ${d}`); }
};

// ── Sandbox: las funciones puras de shared.js ────────────────────────────────
const desde = SHARED.indexOf('const TIPO_MIEMBRO');
const hasta = SHARED.indexOf('\n', SHARED.indexOf('const soloProfesores'));
const trozo = SHARED.slice(desde, hasta);
const { TIPO_MIEMBRO, esProfesor, soloEgresados, soloProfesores } =
    new Function(trozo + '\n return { TIPO_MIEMBRO, esProfesor, soloEgresados, soloProfesores };')();

const egresado = (o = {}) => ({ id: 'e1', tipo: 'egresado', hitosCount: 3, year: '2020', accountStatus: 'activo', area: 'Salud', ...o });
const profe = (o = {}) => ({ id: 'p1', tipo: 'profesor', hitosCount: 0, year: '', accountStatus: 'activo', ...o });

console.log('\n1) Ausencia de tipo = egresado (los 68 documentos anteriores)');
comprobar('un documento SIN campo tipo no es profesor', !esProfesor({ id: 'viejo' }));
comprobar('…y entra en soloEgresados', soloEgresados([{ id: 'viejo' }]).length === 1);
comprobar('un valor raro tampoco cuela como profesor', !esProfesor({ tipo: 'PROFESOR ' }) && !esProfesor({ tipo: 'admin' }));
comprobar('mapearAlumno normaliza el tipo, no lo copia crudo',
    /tipo: d\.tipo === TIPO_MIEMBRO\.PROFESOR \? TIPO_MIEMBRO\.PROFESOR : TIPO_MIEMBRO\.EGRESADO/.test(SHARED));
comprobar('el tipo se normaliza en mapearAlumno y en ningún otro sitio',
    (SHARED.match(/tipo: d\.tipo/g) || []).length === 1);

console.log('\n2) TIPO_MIEMBRO.PROFESOR no es STATUS.PROFESOR');
// Son dos cosas distintas con el mismo nombre: "este egresado da clase" y
// "esta persona es docente del colegio". Confundirlas es el error natural.
comprobar('siguen existiendo los dos y están documentados',
    /STATUS = \{[^}]*PROFESOR:'profesor'/.test(SHARED) && /no confundir con STATUS\.PROFESOR/i.test(SHARED));
comprobar('un egresado que da clase NO es un profesor del colegio',
    !esProfesor(egresado({ status: 'profesor' })));

console.log('\n3) Los seis consumidores que iban a mentir');
comprobar('el resumen de la red cuenta solo egresados', /const activos = soloEgresados\(vivos\)/.test(SHARED));
comprobar('…y publica los profesores como número aparte', /profesores: soloProfesores\(vivos\)\.length/.test(SHARED));
comprobar('…y ese número entra en la comparación que evita reescribir',
    /'rutasCompletas','promoMin','promoMax','profesores'/.test(SHARED));
comprobar('las rutas que cita Karla excluyen profesores',
    /return soloEgresados\(cache\)\.filter\(a => \(a\.hitosCount \|\| 0\) >= 1\)/.test(SHARED)
    && /return soloEgresados\(snap\.docs\.map\(mapearAlumno\)\)/.test(SHARED));
comprobar('las historias destacadas de la portada excluyen profesores',
    /const traer = async \(consulta\) => soloEgresados\(/.test(SHARED));
const ADMIN = leer('admin.html');
comprobar('la tarjeta "Egresados" del admin no cuenta profesores',
    /value:soloEgresados\(users\)\.length/.test(ADMIN));
comprobar('…y "perfiles incompletos" tampoco (un profesor no tiene promoción)',
    /const incomplete = soloEgresados\(users\)/.test(ADMIN));
comprobar('los agregados "a dónde llegan los egresados" excluyen profesores',
    /const conRuta = soloEgresados\(adminLogic\.getVisibleUsers\(\)\)/.test(leer('admin-rutas-ia.js')));
const WORKER = leer('correos-worker/worker.js');
comprobar('a un profesor no se le pide "completa tu ruta"', /if \(!esProfesor && hitos < 2/.test(WORKER));
comprobar('…ni se le manda el pulso de hito abierto', /if \(!esProfesor && hitos > 0\)/.test(WORKER));
comprobar('…pero sí recibe la bienvenida', /pendientes\.push\(\{ alum: a, tipo: 'bienvenida'/.test(WORKER));

console.log('\n4) 🔴 El tipo es una credencial: sale del código, no del formulario');
comprobar('validarCodigoInvitacion devuelve el tipo del código',
    /const tipo = doc\.data\(\)\.tipo === TIPO_MIEMBRO\.PROFESOR/.test(SHARED));
const REG = leer('register.html');
comprobar('el registro lo copia del código en sus DOS ramas (correo y Google)',
    (REG.match(/tipo: invitacionColegio \? invitacionColegio\.tipo : TIPO_MIEMBRO\.EGRESADO/g) || []).length === 2);
comprobar('no hay ningún desplegable de tipo en el registro ni en el onboarding',
    !/<option value="profesor">.*<\/option>/.test(REG) && !/id="ob-tipo"/.test(leer('onboarding.html')));
comprobar('la regla de Firestore impide cambiarse el tipo a sí mismo',
    /request\.resource\.data\.get\('tipo', 'egresado'\) == resource\.data\.get\('tipo', 'egresado'\)/.test(RULES));
comprobar('…y nacer profesor exige un código que diga profesor',
    /function tipoValidoAlCrear\(\)/.test(RULES) && /tipoValidoAlCrear\(\)/.test(RULES.split('function tipoValidoAlCrear')[0] + RULES.split('allow create')[1]));
comprobar('el admin puede corregirlo, y solo el superadmin',
    /cambiarTipo: async/.test(ADMIN) && /state\.adminRole !== 'superadmin'.*Solo el superadministrador/s.test(ADMIN));

console.log('\n5) Lo que ve el estudiante: la ficha no pide datos imposibles');
const DIR = leer('directory.html');
comprobar('el directorio deja filtrar por tipo', /id="directory-tipo"/.test(DIR));
comprobar('la promoción no borra a los profesores del resultado',
    /if \(yearTerm && \(esProfesor\(u\) \|\| !yearValue\.includes\(yearTerm\)\)\) return false;/.test(DIR));
comprobar('la búsqueda entra en las áreas (que son texto libre)',
    /\(u\.areas \|\| ''\)\.toLowerCase\(\)\.includes\(term\)/.test(DIR));
comprobar('la tarjeta del profesor no dice "Promoción ---"', /Profesor del colegio\$\{alum\.aniosEnsenando/.test(DIR));
const OB = leer('onboarding.html');
comprobar('el onboarding del profesor no pide trayectoria', /panel-2-profesor/.test(OB));
comprobar('…y le manda la promoción vacía', /graduationYear: profe \? '' :/.test(OB));
comprobar('…y hitosCount 0, que es lo que lo saca de las historias', /hitosCount: profe \? 0 :/.test(OB));
comprobar('los campos del profesor viajan siempre, vacíos si es egresado',
    /areas: profe \? .* : '',/.test(OB) && /formacion: profe \? .* : '',/.test(OB));

console.log('\n6) El profesor no hereda la etiqueta de "situación actual"');
comprobar('sus tags dicen lo que es, no en qué anda',
    /\['Profesor del colegio'\]|'Profesor del colegio'/.test(SHARED));

console.log(`\n${ok} ok · ${fallos} fallas`);
process.exit(fallos ? 1 : 0);
