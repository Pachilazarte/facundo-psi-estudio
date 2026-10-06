-- ==============================================================================
-- 0003 - Sincronización robusta: Timestamps y Soft Deletes (Anti-resurrección)
-- ==============================================================================
-- Correr DESPUÉS de 0001, 0001b y 0002.
-- Idempotente: todas las instrucciones usan IF NOT EXISTS o CREATE OR REPLACE.
--
-- Propósito:
--   1. Añadir columnas updated_at y deleted_at a todas las entidades maestras.
--   2. Disparar actualización automática de updated_at en cualquier UPDATE.
--   3. Permitir soft-deletes (deleted_at IS NOT NULL) para evitar que dispositivos
--      secundarios resuciten registros eliminados al reconectarse.
--   4. Crear índices optimizados para filtrado y sincronización diferencial.

-- 1. COLUMNAS updated_at Y deleted_at
ALTER TABLE public.materias ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.materias ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

ALTER TABLE public.bibliografia ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.bibliografia ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

ALTER TABLE public.clases ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.clases ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

ALTER TABLE public.apuntes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.apuntes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

ALTER TABLE public.documentos_pdf ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.documentos_pdf ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

ALTER TABLE public.examenes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.examenes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 2. FUNCIÓN DISPARADORA PARA updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. TRIGGERS EN CADA TABLA
DROP TRIGGER IF EXISTS trg_materias_updated_at ON public.materias;
CREATE TRIGGER trg_materias_updated_at
BEFORE UPDATE ON public.materias
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_bibliografia_updated_at ON public.bibliografia;
CREATE TRIGGER trg_bibliografia_updated_at
BEFORE UPDATE ON public.bibliografia
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_clases_updated_at ON public.clases;
CREATE TRIGGER trg_clases_updated_at
BEFORE UPDATE ON public.clases
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_apuntes_updated_at ON public.apuntes;
CREATE TRIGGER trg_apuntes_updated_at
BEFORE UPDATE ON public.apuntes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_documentos_pdf_updated_at ON public.documentos_pdf;
CREATE TRIGGER trg_documentos_pdf_updated_at
BEFORE UPDATE ON public.documentos_pdf
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_examenes_updated_at ON public.examenes;
CREATE TRIGGER trg_examenes_updated_at
BEFORE UPDATE ON public.examenes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. ÍNDICES DE SINCRONIZACIÓN Y RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_materias_sync ON public.materias (deleted_at, updated_at);
CREATE INDEX IF NOT EXISTS idx_bibliografia_sync ON public.bibliografia (deleted_at, updated_at);
CREATE INDEX IF NOT EXISTS idx_clases_sync ON public.clases (deleted_at, updated_at);
CREATE INDEX IF NOT EXISTS idx_apuntes_sync ON public.apuntes (deleted_at, updated_at);
CREATE INDEX IF NOT EXISTS idx_documentos_pdf_sync ON public.documentos_pdf (deleted_at, updated_at);
CREATE INDEX IF NOT EXISTS idx_examenes_sync ON public.examenes (deleted_at, updated_at);
