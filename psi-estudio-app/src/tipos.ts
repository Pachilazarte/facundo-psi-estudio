// Tipos compartidos por la grabadora, el almacenamiento y la cola de transcripción.

export type SegmentoTexto = { start: number; end: number; text: string };

export type EstadoFragmento = 'pendiente' | 'transcripto' | 'error';

export type Fragmento = {
  orden: number;
  /** Nombre del archivo dentro de la carpeta de la sesión (nunca se borra). */
  archivo: string;
  /** Duración medida por el grabador, en segundos. */
  duracionSeg: number;
  estado: EstadoFragmento;
  intentos: number;
  ultimoError?: string;
  texto?: string;
  duracionTranscripta?: number;
  segmentos?: SegmentoTexto[];
};

export type EstadoSesion = 'grabando' | 'pausada' | 'terminada' | 'interrumpida';

export type TramoEnCurso = {
  uri: string;
  iniciadoEn: string;
  orden: number;
};

export type Sesion = {
  id: string;
  materiaId: string | null;
  materiaNombre: string;
  claseNum: number;
  tema: string;
  creadoEn: string;
  actualizadoEn: string;
  estado: EstadoSesion;
  fragmentos: Fragmento[];
  /** Fragmento de audio que se está grabando actualmente en el grabador (por si iOS mata la app). */
  tramoEnCurso?: TramoEnCurso | null;
  /** Hay texto nuevo que todavía no se guardó en PsiEstudio (Supabase). */
  apuntePendiente: boolean;
  apunteGuardadoEn: string | null;
  errorGuardado?: string;
};

export type Materia = {
  id: string;
  nombre: string;
  abreviatura?: string | null;
  color?: string | null;
};
