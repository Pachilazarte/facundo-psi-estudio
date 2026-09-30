-- ==========================================
-- PSIESTUDIO v2 - SUPABASE SCHEMA DDL
-- Proyecto: facundo-psi-estudio
-- Ref: eckgwyvbevlpnhjrsaxy.supabase.co
-- ==========================================

-- 1. MATERIAS (Panel de Parámetros)
CREATE TABLE IF NOT EXISTS public.materias (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    nombre TEXT NOT NULL UNIQUE,
    abreviatura TEXT,
    color TEXT DEFAULT '#0A84FF',
    docente TEXT,
    año_cursado INT DEFAULT 2026,
    cuatrimestre INT DEFAULT 2, -- 1 o 2
    tipo TEXT DEFAULT 'Teórica', -- 'Teórica', 'Práctica', 'Ambas'
    descripcion TEXT,
    fecha_parcial1 DATE,
    fecha_parcial2 DATE,
    fecha_final DATE,
    modalidad_parcial TEXT, -- 'Domiciliario', 'Presencial', 'Oral'
    temas_parcial1 TEXT,    -- Temario Parcial 1
    temas_parcial2 TEXT,    -- Temario Parcial 2
    temas_final TEXT,       -- Temario Final
    link_programa TEXT,     -- Link al programa oficial de la materia
    link_drive TEXT,        -- Link carpeta Drive de la materia
    activa BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. BIBLIOGRAFÍA (Textos y Lecturas)
CREATE TABLE IF NOT EXISTS public.bibliografia (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    materia_id TEXT REFERENCES public.materias(id) ON DELETE CASCADE,
    materia TEXT NOT NULL,
    unidad TEXT NOT NULL DEFAULT 'Unidad 1',
    nro_texto INT DEFAULT 1,
    titulo_texto TEXT NOT NULL,
    autores TEXT,
    caracter TEXT DEFAULT 'Obligatorio', -- 'Obligatorio' o 'Optativo'
    estado TEXT NOT NULL DEFAULT 'Pendiente',
    link_resumen TEXT,
    tipo_clase TEXT DEFAULT 'Teórica',
    notas TEXT,
    va_parcial BOOLEAN DEFAULT FALSE,
    nro_parcial INT DEFAULT 1, -- Qué parcial cubre (1, 2, final)
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. CLASES (Protocolo de Clases)
CREATE TABLE IF NOT EXISTS public.clases (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    materia_id TEXT REFERENCES public.materias(id) ON DELETE CASCADE,
    materia TEXT NOT NULL,
    tipo TEXT DEFAULT 'Teórica',
    nro_clase INT DEFAULT 1,
    fecha DATE DEFAULT CURRENT_DATE,
    titulo_clase TEXT NOT NULL,
    link_grabacion TEXT,
    link_doc_resumen TEXT,
    estado TEXT DEFAULT 'Completada',
    transcripcion TEXT,
    contenido_ppt TEXT,
    aclaraciones TEXT,
    imagenes_diapositivas JSONB DEFAULT '[]'::jsonb,
    bibliografia_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
    fecha_carga TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. APUNTES / RESÚMENES (Sistema de Apuntes Completos)
CREATE TABLE IF NOT EXISTS public.apuntes (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    materia_id TEXT REFERENCES public.materias(id) ON DELETE CASCADE,
    materia TEXT NOT NULL,
    unidad TEXT,
    titulo TEXT NOT NULL,
    contenido TEXT,                  -- Texto del apunte (markdown)
    tipo TEXT DEFAULT 'Resumen',     -- 'Resumen', 'Mapa Conceptual', 'Fichas', 'Cuestionario', 'Notas de Clase'
    bibliografia_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
    clase_id TEXT REFERENCES public.clases(id) ON DELETE SET NULL,
    va_parcial BOOLEAN DEFAULT FALSE,
    nro_parcial INT DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. PDFs e Ingestión
CREATE TABLE IF NOT EXISTS public.documentos_pdf (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    nombre_archivo TEXT NOT NULL,
    materia_id TEXT REFERENCES public.materias(id) ON DELETE SET NULL,
    materia TEXT,
    unidad TEXT,
    nro_texto INT,
    autores TEXT,
    num_paginas INT,
    tamaño_bytes BIGINT,
    va_parcial BOOLEAN DEFAULT FALSE,
    texto_extraido TEXT,
    url_pdf TEXT,
    bibliografia_id TEXT REFERENCES public.bibliografia(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. EXÁMENES (Fechas y seguimiento)
CREATE TABLE IF NOT EXISTS public.examenes (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    nombre TEXT NOT NULL,
    materia_id TEXT REFERENCES public.materias(id) ON DELETE CASCADE,
    materia TEXT NOT NULL,
    tipo TEXT DEFAULT 'Parcial 1', -- 'Parcial 1', 'Parcial 2', 'Final', 'Recuperatorio'
    fecha DATE,
    modalidad TEXT DEFAULT 'Presencial',
    temas TEXT,
    unidades_incluidas TEXT[] DEFAULT ARRAY[]::TEXT[],
    textos_vinculados TEXT[] DEFAULT ARRAY[]::TEXT[],
    textos_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
    finalizado BOOLEAN DEFAULT FALSE,
    nota NUMERIC(4,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. KEEP-ALIVE (Anti-Pausa Supabase)
CREATE TABLE IF NOT EXISTS public.supabase_keep_alive (
    id SERIAL PRIMARY KEY,
    ping_source TEXT DEFAULT 'App-Client',
    ping_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'ACTIVE'
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================
ALTER TABLE public.materias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bibliografia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apuntes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos_pdf ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.examenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supabase_keep_alive ENABLE ROW LEVEL SECURITY;

-- Políticas: Acceso público (usar anon key en cliente con RLS activado)
CREATE POLICY "anon_all_materias" ON public.materias FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_biblio" ON public.bibliografia FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_clases" ON public.clases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_apuntes" ON public.apuntes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_pdfs" ON public.documentos_pdf FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_examenes" ON public.examenes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_keepalive" ON public.supabase_keep_alive FOR ALL USING (true) WITH CHECK (true);

-- Ping de inicialización
INSERT INTO public.supabase_keep_alive (ping_source, status) VALUES ('Schema Init v2', 'ACTIVE');
