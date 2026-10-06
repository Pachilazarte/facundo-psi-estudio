// Acceso a la base de PsiEstudio por la API REST de Supabase.
// La base exige el header x-app-token (ver supabase/migrations/0002_clave_de_app.sql).

import { APP_TOKEN, SUPABASE_ANON_KEY, SUPABASE_URL } from './config';
import type { Materia } from './tipos';

function cabeceras(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'x-app-token': APP_TOKEN,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function conTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, ms = 20000): Promise<T> {
  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), ms);
  try {
    return await fn(control.signal);
  } finally {
    clearTimeout(temporizador);
  }
}

export async function listarMaterias(): Promise<Materia[]> {
  return conTimeout(async (signal) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/materias?select=id,nombre,abreviatura,color&order=nombre`, {
      headers: cabeceras(),
      signal,
    });
    if (!res.ok) throw new Error(`No se pudieron cargar las materias (${res.status})`);
    const datos = (await res.json()) as unknown;
    return Array.isArray(datos) ? (datos as Materia[]) : [];
  });
}

/** Fila de la tabla public.apuntes (solo las columnas que existen en el esquema). */
export type ApunteDesgrabacion = {
  id: string;
  materia_id: string | null;
  materia: string;
  unidad: string;
  titulo: string;
  tipo: string;
  contenido: string;
  va_parcial: boolean;
  nro_parcial: number;
  created_at: string;
  updated_at: string;
};

/** Crea o actualiza el apunte (upsert por id). Se llama cada vez que hay texto nuevo. */
export async function guardarApunte(apunte: ApunteDesgrabacion): Promise<void> {
  await conTimeout(async (signal) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/apuntes`, {
      method: 'POST',
      headers: cabeceras({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify([apunte]),
      signal,
    });
    if (!res.ok) {
      const detalle = await res.text().catch(() => '');
      throw new Error(`Supabase respondió ${res.status}: ${detalle.slice(0, 200)}`);
    }
  }, 30000);
}
