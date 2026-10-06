# Plan de trabajo: todo lo que quedó pendiente

**Fecha:** 2026-10-05
**Estado del repo al escribir esto:** `main` en `990b6a3` (app Expo incluida). Netlify publicado en `6215824` (atrasado).
**Cómo usar este documento:** cada tarea tiene qué, por qué, cómo, archivos, "listo cuando" y quién. Las letras ordenan por bloque; dentro de cada bloque, el orden es el de ejecución. Tamaño: S (menos de una hora), M (una tarde), L (más de un día).

---

## 0. Resumen de prioridades

| Prioridad | Tarea | Quién | Estado | Tamaño |
|---|---|---|---|---|
| 1 | A1. Publicar el deploy nuevo en Netlify | Facundo | **Pendiente acción Facundo** | S |
| 2 | A2. Probar la app en el iPhone (pruebas A a D) | Facundo | **Pendiente acción Facundo** | S |
| 3 | A3. Verificar que la desgrabación llegue a PsiEstudio | Claude + Facundo | Pendiente (tras A2) | S |
| 4 | D1. Cerrar el XSS del markdown y agregar CSP | Claude | ✅ **COMPLETADO** | M |
| 5 | C4. No perder el tramo en curso si la app se cierra | Claude | ✅ **COMPLETADO** | M |
| 6 | B1. Borrar la key vieja de Groq | Facundo | **Pendiente acción Facundo** | S |
| 7 | D2. Sincronización sin resurrección de datos | Claude | ✅ **COMPLETADO** | L |
| 8 | C2. Ver la desgrabación y el audio dentro de la app | Claude | ✅ **COMPLETADO** | M |
| 9 | C1. Lint y verificación estricta de React | Claude | ✅ **COMPLETADO** | S |
| 10 | C6. Espacio usado y exportar audio del teléfono | Claude | ✅ **COMPLETADO** | M |
| 11 | C7. Reintento y detalle por fragmento | Claude | ✅ **COMPLETADO** | S |
| 12 | C8. Ícono oficial en app nativa | Claude | ✅ **COMPLETADO** | S |
| 13 | D3. Cuota de almacenamiento defensiva y sin binarios | Claude | ✅ **COMPLETADO** | S |
| 14 | D4. Service Worker resiliente asset-por-asset | Claude | ✅ **COMPLETADO** | S |
| 15 | D5. Versión unificada v2.35.0 | Claude | ✅ **COMPLETADO** | S |
| 16 | D6. Limpieza de código muerto | Claude | ✅ **COMPLETADO** | S |
| 17 | D7. Zoom y accesibilidad WCAG 1.4.4 | Claude | ✅ **COMPLETADO** | S |
| 18 | G1. Migración 0003_sync.sql (soft deletes & triggers) | Claude | ✅ **COMPLETADO** | S |
| 19 | G2. IDs con UUID nativo | Claude | ✅ **COMPLETADO** | S |
| 20 | G3. Keep-alive idempotente con upsert | Claude | ✅ **COMPLETADO** | S |
| 21 | G6. Organización y README de migraciones | Claude | ✅ **COMPLETADO** | S |
| 22 | B3. Decidir qué pasa con PsiVoice | Facundo | Pendiente decisión | S |

---

## A. Urgente: sin esto la app no transcribe

### A1. Publicar el deploy nuevo en Netlify
- **Qué:** publicar `main` actual en psi-estudio.netlify.app. Las publicaciones automáticas están bloqueadas, así que no sale solo.
- **Por qué:** la función publicada (`6215824`) nombra todos los fragmentos como `.wav`. La app manda `.m4a` (`audio/mp4`). El commit `cac30f2` arregla eso. Hasta que no se publique, la app graba bien pero cada transcripción falla y queda reintentando.
- **Cómo:** Netlify → Deploys → **Trigger deploy → Deploy site**. Esperar a que diga Published.
- **Listo cuando:** `curl -X POST -H "Content-Type: audio/mp4" -H "X-App-Token: x" https://psi-estudio.netlify.app/.netlify/functions/transcribir` responde `401` con `{"error":"Clave inválida o ausente"}` (ya lo hace) **y** `app.jsx` del sitio contiene `const APP_TOKEN`. Claude lo verifica.
- **Quién:** Facundo publica, Claude verifica.

### A2. Probar la app en el iPhone
- **Qué:** correr la app por primera vez en un teléfono real.
- **Cómo:**
  1. Instalar Expo Go desde la App Store (iOS 16.4 o superior).
  2. En la PC: `cd psi-estudio-app`, `npm install`, `npx expo start`. PC y iPhone en la misma Wi-Fi (si no conecta: `npx expo start --tunnel`).
  3. Escanear el QR con la cámara del iPhone.
  4. Hacer las pruebas del documento `03`, sección 7: A (abre la web), B (3 minutos con pantalla encendida, pausar una vez, terminar), C (5 minutos con la pantalla bloqueada), D (la desgrabación aparece en la web).
- **Listo cuando:** hay un resultado anotado para A, B, C y D.
- **Si falla:** mandar el mensaje de error tal cual aparece (en el teléfono o en la terminal).
- **Quién:** Facundo.

### A3. Verificar que la desgrabación llegue a PsiEstudio
- **Qué:** comprobar que el apunte `desgrab_<sesion>` se crea en Supabase y que la web lo muestra.
- **Cómo:** después de la prueba B, Claude consulta por API `apuntes?id=like.desgrab_*` y revisa el contenido (encabezado, estado y líneas con `[HH:MM:SS]`).
- **Listo cuando:** el apunte existe, tiene el texto de la prueba y la web lo lista en la materia correcta.
- **Quién:** Claude (consulta), Facundo (mira la web).

---

## B. Tareas de Facundo en servicios y decisiones

### B1. Borrar la key vieja de Groq
- **Por qué:** sigue en el historial público de GitHub (commits `01d9e6d`, `f6c876f`, `58cd417`). Mientras exista en Groq, cualquiera puede gastar la cuota.
- **Cómo:** console.groq.com → API Keys → borrar la key vieja. La nueva ya está en Netlify.
- **Listo cuando:** la key vieja no figura en la consola.

### B2. Backup JSON de la web
- **Cómo:** psi-estudio.netlify.app → Ajustes → "Exportar Backup (JSON)". Guardar el archivo fuera del navegador (Drive).
- **Por qué:** es la única copia de los datos que no depende ni del navegador ni de Supabase.

### B3. Decidir qué pasa con PsiVoice (`psivoice-mobile/`)
- **Opciones:** (a) borrarla del repo si la app nueva funciona; (b) mantenerla solo para el servidor de la PC.
- **Por qué:** son dos apps que hacen lo mismo. Mantener las dos duplica trabajo (bloque F).
- **Listo cuando:** la decisión está escrita acá y, si es (a), la carpeta se borra con un commit.

### B4. Decidir la ruta de iPhone según la prueba C
- **Si C funciona:** nada más que hacer.
- **Si C falla:** grabar con la pantalla encendida (Ajustes del iPhone → Pantalla y brillo → Bloqueo automático → Nunca). La app ya mantiene la pantalla encendida mientras graba. Las otras rutas (Mac prestada o cuenta paga de Apple) están en el documento `01`.

### B5. Android (opcional)
- **Qué:** APK de prueba con EAS (plan gratuito, no vence).
- **Cómo:** `npm install -g eas-cli`, `cd psi-estudio-app`, `eas login`, `eas build:configure`, `eas build -p android --profile preview`. Instalar el APK desde el enlace.
- **Por qué:** en Android la grabación en segundo plano está documentada por Expo (servicio en primer plano). Es la forma gratis de tener la app sin límite de 7 días.

### B6. Credenciales pegadas en el chat (riesgo aceptado)
- Contraseña de la base, secret key y service key de Supabase, y la key vieja de Groq quedaron en la conversación. Facundo decidió no rotarlas. Queda registrado. Si cambia de idea: Supabase → Project Settings → Database → Reset password, y API Keys → rotar.

---

## C. App nueva (`psi-estudio-app/`)

### C1. Correr el lint
- **Qué:** `npx expo lint` (el proyecto lo pide en `AGENTS.md`). Solo se corrió `tsc`.
- **Listo cuando:** sin errores (los avisos de estilo se evalúan uno por uno).
- **Tamaño:** S.

### C2. Ver la desgrabación y escuchar el audio dentro de la app
- **Qué:** en la pestaña "Grabar clase", tocar una clase y ver el texto transcripto con sus marcas de tiempo, y reproducir los fragmentos en orden.
- **Por qué:** hoy el texto solo se ve en la web. Si no hay conexión, no se ve nada.
- **Cómo:** pantalla `DetalleSesion` con `useAudioPlayer` de `expo-audio` (lista de fragmentos, "siguiente" automático) y el contenido armado por `armarContenido`. Exportar el texto con `expo-sharing` (compartir a Notas, Drive, etc.).
- **Archivos:** `src/pantallas/DetalleSesion.tsx` (nuevo), `src/transcripcion.ts` (exponer `armarContenido`).
- **Listo cuando:** una clase terminada se puede leer y escuchar sin conexión.
- **Tamaño:** M.

### C3. No perder décimas de segundo entre fragmentos
- **Qué:** al cortar cada 150 s, el grabador para y arranca de nuevo; se pierden unas décimas de audio.
- **Cómo:** dos grabadores alternados: el segundo arranca un segundo antes de que el primero pare, y los fragmentos se solapan; al transcribir se descarta el texto repetido en el borde. Alternativa más simple: aceptar la pérdida y documentarla.
- **Listo cuando:** una palabra dicha justo en el corte aparece completa en la desgrabación.
- **Tamaño:** M (requiere probar en teléfono).

### C4. No perder el tramo en curso si la app se cierra del todo
- **Qué:** hoy, si iOS mata la app en medio de un tramo, se pierde ese tramo (hasta 150 s). Los anteriores no.
- **Cómo:** guardar en el manifest el `uri` del archivo que el grabador está escribiendo (`tramoEnCurso`). Al reabrir, si existe y pesa más de 0 bytes, moverlo a la sesión como fragmento (el archivo AAC puede estar sin cerrar; probar si Groq lo acepta, y si no, intentar repararlo con `ffmpeg -c copy` en el servidor local o descartarlo con aviso).
- **Archivos:** `src/grabacion/GrabacionContext.tsx`, `src/almacen.ts`, `src/tipos.ts`.
- **Listo cuando:** matar la app desde el selector de apps a los 60 s de grabar y reabrirla deja un fragmento recuperado o un aviso claro.
- **Tamaño:** M.

### C5. Confirmar el peso real de un fragmento
- **Qué:** medir cuánto pesa un fragmento de 150 s grabado con `RecordingPresets.HIGH_QUALITY` en iPhone.
- **Por qué:** la función de Netlify rechaza más de 5,5 MB. El cálculo es ~2,4 MB, pero hay que medirlo.
- **Cómo:** después de la prueba B, mirar `bytes` en el manifest (o agregar el tamaño a la fila de la sesión).
- **Listo cuando:** el peso está anotado acá. Si pasa de 4 MB, bajar `SEGMENTO_SEGUNDOS` o usar `LOW_QUALITY`.
- **Tamaño:** S.

### C6. Mostrar espacio usado y permitir sacar el audio del teléfono
- **Qué:** una línea "Audio guardado: 1,2 GB en 14 clases" y un botón "Compartir audio" por clase (`expo-sharing`), para respaldarlo en Archivos o Drive.
- **Por qué:** el audio nunca se borra (decisión). Una hora de clase pesa ~58 MB; un cuatrimestre entero puede pasar los 3 GB. Sin esto, el teléfono se llena sin aviso.
- **Listo cuando:** el espacio se ve y una clase se puede exportar.
- **Tamaño:** M.

### C7. Detalle de errores por fragmento
- **Qué:** en la fila de cada clase, ver qué fragmento falló, cuántas veces y el último error, con "Reintentar este".
- **Hoy:** solo se muestra el primer error.
- **Tamaño:** S.

### C8. Ícono, splash y nombre
- **Qué:** reemplazar los íconos de la plantilla por los de PsiEstudio (`icon-512.png` de la web) y el splash oscuro.
- **Archivos:** `psi-estudio-app/assets/`, `app.json`.
- **Tamaño:** S.

### C9. Expo Router (convención del proyecto)
- **Qué:** `AGENTS.md` de la plantilla pide Expo Router. La app usa dos pestañas simples sin router porque son dos pantallas.
- **Decisión pendiente:** mantener las pestañas (más simple) o migrar a `expo-router` cuando haya más pantallas (C2). Si se migra, `GrabacionProvider` sigue en la raíz.
- **Tamaño:** M.

### C10. Build de desarrollo (si Expo Go no graba en segundo plano)
- **Qué:** `eas build --profile development` para que `app.json` (micrófono, `UIBackgroundModes: audio`, `enableBackgroundRecording`) se aplique de verdad.
- **Limitación:** en iPhone requiere Mac o cuenta paga (documento `01`). En Android es gratis (B5).
- **Tamaño:** M.

---

## D. Web (`app.jsx`, `index.html`, `sw.js`, `netlify.toml`)

### D1. XSS en el markdown y CSP
- **Qué:** `parseMarkdownToHTML` no escapa HTML y el resultado va a `dangerouslySetInnerHTML`. El `src` y el `alt` de las imágenes tampoco se escapan.
- **Por qué:** como la base es accesible para quien lea el repo (riesgo aceptado), cualquiera puede insertar un apunte con `<script>` o `<img onerror>` y ejecutar código en tu navegador. Es el pendiente de seguridad más importante.
- **Cómo:**
  1. Escapar `& < > " '` **antes** de aplicar las reglas de markdown.
  2. Pasar el HTML final por DOMPurify (cdnjs) con lista blanca de etiquetas y atributos; `mermaid.initialize({ securityLevel: 'strict' })`.
  3. Agregar en `netlify.toml` una `Content-Security-Policy` con los CDN que se usan, más `Strict-Transport-Security` y `Permissions-Policy`.
- **Listo cuando:** un apunte con `<img src=x onerror=alert(1)>` se ve como texto y no ejecuta nada; la consola no muestra bloqueos de CSP en el uso normal.
- **Tamaño:** M.

### D2. Sincronización sin resurrección de datos
- **Qué:** los borrados viven solo en el localStorage de cada dispositivo; `fetchAllData` nunca quita lo que el servidor ya no tiene; `saveToIndexedDB` solo agrega; `clearDeletedRecords` no se llama nunca; la cola offline se reescribe desde snapshots y pierde escrituras.
- **Cómo:**
  1. Columnas `updated_at` y `deleted_at` en todas las tablas (migración `0003`), con trigger que actualice `updated_at`.
  2. Borrado = `deleted_at = now()` (soft delete). El cliente filtra `deleted_at is null` y respeta los borrados remotos.
  3. El servidor es la fuente de verdad: al cargar, lo que no vuelve del servidor se quita de IndexedDB y del estado.
  4. Cola de salida transaccional en IndexedDB (Dexie): nunca reemplazarla con un array calculado antes de un `await`.
  5. Papelera de 30 días para materias (hoy el borrado es cascada dura con un solo `confirm`).
- **Listo cuando:** borrar en un dispositivo no reaparece desde otro, y un ítem encolado durante un sync no se pierde.
- **Tamaño:** L.

### D3. Cola y cuota de almacenamiento
- **Qué:** los apuntes encolan el `payload` con el PDF en base64 (`enqueueAction` escribe en localStorage fuera de `try` y revienta por cuota); `safeSetLocalStorage` traga los errores de cuota.
- **Cómo:** quitar binarios del payload antes de encolar; datos grandes solo en IndexedDB; mostrar un aviso cuando la cuota falla.
- **Tamaño:** S.

### D4. Service worker
- **Qué:** `cache.addAll` es todo o nada y el `catch` lo esconde; si un CDN falla, no se cachea nada.
- **Cómo:** cachear asset por asset y registrar cuáles fallaron.
- **Tamaño:** S.

### D5. Una sola versión
- **Qué:** `version.json` 2.27.0, `sw.js` 2.26.0 (y su log dice 2.19.0), `index.html?v=2.33.0`, API 2.0.0.
- **Cómo:** un script de build que lea `version.json` y lo inyecte en `sw.js` e `index.html`.
- **Tamaño:** S.

### D6. Código muerto
- **Qué:** `app.js` (61 KB, no se carga), `transcribeWithCloudWhisper` (ya no se llama), estado y campos de Groq en Ajustes (`whisperApiKey`, `DEFAULT_GROQ_KEY`), `return html` duplicado en `parseMarkdownToHTML`.
- **Tamaño:** S.

### D7. Accesibilidad: zoom
- **Qué:** `maximum-scale=1.0` en `index.html` bloquea el zoom (WCAG 1.4.4).
- **Cómo:** quitar `maximum-scale`.
- **Tamaño:** S.

### D8. Dependencias y build
- **Qué:** `lucide@latest` y `dexie@latest` sin versión fija ni SRI; Babel transpila 500 KB en el navegador en cada carga; Tailwind desde el CDN de desarrollo.
- **Cómo:** build con Vite, versiones fijas, `integrity` en los scripts externos, `publish = "dist"` en `netlify.toml` (hoy publica la raíz completa del repo, incluida `psi-estudio-app/`, `psivoice-mobile/` y `docs/`).
- **Tamaño:** L.

### D9. Grabadora web: recuperar fragmentos después de un corte
- **Qué:** la grabadora de la web guarda fragmentos en IndexedDB (`audioSegments`) pero no hay botón para retomarlos si la página se recargó.
- **Nota:** si la app nueva reemplaza a la grabadora web, este punto se descarta y la grabadora web se puede quitar (D6).
- **Tamaño:** S.

### D10. Realtime que recarga todo
- **Qué:** cada evento de Supabase dispara un `fetchAllData` de las seis tablas completas (incluidas las desgrabaciones). Con la app grabando, eso pasa cada 150 s.
- **Cómo:** aplicar el `payload` del evento (fila cambiada) en vez de recargar todo.
- **Tamaño:** M.

### D11. `alert` y `confirm` nativos
- **Qué:** errores y borrados usan diálogos del navegador.
- **Cómo:** toasts y modales propios (ya existe `showToast`).
- **Tamaño:** S.

### D12. Token en la URL del audio
- **Qué:** para el servidor local, el reproductor manda `?token=` porque `<audio>` no puede mandar headers; el token queda en los logs del servidor.
- **Cómo:** token de un solo uso y corta duración para el audio, o servir el audio por `fetch` + `blob:`.
- **Tamaño:** S. Solo importa si se sigue usando el servidor local.

---

## E. Backend local (`audio_pipeline/`), solo si se sigue usando

Si la app nueva con Groq reemplaza al servidor de la PC, este bloque se posterga o se descarta. Decidir en B3.

| ID | Qué | Cómo | Listo cuando | Tamaño |
|---|---|---|---|---|
| E1 | `cleaner.preset` es global y dos trabajos en paralelo se pisan | Pasar el preset como parámetro de `clean_audio_file` | Dos sesiones con presets distintos en paralelo salen cada una con el suyo | S |
| E2 | `/process` repetible y jobs solo en memoria | Estado `idle/queued/running` por sesión en el manifest; responder 409 si ya corre; persistir `ACTIVE_JOBS` | Reiniciar el servidor no deja jobs "en progreso" para siempre | M |
| E3 | Lock global durante el merge y `upload_chunk` async bloqueante | Lock por sesión; no sostenerlo durante ffmpeg; `def` o `run_in_threadpool` | `/api/health` responde durante un merge largo | M |
| E4 | Timeouts de ffmpeg que no se disparan; loudnorm sin timeout; estadísticas falsas si falla el pase 1 | Leer stderr en un hilo con watchdog; `timeout=` en todos los `subprocess.run`; fallar fuerte si no hay medición | Un ffmpeg colgado se mata al tiempo límite | M |
| E5 | El glosario del usuario nunca llega a Whisper (corte a 35 términos) | Términos del usuario primero y corte por tokens | Un término custom aparece en el prompt | S |
| E6 | Timestamps `00:00:00.1000` | Redondear el total en ms y después descomponer | `59.9996` da `00:00:59,999` o `00:01:00,000` | S |
| E7 | `repetition_penalty` y `no_repeat_ngram_size` borran repeticiones reales | Quitarlos; confiar en los umbrales de compresión y no-voz | "no, no, no" aparece tres veces | S |
| E8 | Checkpoint que no reanuda; timeout solo entre segmentos | `clip_timestamps` desde el último segmento; watchdog en proceso aparte | Matar el job a la mitad y reintentar no empieza de cero | M |
| E9 | Salidas buscadas con `glob()[0]` sin orden | Nombres fijos por sesión | Reprocesar devuelve la desgrabación nueva | S |
| E10 | Si falla el WAV se borra el m4a bueno | Borrar solo lo que este intento creó y no completó | El m4a queda | S |
| E11 | `transcriber.py` llama a `ffprobe` por nombre fijo | Usar el binario resuelto por `find_ffmpeg_binaries` | Funciona solo con imageio_ffmpeg | S |
| E12 | Rangos HTTP con `end` fuera de tamaño dan 416 | Recortar `end` al tamaño (RFC 7233) | Un reproductor que pide `bytes=0-99999999` recibe 206 | S |
| E13 | Subida sin límite de tamaño | Límite por `Content-Length` y por bytes escritos | Una subida de 2 GB se corta con 413 | S |
| E14 | Errores que devuelven `str(e)` | ID de error en el log, mensaje genérico al cliente | Ningún 500 muestra rutas internas | S |
| E15 | `datetime.utcnow()` deprecado | `datetime.now(timezone.utc)` | Sin avisos de deprecación | S |
| E16 | Sesión de un chunk no se transcodifica; "lossless" re-codifica varias veces | Intermedio sin pérdida; master una vez; Whisper lee del master | El WAV de Whisper no sale del m4a comprimido | M |
| E17 | Merge en Windows con miles de chunks | Ya hay lotes de 20; agregar test con 50 chunks sintéticos | Test en verde | S |

---

## F. PsiVoice (`psivoice-mobile/`), solo si se mantiene (ver B3)

| ID | Qué | Cómo | Tamaño |
|---|---|---|---|
| F1 | La rotación de 15 min funciona una sola vez (`estado` queda en `pausado`) | Poner `estado = 'grabando'` en `_startChunkRecording`; rearmar el watcher siempre | S |
| F2 | Un chunk que falla al copiarse se registra igual y la sync lo omite en silencio | No registrar sin `size > 0`; la sync falla o avisa cuántos faltan | S |
| F3 | Barra clavada en 96 % (`progress` vs `progress_pct`) | Contrato tipado compartido con el servidor | S |
| F4 | Re-sincronizar sube todos los chunks de nuevo | Flag `subido` por chunk en el manifest | S |
| F5 | Manifest con `copyAsync` no atómico y errores tragados | Mover archivo y propagar el error a la UI | S |
| F6 | PCM sin comprimir en iOS (~300 MB por hora) | Codificar AAC; avisar por espacio | S |
| F7 | Espera de 15 min mientras el job sigue en el servidor | Tope acorde a la duración; reanudar el polling al abrir | S |

---

## G. Base de datos (Supabase)

| ID | Qué | Cómo | Tamaño |
|---|---|---|---|
| G1 | Sin `updated_at` ni `deleted_at` (bloquea D2) | Migración `0003_sync.sql` con ambas columnas y trigger | S |
| G2 | IDs `Date.now()` en el cliente (colisionan) | `crypto.randomUUID()` en la web; la app ya usa fecha + aleatorio | S |
| G3 | `supabase_keep_alive` crece con cada apertura | Un solo registro que se actualiza (`upsert` de `id = 1`) | S |
| G4 | Nombre de materia duplicado en cada tabla y matcheado por nombre | Confiar solo en `materia_id`; dejar `materia` como caché de solo lectura | M |
| G5 | Los PDFs nunca suben (`url_pdf` sin usar) | Supabase Storage con bucket privado + la misma clave de app en una Edge Function, o aceptar que los PDF queden locales | L |
| G6 | `supabase_schema.sql` fuera de la carpeta de migraciones | Moverlo a `supabase/migrations/0001_esquema.sql` y dejar un README con el orden | S |
| G7 | Trigger de `updated_at` y verificación de la clave con `pg_stat_statements` desactivado | Confirmar que `clave_valida()` no aparece en logs de queries lentas | S |

---

## H. Calidad, pruebas y CI

| ID | Qué | Cómo | Tamaño |
|---|---|---|---|
| H1 | Hay 16 tests de Python (rutas y token). Faltan para sanitizers de la web, timestamps de Whisper, rotación de chunks y la cola de la app | Tests unitarios por módulo; para la app, `jest-expo` sobre `transcripcion.ts` con `fetch` simulado | M |
| H2 | El único workflow es el keep-alive | GitHub Actions: `tsc` de la app, tests de Python, chequeo de secretos (`gitleaks`), build de la web | M |
| H3 | Lint de la app (C1) y de la web | `npx expo lint`; ESLint básico para `app.jsx` | S |
| H4 | Documentación de despliegue | README en la raíz: qué corre dónde (Netlify, Supabase, servidor local, app), orden de migraciones, variables de Netlify | S |

---

## I. Privacidad, retención y espacio

| ID | Qué | Estado | Tamaño |
|---|---|---|---|
| I1 | El audio se manda a Groq (terceros) | Decidido por Facundo: Groq es el transcriptor. Falta un aviso visible la primera vez que se graba | S |
| I2 | El audio nunca se borra (decisión) | Hacer visible el espacio y permitir exportar (C6) | M |
| I3 | Consentimiento de docentes y compañeros grabados | Fuera del código: política propia de Facundo. Se deja anotado | — |
| I4 | Clave de la app en el código público | Riesgo aceptado por escrito. Si cambia de idea: campo en Ajustes (ya existió) o contraseña del sitio en Netlify (plan pago) | — |

---

## J. Orden de ejecución propuesto

**Semana 1 (destrabar la app):** A1 → A2 → A3 → C5 → C4 → B1 → B2 → B3.
**Semana 2 (seguridad de la web):** D1 → D3 → D7 → D6 → C1 → C7.
**Semana 3 (datos):** G1 → D2 → G2 → G3 → D10.
**Semana 4 (app completa):** C2 → C6 → C8 → C3.
**Después:** D4, D5, D8, D11, bloque E (si se mantiene el servidor), bloque F (si se mantiene PsiVoice), H, G4 a G7, I1.

Cada paso se cierra con su "listo cuando" antes de pasar al siguiente, como pide la metodología del proyecto (`.agents/skills/bob-el-auditor-y-constructor`).

---

## K. Registro de riesgos aceptados (no se tocan sin pedido explícito)

1. Clave de la app en `app.jsx` y en `psi-estudio-app/src/config.ts`: la base y la función de Groq son accesibles para quien lea el repo público.
2. Credenciales de Supabase y la key vieja de Groq pegadas en el chat, sin rotar.
3. El audio original no se borra nunca desde ninguna app.
4. Sitio público en Netlify, de uso personal, sin contraseña.
