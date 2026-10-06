# Auditoría total: versión del teléfono (web en 390 px + app nativa)

**Fecha:** 2026-10-06
**Alcance:** todo lo que se usa desde el celular: la web publicada en Safari o Chrome del teléfono, la app nativa (Expo) y el backend que las sostiene (Supabase + función de Netlify).
**Método:** medición real en un viewport de 390 × 844 (sitio publicado), lectura del código de la app nativa, consultas a la base (RLS, políticas, buckets), y el checklist de `anti-ia` y el método de `peluche`.
**Capturas de referencia (locales, no se suben):** `.playwright-mcp/auditoria-tel-inicio.png`, `auditoria-tel-grabadora2.png`.

---

## 0. Prueba del dueño (agendada)

Facundo va a probar la app en su iPhone. Esta sección es el guion. Se corre cuando haya tiempo, con la pantalla encendida.

| # | Prueba | Cómo | Resultado esperado | Resultado real |
|---|---|---|---|---|
| A | Abrir la app | `cd psi-estudio-app`, `npx expo start`, escanear el QR con la cámara | Abre Expo Go con PsiEstudio | |
| B | Web dentro de la app | Pestaña PsiEstudio | Carga materias y apuntes | |
| C | Grabar 3 min | Pestaña Grabar → Empezar clase → esperar 3 min → Terminar | Se suben 2 fragmentos, sin error | |
| D | Pausar y reanudar | Durante la grabación: Pausar, esperar 20 s, Reanudar | El reloj sigue y no hay error | |
| E | Bloqueo de pantalla | Empezar, bloquear el iPhone 5 min, desbloquear, Terminar | Si se corta, anotar desde qué minuto | |
| F | Desgrabación | Esperar a que la clase pase a "Lista" (o tocar Reintentar) | Aparece en Historial, no en Apuntes | |
| G | Escuchar | Historial → Escuchar → Reproducir | Suena la parte 1 y pasa a la 2 | |
| H | Copiar y descargar | Historial → Copiar; luego Descargar (.txt) | El texto queda en el portapapeles y el archivo se puede compartir | |
| I | Sin señal | Activar modo avión, grabar 1 min, desactivar | Al volver la señal, el fragmento se sube solo | |

Si falla algo, anotar el mensaje exacto que aparece. Con eso se corrige.

---

## 1. Hallazgos funcionales (lo que hace mal en el teléfono)

### F1. El selector de "Preset acústico" no hace nada en la nube (alta)
- **Dónde:** Grabadora de la web, en el teléfono y en la computadora.
- **Qué pasa:** el preset (Balanceado, Aula con Eco, Docente Lejano, Ventilador) se aplicaba en el servidor de la PC. Desde que la transcripción es en la nube (Groq), ese servidor no participa. El selector sigue visible y dice "elimina ruidos con DSP EBU R128", que es mentira en este camino.
- **Riesgo:** el usuario elige un preset creyendo que mejora el audio.
- **Arreglo:** quitar el selector o marcarlo como "solo con servidor local" y ocultarlo si el servidor no está.

### F2. Dos grabadoras con reglas distintas (alta)
- **Qué pasa:** la web tiene su propia grabadora (en el navegador del teléfono se corta al bloquear la pantalla). La app nativa tiene la suya. Las dos suben a la misma base, pero el usuario no sabe cuál usar.
- **Arreglo:** en un teléfono, la web debe avisar "Para grabar con la pantalla bloqueada, usá la app" y dejar la grabadora de la web como opción secundaria. En la app nativa, esa pestaña es la principal.

### F3. El cartel "Powered by Netlify" tapa el menú inferior (alta)
- **Dónde:** web en 390 px. Se ve en la captura: tapa la mitad derecha del menú (Clases, Exámenes, Más).
- **Qué pasa:** Netlify lo inyecta sobre todo. No se puede quitar desde el código sin el plan de pago.
- **Arreglo:** dejar espacio a la derecha del menú inferior (padding de unos 140 px) o pasar el menú a la parte de arriba en teléfono. El badge no se toca.

### F4. Textos y botones demasiado chicos (media)
- **Medido:** 8 textos menores de 12 px. 3 botones de 32 a 40 px (el mínimo recomendado para tocar con el dedo es 44 px).
- **Dónde:** "Visor Interactivo" (además se ve gris claro, casi sin contraste), los botones redondos de la barra superior, y las etiquetas de estado de las cargas.
- **Arreglo:** mínimo 12 px para cualquier texto, 44 px para botones, y contraste de al menos 4,5:1 (WCAG AA).

### F5. Cargas en segundo plano sin estimación (media)
- **Qué pasa:** "Desgrabando 0/1" no dice cuánto falta ni si está trabada. Una carga que lleva 10 minutos sin avanzar se ve igual que una que avanza.
- **Arreglo:** mostrar el tiempo desde la última parte guardada, y pasar a "Revisar" si lleva más de 10 minutos sin avanzar.

### F6. Errores con diálogos nativos y poco claros (media)
- **Qué pasa:** `alert()` en la web y `Alert.alert` en la app. Son feos y bloquean la pantalla.
- **Arreglo:** toasts con acción ("Reintentar", "Ver motivo"), con el mensaje del error real.

### F7. El menú "Más" tapado y sin salida clara (media)
- **Qué pasa:** la hoja de módulos ocupa casi toda la pantalla y el último ítem ("Fichas de Repaso") queda debajo del cartel de Netlify. No se ve que se puede deslizar hacia abajo para cerrar.
- **Arreglo:** hoja con asa (barra de arrastre), margen inferior de 140 px y botón de cerrar visible.

### F8. La app nativa no tiene Materias, Apuntes ni Exámenes (decisión, baja urgencia)
- **Qué pasa:** la pestaña PsiEstudio es la web. Desde la app nativa solo se graba y se lee el Historial. Crear materias o apuntes obliga a usar la web.
- **Arreglo:** no hace falta copiar todo. Está bien que la app sea la grabadora y el Historial. Si después se quiere más, va como pestaña propia y no como copia de la web.

### F9. Sin conexión: la grabación sí, la desgrabación no (informativo)
- **Qué pasa:** la grabación se guarda en el teléfono y se sube cuando vuelve la señal (prueba I). La desgrabación requiere conexión. Eso es lo esperado.
- **Arreglo:** que la barra diga "Sin señal: se sube al volver" en lugar de un error.

### F10. Grabar con la pantalla bloqueada (límite conocido)
- **Qué pasa:** en la web, iOS corta el micrófono. En la app nativa con Expo Go, no está verificado (ver `docs/03`). La prueba E lo confirma o lo descarta.
- **Arreglo:** si E falla, el camino es un APK o una build de desarrollo (ver `docs/01`).

---

## 2. Backend (lo que sostiene el teléfono)

Consultas hechas hoy sobre la base:

| Control | Resultado |
|---|---|
| RLS activo en todas las tablas de `public` | ✅ las 8 tablas |
| Políticas de acceso | ✅ todas exigen `clave_valida()` (anon y authenticated), excepto la lectura de `supabase_keep_alive`, que es solo lectura y sin datos |
| Función `clave_valida` | ✅ `SECURITY DEFINER` (corre con permisos del dueño) |
| Buckets privados | ✅ `audios` y `pdfs` no son públicos |
| Políticas de Storage | ✅ exigen la clave |
| Límite de tamaño por archivo en los buckets | ⚠️ sin límite (`file_size_limit` vacío) |
| Tipos MIME permitidos | ⚠️ sin restricción (cualquier archivo entra al bucket) |

### B1. La clave de la app está en el código público (riesgo aceptado)
- Facundo lo decidió por escrito el 5 de octubre. Quien lea el repo puede leer y escribir la base.
- **Recomendado si cambia de idea:** rotar la clave, o pasar las consultas por una función del servidor con la clave guardada en Netlify.

### B2. La función de transcripción no exige clave (riesgo aceptado, con costo)
- Responde 400 a un pedido vacío, y sin clave tampoco rechaza. Cualquiera que conozca la URL puede mandar audio a Groq y gastar la cuota.
- **Arreglo:** volver a exigir `x-app-token` (la variable `PSI_API_TOKEN` ya está en Netlify), o un límite de pedidos por IP.

### B3. Buckets sin límite de tamaño ni de tipo (media)
- **Riesgo:** una subida enorme o un archivo que no es audio llena el bucket.
- **Arreglo:** `file_size_limit` de 500 MB para `audios` y 50 MB para `pdfs`, y `allowed_mime_types` de audio (`audio/*`) y `application/pdf`. Se configura con una migración.

### B4. Enlaces firmados de 1 hora (correcto)
- El reproductor pide un enlace temporal por parte. No hay archivos públicos.

---

## 3. Diseño: checklist anti-IA (`anti-ia`)

| Patrón | ¿Está? | Dónde |
|---|---|---|
| Gradiente en el borde de tarjetas en reposo | No | — |
| Sombra en tarjetas en reposo | **Sí** (12 elementos con sombra) | tarjetas de Materias y de la grabadora |
| Badges de color para cada dato | **Sí** | "EVAL-IJ", "PERS", "2° Cuatrimestre", "Cloud", "DSP + IA", "OCR IA" |
| Etiquetas en mayúscula pequeña (eyebrows) | **Sí, muchas** | "PRÓXIMO EXAMEN", "CAPTURA EN VIVO WEB AUDIO", "MATERIA", "PRESET ACÚSTICO", "EN ESPERA" |
| Emoji como ícono | **Sí** | "🎙️ Grabar Audio", "🎧 Visor Interactivo", "📚 Historial (4)", "🎙️" en el menú "Más" |
| Borde lateral grueso de color ("bordecito") | No (0 casos) | — |
| Texto con degradado | No | — |
| Opacidades sin sistema | No medido | — |
| Dark cards en grid masivo | No | — |

**Lectura:** la base visual es sobria (fondo crema, un solo color de acento, esmeralda). Lo que la delata como IA son los **emojis usados como íconos**, las **etiquetas en mayúscula** repetidas, y los **badges** que compiten entre sí.

### Fixes concretos (anti-IA)
1. Reemplazar cada emoji por un ícono de línea (Lucide, que ya está en el proyecto).
2. Dejar una sola etiqueta en mayúscula por pantalla. El resto en tamaño normal con peso semibold.
3. Un badge con color por tarjeta (el más importante). Los demás en gris neutro.
4. Sombra solo al tocar o pasar el dedo. En reposo, borde de 1 px.

---

## 4. Plan de rediseño con peluche (orden de ejecución)

### Paso 0: brief y Design Read
- **Material:** lo que dijo Facundo: herramienta personal para estudiar psicología, grabar clases, leer desgrabaciones y apuntes. Sin marca ni cliente externo.
- **Design Read:** "Herramienta de estudio personal, sobria y cálida: pensada para leer mucho texto y grabar con una mano, tirando hacia un lenguaje académico limpio, no hacia un SaaS genérico."
- **Tipo de página:** producto (app shell, formularios, listas, grabadora). Dirige `impeccable` en registro `product`. Los locks, bans y pre-flight de `design-taste-frontend` se usan como checklist.
- **Pendiente antes de ejecutar:** `impeccable` debe estar inicializado en el proyecto (`.impeccable/config.json` o `PRODUCT.md`). No verificado hoy.

### Paso 1: diagnóstico (hecho en este documento)
- Sección 1 (funcional), sección 2 (backend), sección 3 (anti-IA).
- Pendiente: correr `impeccable critique` y `impeccable audit` sobre la versión del teléfono para tener el diagnóstico de la skill.

### Paso 2: plan priorizado

| Prioridad | Qué | Fuente | Tamaño |
|---|---|---|---|
| 1 | Quitar o aclarar el preset acústico (F1) | funcional | S |
| 2 | Aviso "usá la app para grabar con pantalla bloqueada" en la web de teléfono (F2) | funcional | S |
| 3 | Espacio para el badge de Netlify en el menú inferior (F3) | funcional | S |
| 4 | Textos ≥ 12 px, botones ≥ 44 px, contraste AA (F4) | accesibilidad | M |
| 5 | Emojis reemplazados por íconos de línea (anti-IA) | diseño | S |
| 6 | Restricciones de tamaño y tipo en los buckets (B3) | backend | S |
| 7 | Volver a exigir la clave en la función de Groq (B2), si se decide | backend | S |
| 8 | Toasts con acción en vez de `alert` (F6) | funcional | M |
| 9 | Menú "Más" con asa y margen (F7) | funcional | S |
| 10 | Estimación y alerta de carga trabada (F5) | funcional | S |
| 11 | Sin conexión: mensaje claro (F9) | funcional | S |
| 12 | Un solo estilo entre la app (oscura) y la web (crema): elegir uno (ver 4.1) | diseño | M |

### 4.1 Decisión de diseño pendiente
- La app nativa es **oscura** y la web es **crema**. Al usar las dos seguidas, parecen productos distintos.
- **Opciones:** (a) la app también crema (más coherente con la web), (b) la web también oscura en el teléfono. Se decide antes de ejecutar el paso 3.

### Paso 3: ejecución
- Pasos 1 a 3 y 5 a 7 son cambios chicos y se hacen en una sola pasada.
- Pasos 4, 8 y 12 son de diseño y van con `impeccable typeset`, `layout` y `harden`.
- Las animaciones (si se agregan) se hacen con `animate` (criterio de `emil-design-eng`): ease-out, 150 a 250 ms, sin rebote.

### Paso 4: verificación
- Medir de nuevo con el mismo script de esta auditoría: 0 elementos fuera de pantalla, 0 botones menores de 44 px, 0 textos menores de 12 px, 0 emojis.
- Repetir la prueba del dueño (sección 0).

### Paso 5: reporte
- Antes y después con capturas en el mismo viewport.

---

## 5. Resumen de prioridades

**Urgente (afecta lo que usás todos los días):** F1 (preset que no hace nada), F2 (dos grabadoras sin aviso), F3 (badge tapando el menú).

**Importante:** F4 (tamaños y contraste), B2 (función sin clave), B3 (límites de buckets).

**Mejora:** todo lo demás, en el orden de la sección 4.

---

## 6. Qué no se pudo medir todavía

- La grabación real en el teléfono (prueba C, D, E). Solo se puede en el iPhone.
- Desgrabación de punta a punta desde el teléfono (prueba F). Depende de que la clase pendiente se procese.
- Rendimiento en el teléfono (batería, memoria con una clase de 2 horas).
- Diagnóstico de `impeccable` (no inicializado todavía).
