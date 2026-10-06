// Grabadora de la app. Igual que la web: cada fragmento de SEGMENTO_SEGUNDOS se sube a la base al cortarse.
// La grabación se registra en cargas_audio al empezar, así lo ya subido queda recuperable si algo se corta.
// La grabadora vive en la raíz de la app: cambiar de pestaña no la corta.

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  type RecordingStatus,
} from 'expo-audio';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { SEGMENTO_SEGUNDOS } from '../config';
import { nombrePendiente, ponerEnPendientes } from '../outbox';
import { despertarCola, subirPendientes } from '../cola';
import { actualizarCarga, crearCarga, leerCargas } from '../supabase';
import type { Carga } from '../tipos';
import { AvisoError, avisoDe, detalleTecnico } from '../util';

export type Fase = 'inactiva' | 'preparando' | 'grabando' | 'cortando' | 'pausada';

export type DatosNuevaClase = {
  materiaId: string | null;
  materiaNombre: string;
  claseNum: number;
  tema: string;
};

export type ValorGrabacion = {
  fase: Fase;
  cargaId: string | null;
  etiqueta: string;
  segundos: number;
  aviso: string | null;
  iniciar: (datos: DatosNuevaClase) => Promise<void>;
  pausar: () => Promise<void>;
  reanudar: () => Promise<void>;
  terminar: () => Promise<void>;
  continuar: (carga: Carga) => Promise<void>;
  limpiarAviso: () => void;
};

const Contexto = createContext<ValorGrabacion | null>(null);
const ETIQUETA_PANTALLA = 'psi-grabacion';

function nuevoId(): string {
  return `grab_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

async function modoGrabacion(): Promise<void> {
  await setAudioModeAsync({
    allowsRecording: true,
    playsInSilentMode: true,
    allowsBackgroundRecording: true,
    interruptionMode: 'doNotMix',
  });
}

export function GrabacionProvider({ children }: { children: React.ReactNode }) {
  const [fase, setFaseEstado] = useState<Fase>('inactiva');
  const [cargaId, setCargaId] = useState<string | null>(null);
  const [etiqueta, setEtiqueta] = useState('');
  const [segundos, setSegundos] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);

  const faseRef = useRef<Fase>('inactiva');
  const cargaRef = useRef<{ id: string } | null>(null);
  const ordenRef = useRef(0);
  const segundosBaseRef = useRef(0);
  const corteRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const relojRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cadenaRef = useRef<Promise<void>>(Promise.resolve());

  const alCambiarEstado = (estado: RecordingStatus) => {
    if (estado.hasError && estado.error) {
      console.warn('[PsiEstudio] micrófono', estado.error);
      setAviso('Hubo un problema con el micrófono. Probá de nuevo.');
    }
  };
  const grabadora = useAudioRecorder(RecordingPresets.HIGH_QUALITY, alCambiarEstado);
  const grabadoraRef = useRef(grabadora);
  useEffect(() => {
    grabadoraRef.current = grabadora;
  });

  const setFase = (f: Fase) => {
    faseRef.current = f;
    setFaseEstado(f);
  };

  /** Todo corre en serie: un toque del usuario nunca pisa un corte automático. */
  const enSerie = (fn: () => Promise<void>): Promise<void> => {
    const siguiente = cadenaRef.current.catch(() => undefined).then(fn);
    cadenaRef.current = siguiente.catch(() => undefined);
    return siguiente;
  };

  const detenerReloj = () => {
    if (relojRef.current) {
      clearInterval(relojRef.current);
      relojRef.current = null;
    }
  };

  const iniciarReloj = () => {
    detenerReloj();
    relojRef.current = setInterval(() => {
      let actual = 0;
      try {
        actual = grabadoraRef.current.getStatus().durationMillis / 1000;
      } catch {
        actual = 0;
      }
      setSegundos(Math.floor(segundosBaseRef.current + actual));
    }, 1000);
  };

  const cancelarCorte = () => {
    if (corteRef.current) {
      clearTimeout(corteRef.current);
      corteRef.current = null;
    }
  };

  const programarCorte = () => {
    cancelarCorte();
    corteRef.current = setTimeout(() => {
      void enSerie(cortarYSeguir);
    }, SEGMENTO_SEGUNDOS * 1000);
  };

  const empezarTramo = async () => {
    const g = grabadoraRef.current;
    await g.prepareToRecordAsync();
    g.record();
    programarCorte();
  };

  /** Corta el tramo en curso, lo pasa a la cola de subida y lo sube. Nunca borra nada que no esté en la base. */
  const guardarTramo = async (): Promise<void> => {
    const g = grabadoraRef.current;
    const carga = cargaRef.current;
    cancelarCorte();
    if (!carga) return;
    let duracionMs = 0;
    try {
      duracionMs = g.getStatus().durationMillis;
    } catch {
      duracionMs = 0;
    }
    try {
      await g.stop();
    } catch {
      // ya estaba detenido por el sistema: el archivo igual queda
    }
    const uri = g.uri;
    if (!uri) return;
    ordenRef.current += 1;
    const orden = ordenRef.current;
    ponerEnPendientes(uri, nombrePendiente(carga.id, orden));
    segundosBaseRef.current += Math.round(duracionMs / 100) / 10;
    await subirPendientes();
  };

  const cortarYSeguir = async () => {
    if (faseRef.current !== 'grabando') return;
    setFase('cortando');
    try {
      await guardarTramo();
      if (cargaRef.current) {
        await empezarTramo();
        setFase('grabando');
      }
    } catch (e) {
      console.warn('[PsiEstudio] grabación interrumpida', detalleTecnico(e));
      setAviso('Se interrumpió la grabación. Lo grabado ya está guardado. Tocá Reanudar.');
      await pasarAPausa();
    }
  };

  const pasarAPausa = async () => {
    detenerReloj();
    cancelarCorte();
    setFase('pausada');
    void deactivateKeepAwake(ETIQUETA_PANTALLA);
  };

  const arrancar = async (carga: Carga) => {
    const permiso = await requestRecordingPermissionsAsync();
    if (!permiso.granted) throw new AvisoError('Sin permiso de micrófono. Habilitalo en Ajustes del teléfono, en PsiEstudio.');
    await modoGrabacion();
    cargaRef.current = { id: carga.id };
    setCargaId(carga.id);
    setEtiqueta(`${carga.materia} · Clase ${carga.clase_num}`);
    ordenRef.current = carga.archivos.length;
    segundosBaseRef.current = 0;
    setSegundos(0);
    setAviso(null);
    await activateKeepAwakeAsync(ETIQUETA_PANTALLA);
    await empezarTramo();
    setFase('grabando');
    iniciarReloj();
  };

  const fallarArranque = async (e: unknown) => {
    cargaRef.current = null;
    setCargaId(null);
    setFase('inactiva');
    void deactivateKeepAwake(ETIQUETA_PANTALLA);
    throw e;
  };

  const iniciar = (datos: DatosNuevaClase) =>
    enSerie(async () => {
      if (faseRef.current !== 'inactiva') throw new AvisoError('Ya hay una grabación en curso');
      setFase('preparando');
      const carga: Carga = {
        id: nuevoId(),
        origen: 'grabacion',
        nombre: `Grabación · ${datos.materiaNombre} · Clase ${datos.claseNum}`,
        materia: datos.materiaNombre,
        materia_id: datos.materiaId,
        clase_num: datos.claseNum,
        tema: datos.tema,
        archivos: [],
        partes: {},
        partes_listas: 0,
        partes_total: 0,
        estado: 'grabando',
        error: null,
        apunte_id: null,
        created_at: new Date().toISOString(),
      };
      try {
        await crearCarga(carga); // sin registro en la base no se graba
      } catch (e) {
        await fallarArranque(new AvisoError(avisoDe('No se pudo empezar la clase', e)));
        return;
      }
      try {
        await arrancar(carga);
      } catch (e) {
        await actualizarCarga(carga.id, { estado: 'error', error: 'La grabación no arrancó' }).catch(() => undefined);
        await fallarArranque(new AvisoError(avisoDe('No se pudo empezar la clase', e)));
      }
    });

  const continuar = (carga: Carga) =>
    enSerie(async () => {
      if (faseRef.current !== 'inactiva') throw new AvisoError('Ya hay una grabación en curso');
      setFase('preparando');
      try {
        await actualizarCarga(carga.id, { estado: 'grabando', error: null });
        await arrancar(carga);
      } catch (e) {
        await fallarArranque(new AvisoError(avisoDe('No se pudo continuar la clase', e)));
      }
    });

  const pausar = () =>
    enSerie(async () => {
      if (faseRef.current !== 'grabando') return;
      setFase('cortando');
      try {
        await guardarTramo();
      } catch (e) {
        setAviso(avisoDe('No se pudo guardar el último tramo. Queda en el teléfono', e));
      }
      await pasarAPausa();
    });

  const reanudar = () =>
    enSerie(async () => {
      if (faseRef.current !== 'pausada' || !cargaRef.current) return;
      setFase('preparando');
      try {
        await modoGrabacion();
        await activateKeepAwakeAsync(ETIQUETA_PANTALLA);
        await empezarTramo();
        setFase('grabando');
        setAviso(null);
        iniciarReloj();
      } catch (e) {
        setAviso(avisoDe('No se pudo reanudar la grabación', e));
        await pasarAPausa();
      }
    });

  const terminar = () =>
    enSerie(async () => {
      const carga = cargaRef.current;
      if (!carga) return;
      if (faseRef.current === 'grabando' || faseRef.current === 'cortando') {
        setFase('cortando');
        try {
          await guardarTramo();
        } catch (e) {
          setAviso(avisoDe('No se pudo guardar el último tramo', e));
        }
      }
      detenerReloj();
      cancelarCorte();
      try {
        await subirPendientes();
        const [registro] = await leerCargas({ ids: [carga.id], conPartes: false, limite: 1 });
        const subidos = registro ? registro.archivos.length : 0;
        if (subidos === 0) {
          await actualizarCarga(carga.id, { estado: 'error', error: 'No se grabó audio' });
        } else {
          await actualizarCarga(carga.id, { estado: 'pendiente', error: null });
        }
      } catch (e) {
        console.warn('[PsiEstudio] cierre de clase', detalleTecnico(e));
        setAviso('La clase quedó guardada en el teléfono. Se va a enviar sola cuando haya conexión.');
      }
      cargaRef.current = null;
      setCargaId(null);
      setFase('inactiva');
      setSegundos(0);
      void deactivateKeepAwake(ETIQUETA_PANTALLA);
      despertarCola();
    });

  // Si la app vuelve del fondo y el sistema cortó el micrófono, se sube lo grabado y queda en pausa.
  useEffect(() => {
    const suscripcion = AppState.addEventListener('change', (estadoApp) => {
      if (estadoApp !== 'active') return;
      if (faseRef.current !== 'grabando') return;
      let sigue = true;
      try {
        sigue = grabadoraRef.current.getStatus().isRecording;
      } catch {
        sigue = false;
      }
      if (sigue) return;
      void enSerie(async () => {
        if (faseRef.current !== 'grabando') return;
        setFase('cortando');
        try {
          await guardarTramo();
        } catch (e) {
          setAviso(avisoDe('No se pudo guardar el último tramo', e));
        }
        await pasarAPausa();
        setAviso('El teléfono detuvo la grabación porque la app estaba en segundo plano. Lo grabado ya está guardado. Tocá Reanudar.');
      });
    });
    return () => {
      suscripcion.remove();
      detenerReloj();
      cancelarCorte();
    };
    // Solo usa refs: no depende de estado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const limpiarAviso = () => setAviso(null);

  const valor = useMemo<ValorGrabacion>(
    () => ({ fase, cargaId, etiqueta, segundos, aviso, iniciar, pausar, reanudar, terminar, continuar, limpiarAviso }),
    // Las funciones solo usan refs: alcanza con el estado visible.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fase, cargaId, etiqueta, segundos, aviso],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useGrabacion(): ValorGrabacion {
  const v = useContext(Contexto);
  if (!v) throw new Error('useGrabacion debe usarse dentro de GrabacionProvider');
  return v;
}
