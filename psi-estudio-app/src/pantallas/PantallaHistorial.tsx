// Historial: las desgrabaciones de la base, con ver texto, copiar y descargar.
// Es la misma lista que muestra la web: cargas completadas (y las desgrabaciones viejas de Apuntes).

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useCola } from '../hooks';
import { leerApuntesDesgrabados, leerCargas } from '../supabase';
import type { Carga, ParteDesgrabada } from '../tipos';
import { fechaLegible, marcaDeTiempo, mensajeDeError } from '../util';

type Item = { id: string; materia: string; clase: number | null; tema: string; fecha: string; texto: string };

/** Arma el texto de la desgrabación con marcas de tiempo corridas, igual que la web. */
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

export function PantallaHistorial({ visible }: { visible: boolean }) {
  const cola = useCola();
  const [items, setItems] = useState<Item[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);

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
      }));
      apuntes.forEach((a) => lista.push({ id: a.id, materia: a.materia, clase: null, tema: a.titulo, fecha: a.created_at, texto: a.contenido || '' }));
      lista.sort((x, y) => y.fecha.localeCompare(x.fecha));
      setItems(lista);
      setError(null);
    } catch (e) {
      setError(`No se pudo leer el Historial: ${mensajeDeError(e)}`);
    } finally {
      setCargando(false);
    }
  }, []);

  // Se vuelve a leer cuando se abre la pestaña y cuando termina una desgrabación.
  useEffect(() => {
    if (visible) void cargar();
  }, [visible, cargar, cola.transcribiendo]);

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
        Alert.alert('No disponible', 'Este teléfono no permite compartir archivos. Usá Copiar.');
        return;
      }
      await Sharing.shareAsync(archivo.uri, { mimeType: 'text/plain', dialogTitle: 'Guardar desgrabación' });
    } catch (e) {
      Alert.alert('No se pudo descargar', mensajeDeError(e));
    } finally {
      if (archivo.exists) archivo.delete();
    }
  };

  return (
    <View style={[styles.contenedor, !visible && styles.oculta]}>
      <ScrollView contentContainerStyle={styles.contenido}>
        <View style={styles.encabezado}>
          <Text style={styles.titulo}>Historial de desgrabaciones</Text>
          {cargando ? <ActivityIndicator color="#10b981" /> : null}
        </View>
        {error ? <Text style={styles.textoError}>{error}</Text> : null}
        {!cargando && items.length === 0 && !error ? (
          <Text style={styles.textoMuted}>Todavía no hay desgrabaciones. Grabá una clase o subí un audio desde la web.</Text>
        ) : null}

        {items.map((it) => (
          <View key={it.id} style={styles.tarjeta}>
            <Text style={styles.filaTitulo}>
              {it.materia}
              {it.clase ? ` · Clase #${it.clase}` : ''}
            </Text>
            <Text style={styles.textoMuted}>
              {it.tema || 'Sin tema'} · {fechaLegible(it.fecha)}
            </Text>
            {abierto === it.id ? <Text style={styles.texto} selectable>{it.texto}</Text> : null}
            <View style={styles.filaBotones}>
              <TouchableOpacity onPress={() => setAbierto(abierto === it.id ? null : it.id)} style={styles.boton}>
                <Text style={styles.textoBoton}>{abierto === it.id ? 'Ocultar texto' : 'Ver texto'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => void copiar(it.texto)} style={[styles.boton, styles.botonPrincipal]}>
                <Text style={styles.textoBotonPrincipal}>Copiar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => void descargar(it)} style={styles.boton}>
                <Text style={styles.textoBoton}>Descargar (.txt)</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: '#0b0f14' },
  oculta: { display: 'none' },
  contenido: { padding: 16, gap: 14, paddingBottom: 40 },
  encabezado: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titulo: { color: '#e6edf3', fontSize: 18, fontWeight: '800' },
  tarjeta: { backgroundColor: '#121a24', borderRadius: 14, padding: 14, gap: 8, borderWidth: 1, borderColor: '#1f2f40' },
  filaTitulo: { color: '#e6edf3', fontWeight: '700', fontSize: 15 },
  texto: { color: '#cbd5e1', fontSize: 13, lineHeight: 19, backgroundColor: '#0b0f14', padding: 10, borderRadius: 10 },
  filaBotones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  boton: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#1e2a38' },
  botonPrincipal: { backgroundColor: '#10b981' },
  textoBoton: { color: '#e6edf3', fontWeight: '700', fontSize: 13 },
  textoBotonPrincipal: { color: '#06261b', fontWeight: '800', fontSize: 13 },
  textoMuted: { color: '#8b98a5', fontSize: 12, lineHeight: 17 },
  textoError: { color: '#fca5a5', fontSize: 13 },
});
