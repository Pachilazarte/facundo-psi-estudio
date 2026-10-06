import { useEffect, useState, useSyncExternalStore } from 'react';
import { avisarCambioCargas, estadoCola, suscribirCola, versionDeCargas, type EstadoCola } from './cola';
import { leerCargas } from './supabase';
import type { Carga } from './tipos';

export function useCola(): EstadoCola {
  return useSyncExternalStore(suscribirCola, estadoCola, estadoCola);
}

/** Lista de cargas leída de la base. Se vuelve a leer cuando cambia la cola o la lista. */
export function useCargas(): Carga[] {
  const version = useSyncExternalStore(suscribirCola, versionDeCargas, versionDeCargas);
  const cola = useCola();
  const [cargas, setCargas] = useState<Carga[]>([]);

  useEffect(() => {
    let vivo = true;
    leerCargas({ conPartes: false, limite: 30 })
      .then((c) => {
        if (vivo) setCargas(c);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [version, cola.fragmentosSinSubir, cola.transcribiendo, cola.parte]);

  return cargas;
}

export { avisarCambioCargas };
