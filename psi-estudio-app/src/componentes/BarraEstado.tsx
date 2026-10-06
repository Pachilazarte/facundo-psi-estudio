// Barra fija arriba de toda la app: se ve la grabación y la desgrabación desde cualquier pestaña.

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { despertarCola } from '../cola';
import { useGrabacion } from '../grabacion/GrabacionContext';
import { useCola } from '../hooks';
import { formatearTiempo } from '../util';

export function BarraEstado() {
  const g = useGrabacion();
  const cola = useCola();

  const partes: string[] = [];
  if (g.fase === 'grabando' || g.fase === 'cortando') partes.push(`REC ${formatearTiempo(g.segundos)}`);
  else if (g.fase === 'pausada') partes.push(`PAUSA ${formatearTiempo(g.segundos)}`);
  else if (g.fase === 'preparando') partes.push('Preparando micrófono');
  if (cola.fragmentosSinSubir > 0) partes.push(`subiendo ${cola.fragmentosSinSubir} fragmento(s)`);
  if (cola.transcribiendo) partes.push(`desgrabando ${cola.transcribiendo} · parte ${cola.parte}`);

  const error = g.aviso || cola.ultimoError;
  if (partes.length === 0 && !error) return null;

  const grabando = g.fase === 'grabando' || g.fase === 'cortando';
  return (
    <View style={[styles.barra, grabando && styles.barraGrabando]}>
      {partes.length > 0 ? (
        <Text numberOfLines={1} style={styles.texto}>
          {partes.join(' · ')}
        </Text>
      ) : null}
      {error ? (
        <View style={styles.filaError}>
          <Text numberOfLines={2} style={styles.error}>
            {error}
          </Text>
          <TouchableOpacity
            onPress={() => {
              g.limpiarAviso();
              despertarCola();
            }}
            style={styles.boton}
          >
            <Text style={styles.textoBoton}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  barra: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#13202e', borderBottomWidth: 1, borderBottomColor: '#1f2f40' },
  barraGrabando: { backgroundColor: '#1a2a24', borderBottomColor: '#10b981' },
  texto: { color: '#e6edf3', fontSize: 13, fontWeight: '600' },
  filaError: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  error: { flex: 1, color: '#fca5a5', fontSize: 12 },
  boton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#1e2a38' },
  textoBoton: { color: '#e6edf3', fontSize: 12, fontWeight: '700' },
});
