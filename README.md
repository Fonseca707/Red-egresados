# Red de Egresados (AlumniConnect)

Base inicial de la plataforma conectada a Firebase en modo progresivo:

- Si existe `firebase-config.js`, usa Firebase Auth y Firestore.
- Si no existe, corre en **modo demo local** con datos mock.

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

## Qué necesito para dejarlo 100% conectado en producción

1. **Config web de Firebase** (`apiKey`, `authDomain`, `projectId`, etc.).
2. **Método de autenticación** habilitado en Firebase Auth (Email/Password o Google).
3. **Modelo final de datos** de Firestore (colecciones/campos requeridos).
4. **Reglas de seguridad** deseadas para Auth + Firestore.
5. **Cuenta GitHub destino** (usuario/organización y nombre del repo) para publicar remoto.

## Siguientes pasos recomendados

- Crear módulos por vista (`auth`, `directory`, `profile`, `news`, `messages`).
- Implementar CRUD de perfil y subida de avatar a Firebase Storage.
- Activar reglas y entorno con `.env` (si migramos a Vite/React).
