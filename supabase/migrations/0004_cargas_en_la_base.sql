-- ==========================================
-- 0004 - Audio y desgrabaciones directo a la base (nada en el navegador)
-- ==========================================
-- Correr DESPUÉS de 0002 (usa public.clave_valida()).
--
-- Qué crea:
--   1) Bucket privado "audios" en Supabase Storage: guarda los archivos subidos y los fragmentos grabados.
--   2) Tabla cargas_audio: una fila por carga o grabación, con su estado y el texto de cada parte.
--   Ambas cosas exigen el header x-app-token (misma clave de la app que la tabla de apuntes).

-- 1) Bucket privado
INSERT INTO storage.buckets (id, name, public)
VALUES ('audios', 'audios', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "con_clave_audios" ON storage.objects;
CREATE POLICY "con_clave_audios" ON storage.objects
  FOR ALL TO anon, authenticated
  USING (bucket_id = 'audios' AND public.clave_valida())
  WITH CHECK (bucket_id = 'audios' AND public.clave_valida());

-- 2) Tabla de cargas
CREATE TABLE IF NOT EXISTS public.cargas_audio (
  id            TEXT PRIMARY KEY,
  origen        TEXT NOT NULL DEFAULT 'archivo',          -- 'archivo' (subido) | 'grabacion'
  nombre        TEXT NOT NULL,
  materia_id    TEXT REFERENCES public.materias(id) ON DELETE SET NULL,
  materia       TEXT NOT NULL DEFAULT '',
  clase_num     INT  NOT NULL DEFAULT 1,
  tema          TEXT NOT NULL DEFAULT '',
  archivos      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],  -- rutas en el bucket "audios"
  partes        JSONB NOT NULL DEFAULT '{}'::jsonb,       -- texto y tiempos de cada parte ya desgrabada
  partes_listas INT  NOT NULL DEFAULT 0,
  partes_total  INT  NOT NULL DEFAULT 0,
  estado        TEXT NOT NULL DEFAULT 'pendiente',        -- grabando | pendiente | en_proceso | completada | error
  error         TEXT,
  apunte_id     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cargas_audio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "con_clave_cargas" ON public.cargas_audio;
CREATE POLICY "con_clave_cargas" ON public.cargas_audio
  FOR ALL TO anon, authenticated
  USING (public.clave_valida())
  WITH CHECK (public.clave_valida());

-- Verificación (con la clave correcta el bucket y la tabla responden; sin ella, nada):
--   SELECT count(*) FROM public.cargas_audio;   -- 0 filas al principio
