# Etapa 1: límites de los buckets

**Objetivo:** que un archivo gigante o que no sea audio (o PDF) no llene el almacenamiento. Riesgo B3 de `docs/06`.

**Entradas:** `docs/06` sección 2, B3. `supabase/migrations/0004_cargas_en_la_base.sql` (bucket `audios`) y `0005_pdfs_en_la_base.sql` (bucket `pdfs`).

**Pasos**
- [ ] 1. Crear `supabase/migrations/0006_limites_buckets.sql` con `UPDATE storage.buckets SET file_size_limit = 524288000, allowed_mime_types = ARRAY['audio/*'] WHERE id = 'audios';` y `UPDATE storage.buckets SET file_size_limit = 52428800, allowed_mime_types = ARRAY['application/pdf'] WHERE id = 'pdfs';`. Verificación: `SELECT id, file_size_limit, allowed_mime_types FROM storage.buckets;` muestra los valores.
- [ ] 2. Confirmar qué tipos sube la app: `audio/mp4` (m4a), `audio/webm`, `audio/wav`, y el tipo original de cada archivo elegido (`audio/mpeg`, `audio/x-m4a`, `audio/aac`). Todos entran en `audio/*`. Verificación: `grep -n "contentType\|audio/" app.jsx psi-estudio-app/src/supabase.ts` y anotar cualquier tipo distinto.
- [ ] 3. Subida de prueba después de aplicar la migración: un m4a, un mp3 y un PDF chico deben entrar. Un `.txt` o un `.exe` renombrado debe rechazarse. Verificación: subir con el cliente de la app o con `curl` (sin tocar el token: se usa el que ya tiene la app).
- [ ] 4. Confirmar que una subida mayor al límite se rechaza. Verificación: subir un archivo de 60 MB a `pdfs` y ver el error.

**Criterios de aceptación**
- [ ] Los dos buckets muestran límite y tipos en `storage.buckets`.
- [ ] Un archivo que no es audio (o PDF) no se puede subir.
- [ ] La app sube sus audios y PDFs normales sin error.

**Verificación final:** pasos 3 y 4 hechos y registrados.

**Bloqueos conocidos:** ninguno. Si algún tipo real de audio no entra en `audio/*`, se agrega a la lista antes de cerrar la etapa.

**Rollback:** `UPDATE storage.buckets SET file_size_limit = NULL, allowed_mime_types = NULL WHERE id IN ('audios','pdfs');`
