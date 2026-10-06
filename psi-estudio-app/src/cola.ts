// Proceso de fondo de la app. Hace dos cosas, siempre en este orden:
//   1) Sube a la base los fragmentos grabados que todavía están en el teléfono (y los borra al confirmar).
//   2) Desgraba las cargas pendientes que están en la base (cargas_audio), parte por parte, y guarda cada parte.
// Si algo falla, lo reintenta: nunca descarta un fragmento ni una parte ya desgrabada.

import { AppState } from 'react-native';
import { APP_TOKEN, FUNCION_TRANSCRIBIR } from './config';
import { leerNombrePendiente, pendientesDeSubida } from './outbox';
import { actualizarCarga, bajarArchivo, leerCargas, subirArchivo } from './supabase';
import type { Carga, ParteDesgrabada } from './tipos';
import { mensajeDeError } from './util';

export type EstadoCola = {
  fragmentosSinSubir: number;
  transcribiendo: string | null;
  parte: number | null;
  ultimoError: string | null;
};

let estado: EstadoCola = { fragmentosSinSubir: 0, transcribiendo: null, parte: null, ultimoError: null };
const oyentes = new Set<() => void>();

function cambiar(parcial: Partial<EstadoCola>): void {
  estado = { ...estado, ...parcial };
  oyentes.forEach((fn) => fn());
}

export function estadoCola(): EstadoCola {
  return estado;
}

export function suscribirCola(fn: () => void): () => void {
  oyentes.add(fn);
  return () => {
    oyentes.delete(fn);
  };
}

let subiendo = false;
let desgrabando = false;
let reintento: ReturnType<typeof setTimeout> | null = null;

function programarReintento(ms: number): void {
  if (reintento) clearTimeout(reintento);
  reintento = setTimeout(() => {
    reintento = null;
    despertarCola();
  }, ms);
}

/** Sube lo que esté en el teléfono. Una sola subida a la vez. */
export async function subirPendientes(): Promise<void> {
  if (subiendo) return;
  subiendo = true;
  try {
    for (;;) {
      const pendientes = pendientesDeSubida();
      cambiar({ fragmentosSinSubir: pendientes.length });
      if (pendientes.length === 0) break;

      const archivo = pendientes[0];
      const info = leerNombrePendiente(archivo.name);
      if (!info) {
        archivo.delete();
        continue;
      }
      const ruta = `grabaciones/${info.cargaId}/${String(info.orden).padStart(3, '0')}.m4a`;
      try {
        await subirArchivo(ruta, archivo.uri, 'audio/mp4');
        // Registrar la ruta en la carga, en orden.
        const [carga] = await leerCargas({ ids: [info.cargaId], conPartes: false, limite: 1 });
        const rutas = Array.from(new Set([...(carga ? carga.archivos : []), ruta])).sort();
        await actualizarCarga(info.cargaId, { archivos: rutas, partes_total: rutas.length });
        archivo.delete(); // ya está en la base: el teléfono no guarda copia
      } catch (e) {
        cambiar({ ultimoError: `Fragmento ${info.orden}: ${mensajeDeError(e)}. Se reintenta solo.` });
        programarReintento(30000);
        break;
      }
    }
  } finally {
    subiendo = false;
    cambiar({ fragmentosSinSubir: pendientesDeSubida().length });
  }
}

async function transcribirParte(bytes: ArrayBuffer, tipo: string): Promise<{ text?: string; duration?: number; segments?: ParteDesgrabada['segments']; error?: string }> {
  for (let intento = 1; ; intento++) {
    try {
      const res = await fetch(FUNCION_TRANSCRIBIR, {
        method: 'POST',
        headers: { 'Content-Type': tipo, 'x-app-token': APP_TOKEN },
        body: bytes,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `respuesta ${res.status}`);
      return json;
    } catch (e) {
      if (intento >= 4) throw e;
      await new Promise((r) => setTimeout(r, 4000 * intento));
    }
  }
}

function tipoPorRuta(ruta: string): string {
  return ruta.endsWith('.wav') ? 'audio/wav' : ruta.endsWith('.webm') ? 'audio/webm' : 'audio/mp4';
}

async function desgrabarCarga(carga: Carga): Promise<void> {
  await actualizarCarga(carga.id, { estado: 'en_proceso', error: null });
  const partes: Record<string, ParteDesgrabada> = { ...(carga.partes || {}) };
  const total = carga.archivos.length;
  try {
    if (total === 0) throw new Error('No hay audio para desgrabar');
    for (let i = 0; i < total; i++) {
      if (partes[i]) continue; // ya desgrabada en un intento anterior
      cambiar({ transcribiendo: carga.nombre, parte: i + 1 });
      const ruta = carga.archivos[i];
      const bytes = await bajarArchivo(ruta);
      const data = await transcribirParte(bytes, tipoPorRuta(ruta));
      partes[i] = { text: data.text || '', duration: data.duration || 0, segments: data.segments || [] };
      await actualizarCarga(carga.id, { partes, partes_listas: Object.keys(partes).length, partes_total: total });
    }
    await actualizarCarga(carga.id, { estado: 'completada', error: null });
  } catch (e) {
    const msg = mensajeDeError(e);
    cambiar({ ultimoError: `${carga.nombre}: ${msg}` });
    await actualizarCarga(carga.id, { estado: 'error', error: msg });
  }
}

/** Desgraba las cargas pendientes que están en la base, de a una. */
export async function desgrabarPendientes(): Promise<void> {
  if (desgrabando) return;
  desgrabando = true;
  try {
    for (;;) {
      const [carga] = await leerCargas({ estados: ['pendiente', 'en_proceso'], conPartes: true, orden: 'asc', limite: 1 });
      if (!carga) break;
      await desgrabarCarga(carga);
    }
  } catch (e) {
    cambiar({ ultimoError: `Sin conexión con la base: ${mensajeDeError(e)}. Se reintenta solo.` });
    programarReintento(30000);
  } finally {
    desgrabando = false;
    cambiar({ transcribiendo: null, parte: null });
  }
}

/** Punto de entrada: primero sube, después desgraba. Seguro de llamar cuando sea. */
export function despertarCola(): void {
  void subirPendientes().then(() => desgrabarPendientes());
}

let iniciada = false;
export function iniciarCola(): void {
  if (iniciada) return;
  iniciada = true;
  despertarCola();
  setInterval(despertarCola, 60000);
  AppState.addEventListener('change', (estadoApp) => {
    if (estadoApp === 'active') despertarCola();
  });
}

// Cambios en la lista de cargas (nueva clase, clase terminada): la pantalla se entera sin recargar.
let versionCargas = 0;
export function avisarCambioCargas(): void {
  versionCargas += 1;
  oyentes.forEach((fn) => fn());
}
export function versionDeCargas(): number {
  return versionCargas;
}
