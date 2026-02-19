# Red de Egresados (AlumniConnect)

Base inicial de la plataforma conectada a Firebase en modo progresivo:

- Si existe `firebase-config.js`, usa Firebase Auth y Firestore.
- Si no existe, corre en **modo demo local** con datos mock.
- Login habilitado para **Email/Password** y **Google**.

## Configuración rápida

1. Copia configuración:
   ```bash
   cp firebase-config.example.js firebase-config.js
   ```
2. Reemplaza credenciales por las de tu proyecto Firebase.
3. Sirve la app estática:
   ```bash
   python3 -m http.server 4173
   ```
4. Abre `http://localhost:4173`.

## ¿Cómo sacar la configuración web de Firebase?

1. Entra a [Firebase Console](https://console.firebase.google.com/).
2. Selecciona tu proyecto.
3. Click en el ícono de engranaje (**Project settings**).
4. En la sección **Your apps**, elige tu app web (`</>`).
5. Copia el bloque `firebaseConfig` y pégalo en `firebase-config.js`.

## Auth: checklist mínimo

En **Authentication > Sign-in method** debes ver activos:

- Email/Password ✅
- Google ✅

> Si Google da error en local, revisa `Authorized domains` e incluye `localhost`.

## ¿Qué significa “estructura final” de Firestore?

Es definir exactamente qué colecciones y campos va a usar la app para evitar rehacer código después.

### Propuesta inicial (puedes copiarla y ajustarla)

- `alumni/{uid}`
  - `firstName` (string)
  - `lastName` (string)
  - `displayName` (string)
  - `email` (string)
  - `graduationYear` (number)
  - `location` (string)
  - `role` (string)
  - `company` (string)
  - `skills` (array<string>)
  - `bio` (string)
  - `photoURL` (string)
  - `createdAt` (timestamp)
  - `updatedAt` (timestamp)

- `news/{newsId}`
  - `title`, `summary`, `body`, `category`, `imageURL`, `publishedAt`, `authorName`

- `chats/{chatId}`
  - `members` (array<uid>)
  - `lastMessage` (string)
  - `lastMessageAt` (timestamp)

- `chats/{chatId}/messages/{messageId}`
  - `senderId` (uid)
  - `text` (string)
  - `createdAt` (timestamp)

## ¿Qué reglas de seguridad necesito que me pases?

Pásame tu archivo de reglas actual (`firestore.rules`) o pégamelo tal cual. Para ayudarte más rápido, comparte también estas decisiones:

1. ¿Quién puede leer el directorio de egresados?
   - ¿solo usuarios autenticados?
   - ¿público?
2. ¿Quién puede editar un perfil?
   - ¿solo el dueño (`request.auth.uid == uid`)?
   - ¿admin también?
3. ¿Quién puede publicar noticias?
   - ¿solo admin?
4. ¿Mensajería privada entre miembros del chat únicamente?

Con eso te devuelvo reglas completas y listas para deploy.

## Siguientes pasos recomendados

- Crear módulo de perfil (lectura/escritura a Firestore).
- Guardar avatar en Firebase Storage.
- Crear colección `news` y flujo de publicación por rol admin.
- Migrar a Vite/React si quieres escalar más rápido.
