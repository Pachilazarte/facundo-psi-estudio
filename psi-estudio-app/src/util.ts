/** Error cuyo mensaje ya está escrito para la persona. Cualquier otro error se muestra con avisoDe. */
export class AvisoError extends Error {}

/** Detalle técnico del error. Solo para la consola: nunca se muestra en pantalla. */
export function detalleTecnico(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

/** Frase para la persona. Lo técnico queda en la consola. */
export function avisoDe(accion: string, e: unknown): string {
  console.warn(`[PsiEstudio] ${accion}:`, detalleTecnico(e));
  return `${accion}. Probá de nuevo en unos segundos.`;
}

/** mm:ss, o hh:mm:ss si pasa de una hora (para el reloj visible). */
export function formatearTiempo(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(r).padStart(2, '0');
  return h > 0 ? `${String(h).padStart(2, '0')}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Siempre HH:MM:SS, igual que la web en las desgrabaciones. */
export function marcaDeTiempo(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const r = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${r}`;
}

/** dd/mm/aaaa hh:mm sin depender de Intl (Hermes lo soporta a medias). */
export function fechaLegible(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Formato legible para bytes guardados (KB, MB, GB). */
export function formatearBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const unidades = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(unidades.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const valor = bytes / 1024 ** i;
  return `${valor.toFixed(i === 0 ? 0 : 1)} ${unidades[i]}`;
}
