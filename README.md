# Red de Egresados (AlumniConnect)

La app ahora está conectada a **Firebase Authentication + Cloud Firestore** directamente desde `index.html`.

## Lo implementado

- Login con **Email/Password**.
- Login con **Google**.
- Lectura del directorio desde Firestore.
- Guardado/edición del perfil de egresado en Firestore.
- Mantiene el estilo y flujo visual original del HTML base.

## Estructura de datos usada (Firestore)

Se usa la ruta compatible con tus reglas:

- `artifacts/{appId}/public/data/alumni/{userId}`

Campos guardados por egresado:

- `firstName`, `lastName`
- `graduationYear`
- `location`
- `status` (`estudiando`, `trabajando`, `estudiando y trabajando`, `emprendiendo`)
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

Abrir en navegador:

- `http://localhost:4173`

## Reglas Firestore

El código está alineado a reglas de lectura/escritura por usuario autenticado en la colección de `alumni` dentro de `artifacts/{appId}`.
