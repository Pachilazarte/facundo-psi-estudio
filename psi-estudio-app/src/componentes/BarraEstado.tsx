// Franja arriba de todo: muestra si hay una clase grabándose o desgrabándose, desde cualquier pestaña.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { despertarCola } from '../cola';
import { useGrabacion } from '../grabacion/GrabacionContext';
import { useCola } from '../hooks';
import { TOQUE_MINIMO, tema } from '../tema';
import { formatearTiempo } from '../util';

export function BarraEstado() {
  const g = useGrabacion();
  const cola = useCola();

  const partes: string[] = [];
  if (g.fase === 'grabando' || g.fase === 'cortando') partes.push(`Grabando ${formatearTiempo(g.segundos)}`);
  else if (g.fase === 'pausada') partes.push(`En pausa ${formatearTiempo(g.segundos)}`);
  else if (g.fase === 'preparando') partes.push('Preparando el micrófono');
  if (cola.fragmentosSinSubir > 0) partes.push(`Guardando ${cola.fragmentosSinSubir} parte(s)`);
  if (cola.transcribiendo) partes.push(`Desgrabando ${cola.transcribiendo} · parte ${cola.parte}`);

  const error = g.aviso || cola.ultimoError;
  if (partes.length === 0 && !error) return null;

  const grabando = g.fase === 'grabando' || g.fase === 'cortando';
  return (
    <View style={[styles.barra, grabando && styles.barraGrabando, error && !grabando && styles.barraAviso]}>
      {partes.length > 0 ? (
        <Text numberOfLines={1} style={styles.texto}>
          {partes.join(' · ')}
        </Text>
      ) : null}
      {error ? (
        <View style={styles.filaError}>
          <Text numberOfLines={3} style={styles.error}>
            {error}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              g.limpiarAviso();
              despertarCola();
            }}
            style={styles.boton}
          >
            <Text style={styles.textoBoton}>Reintentar</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  barra: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: tema.superficieSuave,
    borderBottomWidth: 1,
    borderBottomColor: tema.borde,
  },
  barraGrabando: { backgroundColor: tema.acentoSuave, borderBottomColor: tema.acentoIcono },
  barraAviso: { backgroundColor: tema.avisoSuave },
  texto: { color: tema.texto, fontSize: 14, fontWeight: '700' },
  filaError: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  error: { flex: 1, color: tema.aviso, fontSize: 13 },
  boton: {
    minHeight: TOQUE_MINIMO,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.borde,
  },
  textoBoton: { color: tema.texto, fontSize: 13, fontWeight: '700' },
});
