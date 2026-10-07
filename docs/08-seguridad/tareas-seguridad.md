# Tablero: mejoras de seguridad (sin tocar login, tokens ni claves)

Fecha de inicio: 2026-10-06. Autorización: pendiente de confirmar por Facundo para arrancar la etapa 1.
Marcas: `[ ]` pendiente · `[~]` en curso · `[x]` hecho (fecha) · `[!]` bloqueado.

## Fuera de alcance (decidido por Facundo)
- El login, los tokens (`APP_TOKEN`, `PSI_API_TOKEN`, cabecera `x-app-token`) y la clave pública de Supabase no se cambian.
- Consecuencia: B1 (clave en el código) y B2 (la función no exige clave) quedan como riesgo aceptado. No se rota nada.

## Decisiones que necesito de Facundo antes de la etapa 4
1. **Actualizar Expo a una versión mayor** para quitar `braces` y `node-forge` del CLI. Es un cambio grande: se hace en una rama aparte y solo si Facundo lo aprueba.
2. **Precompilar `app.jsx`** (hoy lo compila el navegador con Babel, y para eso la CSP necesita `unsafe-eval`). Es un cambio de cómo carga la app: se hace solo si Facundo lo aprueba.

## Etapa 1: datos en la base (límites de los buckets)
- [ ] 1.1 Migración `0006_limites_buckets.sql`: tamaño máximo y tipos permitidos en `audios` y `pdfs`. Plan: `etapa-1.md`.

## Etapa 2: dependencias de terceros en la web
- [ ] 2.1 Copiar a `vendor/` las librerías que hoy salen de CDN, con versión fija. Plan: `etapa-2.md`.
- [ ] 2.2 Apuntar `index.html` y `sw.js` a los archivos propios.

## Etapa 3: política de seguridad (CSP) más estricta
- [ ] 3.1 Quitar de la CSP los dominios externos que ya no se usan. Plan: `etapa-3.md`.

## Etapa 4: dependencias del build (npm audit)
- [ ] 4.1 Forzar `uuid` a una versión corregida con `overrides`, sin cambiar Expo. Plan: `etapa-4.md`.
- [!] 4.2 `braces` y `node-forge`: requieren la decisión 1 de arriba.

## Etapa 5: higiene del repositorio
- [ ] 5.1 Buscar secretos en el historial de Git (que no haya claves de Groq ni tokens fuera de los aceptados). Plan: `etapa-5.md`.

## Etapa 6: verificación y publicación
- [ ] 6.1 Verificación completa y publicación. Plan: `etapa-6.md`.
