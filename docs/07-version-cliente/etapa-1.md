# Etapa 1: lenguaje para el usuario

**Objetivo:** que nada visible diga "base de datos", "clave", "sincronización", "caché", "DSP", "Groq", "Supabase", "servidor", "offline", "JSON", "ping", "bucket", ni códigos de error.

**Entradas:** `app.jsx`: líneas de `showToast(...)`, `alert(...)` y JSX visible (inventario de hoy).

**Pasos**
- [x] (2026-10-06) 1. Reemplazar cada `showToast`/`alert` técnico por una frase de uso. Verificar: `grep` de palabras técnicas en toasts da 0.
- [~] 2. Reemplazar textos fijos de la grabadora (pastillas de estado, títulos de cargas, "Preset acústico", "Modo DSP", "Captura en vivo web audio", "JSON"). Verificar: revisión visual en 390 px.
- [x] (2026-10-06) 3. Ajustes: quitar la tarjeta de configuración de la base, el botón de prueba de conexión, "Subir todos los datos", "Limpiar caché", "Sincronizar cola". Dejar "Copia de seguridad" (exportar/importar con nombres simples) y la sección Versión. Verificar: la pantalla no muestra URLs ni claves.

**Criterios de aceptación**
- [x] (2026-10-06) Ningún toast ni alerta contiene palabras de la lista de arriba.
- [x] (2026-10-06) Ajustes muestra solo: Copia de seguridad, Versión y Acerca de.

**Verificación final:** `node` + `@babel/standalone` compila `app.jsx`; `grep` de términos prohibidos en JSX y toasts = 0.

**Cierre (2026-10-06):** compila con Babel (igual que antes del cambio). `grep` de toasts, alertas, mensajes de progreso y errores visibles = 0 términos técnicos. Queda afuera a propósito: la revisión visual en 390 px del paso 2, que se hace en la etapa 5.2 junto con la publicación. Se eliminaron `syncAllLocalDataToCloud`, `clearCache` y `triggerPing` porque solo los usaba la pantalla quitada.
