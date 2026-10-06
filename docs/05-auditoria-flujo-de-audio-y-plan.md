# Auditoría del flujo de audio (subir y grabar) y plan de mejora

**Fecha:** 2026-10-06
**Alcance:** cómo se procesa un audio desde que entra (subido a mano o grabado) hasta que queda en PsiEstudio, en la web publicada (`app.jsx`, `netlify/functions/transcribir.js`).
**Pedido de origen:** "si subo un audio estoy obligado a esperar a que lo mande a Groq y desgrabe. Tendría que subirlo y ya: el sistema desgraba y carga de manera oculta."

---

## 1. Lo que encontré

### 1.1 Subir un audio bloquea la pantalla (corregido en este commit)
- **Dónde:** `app.jsx`, input de "Cargar archivo de audio" → `processAudioWithBackend` (antes de este cambio).
- **Qué pasaba:** el archivo entraba en modo "procesando": aparecía un panel con barra de progreso y botón Cancelar. Mientras tanto, esperabas sentado.
- **Corregido:** el archivo se guarda en IndexedDB (tabla `cargasAudio`) y se desgraba en segundo plano. Aparece una lista "Cargas en segundo plano" con el estado de cada una. La app sigue usable.

### 1.2 Si se corta, se pierde todo (corregido en este commit)
- **Qué pasaba:** la desgrabación se hacía en memoria y se guardaba solo al final. Si se cerraba la página, se caía la red, o fallaba una sola parte, se perdía la clase completa.
- **Corregido:** cada parte transcripta se guarda en la carga al instante. Al volver a abrir, la carga retoma desde la última parte guardada. Los fallos se reintentan 3 veces (5 s, 10 s, 15 s) y después quedan en "Error" con botón Reintentar, que conserva lo ya transcripto.

### 1.3 El audio original no se guardaba (corregido en este commit)
- **Qué pasaba:** se usaba un `blob:` temporal. Al recargar, el audio desaparecía y no había cómo rehacer la desgrabación.
- **Corregido:** el archivo queda guardado en IndexedDB hasta que la desgrabación esté completa. Nunca se borra.

### 1.4 Cada parte se pide en serie y el archivo entero se decodifica en memoria (pendiente)
- **Qué pasa:** `decodeAudioData` decodifica el audio completo. Una clase de 2 horas ocupa unos 230 MB de muestras (16 kHz, float32). En un iPhone puede romper la pestaña.
- **Plan:** decodificar por ventanas (`OfflineAudioContext` o leer por rangos del archivo) y no tener la clase entera en memoria. Ver §3, punto P4.

### 1.5 La grabación en vivo sigue usando el panel bloqueante (pendiente)
- **Qué pasa:** al terminar una grabación, `procesarGrabacionSegmentada` vuelve a poner `isProcessing = true`, con el mismo panel de espera.
- **Plan:** pasar la grabación al mismo sistema de cargas (§3, punto P2). Hoy la grabación y la carga son dos caminos distintos.

### 1.6 El servidor local todavía se consulta (corregido en `fc91196`)
- **Qué pasaba:** la web preguntaba cada 30 s por `localhost:8000`, aunque estuviera publicada.
- **Corregido:** en el sitio publicado no se consulta nada; va directo a Groq.

### 1.7 La función de Netlify no tiene límite de uso (pendiente, decisión tuya)
- **Qué pasa:** `bde77d3` quitó la verificación de clave en la función de transcripción. Cualquiera que conozca la URL puede mandar audio y gastar tu cuota de Groq.
- **Por qué importa:** es el único punto donde el costo puede crecer sin que nadie lo note.
- **Plan:** P6.

### 1.8 Se decodifica el audio entero antes de saber si el formato es válido (menor)
- **Qué pasa:** un archivo que no es audio (por ejemplo un PDF renombrado) llega hasta `decodeAudioData` y falla con un error poco claro.
- **Plan:** validar el tipo y el tamaño antes de encolar (§3, P5).

### 1.9 Dos sistemas de estado para la misma clase (menor)
- **Qué pasa:** el Historial (`psi_audio_sessions_history` en localStorage) y las cargas (IndexedDB) guardan cosas parecidas. Son fuentes distintas de verdad.
- **Plan:** unificar en IndexedDB y dejar el Historial como vista (§3, P7).

---

## 2. Qué quedó hecho en este commit

| Problema | Antes | Ahora |
|---|---|---|
| Espera al subir | Panel bloqueante con cancelar | Lista en segundo plano, la app sigue usable |
| Corte a mitad | Se pierde todo | Retoma desde la última parte guardada |
| Falla de una parte | Se pierde la clase | Reintenta 3 veces, después queda en Error con Reintentar |
| Audio original | `blob:` temporal, se pierde al recargar | Guardado en IndexedDB, nunca se borra |
| Al terminar | Se abre el panel de la transcripción | Aviso "Desgrabación lista" y entra al Historial |

**No probado en el navegador ni en el teléfono.** Compila (`@babel/standalone`). La prueba es subir un audio de 5 minutos, navegar a otra pestaña, y ver que la lista avanza y termina en Historial. Y, aparte, cerrar la pestaña en medio y reabrirla.

---

## 3. Plan de mejora (lo que sigue)

| ID | Qué | Por qué | Cómo | Listo cuando | Tamaño |
|---|---|---|---|---|---|
| P1 | Probar la carga en segundo plano | Está compilada pero no probada | Subir un audio de 5 min, cambiar de pestaña, cerrar y reabrir la página | La carga termina y aparece en Historial sin tocar nada | S |
| P2 | Pasar la grabación en vivo al mismo sistema de cargas | Hoy la grabación sigue bloqueando al terminar (§1.5) | `procesarGrabacionSegmentada` encola en `cargasAudio` en vez de `setIsProcessing` | Al terminar una grabación no aparece el panel de espera | M |
| P3 | Quitar el panel de espera para siempre | Ya no lo usa la carga; la grabación lo usará hasta P2 | Borrar el bloque `isProcessing` y `processAudioWithBackend` (rama del servidor local) | No queda código de panel bloqueante | S |
| P4 | Decodificar por ventanas | Una clase de 2 h no entra en memoria del iPhone (§1.4) | Leer el archivo por rangos y decodificar cada ventana de 150 s; o `OfflineAudioContext` por ventanas | Una clase de 2 h se procesa en un iPhone sin que la pestaña se caiga | L |
| P5 | Validar el archivo antes de encolar | Evitar errores confusos (§1.8) | Comprobar tipo MIME y extensión (`audio/*`, `.m4a`, `.mp3`, `.wav`, `.caf`, `.webm`, `.ogg`) y tamaño máximo (500 MB) | Un PDF renombrado se rechaza con un mensaje claro | S |
| P6 | Limitar el uso de la función de Netlify | Sin clave, cualquiera gasta tu cuota (§1.7) | Decisión tuya. Opciones: (a) volver a exigir la clave en la función (`PSI_API_TOKEN` ya está en Netlify); (b) límite de pedidos por IP con Netlify Blobs; (c) dejarlo así y aceptar el riesgo | Elegida la opción y, si es (a) o (b), probada | M |
| P7 | Unificar Historial y cargas | Dos fuentes de verdad (§1.9) | Historial como vista sobre IndexedDB; migrar `psi_audio_sessions_history` | El Historial sale de una sola fuente | M |
| P8 | Reanudar la grabación después de un corte | Lo mismo que hace la app móvil (`docs/04`, C4) | Guardar el tramo en curso en IndexedDB y recuperarlo al reabrir | Matar la pestaña a mitad de grabación deja el tramo recuperable | M |
| P9 | Mostrar el progreso también en el encabezado | Hoy solo se ve en la pestaña Grabadora | Un indicador pequeño arriba que aparezca mientras hay cargas activas | Desde cualquier pestaña se ve que algo se está desgrabando | S |
| P10 | Probar en iPhone (Safari o la app Expo) | Todo lo anterior se probó solo en compilación | Seguir el documento `03`, sección 7, y registrar los resultados | Registro de pruebas A a D en el documento | S |

---

## 4. Orden sugerido

1. **P1** (probar lo que ya está hecho) y **P5** (validar archivos): son rápidos y evitan rehacer trabajo.
2. **P2 y P3** (la grabación deja de bloquear): es lo que más se nota al usar la app.
3. **P6** (decidir sobre el uso de la función): es una decisión tuya antes de que el costo se vuelva un problema.
4. **P4** (archivos grandes): necesario para clases de 2 horas en iPhone.
5. **P7, P8, P9, P10**: pulido y consolidación.

---

## 5. Riesgos aceptados (sin cambios)

- La clave de la app y la función de Groq son públicas en el repo (decisión tuya del 5 de octubre).
- El audio se envía a Groq (terceros) para desgrabar.
- No hay consentimiento explícito de los docentes y estudiantes grabados (tu responsabilidad, fuera del código).
