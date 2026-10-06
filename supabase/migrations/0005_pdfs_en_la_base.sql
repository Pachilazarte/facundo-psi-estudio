-- ==========================================
-- 0005 - PDFs originales en la base (bucket privado "pdfs")
-- ==========================================
-- Correr DESPUÉS de 0002 (usa public.clave_valida()).
-- Los PDFs se guardan como pdfs/<id>.pdf; documentos_pdf.url_pdf guarda esa ruta.

INSERT INTO storage.buckets (id, name, public)
VALUES ('pdfs', 'pdfs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "con_clave_pdfs" ON storage.objects;
CREATE POLICY "con_clave_pdfs" ON storage.objects
  FOR ALL TO anon, authenticated
  USING (bucket_id = 'pdfs' AND public.clave_valida())
  WITH CHECK (bucket_id = 'pdfs' AND public.clave_valida());
