# Etapa 4: dependencias del build (npm audit)

**Objetivo:** cerrar lo que se puede cerrar sin cambiar la versión de Expo. Los 24 avisos actuales están en herramientas de preparación y compilación, no en lo que corre en el teléfono.

**Entradas:** `psi-estudio-app/package.json`, salida de `npm audit --omit=dev --json`.

**Pasos**
- [ ] 1. Agregar en `psi-estudio-app/package.json` un bloque `overrides` que fije `uuid` a `^11.1.1` (el aviso dice que todo lo anterior a 11.1.1 es vulnerable; el árbol tiene 7.0.3, que entra por `expo-sharing` → `@expo/config-plugins` → `xcode`). Verificación: `npm ls uuid --omit=dev` muestra 11.x.
- [ ] 2. Reinstalar y comprobar que nada se rompe: `npx tsc --noEmit`, `npx eslint App.tsx src/`, y `npx expo export --platform ios --output-dir <temp>`. Verificación: los tres pasan.
- [ ] 3. Volver a correr `npm audit --omit=dev`. Verificación: desaparece el aviso de `uuid`; quedan los de `braces` y `node-forge` (decisión 1).
- [ ] 4. Registrar el resultado en `docs/08-seguridad/resultados.md`.

**Criterios de aceptación**
- [ ] `uuid` queda en 11.1.1 o más en el árbol de producción.
- [ ] `tsc`, `eslint` y el export iOS pasan.

**Verificación final:** pasos 2 y 3 hechos.

**Bloqueos conocidos:** `braces` y `node-forge` no tienen versión corregida publicada (el aviso cubre todas las versiones). Solo se van con la decisión 1: actualizar Expo a una versión mayor en una rama aparte. Sin esa decisión, quedan como riesgo aceptado: entran por el CLI de Expo, que corre en la PC al preparar la app.

**Rollback:** quitar el bloque `overrides` y volver a instalar.
