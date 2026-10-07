# Etapa 6: verificación y publicación

**Objetivo:** comprobar todo junto y publicar, con el mismo criterio que la versión cliente.

**Pasos**
- [ ] 1. `npm audit --omit=dev` en `psi-estudio-app`: el aviso de `uuid` desaparece. Verificación: salida registrada.
- [ ] 2. Captura a 390 px del sitio publicado con el CDN bloqueado (ahora no debería pedir ninguno): 0 píxeles distintos fuera de la zona del cartel de Netlify respecto a la referencia.
- [ ] 3. Revisar la CSP en vivo y la consola del navegador: sin errores.
- [ ] 4. Probar subida de audio y PDF, y el límite de tamaño (etapa 1, paso 3 y 4).
- [ ] 5. Desgrabar una clase de punta a punta (una prueba con audio corto).
- [ ] 6. Subir la versión (`VERSION_APP` en `app.jsx`, `version.json`, `sw.js` `CACHE_NAME`, `index.html` `?v=`) y publicar con la CLI de Netlify desde la carpeta limpia. Verificación: `version.json` en vivo muestra la versión nueva.
- [ ] 7. Commit y push a `main`.

**Criterios de aceptación**
- [ ] Todos los pasos anteriores con su resultado registrado en `resultados.md`.
- [ ] La versión en vivo es la nueva.

**Bloqueos conocidos:** la prueba en el teléfono físico sigue en manos de Facundo (checklist de `docs/06` sección 0).
