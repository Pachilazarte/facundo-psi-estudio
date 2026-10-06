# Historial del día: 2026-10-05

Registro completo de lo que se hizo, se decidió y se descubrió durante la sesión de trabajo de hoy. Incluye errores, correcciones y pendientes. **No contiene claves ni contraseñas**: donde hubo un secreto se indica solo que existe y dónde se guarda.

---

## 1. Resumen en una página

- Se hizo una **auditoría completa** del sistema PsiEstudio / PsiVoice (backend de audio, web, app móvil, base de datos y despliegue).
- Se encontraron **cerca de 70 puntos**. Los más graves: claves expuestas en un repo público, base de datos abierta a cualquiera, servidor de desarrollo que exponía el repo y las grabaciones, path traversal en el backend, pérdida de audio en la grabadora web, y sincronización que resucitaba datos borrados.
- Se implementaron las correcciones de **seguridad y acceso** en orden: validación de rutas, token de acceso del backend, servidor web propio, base de datos cerrada con una clave, y función de transcripción en Netlify.
- Se **publicó** la versión nueva en `main` (GitHub) y el deploy de Netlify quedó en **Published** con el código nuevo verificado (`6215824`, luego `d729e31`).
- Se armó una **grabadora segmentada** en la web (fragmentos de 150 s guardados en el celular). **Todavía no se probó en un teléfono.**
- Se investigó cómo tener la app en iPhone de forma gratuita. Conclusión: **no hay ruta gratis verificada para iPhone con grabación en segundo plano**. Ver `01-investigacion-opciones-app.md`.
- El dueño decidió que la app es **de uso personal**, que **no quiere login**, y que la **clave de la app quede en el código del frontend**, aceptando que la base y la función de Groq queden accesibles para quien lea el repo.

---

## 2. Cronología

### 2.1 Auditoría inicial (fase 1 de la skill "Bob el Auditor")

- Se leyó la skill `bob-el-auditor-y-constructor` que está en `.agents/skills/` del proyecto. Su método: auditar un módulo por vez, y después construir punto por punto.
- Se revisaron primero: el esquema de la base (`supabase_schema.sql`), el backend (`audio_pipeline/server.py`), el service worker (`sw.js`), `index.html`, `netlify.toml`, y las zonas de riesgo de `app.jsx` (búsquedas dirigidas por credenciales, `innerHTML`, `fetch`, `localStorage`).
- Hallazgos de la **primera pasada**:
  - Key de Groq visible en el código (`app.jsx`), en un repo **público** de GitHub, en 3 commits del historial.
  - Key de Supabase pública en el frontend, con políticas de la base que dejaban pasar a cualquiera (`USING (true)` para `anon`).
  - Path traversal en el backend por `session_id` y nombres de archivo sin validar.
  - Backend sin autenticación, con CORS abierto y escuchando en `0.0.0.0`.
  - Markdown renderizado con `dangerouslySetInnerHTML` sin escapar HTML: riesgo de XSS almacenado.
  - Service worker con `addAll` atómico (un asset que falla deja todo sin caché).
  - Versiones desincronizadas entre `version.json`, `sw.js`, `index.html` y la API.
  - Código muerto: `app.js` no se carga en ningún lado.
- Se entregó un informe con 20 puntos de backend y frontend, y un orden de ataque.

### 2.2 Verificaciones que se hicieron con la primera pasada

- **Repo público:** `gh repo view` confirmó que `Pachilazarte/facundo-psi-estudio` es público.
- **Key de Groq en el historial:** `git log -S` encontró la key en 3 commits (`01d9e6d`, `f6c876f`, `58cd417`).
- **Path traversal (lógica):** se probó en una carpeta temporal que en Windows `..\..` escapa del directorio base. No se atacó el servidor real en ese momento.
- **Servidor `http.server`:** se probó en una carpeta temporal que sirve `.git/config` y los audios de sesiones con código 200. Eso confirmó que `iniciar_todo.bat` exponía el repo y las grabaciones en la red local.

### 2.3 Corrección a mi propio informe

- Se había dicho que las transcripciones nunca llegaban a la nube. **Es falso**: se guardan como `apuntes` (`app.jsx`, función `saveSessionToHistory`). Lo que sí es solo local es el vínculo con la clase (`handleLinkTranscriptToClass`).

### 2.4 Auditoría profunda (módulo por módulo)

- **DSP (`cleaner.py`)**: se revisó el pipeline de ffmpeg (pase 1 de loudnorm, pase 2, WAV para Whisper). Hallazgos:
  - El timeout de ffmpeg nunca se dispara si el proceso se cuelga sin cerrar `stderr`.
  - Los pases de loudnorm no tienen timeout.
  - Si falla la medición, se usan estadísticas falsas (-24 LUFS) sin avisar.
  - Si falla el WAV, se borra el m4a que sí salió bien.
- **Transcripción (`transcriber.py`)**: hallazgos verificados ejecutando código:
  - El **glosario personalizado nunca llega a Whisper**: el glosario base tiene 37 términos y el corte es a 35.
  - Los **timestamps pueden salir como `00:00:00.1000`** (1000 ms), que no es VTT/SRT válido.
  - `repetition_penalty` y `no_repeat_ngram_size` borran repeticiones reales del habla, lo que contradice la idea de "verbatim".
  - El "checkpoint de resiliencia" no sirve para reanudar: si falla, el job vuelve a empezar desde cero.
- **Merger de sesiones (`session_merger.py`)**: el lock global se mantiene durante todo el ffmpeg. La subida es `async` y bloquea el event loop. Una sesión de un solo chunk se copia sin transcodificar, con extensión `.m4a` sobre un archivo CAF. El "lossless" no es real: hay re-codificación en cada paso.
- **Frontend (`app.jsx`)**: hallazgos verificados leyendo las rutas de código:
  - Los **borrados no se propagan entre dispositivos**: los tombstones son locales, y `clearDeletedRecords` nunca se llama.
  - La **cola offline pierde escrituras** por race (se reescribe desde un snapshot).
  - Los **sanitizers mandan columnas que el esquema no tiene** (`clases`: 4 columnas; `documentos_pdf`: 3). Verificado con un script que cruza ambos archivos.
  - La **grabación web guarda el audio solo en memoria**. El "backup" de localStorage guarda solo metadatos.
  - `safeSetLocalStorage` traga errores de cuota: pérdida silenciosa de datos.
  - El `src` de las imágenes del markdown no se escapa.
- **App móvil (`psivoice-mobile`)**: hallazgos:
  - La **rotación de 15 minutos funciona una sola vez** (el estado queda en `pausado`).
  - Un chunk que falla al copiarse se registra igual en el manifest, y la sincronización lo omite en silencio.
  - La barra de progreso lee `job.progress`, pero el servidor devuelve `progress_pct`: queda clavada en 96 %.
  - **La grabación nunca arrancaba** con la versión instalada de expo-av: se usaba `Audio.InterruptionModeIOS`, que no existe ahí (corregido más adelante).

### 2.5 Plan de trabajo

- Se armó un plan de 6 fases y 27 pasos, ordenado por riesgo: contención, seguridad inmediata, integridad de datos, pipeline de audio, contratos y calidad, arquitectura, y UX.
- Se listaron las decisiones que hacían falta del dueño. Respuestas:
  - **Uso personal, un solo usuario.**
  - **El audio original nunca se borra.** Si una transcripción sale mal, el audio tiene que seguir ahí.
  - **La nube es opt-in.** El dueño dejó que yo decidiera cómo, y así quedó.
  - **Android se prueba** con un APK de EAS, no con Expo Go.

### 2.6 Paso 4 del plan: validación de rutas (rama `auditoria/fase1-rutas`)

- Módulo nuevo: `audio_pipeline/safe_paths.py`. Valida `session_id` (regex), limpia nombres de archivo (`sanitize_filename`) y verifica que la ruta final quede dentro del directorio base (`resolve_inside`).
- Se aplicó en 7 endpoints de `server.py` y en 3 lugares de `session_merger.py`.
- **Pruebas:** 9 unitarias, todas en verde.
- **Ataque real contra el servidor, en carpeta temporal:**
  - Original (`main`): `DELETE /api/sessions/..%5C...` respondió 200 y **borró la carpeta de prueba**. La subida con nombre `..\..\pwned.m4a` quedó fuera de la sesión.
  - Parchado: las mismas peticiones dan 400, la carpeta de prueba queda intacta, y el archivo se guarda dentro de la sesión.
- **Regresión:** crear, subir, borrar y `/health` siguen funcionando.

### 2.7 Decisión sobre login

- Se redactó una migración con login (`0002_solo_mi_cuenta.sql`). El dueño la rechazó: "no quiero login en mi app".
- Se reemplazó por la **clave de la app**: la base exige un header `x-app-token` con una clave guardada en una tabla privada (`private.config`). Esa migración quedó en `supabase/migrations/0002_clave_de_app.sql`.

### 2.8 Paso 5: token de acceso al backend

- `audio_pipeline/seguridad.py`: lee `audio_pipeline/.env` sin dependencias, valida `PSI_API_TOKEN` (mínimo 24 caracteres) y compara con `hmac.compare_digest`.
- `server.py`:
  - Middleware que pide el token en todos los `/api/*` salvo `/api/health` y los preflight.
  - El servidor no arranca si el token falta o es corto.
  - CORS solo para los orígenes de `ALLOWED_ORIGINS`, sin credenciales.
  - El audio acepta `?token=` porque el reproductor `<audio>` no puede mandar headers.
- **Pruebas:** 16 unitarias en total. Con el servidor real: sin token 401, con token 200, health 200 sin token, origen permitido recibe el header de CORS, origen ajeno no.
- `.env` creado por el dueño en `audio_pipeline/` (ignorado por git; `.gitignore` tiene `.env` y `.env.*` con excepción de `.env.example`).
- `.env.example` **se perdió** (probablemente lo renombró el dueño al crear el `.env`). Se recreó sin valores.

### 2.9 Servidor de la web propio (`audio_pipeline/servir_web.py`)

- Reemplaza `python -m http.server 3000` en `iniciar_todo.bat`.
- Sirve **solo** una lista blanca de archivos de la web. No sirve `.git` ni grabaciones.
- Escucha en `127.0.0.1`.
- Entrega el token en `/api-config.json`, **solo** si el pedido llega con Host `localhost` o `127.0.0.1` (evita DNS rebinding).
- **Pruebas:** index 200, config con token, Host ajeno 403, `.git/config` 404, `server.py` 404, `app.jsx` 200.

### 2.10 Cambios en la web (`app.jsx`) y en el celular

- Web: todos los pedidos al servidor llevan `X-PSI-Token`. El token llega solo desde `/api-config.json` en localhost.
- Celular (`psivoice-mobile`):
  - `SyncService.ts`: el token va en todas las llamadas y en `uploadAsync`.
  - `App.tsx`: campo de token en el modal de Ajustes, guardado con `expo-secure-store`.
  - `package.json`: se agregó `expo-secure-store@~14.0.1` (compatible con Expo SDK 52). Hubo un intento fallido con `npx expo install`, que quiso bajar Expo 57. Se corrigió con `npm install` fijado a la versión.
- **Corrección de compilación móvil:** `AudioRecorderService.ts` usaba `Audio.InterruptionModeIOS`, que no existe en expo-av 15 (el enum está en `Audio.types`). Se importa directo desde `expo-av`. `tsc --noEmit` pasa sin errores.
- `app.jsx`: se comprobó que compila con Babel standalone después de cada cambio.

### 2.11 La base de Supabase no tenía tablas

- La API respondía **404** para `materias`, y la lista de tablas expuestas estaba vacía. Eso significaba que **nada de lo que la app hacía en la nube había llegado a la base**. Los datos estaban solo en el navegador.
- Consecuencia adicional: el keep-alive de GitHub Actions pegaba a una tabla inexistente y fallaba todos los días. Antes se había dicho que funcionaba, sin verificarlo.
- Se creó el esquema con `supabase_schema.sql` (0001) y después `supabase/migrations/0001b_columnas_que_usa_la_app.sql` (columnas que la app envía y el esquema no tenía). Se ejecutó por conexión directa, con la contraseña de la base que el dueño pegó en el chat.
  - **Dato importante:** esa contraseña y otras credenciales del proyecto quedaron en el chat. Se recomendó rotarlas. El dueño decidió no hacerlo. **Queda registrado como riesgo aceptado.**
- Verificación: `materias` pasó de 404 a 200.
- Antes de crear las tablas se pidió al dueño un **backup JSON** desde Ajustes. Quedó como paso pendiente de su lado.

### 2.12 Migración 0002 (clave de la app) aplicada

- Se aplicó con la clave del `.env` (leída localmente, no mostrada). La prueba directa en la base:
  - anon sin clave: 0 filas.
  - anon con clave equivocada: 0 filas.
  - anon con clave correcta: 2 filas.
- Verificado también por la API REST: sin clave `[]`, con clave 2 materias.

### 2.13 Git: commits y ramas

| Commit | Qué contiene |
|---|---|
| `f64af2a` | Estado original de `main` (lo que estaba publicado en Netlify al empezar) |
| `396d69f` | Auditoría fase 1: rutas seguras, token, `servir_web.py`, móvil (expo-av), migraciones |
| `6215824` | Netlify: función de transcripción protegida, clave de la app en la base, web en modo nube |
| `d729e31` | Clave de la app en el frontend (decisión del dueño) |
| `cac30f2` | Función de transcripción acepta webm, m4a y wav |
| `e239a8f` | Grabadora segmentada (fragmentos de 150 s en IndexedDB) |

- Ramas: `auditoria/fase1-rutas` (trabajo de seguridad, fusionada en `main` con fast-forward), `app-unica` (grabadora y función, fusionada en `main`).
- Se hicieron push a `origin/main` en varias ocasiones.

### 2.14 Netlify

- El sitio `psi-estudio.netlify.app` estaba publicado desde `main@f64af2a`, la versión vieja con la key de Groq en el código y la base abierta.
- Se pidió bloquear las publicaciones automáticas (**Lock to stop auto pub**). El dueño lo hizo.
- Se publicó manualmente el deploy `main@6215824` (Trigger deploy → Deploy site). El deploy quedó **Published & locked**, con 1 función desplegada.
- **Verificado desde afuera:**
  - `app.jsx` del sitio contiene `x-app-token`.
  - La función `/.netlify/functions/transcribir` responde **401** sin clave y con clave incorrecta.
- **Incidentes de la publicación:**
  - Una respuesta 404 durante un momento de transición (un deploy en curso).
  - Una respuesta "missing form" de otra publicación anterior, que no era la función nueva.
  - Git Bash convirtió las rutas de las URLs: hubo que desactivar la conversión (`MSYS_NO_PATHCONV=1`).

### 2.15 Groq

- El dueño **creó una key nueva** en console.groq.com y la cargó en Netlify como variable `GROQ_API_KEY`. **La key nunca se mostró en el chat**, por decisión del dueño, y no está en ningún archivo del repo.
- La key vieja **sigue en el historial público de GitHub**. Se recomendó borrarla en Groq. Pendiente de confirmar.
- Se quitó la key por defecto del código (`DEFAULT_GROQ_KEY = ''`).
- La función `netlify/functions/transcribir.js`:
  - Exige el header `x-app-token` igual a `PSI_API_TOKEN` (variable de Netlify).
  - Compara en tiempo constante.
  - Rechaza cuerpos vacíos (400), de más de 5,5 MB (413), formatos que no son audio (415), y métodos que no son POST (405).
  - Acepta webm, m4a, mp3, ogg y wav según el content-type.
  - **Pruebas con Groq simulado:** sin clave 401, clave mala 401, clave correcta 200 y llamada a Groq, vacío 400, grande 413, GET 405. Formatos webm, m4a y wav aceptados; video/mp4 rechazado.
- **No se probó la transcripción real con Groq** para no gastar cuota.

### 2.16 Clave de la app en el frontend

- **Decisión del dueño, por escrito:** *"Acepto que la clave quede en el código del frontend y que la base quede accesible para quien la encuentre."*
- Se puso la clave en `app.jsx` como `APP_TOKEN` (leída del `.env` sin mostrarla). Se quitó el campo de Ajustes.
- **Consecuencias aceptadas:**
  - La base de Supabase es accesible para quien lea el repo.
  - La función de Groq también es accesible: alguien puede gastar la cuota de Groq. Se confirmó que **se deja así**.
- Commit `d729e31` y push a `main`.

### 2.17 Grabadora segmentada (commit `e239a8f`)

- Se reemplazó la grabadora de la web:
  - Fragmentos de **150 segundos**, cada uno como un archivo independiente.
  - Cada fragmento se guarda en **IndexedDB** (tabla `audioSegments`, versión 2 de la base local).
  - Al terminar, cada fragmento se manda a la función de Netlify, en orden, y se arma la transcripción con tiempos acumulados.
  - Pausa y reanudación cortan y reabren fragmentos.
  - Si una transcripción falla, los fragmentos quedan en el celular.
- Se quitó la transcripción en vivo del navegador (Web Speech): sus tiempos por palabra eran aproximados, y en Chrome manda el audio a Google.
- Pruebas: el JSX compila. **No se probó en un teléfono.**
- Límites que quedan:
  - No hay todavía un botón para recuperar fragmentos después de un corte.
  - Reproducir la clase entera puede fallar en algunos navegadores, porque los fragmentos se concatenan.

### 2.18 Decisión sobre la app para iPhone

- El dueño probó la web instalada en la pantalla de inicio. **Descartada:** Safari corta el micrófono cuando el teléfono se bloquea o cambia de app.
- El dueño pidió que todo funcione "desde la app", no desde la web, y que sea **gratis**.
- Se investigó (ver `01-investigacion-opciones-app.md`):
  - Compilar iOS en GitHub Actions **no es gratis** (la documentación oficial lo confirma; una búsqueda automática decía lo contrario).
  - La firma gratis de Apple dura 7 días y permite 3 apps.
  - Compilar para iPhone requiere un Mac o la cuenta paga (USD 99 por año).
  - Expo Go no confirma la grabación en segundo plano en iOS.
  - **Android** sí se puede hacer gratis con el plan Free de EAS (15 builds por mes, APK sin vencimiento).
- Pendiente de decisión del dueño: si tiene acceso a un Mac, o si paga la cuenta de Apple.

---

## 3. Errores y correcciones durante el día

Hay que dejarlos escritos porque cambiaron decisiones:

1. **Transcripciones y nube:** dije que no llegaban a la nube. Estaba mal; sí llegan como apuntes.
2. **Keep-alive:** dije que funcionaba. No funcionaba: la tabla no existía.
3. **Google y el micrófono de Chrome:** la transcripción en vivo mandaba audio a Google. Se quitó.
4. **Expo Go y segundo plano:** una búsqueda dijo que no funcionaba; la documentación no lo confirma. Queda como "sin verificar".
5. **GitHub Actions gratis para iOS:** una búsqueda dijo que sí; la documentación oficial dice que no (solo Linux es gratis en repos públicos). Se descartó.
6. **Instalación del paquete móvil:** un comando `npx expo install` quiso bajar Expo 57 porque el proyecto no tenía `node_modules`. Se corrigió con `npm install` fijado a `~14.0.1`.
7. **Pruebas del servidor:** la primera prueba del DELETE tenía el camino de la víctima mal calculado (un nivel más arriba). Se corrigió y se repitió.
8. **Limpieza de procesos:** un comando de limpieza ejecutó `taskkill` sobre **todos** los `python.exe`. No quedó ningún proceso de Python corriendo al verificar, pero si el dueño tenía un servidor abierto, pudo cerrarse. Queda registrado.
9. **`.env.example` desaparecido:** el archivo no estaba en el repo al hacer el commit. Se recreó sin valores.
10. **Rutas de Git Bash:** las URLs con `/` se convertían en rutas de Windows. Se desactivó la conversión.
11. **Netlify muestra "Page not found" durante un deploy en curso:** no es un error de la app; el sitio se estaba reemplazando.
12. **La web estaba expuesta por diseño:** `python -m http.server` servía `.git` y las grabaciones. Se reemplazó por `servir_web.py`.

---

## 4. Estado al cierre de la sesión

### Código y repo
- `main` en `e239a8f` (y los commits anteriores), subido a GitHub.
- Ramas `auditoria/fase1-rutas` y `app-unica` ya fusionadas en `main`.
- El `.env` del servidor está en `audio_pipeline/` y no se sube.

### Netlify
- Deploy `main@6215824` publicado (verificado). **El deploy de `main@e239a8f`** (grabadora segmentada) **falta publicarlo** con "Trigger deploy" o "Publish deploy". Las publicaciones automáticas siguen bloqueadas.

### Supabase
- Tablas creadas y con columnas completas.
- Migración 0002 (clave de la app) aplicada.
- Clave de la app en el código del frontend (decisión del dueño).

### Groq
- Key nueva cargada en Netlify (`GROQ_API_KEY`).
- Key vieja **pendiente de borrar** en console.groq.com.

### Celular
- PsiVoice: el token está en el campo de Ajustes del servidor (se guarda en SecureStore). Sigue dependiendo del servidor de la PC.
- La app **única** para iPhone no está decidida: falta elegir Mac o cuenta paga.

---

## 5. Pendientes

**Del dueño:**
1. Publicar el deploy nuevo de Netlify (`main@e239a8f`) y avisar.
2. Probar la grabadora web desde un teléfono (pantalla encendida, 3 minutos, pausar una vez, cortar).
3. Borrar la key vieja de Groq.
4. Hacer el backup JSON desde Ajustes → "Exportar Backup (JSON)".
5. Decidir cómo tener la app en iPhone: acceso a un Mac, o cuenta paga de USD 99 por año.
6. Confirmar si hay un Mac disponible.

**Míos (en orden):**
1. Verificar que el sitio publicado tenga `e239a8f` (cuando el dueño avise).
2. Botón para recuperar fragmentos que quedaron guardados después de un corte.
3. Si se elige Android: armar el APK con EAS, y que la grabadora de PsiVoice mande fragmentos a la función de Netlify en vez de al servidor de la PC.
4. Continuar con los pasos del plan que quedaron pendientes: rotación de chunks en el celular (M1), validación de chunks (M2), barra de progreso (M3), recortes de Whisper y timestamps (B5 y B6), y la lista de sanitizers ya corregida.
5. Quitar código muerto: `transcribeWithCloudWhisper` (ya no se llama), campos de Groq en Ajustes que quedaron sin uso.

---

## 6. Riesgos aceptados por el dueño

- **Base de Supabase accesible para quien lea el repo** (la clave está en `app.jsx`).
- **Función de Groq accesible para quien lea el repo** (usa la misma clave). Puede gastar la cuota de Groq.
- **Credenciales pegadas en el chat** (contraseña de la base, service key y secret key de Supabase, y la key vieja de Groq). El dueño decidió no rotarlas. Recomendación pendiente.
- **Sitio público en Netlify**, de uso personal.

---

## 7. Archivos creados o modificados hoy

**Backend (`audio_pipeline/`):**
- `server.py` (validación de rutas, middleware de token, CORS)
- `session_merger.py` (validación de sesión y de nombres)
- `safe_paths.py` (nuevo)
- `seguridad.py` (nuevo)
- `servir_web.py` (nuevo)
- `.env.example` (recreado, sin valores)
- `tests/test_safe_paths.py`, `tests/test_seguridad.py` (nuevos)

**Web (raíz):**
- `app.jsx` (token, cliente de Supabase con header, transcripción por Netlify, grabadora segmentada, Dexie v2)
- `iniciar_todo.bat` (arranca `servir_web.py`)
- `netlify.toml` (carpeta de funciones, Node 20)
- `.gitignore` (`.env`, `.env.*`, excepción para `.env.example`)

**Netlify:**
- `netlify/functions/transcribir.js` (nuevo)

**Supabase:**
- `supabase_schema.sql` (0001, ejecutado)
- `supabase/migrations/0001b_columnas_que_usa_la_app.sql` (ejecutado)
- `supabase/migrations/0002_clave_de_app.sql` (ejecutado)

**Móvil (`psivoice-mobile/`):**
- `App.tsx` (campo de token, SecureStore)
- `src/services/SyncService.ts` (header de token)
- `src/services/AudioRecorderService.ts` (import de enums de expo-av)
- `package.json` y `package-lock.json` (expo-secure-store)

**Documentación (`docs/`):**
- `01-investigacion-opciones-app.md`
- `02-historial-del-dia-2026-10-05.md` (este archivo)

---

## 8. Cómo se verificó lo que se dijo

- **Probado con código ejecutado:** rutas (unitarias y servidor real en carpeta temporal), token (unitarias y servidor real), función de Netlify (con Groq simulado), glosario y timestamps de Whisper (ejecución directa), `tsc --noEmit` en el móvil, compilación de `app.jsx` con Babel.
- **Probado contra servicios reales:** tablas de Supabase (API y conexión directa), migración 0002 (dos pruebas), sitio de Netlify (headers del código y respuestas 401 de la función), `.git` y audios en el servidor de la web (antes del cambio).
- **Leído en el código, no ejecutado:** la mayoría de los hallazgos de `app.jsx` (sincronización, cola, tombstones, grabadora).
- **No probado:** la grabación real en un teléfono; la transcripción real con Groq; la app móvil en un dispositivo; la rotación de chunks del celular.
