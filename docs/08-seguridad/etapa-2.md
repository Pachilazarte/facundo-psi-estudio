# Etapa 2: librerías de la web con versión fija, desde el propio sitio

**Objetivo:** que la web no dependa de dominios externos ni de versiones que cambian solas. Hoy hay dos casos: `lucide@latest` y `dexie@latest` (sin versión fija) y cerca de 15 scripts de CDN. Ya pasó con Tailwind (2.36.1): si un dominio se bloquea, la app falla.

**Entradas:** `index.html` (todas las etiquetas `<script>` y `<link>`), `sw.js` (lista `ASSETS_TO_CACHE`).

**Pasos**
- [ ] 1. Listar las versiones actuales de cada librería y fijarlas: react 18, react-dom 18, @babel/standalone, lucide, dexie, @supabase/supabase-js 2, pdf.js 3.11.174, jspdf 2.5.1, jspdf-autotable 3.8.2, pdf-lib 1.17.1, katex 0.16.8, mermaid 10, dompurify 3.1.6. Verificación: tabla con versión exacta y URL de origen en `docs/08-seguridad/versiones.md`.
- [ ] 2. Descargar cada archivo en `vendor/` con su nombre de versión. Verificación: `curl` de cada archivo da 200 y el tamaño coincide con el del CDN.
- [ ] 3. Cambiar en `index.html` las URLs a `vendor/...`. Verificación: `grep -n "https://" index.html` solo muestra Google Fonts y Netlify.
- [ ] 4. Cambiar en `sw.js` la lista `ASSETS_TO_CACHE` a las rutas nuevas, y subir `CACHE_NAME`. Verificación: `sw.js` no tiene URLs de CDN.
- [ ] 5. Comparar la página con el CDN bloqueado y con la copia propia. Verificación: misma técnica que en 2.36.1 (captura a 390 px, 0 píxeles distintos fuera de la zona del cartel de Netlify).

**Criterios de aceptación**
- [ ] Ninguna librería usa `latest`.
- [ ] La página carga sin pedir ningún script a dominios externos (excepto Google Fonts y Netlify).
- [ ] La captura a 390 px es igual a la de referencia.

**Verificación final:** pasos 2, 3 y 5 hechos y registrados.

**Bloqueos conocidos:** `mermaid` pesa unos 3 MB; se acepta, pero se anota el peso en `versiones.md`. Las fuentes de Google no se tocan en esta etapa.

**Rollback:** volver a `index.html` y `sw.js` de la versión anterior (están en git).
