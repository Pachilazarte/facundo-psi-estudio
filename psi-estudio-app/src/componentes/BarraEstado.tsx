// Barra fija arriba de toda la app: muestra la grabación y la transcripción en curso
// desde cualquier pantalla, para que se vea que nada se corta al navegar.

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useGrabacion } from '../grabacion/GrabacionContext';
import { useSesiones } from '../hooks';
import { reintentarAhora, useCola } from '../transcripcion';
import { formatearTiempo } from '../util';

export function BarraEstado() {
  const g = useGrabacion();
  const cola = useCola();
  const sesiones = useSesiones();
  const [ahora, setAhora] = useState(() => Date.now());

  // Mientras hay un reintento programado, refresca la cuenta regresiva cada segundo.
  useEffect(() => {
    if (!cola.proximoReintentoEn) return;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [cola.proximoReintentoEn]);

  const partes: string[] = [];
  if (g.fase === 'grabando' || g.fase === 'cortando') partes.push(`REC ${formatearTiempo(g.segundos)}`);
  else if (g.fase === 'pausada') partes.push(`PAUSA ${formatearTiempo(g.segundos)}`);
  else if (g.fase === 'preparando') partes.push('Preparando micrófono');

  const activa = g.sesion ? sesiones.find((s) => s.id === g.sesion?.id) : null;
  if (activa && activa.fragmentos.length > 0) {
    const listos = activa.fragmentos.filter((f) => f.estado === 'transcripto').length;
    partes.push(`${listos}/${activa.fragmentos.length} fragmentos transcriptos`);
  }

  if (cola.transcribiendo) partes.push(`Transcribiendo fragmento ${cola.transcribiendo.orden}`);
  else if (cola.guardando) partes.push('Guardando en PsiEstudio');
  else if (cola.pendientes > 0) {
    const faltan = cola.proximoReintentoEn ? Math.max(0, Math.ceil((cola.proximoReintentoEn - ahora) / 1000)) : null;
    partes.push(faltan !== null ? `${cola.pendientes} pendientes, reintento en ${faltan} s` : `${cola.pendientes} pendientes`);
  }

  const texto = partes.join(' · ');
  const error = g.aviso || cola.ultimoError;
  if (!texto && !error) return null;

  const grabando = g.fase === 'grabando' || g.fase === 'cortando';
  return (
    <View style={[styles.barra, grabando && styles.barraGrabando]}>
      {texto ? (
        <Text numberOfLines={1} style={styles.texto}>
          {texto}
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
              reintentarAhora();
            }}
            style={styles.botonReintentar}
          >
            <Text style={styles.textoReintentar}>Reintentar</Text>
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
  botonReintentar: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#1e2a38' },
  textoReintentar: { color: '#e6edf3', fontSize: 12, fontWeight: '700' },
});
