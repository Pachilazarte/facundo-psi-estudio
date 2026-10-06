import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { archivoFragmento, reintentarFragmento } from '../almacen';
import { armarContenido, reintentarAhora } from '../transcripcion';
import type { Fragmento, Sesion } from '../tipos';
import { fechaLegible, formatearBytes, formatearTiempo, mensajeDeError } from '../util';

export function DetalleSesion({
  sesion,
  onVolver,
  puedeContinuar,
  onContinuar,
}: {
  sesion: Sesion;
  onVolver: () => void;
  puedeContinuar: boolean;
  onContinuar: () => void;
}) {
  const [pestaña, setPestaña] = useState<'texto' | 'audio'>('texto');
  const [indiceActual, setIndiceActual] = useState(0);

  const fragmentosOrdenados = [...sesion.fragmentos].sort((a, b) => a.orden - b.orden);
  const fragActual = fragmentosOrdenados[indiceActual] ?? null;
  const archActual = fragActual ? archivoFragmento(sesion, fragActual.archivo) : null;
  const source = archActual && archActual.exists ? { uri: archActual.uri } : null;

  const player = useAudioPlayer(source);
  const status = useAudioPlayerStatus(player);

  // Al cambiar de fragmento, actualiza la fuente en el reproductor
  useEffect(() => {
    if (fragActual) {
      const arch = archivoFragmento(sesion, fragActual.archivo);
      if (arch.exists) {
        player.replace({ uri: arch.uri });
      }
    }
  }, [indiceActual, fragActual, player, sesion]);

  // Avance automático al terminar un fragmento suscrito al evento de reproducción
  useEffect(() => {
    const sub = player.addListener('playbackStatusUpdate', (st) => {
      if (st.didJustFinish) {
        setIndiceActual((i) => (i < fragmentosOrdenados.length - 1 ? i + 1 : i));
      }
    });
    return () => {
      sub.remove();
    };
  }, [player, fragmentosOrdenados.length]);

  const toggleReproduccion = () => {
    if (status.playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  const saltarA = (nuevoIndice: number) => {
    if (nuevoIndice >= 0 && nuevoIndice < fragmentosOrdenados.length) {
      setIndiceActual(nuevoIndice);
    }
  };

  const compartirTexto = async () => {
    try {
      const disponible = await Sharing.isAvailableAsync();
      if (!disponible) {
        Alert.alert('No disponible', 'La función de compartir no está disponible en este dispositivo.');
        return;
      }
      const contenido = armarContenido(sesion);
      const nombreArchivo = `desgrabacion_${sesion.id}.txt`;
      const tempFile = new File(Paths.cache, nombreArchivo);
      tempFile.create({ intermediates: true, overwrite: true });
      tempFile.write(contenido);
      await Sharing.shareAsync(tempFile.uri, {
        mimeType: 'text/plain',
        dialogTitle: `Compartir desgrabación de ${sesion.materiaNombre}`,
        UTI: 'public.plain-text',
      });
    } catch (e) {
      Alert.alert('Error al compartir texto', mensajeDeError(e));
    }
  };

  const compartirAudio = async (f: Fragmento) => {
    try {
      const disponible = await Sharing.isAvailableAsync();
      if (!disponible) {
        Alert.alert('No disponible', 'La función de compartir no está disponible.');
        return;
      }
      const arch = archivoFragmento(sesion, f.archivo);
      if (!arch.exists) {
        Alert.alert('Audio no encontrado', 'El archivo no está en el teléfono.');
        return;
      }
      await Sharing.shareAsync(arch.uri, {
        mimeType: 'audio/mp4',
        dialogTitle: `Compartir audio tramo ${f.orden}`,
        UTI: 'public.audio',
      });
    } catch (e) {
      Alert.alert('Error al compartir audio', mensajeDeError(e));
    }
  };

  const handleReintentarFragmento = async (orden: number) => {
    await reintentarFragmento(sesion.id, orden);
    reintentarAhora();
  };

  const duracionTotal = fragmentosOrdenados.reduce((acc, f) => acc + (f.duracionSeg || 0), 0);
  const totalListos = fragmentosOrdenados.filter((f) => f.estado === 'transcripto').length;
  const textoDesgrabacion = armarContenido(sesion);

  return (
    <View style={styles.contenedor}>
      {/* Barra superior con volver */}
      <View style={styles.barraSuperior}>
        <TouchableOpacity onPress={onVolver} style={styles.botonVolver}>
          <Text style={styles.botonVolverTexto}>← Volver</Text>
        </TouchableOpacity>
        <Text numberOfLines={1} style={styles.barraTitulo}>
          {sesion.materiaNombre} · #{sesion.claseNum}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.contenido}>
        {/* Cabecera de la sesión */}
        <View style={styles.tarjetaEncabezado}>
          <Text style={styles.materiaBadge}>{sesion.materiaNombre}</Text>
          <Text style={styles.tituloClase}>
            Clase #{sesion.claseNum}{sesion.tema ? `: ${sesion.tema}` : ''}
          </Text>
          <Text style={styles.subtituloMeta}>
            {fechaLegible(sesion.creadoEn)} · Duración: {formatearTiempo(duracionTotal)}
          </Text>
          <Text style={styles.subtituloMeta}>
            Fragmentos: {totalListos} de {fragmentosOrdenados.length} transcriptos · Estado: {sesion.estado}
          </Text>

          {puedeContinuar ? (
            <TouchableOpacity onPress={onContinuar} style={styles.botonContinuar}>
              <Text style={styles.botonContinuarTexto}>Continuar grabando esta clase</Text>
            </TouchableOpacity>
          ) : null}

          {/* Acciones principales */}
          <View style={styles.filaAcciones}>
            <TouchableOpacity onPress={compartirTexto} style={styles.botonAccion}>
              <Text style={styles.botonAccionTexto}>📤 Compartir texto</Text>
            </TouchableOpacity>
            {fragmentosOrdenados.some((f) => f.estado === 'error' || f.estado === 'pendiente') ? (
              <TouchableOpacity onPress={() => reintentarAhora()} style={[styles.botonAccion, styles.botonReintentar]}>
                <Text style={styles.botonAccionTexto}>🔄 Reintentar cola</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Reproductor de audio fijo */}
        {fragmentosOrdenados.length > 0 ? (
          <View style={styles.tarjetaReproductor}>
            <Text style={styles.reproductorTitulo}>
              Reproduciendo Fragmento {fragActual ? fragActual.orden : 0} de {fragmentosOrdenados.length}
            </Text>
            <View style={styles.controlesReproductor}>
              <TouchableOpacity
                onPress={() => saltarA(indiceActual - 1)}
                disabled={indiceActual <= 0}
                style={[styles.botonControl, indiceActual <= 0 && styles.botonDeshabilitado]}
              >
                <Text style={styles.controlTexto}>⏮</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={toggleReproduccion} style={styles.botonPlay}>
                <Text style={styles.playTexto}>{status.playing ? '⏸' : '▶'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => saltarA(indiceActual + 1)}
                disabled={indiceActual >= fragmentosOrdenados.length - 1}
                style={[styles.botonControl, indiceActual >= fragmentosOrdenados.length - 1 && styles.botonDeshabilitado]}
              >
                <Text style={styles.controlTexto}>⏭</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.filaTiempo}>
              <Text style={styles.tiempoTexto}>{formatearTiempo(status.currentTime)}</Text>
              <Text style={styles.tiempoTexto}>
                {formatearTiempo(status.duration || (fragActual?.duracionSeg ?? 0))}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Selector de pestañas */}
        <View style={styles.selectorPestanas}>
          <TouchableOpacity
            onPress={() => setPestaña('texto')}
            style={[styles.botonPestaña, pestaña === 'texto' && styles.botonPestañaActiva]}
          >
            <Text style={[styles.textoPestaña, pestaña === 'texto' && styles.textoPestañaActiva]}>
              Desgrabación
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setPestaña('audio')}
            style={[styles.botonPestaña, pestaña === 'audio' && styles.botonPestañaActiva]}
          >
            <Text style={[styles.textoPestaña, pestaña === 'audio' && styles.textoPestañaActiva]}>
              Fragmentos ({fragmentosOrdenados.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Contenido según pestaña */}
        {pestaña === 'texto' ? (
          <View style={styles.tarjetaTexto}>
            <Text selectable style={styles.cuerpoDesgrabacion}>
              {textoDesgrabacion}
            </Text>
          </View>
        ) : (
          <View style={styles.listaFragmentos}>
            {fragmentosOrdenados.map((f, idx) => {
              const arch = archivoFragmento(sesion, f.archivo);
              const tamano = arch.exists ? formatearBytes(arch.size) : '0 B';
              const seleccionado = idx === indiceActual;
              return (
                <View key={f.orden} style={[styles.itemFragmento, seleccionado && styles.itemSeleccionado]}>
                  <View style={styles.infoFragmento}>
                    <Text style={styles.numeroFragmento}>Fragmento #{f.orden}</Text>
                    <Text style={styles.duracionFragmento}>
                      {formatearTiempo(f.duracionSeg)} · {tamano}
                    </Text>
                    <Text
                      style={[
                        styles.estadoFragmento,
                        f.estado === 'transcripto' && styles.estadoOk,
                        f.estado === 'error' && styles.estadoError,
                      ]}
                    >
                      {f.estado === 'transcripto'
                        ? 'Transcripto'
                        : f.estado === 'error'
                          ? `Error: ${f.ultimoError || 'falló envío'}`
                          : 'Pendiente en cola'}
                    </Text>
                  </View>

                  <View style={styles.accionesFragmento}>
                    <TouchableOpacity
                      onPress={() => {
                        setIndiceActual(idx);
                        player.play();
                      }}
                      style={styles.botonMini}
                    >
                      <Text style={styles.botonMiniTexto}>{seleccionado && status.playing ? 'Pausar' : 'Escuchar'}</Text>
                    </TouchableOpacity>
                    {arch.exists ? (
                      <TouchableOpacity onPress={() => void compartirAudio(f)} style={styles.botonMini}>
                        <Text style={styles.botonMiniTexto}>Exportar</Text>
                      </TouchableOpacity>
                    ) : null}
                    {f.estado === 'error' ? (
                      <TouchableOpacity
                        onPress={() => void handleReintentarFragmento(f.orden)}
                        style={[styles.botonMini, styles.botonReintentarMini]}
                      >
                        <Text style={styles.botonMiniTexto}>Reintentar</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: '#0b0f14' },
  barraSuperior: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2f40',
    backgroundColor: '#0b0f14',
    gap: 12,
  },
  botonVolver: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#1e2a38',
    borderRadius: 8,
  },
  botonVolverTexto: { color: '#34d399', fontWeight: '700', fontSize: 14 },
  barraTitulo: { color: '#e6edf3', fontSize: 15, fontWeight: '700', flex: 1 },
  contenido: { padding: 14, gap: 12, paddingBottom: 40 },
  tarjetaEncabezado: {
    backgroundColor: '#121a24',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f2f40',
    gap: 6,
  },
  materiaBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#06261b',
    color: '#34d399',
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    textTransform: 'uppercase',
  },
  tituloClase: { color: '#e6edf3', fontSize: 18, fontWeight: '800', marginTop: 4 },
  subtituloMeta: { color: '#8b98a5', fontSize: 12 },
  filaAcciones: { flexDirection: 'row', gap: 10, marginTop: 8 },
  botonAccion: {
    flex: 1,
    backgroundColor: '#1e2a38',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  botonReintentar: { backgroundColor: '#78350f' },
  botonAccionTexto: { color: '#e6edf3', fontSize: 13, fontWeight: '700' },
  botonContinuar: {
    backgroundColor: '#10b981',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  botonContinuarTexto: { color: 'white', fontWeight: '800', fontSize: 14 },
  tarjetaReproductor: {
    backgroundColor: '#16222f',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#243b53',
    gap: 8,
  },
  reproductorTitulo: { color: '#94a3b8', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  controlesReproductor: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 20 },
  botonControl: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1e2a38',
    justifyContent: 'center',
    alignItems: 'center',
  },
  botonDeshabilitado: { opacity: 0.3 },
  controlTexto: { color: '#e6edf3', fontSize: 18 },
  botonPlay: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playTexto: { color: 'white', fontSize: 22, fontWeight: '800' },
  filaTiempo: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6 },
  tiempoTexto: { color: '#8b98a5', fontSize: 11, fontFamily: 'monospace' },
  selectorPestanas: { flexDirection: 'row', backgroundColor: '#121a24', borderRadius: 10, padding: 4, gap: 4 },
  botonPestaña: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  botonPestañaActiva: { backgroundColor: '#1e2a38' },
  textoPestaña: { color: '#8b98a5', fontSize: 13, fontWeight: '600' },
  textoPestañaActiva: { color: '#e6edf3', fontWeight: '700' },
  tarjetaTexto: {
    backgroundColor: '#121a24',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f2f40',
  },
  cuerpoDesgrabacion: { color: '#e6edf3', fontSize: 13, lineHeight: 22, fontFamily: 'monospace' },
  listaFragmentos: { gap: 8 },
  itemFragmento: {
    backgroundColor: '#121a24',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1f2f40',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemSeleccionado: { borderColor: '#10b981', backgroundColor: '#142525' },
  infoFragmento: { flex: 1, gap: 2 },
  numeroFragmento: { color: '#e6edf3', fontSize: 14, fontWeight: '700' },
  duracionFragmento: { color: '#8b98a5', fontSize: 11 },
  estadoFragmento: { color: '#f59e0b', fontSize: 11, fontWeight: '600' },
  estadoOk: { color: '#34d399' },
  estadoError: { color: '#ef4444' },
  accionesFragmento: { flexDirection: 'row', gap: 6 },
  botonMini: {
    backgroundColor: '#1e2a38',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  botonReintentarMini: { backgroundColor: '#78350f' },
  botonMiniTexto: { color: '#e6edf3', fontSize: 11, fontWeight: '700' },
});
