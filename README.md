# Red de Egresados (AlumniConnect)

La app está conectada a Firebase manteniendo el estilo original del HTML.

## Funcionalidades implementadas

- Login con Email/Password.
- Login con Google.
- Registro normal con email/contraseña.
- Modo invitado para navegar directorio.
- Perfil de egresado guardado en Firestore.
- Chat 1:1 base: creación desde Directorio (solo usuario registrado) y persistencia de mensajes.
- Notificaciones removidas del navbar.

## Firestore usado

- Perfiles/directorio:
  - `artifacts/{appId}/public/data/alumni/{userId}`
- Chats 1:1:
  - `artifacts/{appId}/public/data/chats/{chatId}`
  - `artifacts/{appId}/public/data/chats/{chatId}/messages/{messageId}`

## Recomendación de reglas para invitado + chats

Para que invitado vea directorio, la lectura de `alumni` debe ser pública.

```txt
match /artifacts/{appId}/public/data/alumni/{userId} {
  allow read: if true;
  allow write: if request.auth != null && request.auth.uid == userId;
}

match /artifacts/{appId}/public/data/chats/{chatId} {
  allow read: if request.auth != null && (
    request.auth.token.admin == true || request.auth.uid in resource.data.members
  );
  allow create: if request.auth != null;
  allow update: if request.auth != null && (
    request.auth.token.admin == true || request.auth.uid in resource.data.members
  );

  match /messages/{messageId} {
    allow read, create: if request.auth != null && (
      request.auth.token.admin == true || request.auth.uid in get(/databases/$(database)/documents/artifacts/$(appId)/public/data/chats/$(chatId)).data.members
    );
  }
}
```

## Ejecutar local

```bash
python3 -m http.server 4173
```

Abrir en `http://localhost:4173`.
