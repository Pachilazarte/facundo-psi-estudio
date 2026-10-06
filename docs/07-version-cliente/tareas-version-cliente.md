# Tablero: versión final para el cliente (teléfono)

Fecha de inicio: 2026-10-06. Autorización: Facundo pidió ejecutar el plan completo ("arregla todo").
Marcas: `[ ]` pendiente · `[~]` en curso · `[x]` hecho (fecha) · `[!]` bloqueado.

Estado al cierre de esta sesión: etapas 1 a 5 ejecutadas en código; la revisión visual en 390 px quedó bloqueada (ver etapa 5, paso 3).

## Etapa 1: lenguaje para el usuario (sin términos técnicos)
- [x] (2026-10-06) 1.1 Textos, mensajes y alertas de la web sin palabras técnicas. Plan: `etapa-1.md`.
- [x] (2026-10-06) 1.2 Quitar la sección técnica de Ajustes (base, claves, ping, caché) y dejar copia de seguridad y versión.

## Etapa 2: web en el teléfono
- [x] (2026-10-06) 2.1 Menú inferior sin tapar el cartel de Netlify; botones ≥ 44 px; textos ≥ 11 px. Medido en 390 px con Chrome local.
- [x] (2026-10-06) 2.2 Sin emojis como íconos; íconos de línea.
- [x] (2026-10-06) 2.3 Grabadora de la web: opciones claras, sin preset que no funciona.

## Etapa 3: app nativa (Expo)
- [x] (2026-10-06) 3.1 Mismo estilo que la web (fondo crema, acento verde).
- [x] (2026-10-06) 3.2 Íconos en las pestañas y botones de 44 px.
- [x] (2026-10-06) 3.3 Textos amigables, sin errores técnicos.

## Etapa 4: versión y novedades
- [x] (2026-10-06) 4.1 Web: sección Versión en Ajustes y modal de novedades al actualizar. Publicado (2.36.0) y comprobado en el sitio.
- [x] (2026-10-06) 4.2 App: sección Versión y modal de novedades al actualizar (compila; falta probarlo en el teléfono).

## Etapa 5: verificación y publicación
- [x] (2026-10-06) 5.1 Compilación de la web, chequeo de tipos y empaquetado de la app sin errores.
- [~] 5.2 Publicar la web en Netlify y verificar en el teléfono (tamaño 390 px). Publicado y verificado en el sitio a 390 px con Chrome local; falta la prueba en el teléfono físico (checklist `docs/06` sección 0).
- [x] (2026-10-06) 5.3 Subir a GitHub. Commit `3ee98fa` en `main`.
