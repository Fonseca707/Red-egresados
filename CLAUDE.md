# Sinapsis — Red de Egresados LCP

## ⛔ REGLA #0 — LEER EL VAULT ANTES DE TRABAJAR

Antes de tocar código o hablar del proyecto:

1. `C:\Users\juand\MiVaultClaude\CLAUDE.md` — reglas del vault + tabla de proyectos.
2. `C:\Users\juand\MiVaultClaude\proyectos\red-egresados\index.md` — estado real del proyecto.
3. `C:\Users\juand\MiVaultClaude\proyectos\red-egresados\aprendizajes.md` — cómo trabajar este proyecto y con Juan.

El vault es la fuente de verdad, por encima de lo que yo recuerde o de lo que diga el nombre de una carpeta.

**Mientras trabajo → mantener el vault vivo:** cada decisión o cambio se escribe en su nota del vault EN EL MOMENTO, sin esperar a que me lo pidan. Antes de cerrar: verificar que quedó escrito.

**Pendientes de Juan** (claves, despliegues, compras, pruebas en dispositivo real) se anotan solos:

```
node C:\Users\juand\Desktop\Lanzadera\herramientas\pendiente.js agregar "texto" --proyecto Sinapsis
```

## ⚠️ El CSS se COMPILA (desde 2026-07-31)

Tailwind ya **no** viene de `cdn.tailwindcss.com` (compilaba en el navegador y, cuando el script no llegaba, la web se veía sin un solo estilo en el celular). Ahora se sirve `tailwind.css`, compilado desde este repo.

**Si agregas, cambias o borras una clase de Tailwind en cualquier `.html` o `.js`, recompila ANTES de desplegar:**

```
npx tailwindcss@3 -i tailwind.src.css -o tailwind.css --minify
```

Si no lo haces, la clase nueva **no existe** y esa parte se ve rota. Dos reglas que van con esto:
- Al recompilar, subir el `?v=` de `tailwind.css` en las 11 páginas (misma regla que `shared.js`/`theme.js`).
- `tailwind.config.js` lista `content: ['./*.html', './*.js']`. Las clases escritas dentro de plantillas de JS **sí** se detectan; las construidas por concatenación (`bg-${color}-500`) **no** — no las uses.
- El `<link>` de `tailwind.css` va al **final del `<head>`**, después de los `<style>` de la página: ahí es donde el CDN inyectaba el suyo y de ahí depende la cascada (con el link arriba, los iconos pierden su `line-height` y la barra móvil encoge 10 px).

## Este repo

- Ruta: `C:\Users\juand\Desktop\Sinapsis` — GitHub: `Fonseca707/Red-egresados`.
- Multi-tenant por colegio; superadmin por **correo exacto y verificado** (nunca por prefijo).
- Notas clave del vault: `multi-tenant.md`, `plataforma.md`, `correos-automaticos.md`, `icfes-modulo.md`, `toefl-formato-real-2026.md`.
