import { useMemo, useSyncExternalStore } from 'react';
import { listarSesiones, suscribirSesiones, versionSesiones } from './almacen';
import type { Sesion } from './tipos';

/** Lista de clases grabadas, que se actualiza sola cuando cambia cualquier sesión. */
export function useSesiones(): Sesion[] {
  const version = useSyncExternalStore(suscribirSesiones, versionSesiones, versionSesiones);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- version es el número de versión externo que invalida la lista
  return useMemo(() => listarSesiones(), [version]);
}
