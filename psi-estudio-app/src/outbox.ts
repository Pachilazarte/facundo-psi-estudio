// Cola de subida: los fragmentos grabados esperan acá SOLO hasta que la base confirma la subida.
// Después se borran del teléfono: el original queda en la base (bucket "audios").

import { Directory, File, Paths } from 'expo-file-system';

const CARPETA = new Directory(Paths.document, 'pendientes-subida');

function asegurarCarpeta(): void {
  if (!CARPETA.exists) CARPETA.create({ intermediates: true, idempotent: true });
}

/** Nombre con el id de la carga y el número de fragmento: <cargaId>__001.m4a */
export function nombrePendiente(cargaId: string, orden: number): string {
  return `${cargaId}__${String(orden).padStart(3, '0')}.m4a`;
}

export function leerNombrePendiente(nombre: string): { cargaId: string; orden: number } | null {
  const m = nombre.match(/^(.+)__(\d{3})\.m4a$/);
  return m ? { cargaId: m[1], orden: parseInt(m[2], 10) } : null;
}

export function ponerEnPendientes(uriOrigen: string, nombre: string): void {
  asegurarCarpeta();
  new File(uriOrigen).move(new File(CARPETA, nombre));
}

export function pendientesDeSubida(): File[] {
  asegurarCarpeta();
  return CARPETA.list().filter((e): e is File => e instanceof File);
}
