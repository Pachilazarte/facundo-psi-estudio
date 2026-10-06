# Etapa 4: versión y novedades

**Objetivo:** cada vez que se publica una versión nueva, el usuario ve un aviso con qué cambió.

**Diseño**
- Una lista `NOVEDADES` en el código (versión, fecha, cambios en lenguaje simple).
- Al abrir, si la versión guardada en el teléfono es distinta de la actual, se muestra un modal con los cambios y se guarda la versión vista.
- Ajustes tiene una sección Versión con la versión actual y el botón "Ver novedades".

**Pasos**
- [~] 1. Web: constantes `VERSION_APP` y `NOVEDADES` en `app.jsx`; modal `ModalNovedades`; sección Versión en Ajustes. Verificación: compila (pasa) y el modal aparece con perfil limpio (pendiente, etapa 5.3). La versión se subió a 2.36.0 en `app.jsx`, `version.json`, `sw.js` e `index.html`.
- [x] (2026-10-06) 2. App: `src/novedades.ts`, modal al abrir (guarda la versión vista en un archivo del teléfono) y pestaña Ajustes con la versión. Verificación: `tsc` (pasa). Versión de la app: 1.1.0 (`app.json` y `src/novedades.ts`).

**Criterios de aceptación**
- [ ] Con una versión nueva, el modal aparece una sola vez y lista los cambios. Pendiente: se comprueba en el sitio y en el teléfono (etapa 5.3).
- [ ] Ajustes muestra la versión actual. Pendiente: visual en 390 px (etapa 5.3).
