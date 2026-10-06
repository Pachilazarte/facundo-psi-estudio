# Etapa 4: versión y novedades

**Objetivo:** cada vez que se publica una versión nueva, el usuario ve un aviso con qué cambió.

**Diseño**
- Una lista `NOVEDADES` en el código (versión, fecha, cambios en lenguaje simple).
- Al abrir, si la versión guardada en el teléfono es distinta de la actual, se muestra un modal con los cambios y se guarda la versión vista.
- Ajustes tiene una sección Versión con la versión actual y el botón "Ver novedades".

**Pasos**
- [x] (2026-10-06) 1. Web: constantes `VERSION_APP` y `NOVEDADES` en `app.jsx`; modal `ModalNovedades`; sección Versión en Ajustes. Verificación: compila y el modal aparece con perfil limpio (medido con Chrome local, 390 px). La versión se subió a 2.36.0 en `app.jsx`, `version.json`, `sw.js` e `index.html`.
- [x] (2026-10-06) 2. App: `src/novedades.ts`, modal al abrir (guarda la versión vista en un archivo del teléfono) y pestaña Ajustes con la versión. Verificación: `tsc` (pasa). Versión de la app: 1.1.0 (`app.json` y `src/novedades.ts`).

**Criterios de aceptación**
- [x] (2026-10-06) Con una versión nueva, el modal aparece una sola vez y lista los cambios. Comprobado en el sitio: aparece con perfil limpio, se cierra con "Entendido" y no vuelve al recargar. En el teléfono físico queda pendiente (checklist `docs/06`).
- [x] (2026-10-06) Ajustes muestra la versión actual (web: "Versión instalada: v2.36.0", medido en el sitio). La app nativa muestra `VERSION_APP` (1.1.0); no corrió en un teléfono, así que eso queda pendiente.
