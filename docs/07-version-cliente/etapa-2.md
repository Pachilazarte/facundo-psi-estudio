# Etapa 2: web en el teléfono

**Objetivo:** que la web se use cómodo con el dedo en 390 px.

**Pasos**
- [~] 1. Menú inferior con espacio a la derecha para el cartel de Netlify (el cartel no se puede quitar). Verificación: en 390 px el último ítem es tocable. Hecho en código: la barra reserva 44 px abajo (`pb-[calc(2.75rem+…)]`); falta medir en 390 px (etapa 5.3).
- [~] 2. Textos menores de 11 px pasan a 11 px como mínimo; botones de la barra superior ≥ 40 px. Verificación: medición con script (0 elementos menores). Hecho en código: 42 líneas de JSX pasaron a `text-[11px]` y los dos botones de la cabecera a 44 px en teléfono; falta la medición (etapa 5.3). Los textos de los PDF no se tocaron.
- [x] (2026-10-06) 3. Emojis de etiquetas ("🎙️", "🎧", "📚") se quitan. Verificación: grep de emojis en JSX = 0.
- [x] (2026-10-06) 4. Grabadora: quitar el selector de preset acústico (no tiene efecto en la nube) y la pastilla "Modo Autónomo / Offline". Verificación: revisión visual. Quitados en la etapa 1 (selector y pastilla de estado). Se agregó el aviso para celular de la auditoría (F2): la grabación de la web se corta con la pantalla bloqueada.

**Criterios de aceptación**
- [ ] En 390 px no hay elementos fuera de pantalla ni tapados por el cartel. Pendiente: se mide en la etapa 5.3.
- [x] (2026-10-06) Ningún emoji en la interfaz.
