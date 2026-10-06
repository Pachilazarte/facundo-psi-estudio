# Etapa 2: web en el teléfono

**Objetivo:** que la web se use cómodo con el dedo en 390 px.

**Pasos**
- [x] (2026-10-06) 1. Menú inferior con espacio a la derecha para el cartel de Netlify (el cartel no se puede quitar). Verificación: en 390 px las seis pestañas se leen completas (medido con Chrome local). La barra reserva 64 px abajo (`pb-[calc(4rem+…)]`).
- [x] (2026-10-06) 2. Textos menores de 11 px pasan a 11 px como mínimo; botones de la barra superior ≥ 40 px. Verificación: medición con script en el sitio publicado: 0 textos menores de 11 px. 42 líneas de JSX pasaron a `text-[11px]` y los dos botones de la cabecera a 44 px en teléfono. Los textos de los PDF no se tocaron.
- [x] (2026-10-06) 3. Emojis de etiquetas ("🎙️", "🎧", "📚") se quitan. Verificación: grep de emojis en JSX = 0.
- [x] (2026-10-06) 4. Grabadora: quitar el selector de preset acústico (no tiene efecto en la nube) y la pastilla "Modo Autónomo / Offline". Verificación: revisión visual. Quitados en la etapa 1 (selector y pastilla de estado). Se agregó el aviso para celular de la auditoría (F2): la grabación de la web se corta con la pantalla bloqueada.

**Criterios de aceptación**
- [x] (2026-10-06) En 390 px no hay elementos fuera de pantalla ni tapados por el cartel. Sin scroll horizontal; el cartel no tapa la barra ni los modales (medido con Chrome local).
- [x] (2026-10-06) Ningún emoji en la interfaz.
