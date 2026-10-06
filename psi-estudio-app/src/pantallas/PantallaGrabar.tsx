// Pantalla de grabación. Elegís materia y clase, grabás, y ves el estado de cada clase (que vive en la base).

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { avisarCambioCargas, despertarCola } from '../cola';
import { useGrabacion } from '../grabacion/GrabacionContext';
import { useCargas } from '../hooks';
import { actualizarCarga, listarMaterias } from '../supabase';
import type { Carga, Materia } from '../tipos';
import { fechaLegible, formatearTiempo, mensajeDeError } from '../util';

export function PantallaGrabar({ visible }: { visible: boolean }) {
  const g = useGrabacion();
  const cargas = useCargas();

  const [materias, setMaterias] = useState<Materia[]>([]);
  const [errorMaterias, setErrorMaterias] = useState<string | null>(null);
  const [materiaId, setMateriaId] = useState<string | null>(null);
  const [claseNum, setClaseNum] = useState(1);
  const [tema, setTema] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const cargarMaterias = useCallback(async () => {
    try {
      const lista = await listarMaterias();
      setMaterias(lista);
      setErrorMaterias(null);
    } catch (e) {
      setErrorMaterias(`Sin conexión con PsiEstudio: ${mensajeDeError(e)}`);
    }
  }, []);

  useEffect(() => {
    void cargarMaterias();
  }, [cargarMaterias]);

  useEffect(() => {
    if (!materiaId && materias.length > 0) setMateriaId(materias[0].id);
  }, [materias, materiaId]);

  const ejecutar = async (accion: () => Promise<void>, titulo: string) => {
    setOcupado(true);
    try {
      await accion();
    } catch (e) {
      Alert.alert(titulo, mensajeDeError(e));
    } finally {
      setOcupado(false);
    }
  };

  const empezar = () => {
    const materia = materias.find((m) => m.id === materiaId) ?? null;
    void ejecutar(
      () =>
        g.iniciar({
          materiaId: materia ? materia.id : null,
          materiaNombre: materia ? materia.nombre : 'General',
          claseNum,
          tema: tema.trim(),
        }).then(() => avisarCambioCargas()),
      'No se pudo empezar',
    );
  };

  const confirmarTerminar = () => {
    Alert.alert('Terminar la clase', 'Se sube lo grabado y se desgraba lo que falte. ¿Terminar?', [
      { text: 'Seguir grabando', style: 'cancel' },
      {
        text: 'Terminar',
        style: 'destructive',
        onPress: () => void ejecutar(() => g.terminar().then(() => avisarCambioCargas()), 'No se pudo terminar'),
      },
    ]);
  };

  const reintentar = (carga: Carga) => {
    void ejecutar(async () => {
      await actualizarCarga(carga.id, { estado: 'pendiente', error: null });
      avisarCambioCargas();
      despertarCola();
    }, 'No se pudo reintentar');
  };

  const hayGrabacion = g.fase !== 'inactiva';

  return (
    <View style={[styles.contenedor, !visible && styles.oculta]}>
      <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
        {!hayGrabacion ? (
          <View style={styles.tarjeta}>
            <Text style={styles.titulo}>Nueva clase</Text>
            <Text style={styles.etiqueta}>Materia</Text>
            {errorMaterias ? <Text style={styles.textoError}>{errorMaterias}</Text> : null}
            {materias.length === 0 && !errorMaterias ? <ActivityIndicator color="#10b981" /> : null}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {materias.map((m) => {
                const activa = m.id === materiaId;
                return (
                  <TouchableOpacity key={m.id} onPress={() => setMateriaId(m.id)} style={[styles.chip, activa && styles.chipActivo]}>
                    <Text style={[styles.chipTexto, activa && styles.chipTextoActivo]} numberOfLines={1}>
                      {m.abreviatura || m.nombre}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.etiqueta}>Número de clase</Text>
            <View style={styles.filaNumero}>
              <TouchableOpacity onPress={() => setClaseNum((n) => Math.max(1, n - 1))} style={styles.botonNumero}>
                <Text style={styles.botonNumeroTexto}>-</Text>
              </TouchableOpacity>
              <Text style={styles.numero}>{claseNum}</Text>
              <TouchableOpacity onPress={() => setClaseNum((n) => n + 1)} style={styles.botonNumero}>
                <Text style={styles.botonNumeroTexto}>+</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.etiqueta}>Tema (opcional)</Text>
            <TextInput
              value={tema}
              onChangeText={setTema}
              placeholder="Ej: Transferencia y contratransferencia"
              placeholderTextColor="#64748b"
              style={styles.entrada}
            />

            <TouchableOpacity onPress={empezar} disabled={ocupado} style={[styles.botonGrande, ocupado && styles.deshabilitado]}>
              {ocupado ? <ActivityIndicator color="white" /> : <Text style={styles.botonGrandeTexto}>Empezar clase</Text>}
            </TouchableOpacity>
            <Text style={styles.textoMuted}>
              El audio se sube a la base cada 2,5 minutos y la desgrabación queda en el Historial. Podés usar las otras pestañas mientras grabás.
            </Text>
          </View>
        ) : (
          <View style={[styles.tarjeta, styles.tarjetaGrabando]}>
            <Text style={styles.titulo}>{g.etiqueta}</Text>
            <Text style={styles.reloj}>{formatearTiempo(g.segundos)}</Text>
            <Text style={styles.estadoGrabacion}>
              {g.fase === 'grabando' && 'Grabando'}
              {g.fase === 'cortando' && 'Subiendo fragmento...'}
              {g.fase === 'pausada' && 'En pausa'}
              {g.fase === 'preparando' && 'Preparando...'}
            </Text>
            <View style={styles.filaBotones}>
              {g.fase === 'grabando' ? (
                <TouchableOpacity onPress={() => void ejecutar(() => g.pausar(), 'No se pudo pausar')} disabled={ocupado} style={styles.botonSecundario}>
                  <Text style={styles.botonSecundarioTexto}>Pausar</Text>
                </TouchableOpacity>
              ) : null}
              {g.fase === 'pausada' ? (
                <TouchableOpacity onPress={() => void ejecutar(() => g.reanudar(), 'No se pudo reanudar')} disabled={ocupado} style={styles.botonSecundario}>
                  <Text style={styles.botonSecundarioTexto}>Reanudar</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                onPress={confirmarTerminar}
                disabled={ocupado || g.fase === 'preparando' || g.fase === 'cortando'}
                style={[styles.botonTerminar, (ocupado || g.fase === 'preparando' || g.fase === 'cortando') && styles.deshabilitado]}
              >
                <Text style={styles.botonGrandeTexto}>Terminar clase</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.textoMuted}>Mantené la pantalla encendida: el teléfono puede cortar el micrófono si se bloquea.</Text>
          </View>
        )}

        <Text style={styles.titulo}>Clases en la base</Text>
        {cargas.length === 0 ? <Text style={styles.textoMuted}>Todavía no hay clases grabadas o subidas.</Text> : null}
        {cargas.map((c) => {
          const actual = g.cargaId === c.id;
          return (
            <View key={c.id} style={[styles.fila, actual && styles.filaActiva]}>
              <Text style={styles.filaTitulo}>
                {c.materia} · Clase {c.clase_num}
                {c.tema ? ` · ${c.tema}` : ''}
              </Text>
              <Text style={styles.textoMuted}>{fechaLegible(c.created_at)}</Text>
              {c.estado === 'completada' ? <Text style={styles.ok}>Lista en el Historial</Text> : null}
              {c.estado === 'pendiente' || c.estado === 'en_proceso' ? (
                <Text style={styles.filaEstado}>Desgrabando {c.partes_listas || 0}/{c.partes_total || '?'}</Text>
              ) : null}
              {c.estado === 'grabando' && actual ? <Text style={styles.ok}>Grabando ({c.partes_total || 0} fragmentos subidos)</Text> : null}
              {c.estado === 'grabando' && !actual ? (
                <TouchableOpacity onPress={() => reintentar(c)} style={styles.botonSecundario}>
                  <Text style={styles.botonSecundarioTexto}>Grabación interrumpida: desgrabar lo subido</Text>
                </TouchableOpacity>
              ) : null}
              {c.estado === 'error' ? (
                <View>
                  <Text style={styles.textoError}>{c.error}</Text>
                  <TouchableOpacity onPress={() => reintentar(c)} style={styles.botonSecundario}>
                    <Text style={styles.botonSecundarioTexto}>Reintentar ({c.partes_listas || 0} partes guardadas)</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: '#0b0f14' },
  oculta: { display: 'none' },
  contenido: { padding: 16, gap: 14, paddingBottom: 40 },
  tarjeta: { backgroundColor: '#121a24', borderRadius: 16, padding: 16, gap: 10, borderWidth: 1, borderColor: '#1f2f40' },
  tarjetaGrabando: { borderColor: '#10b981' },
  titulo: { color: '#e6edf3', fontSize: 18, fontWeight: '700' },
  etiqueta: { color: '#8b98a5', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },
  chips: { gap: 8, paddingVertical: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#1e2a38', maxWidth: 220 },
  chipActivo: { backgroundColor: '#10b981' },
  chipTexto: { color: '#e6edf3', fontWeight: '600' },
  chipTextoActivo: { color: '#06261b' },
  filaNumero: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  botonNumero: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#1e2a38', alignItems: 'center', justifyContent: 'center' },
  botonNumeroTexto: { color: '#e6edf3', fontSize: 20, fontWeight: '700' },
  numero: { color: '#e6edf3', fontSize: 22, fontWeight: '800', minWidth: 32, textAlign: 'center' },
  entrada: { backgroundColor: '#0b0f14', borderWidth: 1, borderColor: '#1f2f40', borderRadius: 10, padding: 12, color: '#e6edf3' },
  botonGrande: { marginTop: 8, paddingVertical: 16, borderRadius: 14, backgroundColor: '#10b981', alignItems: 'center' },
  botonGrandeTexto: { color: 'white', fontWeight: '800', fontSize: 16 },
  botonTerminar: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#ef4444', alignItems: 'center' },
  botonSecundario: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#1e2a38', alignItems: 'center', marginTop: 6 },
  botonSecundarioTexto: { color: '#e6edf3', fontWeight: '700' },
  deshabilitado: { opacity: 0.5 },
  filaBotones: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  reloj: { color: '#e6edf3', fontSize: 44, fontWeight: '800', fontVariant: ['tabular-nums'], textAlign: 'center', marginVertical: 6 },
  estadoGrabacion: { color: '#34d399', textAlign: 'center', fontWeight: '700' },
  fila: { backgroundColor: '#121a24', borderRadius: 14, padding: 14, gap: 4, borderWidth: 1, borderColor: '#1f2f40' },
  filaActiva: { borderColor: '#10b981' },
  filaTitulo: { color: '#e6edf3', fontWeight: '700', fontSize: 15 },
  filaEstado: { color: '#fbbf24', fontSize: 13 },
  ok: { color: '#34d399', fontWeight: '700', fontSize: 13 },
  textoMuted: { color: '#8b98a5', fontSize: 12, lineHeight: 17 },
  textoError: { color: '#fca5a5', fontSize: 12 },
});
