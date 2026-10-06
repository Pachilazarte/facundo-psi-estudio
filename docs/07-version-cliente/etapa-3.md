# Etapa 3: app nativa (Expo)

**Objetivo:** la app se ve igual que la web y se usa con una mano.

**Decisión de diseño (tomada en esta etapa):** fondo crema `#FBF8F3`, superficies blancas, texto `#1F2937`, acento verde `#059669`, bordes `#E7E1D8`. Se toma de la web para que las dos se vean como un mismo producto.

**Pasos**
- [x] (2026-10-06) 1. Crear `psi-estudio-app/src/tema.ts` con esos tokens. Verificación: `tsc --noEmit` (pasa).
- [x] (2026-10-06) 2. Reescribir estilos de `App.tsx`, `BarraEstado.tsx`, `PantallaGrabar.tsx`, `PantallaHistorial.tsx` con los tokens. Verificación: `tsc` y `expo export` (pasan). Se agregaron `PantallaSitio.tsx`, `componentes/Boton.tsx` y el helper de errores en `util.ts`.
- [x] (2026-10-06) 3. Íconos de `@expo/vector-icons` (Feather, instalado con `npx expo install`) en las pestañas y botones; botones con alto mínimo de 44 px (`TOQUE_MINIMO`). Las pestañas pasaron abajo, para usar con una mano.
- [x] (2026-10-06) 4. Textos amigables: sin "base", "sincronizar", "fragmento", "servidor" en lo visible (verificado con grep). Errores con frase clara (`avisoDe`); el detalle técnico solo va a la consola.

**Criterios de aceptación**
- [x] (2026-10-06) Ninguna pantalla usa colores fuera de `tema.ts` (grep de `#` y `rgba` en `src/` y `App.tsx` solo encuentra `tema.ts`).
- [x] (2026-10-06) Ningún mensaje de la app contiene términos técnicos (grep de textos visibles).

**Cierre (2026-10-06):** ESLint sin hallazgos en todo `App.tsx` y `src/`. Cuatro hallazgos de `react-hooks/set-state-in-effect` quedaron con supresión puntual y motivo (carga de datos al abrir, reproductor). Pendiente para la etapa 5: probar la app en un teléfono real (el plan de prueba del dueño, `docs/06` sección 0).
