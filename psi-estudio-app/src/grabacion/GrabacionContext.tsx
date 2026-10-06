// La grabadora vive acá, en la raíz de la app, para que seguir navegando no la corte.
// Graba en fragmentos de SEGMENTO_SEGUNDOS: cada corte guarda un archivo en el teléfono y lo manda a la cola.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
import { crearSesion, guardarSesion, moverGrabacionASesion, obtenerSesion } from '../almacen';
import { despertar } from '../transcripcion';
import type { Sesion } from '../tipos';
import { mensajeDeError } from '../util';

export type Fase = 'inactiva' | 'preparando' | 'grabando' | 'cortando' | 'pausada';

export type DatosNuevaSesion = {
  materiaId: string | null;
  materiaNombre: string;
  claseNum: number;
  tema: string;
};

type ValorContexto = {
  fase: Fase;
  sesion: Sesion | null;
  segundos: number;
  aviso: string | null;
  iniciar: (datos: DatosNuevaSesion) => Promise<void>;
  continuar: (sesionId: string) => Promise<void>;
  pausar: () => Promise<void>;
  reanudar: () => Promise<void>;
  terminar: () => Promise<void>;
  limpiarAviso: () => void;
};

const Contexto = createContext<ValorContexto | null>(null);
const ETIQUETA_PANTALLA = 'psi-grabacion';

async function activarModoGrabacion(): Promise<void> {
  await setAudioModeAsync({
    allowsRecording: true,
    playsInSilentMode: true,
    allowsBackgroundRecording: true,
    interruptionMode: 'doNotMix',
  });
}

export function GrabacionProvider({ children }: { children: React.ReactNode }) {
  const [fase, setFaseEstado] = useState<Fase>('inactiva');
  const [sesion, setSesionEstado] = useState<Sesion | null>(null);
  const [segundos, setSegundos] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);

  const faseRef = useRef<Fase>('inactiva');
  const sesionRef = useRef<Sesion | null>(null);
  const ordenRef = useRef(0);
  const segundosBaseRef = useRef(0);
  const timerCorteRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const relojRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cadenaRef = useRef<Promise<void>>(Promise.resolve());

  const alCambiarEstado = useCallback((estado: RecordingStatus) => {
    if (estado.hasError && estado.error) setAviso(`Problema del grabador: ${estado.error}`);
    if (estado.mediaServicesDidReset) setAviso('El sistema reinició el audio. Si la grabación se detuvo, tocá Reanudar.');
  }, []);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY, alCambiarEstado);
  const recorderRef = useRef(recorder);
  recorderRef.current = recorder;

  const setFase = (f: Fase) => {
    faseRef.current = f;
    setFaseEstado(f);
  };
  const setSesion = (s: Sesion | null) => {
    sesionRef.current = s;
    setSesionEstado(s ? { ...s } : null);
  };
  const refrescarSesion = () => {
    const s = sesionRef.current;
    setSesionEstado(s ? { ...s } : null);
  };

  /** Todas las operaciones corren una detrás de otra: un toque del usuario nunca pisa un corte automático. */
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
        actual = recorderRef.current.getStatus().durationMillis / 1000;
      } catch {
        actual = 0;
      }
      setSegundos(Math.floor(segundosBaseRef.current + actual));
    }, 1000);
  };

  const cancelarCorteProgramado = () => {
    if (timerCorteRef.current) {
      clearTimeout(timerCorteRef.current);
      timerCorteRef.current = null;
    }
  };

  const programarCorte = () => {
    cancelarCorteProgramado();
    timerCorteRef.current = setTimeout(() => {
      void enSerie(cortarYSeguir);
    }, SEGMENTO_SEGUNDOS * 1000);
  };

  const empezarTramo = async () => {
    const rec = recorderRef.current;
    await rec.prepareToRecordAsync();
    rec.record();
    programarCorte();
  };

  /** Detiene el tramo en curso y lo guarda como fragmento de la sesión. Nunca borra nada. */
  const guardarTramo = async (): Promise<void> => {
    const rec = recorderRef.current;
    const s = sesionRef.current;
    cancelarCorteProgramado();
    if (!s) return;
    let duracionMs = 0;
    try {
      duracionMs = rec.getStatus().durationMillis;
    } catch {
      duracionMs = 0;
    }
    try {
      await rec.stop();
    } catch {
      // el sistema ya lo había detenido: el archivo igual queda
    }
    const uri = rec.uri;
    if (!uri) return;
    const orden = ordenRef.current + 1;
    const { archivo, bytes } = await moverGrabacionASesion(uri, s, orden);
    if (bytes <= 0) return;
    ordenRef.current = orden;
    const duracionSeg = Math.round(duracionMs / 100) / 10;
    s.fragmentos.push({ orden, archivo, duracionSeg, estado: 'pendiente', intentos: 0 });
    segundosBaseRef.current += duracionSeg;
    await guardarSesion(s);
    refrescarSesion();
    despertar();
  };

  const pasarAPausada = async () => {
    detenerReloj();
    cancelarCorteProgramado();
    const s = sesionRef.current;
    if (s) {
      s.estado = 'pausada';
      await guardarSesion(s);
    }
    setFase('pausada');
    refrescarSesion();
    void deactivateKeepAwake(ETIQUETA_PANTALLA);
  };

  const cortarYSeguir = async () => {
    if (faseRef.current !== 'grabando') return;
    setFase('cortando');
    try {
      await guardarTramo();
      // Todo corre en serie, así que nadie pudo cambiar la fase mientras se guardaba.
      if (sesionRef.current) {
        await empezarTramo();
        setFase('grabando');
      }
    } catch (e) {
      setAviso(`Se interrumpió la grabación: ${mensajeDeError(e)}. Lo grabado quedó guardado. Tocá Reanudar para seguir.`);
      await pasarAPausada();
    }
  };

  const arrancarConSesion = async (s: Sesion) => {
    const permiso = await requestRecordingPermissionsAsync();
    if (!permiso.granted) throw new Error('Sin permiso de micrófono. Habilitalo en Ajustes del iPhone, en PsiEstudio.');
    await activarModoGrabacion();
    s.estado = 'grabando';
    await guardarSesion(s);
    setSesion(s);
    ordenRef.current = s.fragmentos.reduce((max, f) => Math.max(max, f.orden), 0);
    segundosBaseRef.current = s.fragmentos.reduce((acc, f) => acc + (f.duracionSeg || 0), 0);
    setSegundos(Math.floor(segundosBaseRef.current));
    setAviso(null);
    await activateKeepAwakeAsync(ETIQUETA_PANTALLA);
    await empezarTramo();
    setFase('grabando');
    iniciarReloj();
  };

  const iniciar = (datos: DatosNuevaSesion) =>
    enSerie(async () => {
      if (faseRef.current !== 'inactiva') throw new Error('Ya hay una grabación en curso');
      setFase('preparando');
      try {
        await arrancarConSesion(crearSesion(datos));
      } catch (e) {
        setFase('inactiva');
        setSesion(null);
        void deactivateKeepAwake(ETIQUETA_PANTALLA);
        throw e;
      }
    });

  const continuar = (sesionId: string) =>
    enSerie(async () => {
      if (faseRef.current !== 'inactiva') throw new Error('Ya hay una grabación en curso');
      const s = obtenerSesion(sesionId);
      if (!s) throw new Error('No se encontró la clase en el teléfono');
      setFase('preparando');
      try {
        await arrancarConSesion(s);
      } catch (e) {
        setFase('inactiva');
        setSesion(null);
        void deactivateKeepAwake(ETIQUETA_PANTALLA);
        throw e;
      }
    });

  const pausar = () =>
    enSerie(async () => {
      if (faseRef.current !== 'grabando') return;
      setFase('cortando');
      try {
        await guardarTramo();
      } catch (e) {
        setAviso(`No se pudo guardar el último tramo: ${mensajeDeError(e)}`);
      }
      await pasarAPausada();
    });

  const reanudar = () =>
    enSerie(async () => {
      if (faseRef.current !== 'pausada' || !sesionRef.current) return;
      setFase('preparando');
      try {
        await activarModoGrabacion();
        await activateKeepAwakeAsync(ETIQUETA_PANTALLA);
        await empezarTramo();
        const s = sesionRef.current;
        s.estado = 'grabando';
        await guardarSesion(s);
        refrescarSesion();
        setFase('grabando');
        setAviso(null);
        iniciarReloj();
      } catch (e) {
        setAviso(`No se pudo reanudar: ${mensajeDeError(e)}`);
        await pasarAPausada();
      }
    });

  const terminar = () =>
    enSerie(async () => {
      const s = sesionRef.current;
      if (!s) return;
      if (faseRef.current === 'grabando') {
        setFase('cortando');
        try {
          await guardarTramo();
        } catch (e) {
          setAviso(`No se pudo guardar el último tramo: ${mensajeDeError(e)}`);
        }
      }
      detenerReloj();
      cancelarCorteProgramado();
      s.estado = 'terminada';
      // Fuerza un guardado final en PsiEstudio con el estado "completa" cuando terminen los fragmentos.
      if (s.fragmentos.length > 0) s.apuntePendiente = true;
      await guardarSesion(s);
      setSesion(null);
      setFase('inactiva');
      setSegundos(0);
      void deactivateKeepAwake(ETIQUETA_PANTALLA);
      try {
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      } catch {
        // no es grave
      }
      despertar();
    });

  const limpiarAviso = () => setAviso(null);

  // Si la app vuelve del fondo y iOS cortó el micrófono, se guarda lo grabado y queda en pausa (nunca se pierde).
  useEffect(() => {
    const suscripcion = AppState.addEventListener('change', (siguiente) => {
      if (siguiente !== 'active') return;
      despertar();
      if (faseRef.current !== 'grabando') return;
      let sigue = true;
      try {
        sigue = recorderRef.current.getStatus().isRecording;
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
          setAviso(`No se pudo guardar el último tramo: ${mensajeDeError(e)}`);
        }
        await pasarAPausada();
        setAviso('iOS detuvo la grabación mientras la app estaba en segundo plano. Lo grabado quedó guardado. Tocá Reanudar para seguir.');
      });
    });
    return () => {
      suscripcion.remove();
      detenerReloj();
      cancelarCorteProgramado();
    };
    // Solo usa refs: no depende de ningún estado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const valor = useMemo<ValorContexto>(
    () => ({ fase, sesion, segundos, aviso, iniciar, continuar, pausar, reanudar, terminar, limpiarAviso }),
    // Las funciones solo usan refs, así que alcanza con el estado visible.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fase, sesion, segundos, aviso],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useGrabacion(): ValorContexto {
  const valor = useContext(Contexto);
  if (!valor) throw new Error('useGrabacion debe usarse dentro de GrabacionProvider');
  return valor;
}
