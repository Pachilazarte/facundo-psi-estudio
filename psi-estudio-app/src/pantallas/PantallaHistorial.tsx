// Historial: las desgrabaciones guardadas. Para cada una: ver texto, escuchar el audio, copiar y descargar.
// Es la misma lista que muestra la web: clases desgrabadas y las desgrabaciones viejas de Apuntes.

import { Feather } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Boton } from '../componentes/Boton';
import { useCola } from '../hooks';
import { leerApuntesDesgrabados, leerCargas, urlFirmada } from '../supabase';
import { TOQUE_MINIMO, tema } from '../tema';
import type { Carga, ParteDesgrabada } from '../tipos';
import { avisoDe, detalleTecnico, fechaLegible, formatearTiempo, marcaDeTiempo } from '../util';

type Item = {
  id: string;
  materia: string;
  clase: number | null;
  tema: string;
  fecha: string;
  texto: string;
  archivos: string[];
};

/** Texto de la desgrabación con marcas de tiempo corridas, igual que la web. */
function armarTexto(carga: { materia: string; clase_num: number; tema: string }, partes: Record<string, ParteDesgrabada>, total: number): string {
  const lineas = [`DESGRABACIÓN: ${carga.materia} - CLASE #${carga.clase_num}`];
  if (carga.tema) lineas.push(`Tema: ${carga.tema}`);
  lineas.push('');
  let acumulado = 0;
  for (let i = 0; i < total; i++) {
    const r = partes[i];
    if (!r) continue;
    const segs = (r.segments || []).filter((s) => (s.text || '').trim());
    if (segs.length > 0) {
      segs.forEach((s) => lineas.push(`[${marcaDeTiempo(acumulado + s.start)}] ${s.text.trim()}`));
    } else if ((r.text || '').trim()) {
      lineas.push(`[${marcaDeTiempo(acumulado)}] ${r.text.trim()}`);
    }
    acumulado += r.duration || 0;
  }
  return lineas.join('\n');
}

/** Reproduce las partes del audio una tras otra. Cada parte se pide con un enlace temporal. */
function Reproductor({ archivos }: { archivos: string[] }) {
  const [indice, setIndice] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const player = useAudioPlayer(null);
  const estado = useAudioPlayerStatus(player);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => undefined);
  }, []);

  useEffect(() => {
    let vivo = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- al cambiar de parte se limpia el enlace anterior
    setError(null);
    setUrl(null);
    urlFirmada(archivos[indice])
      .then((u) => {
        if (vivo) setUrl(u);
      })
      .catch((e) => {
        if (vivo) setError(avisoDe('No se pudo cargar el audio', e));
      });
    return () => {
      vivo = false;
    };
  }, [indice, archivos]);

  useEffect(() => {
    if (!url) return;
    player.replace({ uri: url });
    player.play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- el reproductor avisó que terminó la parte
    if (estado.didJustFinish && indice + 1 < archivos.length) setIndice(indice + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.didJustFinish]);

  const hayMas = indice + 1 < archivos.length;

  return (
    <View style={styles.reproductor}>
      <Text style={styles.textoSuave}>
        Parte {indice + 1} de {archivos.length} · {formatearTiempo(estado.currentTime)} / {formatearTiempo(estado.duration)}
      </Text>
      {error ? <Text style={styles.textoError}>{error}</Text> : null}
      <View style={styles.filaBotones}>
        <Boton
          texto={estado.playing ? 'Pausar' : 'Reproducir'}
          icono={estado.playing ? 'pause' : 'play'}
          variante="principal"
          onPress={() => (estado.playing ? player.pause() : player.play())}
          disabled={!url}
          cargando={!url && !error}
          style={styles.flexible}
        />
        <Boton texto="Siguiente parte" icono="skip-forward" onPress={() => setIndice(indice + 1)} disabled={!hayMas} style={styles.flexible} />
      </View>
    </View>
  );
}

export function PantallaHistorial({ visible }: { visible: boolean }) {
  const cola = useCola();
  const [items, setItems] = useState<Item[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [escuchando, setEscuchando] = useState<string | null>(null);
  const [filtro, setFiltro] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [cargas, apuntes] = await Promise.all([
        leerCargas({ estados: ['completada'], conPartes: true, limite: 100 }),
        leerApuntesDesgrabados(),
      ]);
      const lista: Item[] = cargas.map((c: Carga) => ({
        id: c.id,
        materia: c.materia,
        clase: c.clase_num,
        tema: c.tema,
        fecha: c.created_at,
        texto: armarTexto(c, c.partes, c.archivos.length),
        archivos: c.archivos,
      }));
      apuntes.forEach((a) =>
        lista.push({ id: a.id, materia: a.materia, clase: null, tema: a.titulo, fecha: a.created_at, texto: a.contenido || '', archivos: [] }),
      );
      lista.sort((x, y) => y.fecha.localeCompare(x.fecha));
      setItems(lista);
      setError(null);
    } catch (e) {
      setError(avisoDe('No se pudo cargar el Historial', e));
    } finally {
      setCargando(false);
    }
  }, []);

  // Se vuelve a leer al abrir la pestaña y cuando termina una desgrabación.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- la lista se carga al abrir la pestaña
    if (visible) void cargar();
  }, [visible, cargar, cola.transcribiendo]);

  const filtrados = items.filter((it) => {
    if (!filtro.trim()) return true;
    const f = filtro.trim().toLowerCase();
    return it.materia.toLowerCase().includes(f) || (it.tema || '').toLowerCase().includes(f);
  });

  const copiar = async (texto: string) => {
    await Clipboard.setStringAsync(texto);
    Alert.alert('Copiado', 'El texto de la desgrabación está en el portapapeles.');
  };

  const descargar = async (item: Item) => {
    const nombre = `Desgrabacion_${item.materia.replace(/[^\w-]+/g, '_')}_Clase${item.clase ?? ''}.txt`;
    const archivo = new File(Paths.cache, nombre);
    try {
      if (archivo.exists) archivo.delete();
      archivo.create({ overwrite: true });
      archivo.write(item.texto);
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('No disponible', 'Este teléfono no permite guardar archivos. Usá Copiar.');
        return;
      }
      await Sharing.shareAsync(archivo.uri, { mimeType: 'text/plain', dialogTitle: 'Guardar desgrabación' });
    } catch (e) {
      console.warn('[PsiEstudio] descarga', detalleTecnico(e));
      Alert.alert('No se pudo descargar', avisoDe('No se pudo descargar la desgrabación', e));
    } finally {
      if (archivo.exists) archivo.delete();
    }
  };

  return (
    <View style={[styles.contenedor, !visible && styles.oculta]}>
      <ScrollView
        contentContainerStyle={styles.contenido}
        refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} tintColor={tema.acentoIcono} />}
      >
        <Text style={styles.titulo}>Historial de desgrabaciones</Text>
        <View style={styles.buscador}>
          <Feather name="search" size={18} color={tema.textoSuave} />
          <TextInput
            value={filtro}
            onChangeText={setFiltro}
            placeholder="Buscar por materia o tema"
            placeholderTextColor={tema.textoSuave}
            style={styles.entrada}
            autoCapitalize="none"
          />
        </View>
        {error ? <Text style={styles.textoError}>{error}</Text> : null}
        {cargando && items.length === 0 ? <ActivityIndicator color={tema.acentoIcono} /> : null}
        {!cargando && filtrados.length === 0 && !error ? (
          <Text style={styles.textoSuave}>
            {items.length === 0
              ? 'Todavía no hay desgrabaciones. Grabá una clase o subí un audio desde la web.'
              : 'Ninguna desgrabación coincide con la búsqueda.'}
          </Text>
        ) : null}

        {filtrados.map((it) => (
          <View key={it.id} style={styles.tarjeta}>
            <Text style={styles.filaTitulo}>
              {it.materia}
              {it.clase ? ` · Clase #${it.clase}` : ''}
            </Text>
            <Text style={styles.textoSuave}>
              {it.tema || 'Sin tema'} · {fechaLegible(it.fecha)}
            </Text>

            {escuchando === it.id && it.archivos.length > 0 ? <Reproductor archivos={it.archivos} /> : null}
            {abierto === it.id ? (
              <Text style={styles.texto} selectable>
                {it.texto}
              </Text>
            ) : null}

            <View style={styles.filaBotones}>
              {it.archivos.length > 0 ? (
                <Boton
                  texto={escuchando === it.id ? 'Cerrar audio' : 'Escuchar'}
                  icono={escuchando === it.id ? 'x' : 'headphones'}
                  onPress={() => setEscuchando(escuchando === it.id ? null : it.id)}
                  style={styles.flexible}
                />
              ) : null}
              <Boton
                texto={abierto === it.id ? 'Ocultar texto' : 'Ver texto'}
                icono={abierto === it.id ? 'chevron-up' : 'file-text'}
                onPress={() => setAbierto(abierto === it.id ? null : it.id)}
                style={styles.flexible}
              />
            </View>
            <View style={styles.filaBotones}>
              <Boton texto="Copiar" icono="copy" variante="principal" onPress={() => void copiar(it.texto)} style={styles.flexible} />
              <Boton texto="Descargar" icono="download" onPress={() => void descargar(it)} style={styles.flexible} />
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: tema.fondo },
  oculta: { display: 'none' },
  contenido: { padding: 16, gap: 14, paddingBottom: 40 },
  titulo: { color: tema.texto, fontSize: 19, fontWeight: '800' },
  buscador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.borde,
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: TOQUE_MINIMO,
  },
  entrada: { flex: 1, color: tema.texto, fontSize: 15, paddingVertical: 10 },
  tarjeta: {
    backgroundColor: tema.superficie,
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: tema.borde,
  },
  filaTitulo: { color: tema.texto, fontWeight: '700', fontSize: 16 },
  texto: {
    color: tema.texto,
    fontSize: 14,
    lineHeight: 21,
    backgroundColor: tema.superficieSuave,
    padding: 12,
    borderRadius: 10,
  },
  reproductor: { backgroundColor: tema.superficieSuave, borderRadius: 12, padding: 12, gap: 10 },
  filaBotones: { flexDirection: 'row', gap: 8 },
  flexible: { flex: 1 },
  textoSuave: { color: tema.textoSuave, fontSize: 13, lineHeight: 19 },
  textoError: { color: tema.error, fontSize: 14, fontWeight: '600' },
});
