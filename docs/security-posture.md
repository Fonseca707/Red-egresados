# Estado de ciberseguridad de la plataforma

Este documento resume el estado actual observable en el repositorio para apoyar una charla de ciberseguridad. No reemplaza una auditoría de infraestructura, reglas de Firebase, consola de Google Cloud ni pruebas de penetración.

## Puertos abiertos

- La aplicación del repositorio es un frontend estático compuesto por archivos HTML, CSS y JavaScript; no hay servidor HTTP propio, Dockerfile, proceso Node/Express ni configuración de escucha de puertos versionada.
- En producción la exposición de red dependerá del hosting usado. Con Firebase Hosting normalmente solo deberían exponerse HTTPS/443 y redirección HTTP/80 gestionadas por la plataforma, no puertos de aplicación personalizados.
- Acción recomendada: validar desde el dominio real con un escaneo externo autorizado y documentar el resultado esperado: 443 abierto, 80 redirigiendo a HTTPS, demás puertos cerrados o filtrados.

## Backups

- El repositorio no incluye política, automatización ni evidencia de backups para Firestore, Storage o configuración de Firebase.
- Los datos operativos se guardan principalmente en Firestore bajo la ruta `artifacts/{appId}/public/data/alumni`, `artifacts/{appId}/public/data/news`, `artifacts/{appId}/admins` y subcolecciones de chats por usuario.
- Acción recomendada: habilitar exportaciones programadas de Firestore hacia Cloud Storage, versionar la política de retención y probar restauraciones periódicamente.

## Mecanismo de contingencias

- La aplicación usa Firebase Authentication y Firestore como dependencias críticas. Si Firebase Auth falla, no hay mecanismo alterno para autenticación real; si Firestore falla, algunas pantallas quedan sin datos o usan fallbacks visuales limitados.
- No hay runbook versionado de incidentes, página de estado, modo mantenimiento, monitoreo, alertas ni procedimiento documentado de comunicación a usuarios.
- Acción recomendada: crear un runbook con responsables, severidades, pasos de diagnóstico, comunicación, criterios de escalamiento y procedimiento de recuperación desde backup.

## Política de fallas

- El código muestra mensajes amigables para varios errores de autenticación y valida algunos datos antes de guardar perfiles.
- La política formal de fallas no está documentada: no hay objetivos RTO/RPO, matriz de severidad, tiempos de respuesta, responsabilidades, ni proceso postmortem.
- Acción recomendada: definir RTO/RPO, severidades P1-P4, ventanas de comunicación, criterios de degradación segura y revisión post-incidente.

## Riesgos principales observados

1. No hay evidencia versionada de reglas de seguridad de Firestore o Storage.
2. La configuración de Firebase aparece embebida en el frontend; esto no es un secreto por sí mismo, pero exige reglas backend estrictas y restricciones de dominio/API key en Google Cloud.
3. No hay documentación de backups ni pruebas de restauración.
4. No hay runbook de contingencia o política formal de manejo de fallas.
5. El repositorio no incluye pipeline de seguridad, análisis estático, escaneo de dependencias o pruebas automatizadas.

## Configuración de Firebase en el frontend (por diseño)

- Las claves de `firebaseConfig` (incluida `apiKey`) viven en el cliente (`shared.js` y `index.html`). **Esto es normal y esperado en apps web de Firebase**: la `apiKey` identifica el proyecto, no es un secreto y no otorga acceso a datos por sí sola.
- La seguridad real **no** depende de ocultar esa configuración, sino de las **Reglas de Firestore** (y de Storage), más restricciones de dominio/API key en Google Cloud. Por eso la config permanece embebida y versionada; moverla a un archivo aparte no aporta seguridad y complica el despliegue estático.
- Estado actual: las reglas de Firestore **no están versionadas en este repositorio**, por lo que la frontera de seguridad efectiva no es auditable desde el código. Este es el riesgo #1 y #2 de la sección anterior.

### Borrador de referencia de Reglas de Firestore

No se despliega automáticamente: es un punto de partida para revisar y ajustar en la consola de Firebase antes de publicar. Alinea con las rutas reales que usa la app.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // El superadmin se reconoce por correo, igual que en el cliente
    // (state.superAdminUsernames). Login por usuario => correo sintetico
    // usuario@sinapsis.local; login con Google => correo real.
    function isSuperAdmin() {
      return request.auth != null && (
        request.auth.token.email.matches('juanda[.]fonsecag@.*') ||
        request.auth.token.email.matches('wanda[.]cg@.*')
      );
    }

    match /artifacts/{appId} {

      // Sub-admin de colegio: tiene documento en admins/{uid}.
      function isSchoolAdmin() {
        return request.auth != null &&
          exists(/databases/$(database)/documents/artifacts/$(appId)/admins/$(request.auth.uid));
      }
      function isAdmin() { return isSuperAdmin() || isSchoolAdmin(); }

      // Directorio de egresados: lectura autenticada; cada quien edita su doc
      // (o un admin, p. ej. al crear un sub-administrador).
      match /public/data/alumni/{userId} {
        allow read: if request.auth != null;
        allow create, update: if request.auth != null
          && (request.auth.uid == userId || isAdmin());
        allow delete: if isAdmin();
      }

      // Noticias: lectura publica; escritura solo admin.
      match /public/data/news/{newsId} {
        allow read: if true;
        allow write: if isAdmin();
      }

      // Usuarios de login (username -> authEmail/uid).
      // Un usuario reserva su propio username; un admin puede reservar el de
      // un sub-administrador que esta creando (uid distinto al del admin).
      match /usernames/{username} {
        allow read: if true; // necesario para resolver login por usuario
        allow create, update: if request.auth != null
          && (request.resource.data.uid == request.auth.uid || isAdmin());
        allow delete: if isAdmin();
      }

      // Administradores de colegio: solo el superadmin asigna/revoca.
      match /admins/{userId} {
        allow read: if request.auth != null
          && (request.auth.uid == userId || isAdmin());
        allow write: if isSuperAdmin();
      }

      // Chats: el dueno de la subcoleccion escribe su copia; ademas el emisor
      // puede escribir la copia del par (el modelo actual guarda una copia por
      // usuario, no un chat 1:1 compartido).
      match /users/{userId}/chats/{chatId} {
        allow read: if request.auth != null && request.auth.uid == userId;
        allow create, update: if request.auth != null
          && (request.auth.uid == userId || request.resource.data.peerId == request.auth.uid);
        match /messages/{messageId} {
          allow read: if request.auth != null && request.auth.uid == userId;
          allow create: if request.auth != null
            && request.resource.data.senderId == request.auth.uid;
        }
      }
    }
  }
}
```

> Por qué fallaba "Crear administrador de colegio" (`Missing or insufficient permissions`): `createSubAdmin` escribe, en el contexto del superadmin, tres documentos con un `uid` distinto al suyo (`usernames/{u}`, `alumni/{nuevoUid}`, `admins/{nuevoUid}`). Sin una regla que reconozca al superadmin del lado del servidor, Firestore lo trata como usuario normal y rechaza esas escrituras. El bloque de arriba resuelve esto con `isSuperAdmin()` (por correo). Alternativa más robusta a futuro: representar al superadmin con un doc `admins/{uid}` con `role: 'superadmin'` y usar Custom Claims en vez de comparar correos.

## Próximos pasos recomendados

1. Exportar y versionar reglas de Firestore/Storage.
2. Configurar backups programados de Firestore y probar restauración en un proyecto alterno.
3. Documentar runbook de contingencias y política de fallas.
4. Validar puertos del dominio productivo con escaneo autorizado.
5. Restringir API keys por dominio y revisar proveedores habilitados en Firebase Authentication.
6. Agregar monitoreo y alertas para errores de autenticación, lecturas/escrituras fallidas y disponibilidad del hosting.
