// Acceso directo a la base de PsiEstudio (Supabase). Nada se guarda en el teléfono salvo lo que todavía no se subió.
// Usa la misma clave de la app que la web (ver supabase/migrations/0002_clave_de_app.sql).

import { File, UploadType } from 'expo-file-system';
import { APP_TOKEN, SUPABASE_ANON_KEY, SUPABASE_URL } from './config';
import type { ApunteDesgrabado, Carga, Materia } from './tipos';

export const BUCKET_AUDIOS = 'audios';

const COLUMNAS_CARGA_LISTA =
  'id,origen,nombre,materia,materia_id,clase_num,tema,archivos,partes_listas,partes_total,estado,error,apunte_id,created_at';

export function cabeceras(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'x-app-token': APP_TOKEN,
    ...extra,
  };
}

async function pedir<T>(url: string, init: RequestInit, ms = 30000): Promise<T> {
  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), ms);
  try {
    const res = await fetch(url, { ...init, signal: control.signal });
    const texto = await res.text();
    if (!res.ok) throw new Error(`Supabase respondió ${res.status}: ${texto.slice(0, 200)}`);
    return (texto ? JSON.parse(texto) : null) as T;
  } finally {
    clearTimeout(temporizador);
  }
}

export async function listarMaterias(): Promise<Materia[]> {
  const url = `${SUPABASE_URL}/rest/v1/materias?select=id,nombre,abreviatura&order=nombre`;
  return pedir<Materia[]>(url, { headers: cabeceras() });
}

type OpcionesLeer = {
  estados?: string[];
  ids?: string[];
  conPartes?: boolean;
  orden?: 'asc' | 'desc';
  limite?: number;
};

export async function leerCargas(opciones: OpcionesLeer = {}): Promise<Carga[]> {
  const columnas = opciones.conPartes ? `${COLUMNAS_CARGA_LISTA},partes` : COLUMNAS_CARGA_LISTA;
  const filtros: string[] = [`select=${columnas}`];
  if (opciones.estados && opciones.estados.length > 0) filtros.push(`estado=in.(${opciones.estados.join(',')})`);
  if (opciones.ids && opciones.ids.length > 0) filtros.push(`id=in.(${opciones.ids.map(encodeURIComponent).join(',')})`);
  filtros.push(`order=created_at.${opciones.orden === 'asc' ? 'asc' : 'desc'}`);
  filtros.push(`limit=${opciones.limite ?? 30}`);
  const filas = await pedir<Carga[]>(`${SUPABASE_URL}/rest/v1/cargas_audio?${filtros.join('&')}`, { headers: cabeceras() });
  return (filas || []).map((f) => ({ ...f, partes: f.partes || {} }));
}

export async function crearCarga(carga: Carga): Promise<void> {
  await pedir(`${SUPABASE_URL}/rest/v1/cargas_audio`, {
    method: 'POST',
    headers: cabeceras({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
    body: JSON.stringify([carga]),
  });
}

export async function actualizarCarga(id: string, cambios: Partial<Carga>): Promise<void> {
  await pedir(`${SUPABASE_URL}/rest/v1/cargas_audio?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: cabeceras({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
    body: JSON.stringify({ ...cambios, updated_at: new Date().toISOString() }),
  });
}

/** Desgrabaciones antiguas que quedaron en Apuntes (la web las muestra en el Historial). */
export async function leerApuntesDesgrabados(): Promise<ApunteDesgrabado[]> {
  const url = `${SUPABASE_URL}/rest/v1/apuntes?select=id,materia,titulo,contenido,created_at&id=like.desgrab_*&order=created_at.desc&limit=100`;
  return pedir<ApunteDesgrabado[]>(url, { headers: cabeceras() });
}

/** Sube un archivo local al bucket "audios" tal cual (bytes crudos). Falla si la base responde distinto de 200. */
export async function subirArchivo(ruta: string, uriLocal: string, tipo: string): Promise<void> {
  const archivo = new File(uriLocal);
  const res = await archivo.upload(`${SUPABASE_URL}/storage/v1/object/${BUCKET_AUDIOS}/${ruta}`, {
    uploadType: UploadType.BINARY_CONTENT,
    httpMethod: 'POST',
    headers: cabeceras({ 'Content-Type': tipo, 'x-upsert': 'true' }),
  });
  if (res.status !== 200) throw new Error(`No se pudo subir el audio (${res.status}): ${res.body.slice(0, 200)}`);
}

/** Enlace temporal (1 hora) para escuchar o bajar un archivo del bucket. */
export async function urlFirmada(ruta: string): Promise<string> {
  const firma = await pedir<{ signedURL: string }>(
    `${SUPABASE_URL}/storage/v1/object/sign/${BUCKET_AUDIOS}/${ruta}`,
    {
      method: 'POST',
      headers: cabeceras({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ expiresIn: 3600 }),
    },
  );
  return `${SUPABASE_URL}/storage/v1${firma.signedURL}`;
}

/** Baja un archivo del bucket (bytes crudos). */
export async function bajarArchivo(ruta: string): Promise<ArrayBuffer> {
  const res = await fetch(await urlFirmada(ruta));
  if (!res.ok) throw new Error(`No se pudo bajar el audio (${res.status})`);
  return res.arrayBuffer();
}
