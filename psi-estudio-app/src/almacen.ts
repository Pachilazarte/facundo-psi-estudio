// Almacenamiento en el teléfono: una carpeta por clase grabada, con sus fragmentos de audio
// y un manifest.json. Regla: el audio original NUNCA se borra desde la app.

import { Directory, File, Paths } from 'expo-file-system';
import type { Materia, Sesion } from './tipos';

const RAIZ = new Directory(Paths.document, 'psi-clases');

/** Sesiones ya leídas. Es la única copia en memoria: grabadora y cola trabajan sobre el mismo objeto. */
const enMemoria = new Map<string, Sesion>();
/** Escrituras del manifest en serie, por sesión, para que no se pisen. */
const escrituras = new Map<string, Promise<void>>();

const oyentes = new Set<() => void>();
let version = 0;

function notificar(): void {
  version += 1;
  for (const fn of oyentes) fn();
}

export function suscribirSesiones(fn: () => void): () => void {
  oyentes.add(fn);
  return () => {
    oyentes.delete(fn);
  };
}

export function versionSesiones(): number {
  return version;
}

export function asegurarRaiz(): void {
  if (!RAIZ.exists) RAIZ.create({ intermediates: true, idempotent: true });
}

export function dirSesion(id: string): Directory {
  return new Directory(RAIZ, id);
}

export function archivoFragmento(sesion: Sesion, archivo: string): File {
  return new File(dirSesion(sesion.id), archivo);
}

function leerDesdeDisco(id: string): Sesion | null {
  // Si el manifest quedó a medio escribir, el .tmp tiene la versión más nueva.
  for (const nombre of ['manifest.json', 'manifest.json.tmp']) {
    try {
      const f = new File(dirSesion(id), nombre);
      if (!f.exists) continue;
      const datos = JSON.parse(f.textSync()) as Sesion;
      if (datos && datos.id === id && Array.isArray(datos.fragmentos)) return datos;
    } catch {
      // probar el siguiente
    }
  }
  return null;
}

export function obtenerSesion(id: string): Sesion | null {
  const cacheada = enMemoria.get(id);
  if (cacheada) return cacheada;
  const leida = leerDesdeDisco(id);
  if (leida) enMemoria.set(id, leida);
  return leida;
}

export function listarSesiones(): Sesion[] {
  asegurarRaiz();
  let entradas: (Directory | File)[] = [];
  try {
    entradas = RAIZ.list();
  } catch {
    entradas = [];
  }
  const sesiones: Sesion[] = [];
  for (const entrada of entradas) {
    if (!(entrada instanceof Directory)) continue;
    const s = obtenerSesion(entrada.name);
    if (s) sesiones.push(s);
  }
  return sesiones.sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
}

/** Escritura atómica del manifest (temporal + reemplazo). Devuelve cuando quedó en disco. */
export function guardarSesion(sesion: Sesion): Promise<void> {
  sesion.actualizadoEn = new Date().toISOString();
  enMemoria.set(sesion.id, sesion);
  const contenido = JSON.stringify(sesion, null, 2);
  const anterior = escrituras.get(sesion.id) ?? Promise.resolve();
  const siguiente = anterior
    .catch(() => undefined)
    .then(async () => {
      const dir = dirSesion(sesion.id);
      if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
      const tmp = new File(dir, 'manifest.json.tmp');
      tmp.create({ intermediates: true, overwrite: true });
      tmp.write(contenido);
      await tmp.move(new File(dir, 'manifest.json'), { overwrite: true });
    });
  escrituras.set(sesion.id, siguiente);
  notificar();
  return siguiente;
}

export function crearSesion(datos: Pick<Sesion, 'materiaId' | 'materiaNombre' | 'claseNum' | 'tema'>): Sesion {
  const ahora = new Date().toISOString();
  const id = `sesion_${ahora.replace(/[-:.TZ]/g, '').slice(0, 14)}_${Math.random().toString(36).slice(2, 6)}`;
  const sesion: Sesion = {
    id,
    ...datos,
    creadoEn: ahora,
    actualizadoEn: ahora,
    estado: 'grabando',
    fragmentos: [],
    apuntePendiente: false,
    apunteGuardadoEn: null,
  };
  asegurarRaiz();
  dirSesion(id).create({ intermediates: true, idempotent: true });
  enMemoria.set(id, sesion);
  notificar();
  return sesion;
}

/** Mueve el archivo que dejó el grabador (en la caché) a la carpeta de la sesión. */
export async function moverGrabacionASesion(
  uriOrigen: string,
  sesion: Sesion,
  orden: number,
): Promise<{ archivo: string; bytes: number }> {
  const origen = new File(uriOrigen);
  if (!origen.exists) throw new Error('No se encontró el archivo de la grabación');
  const extRaw = origen.extension || '.m4a';
  const ext = extRaw.startsWith('.') ? extRaw : `.${extRaw}`;
  const archivo = `frag_${String(orden).padStart(3, '0')}${ext}`;
  const destino = new File(dirSesion(sesion.id), archivo);
  await origen.move(destino, { overwrite: true });
  return { archivo, bytes: destino.size };
}

/** Si la app se cerró en medio de una clase, se recupera el fragmento en curso (si quedó en disco) y la sesión queda como "interrumpida" (nada se borra). */
export async function recuperarSesionesInterrumpidas(): Promise<void> {
  for (const s of listarSesiones()) {
    let modificado = false;

    // Si había un tramo grabándose cuando se cerró o mató la app:
    if (s.tramoEnCurso && s.tramoEnCurso.uri) {
      try {
        const origen = new File(s.tramoEnCurso.uri);
        if (origen.exists && origen.size > 0) {
          const orden = s.tramoEnCurso.orden;
          const { archivo, bytes } = await moverGrabacionASesion(s.tramoEnCurso.uri, s, orden);
          if (bytes > 0) {
            s.fragmentos.push({
              orden,
              archivo,
              duracionSeg: 0,
              estado: 'pendiente',
              intentos: 0,
            });
            s.apuntePendiente = true;
            modificado = true;
          }
        }
      } catch (err) {
        console.warn('No se pudo recuperar el fragmento en curso de la sesión:', s.id, err);
      }
      s.tramoEnCurso = null;
      modificado = true;
    }

    if (s.estado === 'grabando') {
      s.estado = 'interrumpida';
      modificado = true;
    }

    if (modificado) {
      await guardarSesion(s);
    }
  }
}

// Caché de materias para poder elegir materia sin conexión.
function archivoMaterias(): File {
  return new File(RAIZ, 'materias.json');
}

export function guardarCacheMaterias(materias: Materia[]): void {
  try {
    asegurarRaiz();
    const f = archivoMaterias();
    f.create({ intermediates: true, overwrite: true });
    f.write(JSON.stringify(materias));
  } catch {
    // la caché es opcional
  }
}

export function leerCacheMaterias(): Materia[] {
  try {
    const f = archivoMaterias();
    if (!f.exists) return [];
    const datos = JSON.parse(f.textSync()) as unknown;
    return Array.isArray(datos) ? (datos as Materia[]) : [];
  } catch {
    return [];
  }
}

/** Calcula el espacio total en bytes que ocupan las grabaciones en el teléfono. */
export function calcularEspacioAudio(): { totalBytes: number; totalClases: number } {
  let totalBytes = 0;
  const sesiones = listarSesiones();
  for (const s of sesiones) {
    for (const f of s.fragmentos) {
      try {
        const arch = archivoFragmento(s, f.archivo);
        if (arch.exists) totalBytes += arch.size;
      } catch {
        // omitir errores de lectura
      }
    }
  }
  return { totalBytes, totalClases: sesiones.length };
}

/** Permite reintentar un fragmento individual que falló. */
export async function reintentarFragmento(sesionId: string, orden: number): Promise<void> {
  const s = obtenerSesion(sesionId);
  if (!s) return;
  const f = s.fragmentos.find((frag) => frag.orden === orden);
  if (!f) return;
  f.estado = 'pendiente';
  f.ultimoError = undefined;
  f.intentos = 0;
  await guardarSesion(s);
}
