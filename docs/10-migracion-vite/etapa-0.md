# Etapa 0: Vite instalado, sin tocar lo que hoy se publica

**Objetivo:** tener Vite funcionando en una carpeta nueva, en una rama nueva, sin que
nada de esto afecte lo que Netlify publica desde `main` hoy.

**Entradas:** ninguna (es el punto de partida). Leer `_comun.md` completo antes de
empezar.

**Decisión de esta etapa:** el proyecto nuevo vive en `web-vite/`, con su propio
`index.html`, `vite.config.js`, `package.json` y `src/`. La raíz del repo (el
`index.html`, `app.jsx`, etc. de hoy) no se toca. Así, mientras dura toda la
migración, si Facundo pide un arreglo rápido en el sistema de siempre, se puede seguir
haciendo en `main` sin chocar con esta migración.

**Archivos a crear**
- `web-vite/package.json`
- `web-vite/vite.config.js`
- `web-vite/index.html`
- `web-vite/src/main.jsx`

**Pasos**
- [ ] 1. `git checkout -b migracion-vite` desde `main` actualizado. Verificación:
      `git branch --show-current` dice `migracion-vite`.
- [ ] 2. Crear `web-vite/package.json` con `vite`, `@vitejs/plugin-react`, `react` y
      `react-dom` como dependencias (versiones iguales a las que ya se usan en la app:
      React 18). Verificación: `npm install` dentro de `web-vite/` termina sin error.
- [ ] 3. Crear `web-vite/vite.config.js` con el plugin de React.
- [ ] 4. Crear `web-vite/index.html`: mismo `<head>` que el `index.html` real de hoy
      (manifest, íconos, meta tags, `theme-color`), pero con
      `<script type="module" src="/src/main.jsx"></script>` en vez de los `<script>`
      de Babel y las librerías por CDN.
- [ ] 5. Crear `web-vite/src/main.jsx`: monta un componente chico de prueba (un texto
      tipo "PsiEstudio — Vite andando"), solo para confirmar que el motor funciona.
      Todavía no es la app real.
- [ ] 6. Verificación: `npm run dev` (adentro de `web-vite/`) levanta un servidor y
      muestra el placeholder sin errores en la consola del navegador.
- [ ] 7. Verificación: `npm run build` genera `web-vite/dist/index.html` y sus
      archivos `.js`/`.css` sin errores.
- [ ] 8. Commit en la rama `migracion-vite` (no en `main`).

**Criterios de aceptación**
- [ ] `web-vite/` existe, compila y corre, sin que ningún archivo de la raíz del repo
      haya cambiado.
- [ ] `main` sigue exactamente igual que antes de esta etapa.

**Verificación final:** `git diff main migracion-vite --stat` solo muestra archivos
nuevos dentro de `web-vite/`, nada modificado fuera de esa carpeta.

**Bloqueos conocidos:** ninguno todavía. Si en el camino Facundo pide cambios urgentes
al sistema de siempre, esos cambios van a `main` (o a una rama corta desde `main`) y
después se traen a `migracion-vite` con un merge, no al revés.
