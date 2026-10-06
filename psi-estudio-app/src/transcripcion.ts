// Cola de transcripción. Corre en segundo plano dentro de la app, independiente de la pantalla:
// toma los fragmentos pendientes de todas las sesiones, los manda a la función de Netlify y,
// con cada fragmento nuevo, actualiza el apunte en PsiEstudio (Supabase).
// Si algo falla, reintenta con espera creciente y nunca descarta un fragmento.

import { useSyncExternalStore } from 'react';
import { UploadType } from 'expo-file-system';
import { APP_TOKEN, FUNCION_TRANSCRIBIR } from './config';
import { archivoFragmento, guardarSesion, listarSesiones } from './almacen';
import { guardarApunte, type ApunteDesgrabacion } from './supabase';
import type { Fragmento, Sesion } from './tipos';
import { fechaLegible, marcaDeTiempo, mensajeDeError } from './util';

export type EstadoCola = {
  pendientes: number;
  transcribiendo: { sesionId: string; orden: number } | null;
  guardando: string | null;
  ultimoError: string | null;
  proximoReintentoEn: number | null;
};

let estado: EstadoCola = {
  pendientes: 0,
  transcribiendo: null,
  guardando: null,
  ultimoError: null,
  proximoReintentoEn: null,
};

const oyentes = new Set<() => void>();
const esperaHasta = new Map<string, number>();
let corriendo = false;
let hayNovedades = false;
let temporizador: ReturnType<typeof setTimeout> | null = null;

function emitir(): void {
  for (const fn of oyentes) fn();
}

function setEstado(parcial: Partial<EstadoCola>): void {
  estado = { ...estado, ...parcial };
  emitir();
}

export function suscribirCola(fn: () => void): () => void {
  oyentes.add(fn);
  return () => {
    oyentes.delete(fn);
  };
}

export function estadoCola(): EstadoCola {
  return estado;
}

export function useCola(): EstadoCola {
  return useSyncExternalStore(suscribirCola, estadoCola, estadoCola);
}

/** Espera antes de reintentar: 5 s, 10 s, 20 s, 40 s, 80 s y después siempre 120 s. */
function espera(intentos: number): number {
  const exponente = Math.max(0, Math.min(intentos - 1, 5));
  return Math.min(120_000, 5_000 * 2 ** exponente);
}

function claveFragmento(s: Sesion, f: Fragmento): string {
  return `${s.id}:${f.orden}`;
}

function contarPendientes(sesiones: Sesion[]): number {
  let n = 0;
  for (const s of sesiones) for (const f of s.fragmentos) if (f.estado !== 'transcripto') n += 1;
  return n;
}

type Trabajo =
  | { tipo: 'fragmento'; sesion: Sesion; fragmento: Fragmento }
  | { tipo: 'apunte'; sesion: Sesion }
  | { tipo: 'esperar'; hasta: number }
  | null;

function siguienteTrabajo(sesiones: Sesion[]): Trabajo {
  const ahora = Date.now();
  let minEspera: number | null = null;
  const porAntiguedad = [...sesiones].sort((a, b) => a.creadoEn.localeCompare(b.creadoEn));

  for (const s of porAntiguedad) {
    for (const f of [...s.fragmentos].sort((a, b) => a.orden - b.orden)) {
      if (f.estado === 'transcripto') continue;
      const hasta = esperaHasta.get(claveFragmento(s, f)) ?? 0;
      if (hasta > ahora) {
        if (minEspera === null || hasta < minEspera) minEspera = hasta;
        continue;
      }
      return { tipo: 'fragmento', sesion: s, fragmento: f };
    }
  }
  for (const s of porAntiguedad) {
    if (!s.apuntePendiente) continue;
    const hasta = esperaHasta.get(`${s.id}:apunte`) ?? 0;
    if (hasta > ahora) {
      if (minEspera === null || hasta < minEspera) minEspera = hasta;
      continue;
    }
    return { tipo: 'apunte', sesion: s };
  }
  if (minEspera === null) return null;
  return { tipo: 'esperar', hasta: minEspera };
}

type RespuestaFuncion = {
  text?: string;
  duration?: number;
  segments?: { start: number; end: number; text: string }[];
  error?: string;
};

async function transcribirFragmento(sesion: Sesion, fragmento: Fragmento): Promise<void> {
  const clave = claveFragmento(sesion, fragmento);
  setEstado({ transcribiendo: { sesionId: sesion.id, orden: fragmento.orden }, guardando: null });
  try {
    const archivo = archivoFragmento(sesion, fragmento.archivo);
    if (!archivo.exists || archivo.size <= 0) throw new Error('el archivo del fragmento no está en el teléfono');

    const res = await archivo.upload(FUNCION_TRANSCRIBIR, {
      httpMethod: 'POST',
      uploadType: UploadType.BINARY_CONTENT,
      headers: { 'Content-Type': 'audio/mp4', 'x-app-token': APP_TOKEN },
    });

    let datos: RespuestaFuncion = {};
    try {
      datos = JSON.parse(res.body) as RespuestaFuncion;
    } catch {
      datos = {};
    }
    if (res.status !== 200) throw new Error(datos.error || `la transcripción respondió ${res.status}`);

    fragmento.texto = (datos.text || '').trim();
    fragmento.duracionTranscripta = datos.duration || fragmento.duracionSeg;
    fragmento.segmentos = (datos.segments || []).map((seg) => ({
      start: seg.start,
      end: seg.end,
      text: (seg.text || '').trim(),
    }));
    fragmento.estado = 'transcripto';
    fragmento.ultimoError = undefined;
    sesion.apuntePendiente = true;
    esperaHasta.delete(clave);
    setEstado({ ultimoError: null });
  } catch (e) {
    fragmento.intentos += 1;
    fragmento.estado = 'error';
    fragmento.ultimoError = mensajeDeError(e);
    esperaHasta.set(clave, Date.now() + espera(fragmento.intentos));
    setEstado({ ultimoError: `Fragmento ${fragmento.orden} (${sesion.materiaNombre}): ${fragmento.ultimoError}` });
  } finally {
    setEstado({ transcribiendo: null });
    await guardarSesion(sesion);
  }
}

function armarContenido(sesion: Sesion): string {
  const lineas: string[] = [];
  lineas.push(`DESGRABACIÓN: ${sesion.materiaNombre} - CLASE #${sesion.claseNum}`);
  if (sesion.tema) lineas.push(`Tema: ${sesion.tema}`);

  const total = sesion.fragmentos.length;
  const listos = sesion.fragmentos.filter((f) => f.estado === 'transcripto').length;
  let estadoTexto: string;
  if (sesion.estado === 'terminada' && listos === total) estadoTexto = 'Desgrabación completa';
  else if (sesion.estado === 'terminada') estadoTexto = `Transcribiendo: ${listos} de ${total} fragmentos listos`;
  else estadoTexto = `Grabación en curso: ${listos} de ${total} fragmentos transcriptos`;
  lineas.push(`Estado: ${estadoTexto} (actualizado ${fechaLegible(new Date().toISOString())})`);
  lineas.push('');

  let desplazamiento = 0;
  for (const f of [...sesion.fragmentos].sort((a, b) => a.orden - b.orden)) {
    if (f.estado === 'transcripto') {
      if (f.segmentos && f.segmentos.length > 0) {
        for (const seg of f.segmentos) {
          if (seg.text) lineas.push(`[${marcaDeTiempo(desplazamiento + seg.start)}] ${seg.text}`);
        }
      } else if (f.texto) {
        lineas.push(`[${marcaDeTiempo(desplazamiento)}] ${f.texto}`);
      }
    } else {
      lineas.push(`[${marcaDeTiempo(desplazamiento)}] (fragmento ${f.orden} pendiente de transcribir)`);
    }
    desplazamiento += f.duracionTranscripta || f.duracionSeg || 0;
  }
  return lineas.join('\n');
}

function armarApunte(sesion: Sesion): ApunteDesgrabacion {
  return {
    id: `desgrab_${sesion.id}`,
    materia_id: sesion.materiaId,
    materia: sesion.materiaNombre,
    unidad: 'Unidad 1',
    titulo: `Desgrabación: Clase ${sesion.claseNum} - ${sesion.tema || 'Audio'}`,
    tipo: 'texto',
    contenido: armarContenido(sesion),
    va_parcial: false,
    nro_parcial: 1,
    created_at: sesion.creadoEn,
    updated_at: new Date().toISOString(),
  };
}

async function guardarEnPsiEstudio(sesion: Sesion): Promise<void> {
  const clave = `${sesion.id}:apunte`;
  const listosAntes = sesion.fragmentos.filter((f) => f.estado === 'transcripto').length;
  const estadoAntes = sesion.estado;
  setEstado({ guardando: sesion.id, transcribiendo: null });
  try {
    await guardarApunte(armarApunte(sesion));
    const listosDespues = sesion.fragmentos.filter((f) => f.estado === 'transcripto').length;
    // Si mientras guardábamos llegó texto nuevo, se vuelve a guardar en la próxima vuelta.
    if (listosDespues === listosAntes && sesion.estado === estadoAntes) sesion.apuntePendiente = false;
    sesion.apunteGuardadoEn = new Date().toISOString();
    sesion.errorGuardado = undefined;
    esperaHasta.delete(clave);
    setEstado({ ultimoError: null });
  } catch (e) {
    sesion.errorGuardado = mensajeDeError(e);
    esperaHasta.set(clave, Date.now() + 30_000);
    setEstado({ ultimoError: `No se pudo guardar en PsiEstudio: ${sesion.errorGuardado}` });
  } finally {
    setEstado({ guardando: null });
    await guardarSesion(sesion);
  }
}

function programar(hasta: number): void {
  if (temporizador) clearTimeout(temporizador);
  temporizador = setTimeout(() => {
    temporizador = null;
    void bucle();
  }, Math.max(250, hasta - Date.now()));
}

async function bucle(): Promise<void> {
  if (corriendo) return;
  corriendo = true;
  try {
    for (;;) {
      hayNovedades = false;
      const sesiones = listarSesiones();
      setEstado({ pendientes: contarPendientes(sesiones) });
      const trabajo = siguienteTrabajo(sesiones);
      if (!trabajo) {
        if (hayNovedades) continue;
        setEstado({ proximoReintentoEn: null });
        break;
      }
      if (trabajo.tipo === 'esperar') {
        if (hayNovedades) continue;
        programar(trabajo.hasta);
        setEstado({ proximoReintentoEn: trabajo.hasta });
        break;
      }
      setEstado({ proximoReintentoEn: null });
      if (trabajo.tipo === 'fragmento') await transcribirFragmento(trabajo.sesion, trabajo.fragmento);
      else await guardarEnPsiEstudio(trabajo.sesion);
    }
  } finally {
    corriendo = false;
    setEstado({ transcribiendo: null, guardando: null, pendientes: contarPendientes(listarSesiones()) });
  }
}

/** Avisa a la cola que hay trabajo nuevo (o que el usuario pidió reintentar ahora). */
export function despertar(): void {
  hayNovedades = true;
  if (temporizador) {
    clearTimeout(temporizador);
    temporizador = null;
  }
  void bucle();
}

/** Reintenta ya, sin esperar los tiempos de espera. */
export function reintentarAhora(): void {
  esperaHasta.clear();
  despertar();
}
