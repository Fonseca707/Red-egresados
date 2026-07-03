# Sinapsis - Red de Egresados

La app esta conectada a Firebase desde paginas HTML estaticas. El nucleo compartido vive en `shared.js`; ese archivo define Firebase, rutas de Firestore, navegacion comun, helpers de perfil, colegio por defecto y roles administrativos.

## Funcionalidades implementadas

- Inicio de sesion con **correo o usuario + password**.
- Inicio de sesión con **Google**.
- Opción **"Revisar la red como invitado"** (solo lectura del directorio).
- Opcion de **registro normal** con correo o usuario desde la misma vista de login.
- Lectura/edición del perfil de egresado en Firestore.
- Mensajes básicos persistidos en Firebase por usuario autenticado.
- Etiqueta de colegio `LCP` como valor por defecto para usuarios existentes y nuevos.
- Panel admin con metricas, graficas simples, gestion de noticias, usuarios y administradores por colegio.

## Firestore usado

Rutas alineadas con tus reglas:

- Perfil y directorio: `artifacts/{appId}/public/data/alumni/{userId}`
- Usuarios de login: `artifacts/{appId}/usernames/{username}`
- Administradores: `artifacts/{appId}/admins/{userId}`
- Chats por usuario: `artifacts/{appId}/users/{userId}/chats/{chatId}`
- Mensajes por chat: `artifacts/{appId}/users/{userId}/chats/{chatId}/messages/{messageId}`

## Seguridad y configuración de Firebase

La `firebaseConfig` (incluida `apiKey`) está embebida en el cliente **por diseño**: en apps web de Firebase no es un secreto. La seguridad real depende de las **Reglas de Firestore**, que hoy no están versionadas en el repo. Consulta `docs/security-posture.md` para el detalle y un **borrador de referencia de reglas** alineado con las rutas de esta app.

## Campos de perfil guardados

- `firstName`, `lastName`
- `graduationYear`
- `location`
- `status`
- `area`
- `studies`
- `role`
- `bio`
- `skills` (array)
- `topics`
- `phone`
- `linkedin`
- `school` (`LCP` por defecto)
- `username` (cuando el registro se hace con usuario)
- `email`
- `contactEmail`
- `createdAt`, `updatedAt`

## Ejecutar local

```bash
python3 -m http.server 4173
```

Abrir en `http://localhost:4173`.

## Qué faltaría para producción completa

- Reglas para chat 1:1 real entre dos usuarios (hoy cada usuario guarda su propia copia de mensajes).
- Reglas de seguridad Firestore completas para proteger `admins` y `usernames` desde servidor/reglas.
- Backend o Cloud Function para creacion de administradores en produccion con privilegios mas fuertes.
