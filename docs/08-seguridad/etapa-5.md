# Etapa 5: higiene del repositorio

**Objetivo:** confirmar que no hay secretos en Git fuera de los que ya se aceptaron (la clave de la app y el token de la función, que son parte del riesgo B1 y B2 y no se tocan).

**Entradas:** historial completo de `main`, `.gitignore`, `audio_pipeline/.env.example`.

**Pasos**
- [ ] 1. Buscar en todo el historial patrones de claves: `gsk_` (Groq), `sbp_` (Supabase management), `service_role`, `PRIVATE KEY`. Verificación: `git log -p --all | grep -E "gsk_|sbp_|service_role|PRIVATE KEY"` no devuelve nada que no esté aceptado.
- [ ] 2. Confirmar que `.env` y `.env.*` (excepto `.env.example`) no están en Git. Verificación: `git ls-files | grep -E "\.env"` solo muestra `.env.example`.
- [ ] 3. Confirmar que `servir_web.py` escucha solo en `127.0.0.1` y que `audio_pipeline` no se publica en Netlify. Verificación: `grep -n "127.0.0.1\|0.0.0.0" audio_pipeline/servir_web.py` y revisar que `netlify.toml` `publish = "."` no incluye `audio_pipeline/` en el deploy (el deploy usa una carpeta limpia).
- [ ] 4. Registrar hallazgos en `docs/08-seguridad/resultados.md`.

**Criterios de aceptación**
- [ ] No hay claves nuevas en el historial.
- [ ] El servidor local no está expuesto.

**Verificación final:** pasos 1 a 3 registrados.

**Bloqueos conocidos:** si aparece una clave nueva en el historial, se avisa a Facundo antes de tocar nada (rotar una clave es decisión suya).

**Rollback:** no aplica (solo lectura).
