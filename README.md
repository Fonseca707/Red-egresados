# Red de Egresados (AlumniConnect)

La app quedó conectada a Firebase manteniendo el estilo original de tu HTML.

## Funcionalidades implementadas

- Inicio de sesión con **Email/Password**.
- Inicio de sesión con **Google**.
- Opción **"Revisar la red como invitado"** (solo lectura del directorio).
- Opción de **registro normal** con email/contraseña desde la misma vista de login.
- Lectura/edición del perfil de egresado en Firestore.
- Mensajes básicos persistidos en Firebase por usuario autenticado.

## Firestore usado

Rutas alineadas con tus reglas:

- Perfil y directorio: `artifacts/{appId}/public/data/alumni/{userId}`
- Chats por usuario: `artifacts/{appId}/users/{userId}/chats/{chatId}`
- Mensajes por chat: `artifacts/{appId}/users/{userId}/chats/{chatId}/messages/{messageId}`

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
- `email`
- `createdAt`, `updatedAt`

## Ejecutar local

```bash
python3 -m http.server 4173
```

Abrir en `http://localhost:4173`.

## Qué faltaría para producción completa

- Reglas para chat 1:1 real entre dos usuarios (hoy cada usuario guarda su propia copia de mensajes).
- Gestión de roles admin (publicación de novedades, moderación).
- Validaciones más estrictas de formularios y manejo de errores amigable.
