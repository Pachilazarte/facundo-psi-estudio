# Etapa 5: verificación y publicación

**Pasos**
- [x] (2026-10-06) 1. Compilar `app.jsx` con Babel; `tsc --noEmit` y `expo export --platform ios` en la app. Resultado: Babel OK; tsc sin errores; export iOS OK (720 módulos); ESLint sin hallazgos en `App.tsx` y `src/`.
- [~] 2. Publicar la web con Netlify CLI (sitio `e3f0fada-f75d-407d-9bb2-88accb14f8af`) y verificar en el sitio que la versión nueva está. Publicado (deploy de producción live). Verificado en `https://psi-estudio.netlify.app`: `version.json` = 2.36.0, `index.html` carga `app.jsx?v=2.36.0`, la función responde 405 a GET y la CSP sigue puesta. Falta la revisión visual en el teléfono.
- [!] 3. Revisar en 390 px: menú, grabadora, historial, ajustes y modal de novedades. Bloqueado: no hay ningún navegador conectado a la herramienta de Chrome en esta sesión. Lo destraba: conectar la extensión de Chrome, o que Facundo lo pruebe con el checklist de `docs/06` sección 0.
- [x] (2026-10-06) 4. Commit y push a `main`. Commit `3ee98fa`, subido a `origin/main`.
