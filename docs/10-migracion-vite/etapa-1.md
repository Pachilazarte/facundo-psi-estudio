# Etapa 1: utilidades puras

**Objetivo:** sacar de `app.jsx` las ~28 funciones que no dependen de React (texto,
fechas, markdown, almacenamiento local, imágenes) y dejarlas en `web-vite/src/lib/`,
importables desde cualquier lado. Son las de menor riesgo de todo el sistema: no tienen
estado, no tienen JSX (salvo que se compruebe lo contrario al leerlas de nuevo).

**Entradas:** `_comun.md` completo. El inventario de esta etapa en
`tareas-migracion-vite.md` (sección "Etapa 1"). `app.jsx` líneas ~63–962 (confirmar
los límites exactos al leerlo, pueden haberse corrido un poco desde que se escribió
este plan).

**Archivos a crear (uno por grupo, no uno por función)**
- `web-vite/src/lib/texto.js` — `escapeHTML`, `sanitizeURL`, `generarUUID`, `formatTime`
- `web-vite/src/lib/markdown.js` — `parseMarkdownToHTML`, `parseInlineSegments`,
  `parseMarkdownTokens`, `stripInline`, `formatLatexReadable`, `parseInline`,
  `parseMarkdown`
- `web-vite/src/lib/almacenamiento.js` — `safeGetLocalStorage`,
  `stripLargeBinaryFields`, `safeSetLocalStorage`, `getDeletedRecords`,
  `addDeletedRecord`, `isRecordDeleted`, `clearDeletedRecords`
- `web-vite/src/lib/academico.js` — `extractAcademicTitle`, `generateAcademicPrompt`,
  `esApunteDesgrabacion`
- `web-vite/src/lib/imagenes.js` — `getStoredImageData`, `getRotatedBase64Sync`
- `web-vite/src/lib/supabase-headers.js` — `psiApiHeaders`
- `web-vite/src/lib/errores.js` — `mensajeAmigable`
- `web-vite/src/lib/pdf-rutas.js` — `rutaPdfDe`
- `web-vite/src/lib/haptics.js` — `triggerHaptic`

**Pasos (se repiten por cada archivo de la lista de arriba)**
- [ ] 1. Copiar las funciones de ese grupo tal cual están hoy en `app.jsx` al archivo
      nuevo, con `export function ...` (o `export const ...`) en cada una.
- [ ] 2. Grep de cada función copiada: listar todo identificador que usa y no está
      definido en ese mismo archivo (por ejemplo, si `parseMarkdownToHTML` usa
      `escapeHTML`, hace falta `import { escapeHTML } from './texto.js'`). Agregar los
      `import` que falten.
- [ ] 3. En `app.jsx` (todavía el de la raíz, sin tocar `web-vite/`, esto es solo para
      ir confirmando la extracción es correcta antes de la etapa 10): no se borra nada
      todavía — esta etapa 1 es de **copiado y organización**, `app.jsx` sigue intacto
      hasta la etapa 10. (Ver bloqueo conocido más abajo.)
- [ ] 4. Verificación: desde `web-vite/`, un archivo de prueba chico que importe cada
      función nueva y la llame con un dato de ejemplo, corrido con
      `node --experimental-vm-modules` o directamente revisado con `npm run dev` +
      la consola del navegador. Confirmar que da el mismo resultado que la función
      original (se puede comparar a mano con un par de casos conocidos, ej.
      `formatTime(125)` debe dar `"02:05"`).
- [ ] 5. Commit en `migracion-vite` con los archivos de ese grupo.

**Código de referencia:** las funciones ya probadas en producción en
`app.jsx` líneas ~63–962 (confirmar rango exacto al ejecutar). Copiar el comportamiento
tal cual, no "mejorarlo" de paso.

**Criterios de aceptación**
- [ ] Las 28 funciones del inventario están en `web-vite/src/lib/`, cada una
      exportada y sin ningún `import` faltante.
- [ ] Cada una da el mismo resultado que su versión original en `app.jsx` para los
      mismos datos de entrada.
- [ ] `app.jsx` (el de la raíz, el que usa producción) no se tocó en esta etapa.

**Verificación final:** `npm run build` en `web-vite/` sin errores con los nuevos
archivos ya importados desde el `main.jsx` de prueba.

**Bloqueos conocidos:** esta etapa deja las funciones **duplicadas** (siguen en
`app.jsx` y ahora también en `web-vite/src/lib/`). Es intencional: recién en la etapa
10, cuando `web-vite/` reemplaza al sistema actual, la copia de `app.jsx` deja de
usarse. Hasta entonces, un arreglo a una de estas funciones (si hiciera falta) debería
hacerse en los dos lados o anotarse como pendiente de repetir en `web-vite/`.
