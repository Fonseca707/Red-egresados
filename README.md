# Red de Egresados (AlumniConnect)

## Seguridad de Firebase config (importante)

- En apps web **no se puede ocultar completamente** `apiKey` del cliente.
- Lo que sí protege tu proyecto son las **reglas de Firestore/Auth**, dominios autorizados y App Check.
- Para no dejarla hardcodeada en el HTML, ahora se carga desde `firebase-config.js` (ignorado por git).

### Configuración local

1. Copia el ejemplo:
   ```bash
   cp firebase-config.example.js firebase-config.js
   ```
2. Pega tu configuración real en `window.FIREBASE_CONFIG`.
3. Corre:
   ```bash
   python3 -m http.server 4173
   ```

## Funcionalidades

- Login Email/Password, Google y registro por email.
- Modo invitado para ver directorio.
- Perfil guardado en Firestore.
- Mensajes persistentes por usuario autenticado bajo rutas compatibles con tus reglas actuales.

## Rutas Firestore usadas actualmente

- Perfiles/directorio:
  - `artifacts/{appId}/public/data/alumni/{userId}`
- Chats por usuario:
  - `artifacts/{appId}/users/{userId}/chats/{chatId}`
  - `artifacts/{appId}/users/{userId}/chats/{chatId}/messages/{messageId}`

> Nota: con estas reglas, el chat queda guardado por cada usuario. Para chat compartido 1:1 real se necesita ampliar reglas/estructura.


## Solución de fallos comunes

- Si ves `FIREBASE_CONFIG no encontrado`, crea `firebase-config.js` desde el ejemplo.
- Si el login no avanza, revisa credenciales y que el proveedor Email/Password esté activo en Firebase Auth.
- Si mensajes no crean chat, revisa reglas en `artifacts/{appId}/users/{userId}/chats/...`.
