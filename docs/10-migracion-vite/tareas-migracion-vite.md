# Tablero: migración de `app.jsx` a Vite + componentes separados

Fecha de inicio: sin arrancar. Esto es el plan; ninguna etapa empieza sin que Facundo
lo autorice explícitamente (ver `_comun.md`).

Marcas: `[ ]` pendiente · `[~]` en curso · `[x]` hecho (fecha, verificado) · `[!]` bloqueado.

Reglas comunes, riesgos y la regla de "copiar antes de borrar": ver `_comun.md`.

## Por qué (resumen de la auditoría del 2026-10-08)

- `app.jsx`: 10.757 líneas, 530 KB, un solo archivo.
- Se compila con Babel Standalone **en el navegador del usuario**, en cada visita.
- Las librerías (React, Supabase, pdf.js, jspdf, pdf-lib, dexie, katex, mermaid,
  dompurify) se cargan desde CDNs externos, sin empaquetar.
- No hay paso de build: lo que está en el repo es exactamente lo que llega al
  teléfono.
- Evidencia directa de esta sesión: Babel avisó que "desoptimizó el estilo" del
  archivo por superar los 500 KB — el compilador se rinde a generar código prolijo
  porque el archivo es demasiado grande.

Meta: mismo sistema, mismo comportamiento, compilado de fábrica (Vite) y separado en
archivos chicos por función. Nada se pierde, nada se rompe, se mejora el rendimiento.

## Mapa de etapas

| Etapa | Qué mueve | Tamaño aprox. | Riesgo |
|---|---|---|---|
| 0 | Vite instalado y conviviendo con el sistema actual, sin publicarse | — | bajo |
| 1 | Utilidades puras (texto, fechas, markdown, almacenamiento) | ~900 líneas | bajo |
| 2 | Constantes/config, semillas académicas, generador de PDF (`buildPDF`) | ~800 líneas | bajo-medio |
| 3 | `Icon` + modales chicos (Novedades, MoreMenu, NotaExpandible, Materia, Biblio, BatchImport) | ~700 líneas | medio |
| 4 | Modales utilitarios (Búsqueda, Pomodoro, Fichas) | ~340 líneas | bajo |
| 5 | Modales grandes de contenido (Examen, Clase, Apunte, Subir PDF, Visor PDF) | ~2.500 líneas | medio-alto |
| 6 | Grabadora y Desgrabador (`GrabadoraDesgrabadorView`) | ~2.185 líneas | alto |
| 7 | `App()`: hooks de datos y sincronización (Supabase/IndexedDB/cola) | parte de ~3.900 líneas | alto |
| 8 | `App()`: cabecera, barra de pestañas, barra inferior móvil | parte de ~3.900 líneas | medio |
| 9 | `App()`: una pantalla por pestaña (Aulas, Bibliografía, Clases, Apuntes, Exámenes, PDFs, Perfil, Ajustes) | parte de ~3.900 líneas | alto (probablemente se divide en 2-3 etapas al ejecutar) |
| 10 | Cambio de motor: apagar Babel/CDN, publicar lo que arma Vite | — | alto (es el "switch", el punto sin vuelta atrás) |
| 11 | Carga diferida: pdf.js/jspdf/mermaid/katex/dexie solo cuando hacen falta | — | bajo (ya con Vite) |
| 12 | Limpieza final: borrar lo que quedó sin usar, actualizar `docs/` | — | bajo |

Los tamaños de la etapa 9 en particular van a superar el bloque de 16-20 h de una sola
etapa (así trabaja Facundo, ver `metodo-etapas-tareas`): es esperable que al llegar ahí
se parta en 2 o 3 etapas más chicas, una por grupo de pestañas. Eso se decide al
empezarla, no ahora.

## Inventario completo (nada se migra sin pasar por acá)

### Etapa 1 — utilidades puras (`src/lib/`)
- [ ] `Icon` (línea ~63) → en realidad es componente visual, se migra en la etapa 3 junto a los modales (queda anotado acá para no perderlo de vista, ver etapa 3).
- [ ] `psiApiHeaders` (~131) → `src/lib/supabase-headers.js`
- [ ] `mensajeAmigable` (~143) → `src/lib/errores.js`
- [ ] `rutaPdfDe` (~192) → `src/lib/pdf-rutas.js`
- [ ] `triggerHaptic` (~216) → `src/lib/haptics.js`
- [ ] `extractAcademicTitle` (~228) → `src/lib/academico.js`
- [ ] `generateAcademicPrompt` (~237) → `src/lib/academico.js`
- [ ] `esApunteDesgrabacion` (~276) → `src/lib/academico.js`
- [ ] `escapeHTML` (~280) → `src/lib/texto.js`
- [ ] `sanitizeURL` (~290) → `src/lib/texto.js`
- [ ] `parseMarkdownToHTML` (~299) → `src/lib/markdown.js`
- [ ] `generarUUID` (~454) → `src/lib/texto.js`
- [ ] `formatTime` (~465) → `src/lib/texto.js`
- [ ] `safeGetLocalStorage` (~476) → `src/lib/almacenamiento.js`
- [ ] `stripLargeBinaryFields` (~493) → `src/lib/almacenamiento.js`
- [ ] `safeSetLocalStorage` (~510) → `src/lib/almacenamiento.js`
- [ ] `getDeletedRecords` (~524) → `src/lib/almacenamiento.js`
- [ ] `addDeletedRecord` (~528) → `src/lib/almacenamiento.js`
- [ ] `isRecordDeleted` (~537) → `src/lib/almacenamiento.js`
- [ ] `clearDeletedRecords` (~543) → `src/lib/almacenamiento.js`
- [ ] `parseInlineSegments` (~548) → `src/lib/markdown.js`
- [ ] `parseMarkdownTokens` (~568) → `src/lib/markdown.js`
- [ ] `stripInline` (~737) → `src/lib/markdown.js`
- [ ] `formatLatexReadable` (~745) → `src/lib/markdown.js`
- [ ] `parseInline` (~776) → `src/lib/markdown.js`
- [ ] `parseMarkdown` (~801) → `src/lib/markdown.js`
- [ ] `getStoredImageData` (~925) → `src/lib/imagenes.js`
- [ ] `getRotatedBase64Sync` (~935) → `src/lib/imagenes.js`

Plan detallado: `etapa-1.md`.

### Etapa 2 — constantes, semillas y generador de PDF
- [ ] `SUPABASE_CONFIG` (línea 10) → `src/config.js` (valor intacto, no se toca ni se rota)
- [ ] `APP_TOKEN` (línea 16) → `src/config.js` (valor intacto)
- [ ] `VERSION_APP` (línea 153) → `src/config.js`
- [ ] `NOVEDADES` (línea 154) → `src/novedades.js`
- [ ] `CLAVES_SIN_CACHE` (línea 187) → `src/config.js`
- [ ] `buildPDF` (~963) → `src/lib/pdf-generador.js` (función grande, ~460 líneas; confirmar límite exacto al ejecutar, termina antes de `ACADEMIC_MASTER_SEEDS`)
- [ ] `ACADEMIC_MASTER_SEEDS` (~1424) → `src/seeds.js`

### Etapa 3 — `Icon` y modales chicos
- [ ] `Icon` (~63) → `src/componentes/Icon.jsx`
- [ ] `ModalNovedades` (~5630) → `src/componentes/ModalNovedades.jsx`
- [ ] `NotaExpandible` (~5659) → `src/componentes/NotaExpandible.jsx`
- [ ] `ModalMoreMenu` (~5680, el menú radial) → `src/componentes/ModalMoreMenu.jsx`
- [ ] `ModalMateria` (~5873) → `src/componentes/ModalMateria.jsx`
- [ ] `ModalBiblio` (~6183) → `src/componentes/ModalBiblio.jsx`
- [ ] `ModalBiblioBatchImport` (~6261) → `src/componentes/ModalBiblioBatchImport.jsx`

### Etapa 4 — modales utilitarios
- [ ] `ModalSearch` (~8159) → `src/componentes/ModalSearch.jsx`
- [ ] `ModalPomodoro` (~8260) → `src/componentes/ModalPomodoro.jsx`
- [ ] `ModalFlashcards` (~8379) → `src/componentes/ModalFlashcards.jsx`

### Etapa 5 — modales grandes de contenido
- [ ] `ModalExamenWithLinking` (~6323) → `src/componentes/ModalExamenWithLinking.jsx`
- [ ] `ModalClase` (~6471) → `src/componentes/ModalClase.jsx`
- [ ] `ModalApunteSplitView` (~6984) → `src/componentes/ModalApunteSplitView.jsx`
- [ ] `ModalSubirDocumentoPDF` (~7563) → `src/componentes/ModalSubirDocumentoPDF.jsx`
- [ ] `VisorPDF` (~7904) → `src/componentes/VisorPDF.jsx`
- [ ] `ModalPDFViewer` (~8010) → `src/componentes/ModalPDFViewer.jsx`

### Etapa 6 — Grabadora y Desgrabador
- [ ] `GrabadoraDesgrabadorView` (~8503–10688, ~2.185 líneas) → se divide al ejecutar en al menos: grabación en vivo, cola de procesamiento/desgrabación, historial. Plan detallado recién antes de empezar esta etapa (es la pieza más compleja del sistema además de `App()`).

### Etapas 7 a 9 — `App()` (1727–5629, ~3.900 líneas)
El componente raíz. Se vacía en 3 etapas, en este orden (cada una deja `App()` más
chico y el sistema funcionando igual):
- [ ] Etapa 7: estado y efectos de datos/sincronización → hooks (`useDatosAcademicos`,
      `useSincronizacion`, `useSesion`, según lo que se vaya encontrando).
- [ ] Etapa 8: cabecera (buscador, pomodoro, tema), barra de pestañas de escritorio,
      barra inferior móvil → `src/componentes/BarraSuperior.jsx`,
      `src/componentes/BarraInferior.jsx`.
- [ ] Etapa 9: una pantalla por pestaña → `src/pantallas/Aulas.jsx`,
      `Bibliografia.jsx`, `Clases.jsx`, `Apuntes.jsx`, `Examenes.jsx`, `PDFs.jsx`,
      `Perfil.jsx`, `Ajustes.jsx`. Al llegar acá se escribe el detalle fino con los
      números de línea reales de ese momento (van a haber cambiado por las etapas
      anteriores).

### Etapa 10 — cambio de motor
- [ ] `index.html`: sacar los `<script>` de Babel Standalone y de todas las librerías
      por CDN; Vite los reemplaza por su propio bundle.
- [ ] `netlify.toml`: el build pasa a `npm run build` (Vite) y `publish` pasa de `.`
      a `dist`.
- [ ] Verificación completa (igual que el checklist de `docs/06`, sección 0) antes de
      fusionar a `main`.
- [ ] `ErrorBoundary` (~10689) se revisa en esta etapa (sigue siendo necesario con
      React, no depende de Babel).

### Etapa 11 — carga diferida
- [ ] pdf.js, jspdf + jspdf-autotable, pdf-lib, mermaid, katex, dexie: pasan a
      `import()` dinámico, cada uno recién cuando se abre la pantalla que lo necesita.

### Etapa 12 — limpieza
- [ ] Revisar funciones que quedaron sin ningún uso tras la separación (pasa seguido
      en refactors grandes) y confirmar con Facundo antes de borrarlas.
- [ ] Actualizar `docs/` con el mapa final de archivos.
