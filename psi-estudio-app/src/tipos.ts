// Tipos de la tabla public.cargas_audio y de apuntes (mismos nombres que la web).

export type ParteDesgrabada = {
  text: string;
  duration: number;
  segments: { start: number; end: number; text: string }[];
};

export type EstadoCarga = 'grabando' | 'pendiente' | 'en_proceso' | 'completada' | 'error';

export type Carga = {
  id: string;
  origen: 'archivo' | 'grabacion';
  nombre: string;
  materia: string;
  materia_id: string | null;
  clase_num: number;
  tema: string;
  archivos: string[];
  partes: Record<string, ParteDesgrabada>;
  partes_listas: number;
  partes_total: number;
  estado: EstadoCarga;
  error: string | null;
  apunte_id: string | null;
  created_at: string;
};

export type Materia = {
  id: string;
  nombre: string;
  abreviatura?: string | null;
};

export type ApunteDesgrabado = {
  id: string;
  materia: string;
  titulo: string;
  contenido: string;
  created_at: string;
};
