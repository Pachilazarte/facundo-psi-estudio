-- ==========================================
-- 0002 - Acceso solo para tu cuenta
-- ==========================================
-- Requisitos ANTES de correr esto:
--   1. Crear tu usuario en Supabase (Authentication > Users > Add user).
--   2. Desactivar registros públicos (Authentication > Sign In / Providers >
--      desactivar "Allow new users to sign up").
--   3. Reemplazar TU_EMAIL abajo por el email de tu cuenta.
--
-- Qué hace:
--   - Quita el acceso de rol "anon" a todas las tablas (la key pública ya no alcanza).
--   - Solo una sesión iniciada con TU email puede leer o escribir.
--   - El keep-alive de GitHub Actions solo necesita leer una fila: se deja
--     SELECT para anon en supabase_keep_alive, sin escritura.

-- Función de comprobación, reutilizada por todas las políticas
CREATE OR REPLACE FUNCTION public.es_mi_cuenta()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT (auth.jwt() ->> 'email') = 'TU_EMAIL'
$$;

-- Quitar las políticas abiertas de la 0001
DROP POLICY IF EXISTS "anon_all_materias"   ON public.materias;
DROP POLICY IF EXISTS "anon_all_biblio"     ON public.bibliografia;
DROP POLICY IF EXISTS "anon_all_clases"     ON public.clases;
DROP POLICY IF EXISTS "anon_all_apuntes"    ON public.apuntes;
DROP POLICY IF EXISTS "anon_all_pdfs"       ON public.documentos_pdf;
DROP POLICY IF EXISTS "anon_all_examenes"   ON public.examenes;
DROP POLICY IF EXISTS "anon_all_keepalive"  ON public.supabase_keep_alive;

-- Tablas de trabajo: solo tu cuenta
CREATE POLICY "solo_mi_cuenta_materias" ON public.materias
  FOR ALL TO authenticated USING (public.es_mi_cuenta()) WITH CHECK (public.es_mi_cuenta());
CREATE POLICY "solo_mi_cuenta_biblio" ON public.bibliografia
  FOR ALL TO authenticated USING (public.es_mi_cuenta()) WITH CHECK (public.es_mi_cuenta());
CREATE POLICY "solo_mi_cuenta_clases" ON public.clases
  FOR ALL TO authenticated USING (public.es_mi_cuenta()) WITH CHECK (public.es_mi_cuenta());
CREATE POLICY "solo_mi_cuenta_apuntes" ON public.apuntes
  FOR ALL TO authenticated USING (public.es_mi_cuenta()) WITH CHECK (public.es_mi_cuenta());
CREATE POLICY "solo_mi_cuenta_pdfs" ON public.documentos_pdf
  FOR ALL TO authenticated USING (public.es_mi_cuenta()) WITH CHECK (public.es_mi_cuenta());
CREATE POLICY "solo_mi_cuenta_examenes" ON public.examenes
  FOR ALL TO authenticated USING (public.es_mi_cuenta()) WITH CHECK (public.es_mi_cuenta());

-- Keep-alive: tu cuenta escribe; el workflow de GitHub solo lee
CREATE POLICY "solo_mi_cuenta_keepalive" ON public.supabase_keep_alive
  FOR ALL TO authenticated USING (public.es_mi_cuenta()) WITH CHECK (public.es_mi_cuenta());
CREATE POLICY "anon_lee_keepalive" ON public.supabase_keep_alive
  FOR SELECT TO anon USING (true);

-- Verificación rápida (correr como anon, debe devolver 0 filas en tablas de trabajo)
--   SELECT count(*) FROM public.materias;   -- con la key anon: error o 0 filas
