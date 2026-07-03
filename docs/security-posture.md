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
    match /artifacts/{appId} {

      // Directorio de egresados: lectura autenticada; cada quien solo edita su doc.
      match /public/data/alumni/{userId} {
        allow read: if request.auth != null;
        allow create, update: if request.auth != null
          && (request.auth.uid == userId || isAdmin(appId));
        allow delete: if isAdmin(appId);
      }

      // Noticias: lectura pública/autenticada; escritura solo admin.
      match /public/data/news/{newsId} {
        allow read: if true;
        allow write: if isAdmin(appId);
      }

      // Usuarios de login (username -> authEmail/uid).
      match /usernames/{username} {
        allow read: if true; // necesario para resolver login por usuario
        allow create, update: if request.auth != null
          && request.resource.data.uid == request.auth.uid;
      }

      // Administradores de colegio: solo superadmin escribe; el afectado puede leerse.
      match /admins/{userId} {
        allow read: if request.auth != null
          && (request.auth.uid == userId || isAdmin(appId));
        allow write: if isAdmin(appId);
      }

      // Chats y mensajes: solo el dueño de la subcolección.
      match /users/{userId}/chats/{chatId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
        match /messages/{messageId} {
          allow read, write: if request.auth != null && request.auth.uid == userId;
        }
      }
    }

    function isAdmin(appId) {
      return request.auth != null
        && exists(/databases/$(database)/documents/artifacts/$(appId)/admins/$(request.auth.uid));
    }
  }
}
```

> Nota: este borrador asume que los superadmins también tienen documento en `admins/{uid}`. Hoy la app identifica superadmins por correo/usuario en el cliente (`state.superAdminUsernames`), no en Firestore; antes de desplegar reglas hay que decidir cómo representar al superadmin del lado del servidor (por ejemplo, un doc `admins/{uid}` con `role: 'superadmin'`), o el superadmin quedará sin permisos de escritura. El modelo de chat actual guarda una copia por usuario, no un chat 1:1 compartido.

## Próximos pasos recomendados

1. Exportar y versionar reglas de Firestore/Storage.
2. Configurar backups programados de Firestore y probar restauración en un proyecto alterno.
3. Documentar runbook de contingencias y política de fallas.
4. Validar puertos del dominio productivo con escaneo autorizado.
5. Restringir API keys por dominio y revisar proveedores habilitados en Firebase Authentication.
6. Agregar monitoreo y alertas para errores de autenticación, lecturas/escrituras fallidas y disponibilidad del hosting.
