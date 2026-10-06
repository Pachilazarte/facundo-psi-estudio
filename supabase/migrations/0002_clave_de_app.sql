-- ==========================================
-- 0002 - Clave de la app (sin login)
-- ==========================================
-- Correr DESPUÉS de 0001 y 0001b, y SOLO después de que la web envíe la clave
-- (si no, la web se queda sin acceso).
--
-- Antes de correr: reemplazar REEMPLAZAR_POR_TU_CLAVE por el mismo valor de
-- PSI_API_TOKEN que está en audio_pipeline/.env (el que pegás en Ajustes).
--
-- Qué hace:
--   - Cualquiera con la key pública (anon) ya NO puede leer ni escribir,
--     salvo que el pedido traiga el header x-app-token con la clave correcta.
--   - La clave se guarda en una tabla privada que ningún rol de la API puede leer.
--   - supabase_keep_alive: el workflow de GitHub solo necesita leer (sin clave).

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Ningún rol de la API puede ver esta tabla
REVOKE ALL ON private.config FROM PUBLIC, anon, authenticated;

INSERT INTO private.config (key, value)
VALUES ('app_token', 'REEMPLAZAR_POR_TU_CLAVE')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Compara el header x-app-token del pedido con la clave guardada.
-- SECURITY DEFINER: corre con permisos del dueño, así anon puede usar la
-- comparación sin poder leer la tabla.
CREATE OR REPLACE FUNCTION public.clave_valida()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM private.config AS c
    WHERE c.key = 'app_token'
      AND c.value = (current_setting('request.headers', true)::json ->> 'x-app-token')
  )
$$;

-- Quitar las políticas abiertas de 0001
DROP POLICY IF EXISTS "anon_all_materias"   ON public.materias;
DROP POLICY IF EXISTS "anon_all_biblio"     ON public.bibliografia;
DROP POLICY IF EXISTS "anon_all_clases"     ON public.clases;
DROP POLICY IF EXISTS "anon_all_apuntes"    ON public.apuntes;
DROP POLICY IF EXISTS "anon_all_pdfs"       ON public.documentos_pdf;
DROP POLICY IF EXISTS "anon_all_examenes"   ON public.examenes;
DROP POLICY IF EXISTS "anon_all_keepalive"  ON public.supabase_keep_alive;

-- Tablas de trabajo: solo con la clave
CREATE POLICY "con_clave_materias" ON public.materias
  FOR ALL TO anon, authenticated USING (public.clave_valida()) WITH CHECK (public.clave_valida());
CREATE POLICY "con_clave_biblio" ON public.bibliografia
  FOR ALL TO anon, authenticated USING (public.clave_valida()) WITH CHECK (public.clave_valida());
CREATE POLICY "con_clave_clases" ON public.clases
  FOR ALL TO anon, authenticated USING (public.clave_valida()) WITH CHECK (public.clave_valida());
CREATE POLICY "con_clave_apuntes" ON public.apuntes
  FOR ALL TO anon, authenticated USING (public.clave_valida()) WITH CHECK (public.clave_valida());
CREATE POLICY "con_clave_pdfs" ON public.documentos_pdf
  FOR ALL TO anon, authenticated USING (public.clave_valida()) WITH CHECK (public.clave_valida());
CREATE POLICY "con_clave_examenes" ON public.examenes
  FOR ALL TO anon, authenticated USING (public.clave_valida()) WITH CHECK (public.clave_valida());

-- Keep-alive: con clave escribe la app; el workflow de GitHub solo lee
CREATE POLICY "con_clave_keepalive" ON public.supabase_keep_alive
  FOR ALL TO anon, authenticated USING (public.clave_valida()) WITH CHECK (public.clave_valida());
CREATE POLICY "anon_lee_keepalive" ON public.supabase_keep_alive
  FOR SELECT TO anon USING (true);

-- Verificación (con la key anon SIN el header, debe dar 0 filas o error):
--   curl .../rest/v1/materias?select=id  -> []
