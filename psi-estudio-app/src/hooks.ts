import { useMemo, useSyncExternalStore } from 'react';
import { listarSesiones, suscribirSesiones, versionSesiones } from './almacen';
import type { Sesion } from './tipos';

/** Lista de clases grabadas, que se actualiza sola cuando cambia cualquier sesión. */
export function useSesiones(): Sesion[] {
  const version = useSyncExternalStore(suscribirSesiones, versionSesiones, versionSesiones);
  return useMemo(() => listarSesiones(), [version]);
}
