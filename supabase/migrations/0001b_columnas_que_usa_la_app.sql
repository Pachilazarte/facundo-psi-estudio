-- ==========================================
-- 0001b - Columnas que la app ya envía y el esquema 0001 no tiene
-- ==========================================
-- Correr DESPUÉS de supabase_schema.sql (0001) y ANTES de 0002.
-- Todas usan IF NOT EXISTS: se pueden correr más de una vez sin romper nada.

-- clases: lo que manda app.jsx (sanitizeForCloud.clases)
ALTER TABLE public.clases ADD COLUMN IF NOT EXISTS desgrabacion_md TEXT DEFAULT '';
ALTER TABLE public.clases ADD COLUMN IF NOT EXISTS grabaciones JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.clases ADD COLUMN IF NOT EXISTS imagenes JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.clases ADD COLUMN IF NOT EXISTS temas_enfasis TEXT DEFAULT '';

-- documentos_pdf: lo que manda app.jsx (sanitizeForCloud.documentos_pdf)
ALTER TABLE public.documentos_pdf ADD COLUMN IF NOT EXISTS titulo TEXT;
ALTER TABLE public.documentos_pdf ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'Resumen';
ALTER TABLE public.documentos_pdf ADD COLUMN IF NOT EXISTS nro_parcial INT;

-- Verificación: debe listar las 4 de clases y las 3 de documentos_pdf
-- SELECT table_name, column_name FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name IN ('clases','documentos_pdf')
--    AND column_name IN ('desgrabacion_md','grabaciones','imagenes','temas_enfasis','titulo','tipo','nro_parcial');
