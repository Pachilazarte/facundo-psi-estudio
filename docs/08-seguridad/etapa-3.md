# Etapa 3: política de seguridad (CSP) más estricta

**Objetivo:** que el navegador bloquee cualquier cosa que la app no usa. Hoy la CSP de `netlify.toml` permite dominios externos y `unsafe-eval`.

**Entradas:** `netlify.toml` (cabecera `Content-Security-Policy`), resultado de la etapa 2.

**Pasos**
- [ ] 1. Quitar de `script-src`, `style-src`, `font-src` y `connect-src` los dominios de CDN que la etapa 2 reemplazó (cdn.jsdelivr.net, unpkg.com, cdnjs.cloudflare.com, cdn.tailwindcss.com). Verificación: `grep -c "cdn" netlify.toml` = 0.
- [ ] 2. Dejar `connect-src` solo con `'self'`, Supabase (`https://*.supabase.co`, `wss://*.supabase.co`) y Groq (`https://api.groq.com`, solo si la app lo llama directo; si no, quitarlo). Verificación: revisar `grep -n "fetch(\|https://api.groq" app.jsx` antes de quitar Groq.
- [ ] 3. Medir en el sitio publicado. Verificación: `curl -sI https://psi-estudio.netlify.app/ | grep -i content-security-policy` muestra la CSP nueva, y la consola del navegador (Chrome local) no tiene errores de CSP en la carga.
- [ ] 4. Probar desgrabar una clase de punta a punta. Verificación: la función responde y la app recibe texto.

**Criterios de aceptación**
- [ ] La CSP no lista ningún dominio de CDN.
- [ ] La app carga y desgraba sin errores de CSP.

**Verificación final:** pasos 3 y 4 hechos.

**Bloqueos conocidos:** `unsafe-eval` queda mientras Babel compile en el navegador. Quitarlo depende de la decisión 2 (precompilar `app.jsx`), que no está en este plan por default.

**Rollback:** restaurar la cabecera anterior de `netlify.toml` (en git).
