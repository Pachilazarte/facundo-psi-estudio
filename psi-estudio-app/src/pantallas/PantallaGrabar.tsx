// Pantalla de grabación: elegir materia y clase, grabar, y ver el estado de cada clase grabada.
// Nada de lo que aparece acá se puede borrar desde la app: el audio original siempre queda.

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { guardarCacheMaterias, leerCacheMaterias } from '../almacen';
import { useGrabacion } from '../grabacion/GrabacionContext';
import { useSesiones } from '../hooks';
import { listarMaterias } from '../supabase';
import type { Materia, Sesion } from '../tipos';
import { reintentarAhora, useCola } from '../transcripcion';
import { fechaLegible, formatearTiempo, mensajeDeError } from '../util';

export function PantallaGrabar({ visible }: { visible: boolean }) {
  const g = useGrabacion();
  const cola = useCola();
  const sesiones = useSesiones();

  const [materias, setMaterias] = useState<Materia[]>(() => leerCacheMaterias());
  const [materiaId, setMateriaId] = useState<string | null>(null);
  const [claseNum, setClaseNum] = useState(1);
  const [tema, setTema] = useState('');
  const [cargandoMaterias, setCargandoMaterias] = useState(false);
  const [errorMaterias, setErrorMaterias] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const cargarMaterias = useCallback(async () => {
    setCargandoMaterias(true);
    setErrorMaterias(null);
    try {
      const lista = await listarMaterias();
      setMaterias(lista);
      guardarCacheMaterias(lista);
    } catch (e) {
      setErrorMaterias(`Sin conexión con PsiEstudio: ${mensajeDeError(e)}. Se usan las materias guardadas.`);
    } finally {
      setCargandoMaterias(false);
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
        }),
      'No se pudo empezar',
    );
  };

  const confirmarTerminar = () => {
    Alert.alert('Terminar la clase', 'Se guarda lo grabado y se transcribe lo que falte. ¿Terminar?', [
      { text: 'Seguir grabando', style: 'cancel' },
      { text: 'Terminar', style: 'destructive', onPress: () => void ejecutar(() => g.terminar(), 'No se pudo terminar') },
    ]);
  };

  const hayGrabacion = g.fase !== 'inactiva';

  return (
    <View style={[styles.contenedor, !visible && styles.oculta]}>
      <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
        {!hayGrabacion ? (
          <View style={styles.tarjeta}>
            <Text style={styles.titulo}>Nueva clase</Text>

            <View style={styles.filaEntreTitulo}>
              <Text style={styles.etiqueta}>Materia</Text>
              <TouchableOpacity onPress={() => void cargarMaterias()} disabled={cargandoMaterias}>
                <Text style={styles.enlace}>{cargandoMaterias ? 'Actualizando...' : 'Actualizar'}</Text>
              </TouchableOpacity>
            </View>
            {errorMaterias ? <Text style={styles.textoError}>{errorMaterias}</Text> : null}
            {materias.length === 0 && !cargandoMaterias ? (
              <Text style={styles.textoMuted}>No hay materias cargadas. La clase se guarda como "General".</Text>
            ) : null}
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
              Se graba en fragmentos de 2,5 minutos. Cada fragmento queda guardado en el teléfono y se transcribe solo. Podés ir a
              PsiEstudio mientras tanto: la grabación sigue.
            </Text>
          </View>
        ) : (
          <View style={[styles.tarjeta, styles.tarjetaGrabando]}>
            <Text style={styles.titulo}>
              {g.sesion?.materiaNombre} · Clase {g.sesion?.claseNum}
            </Text>
            {g.sesion?.tema ? <Text style={styles.textoMuted}>{g.sesion.tema}</Text> : null}
            <Text style={styles.reloj}>{formatearTiempo(g.segundos)}</Text>
            <Text style={styles.estadoGrabacion}>
              {g.fase === 'grabando' && 'Grabando'}
              {g.fase === 'cortando' && 'Guardando fragmento...'}
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
            <Text style={styles.textoMuted}>Mantené la pantalla encendida y la app abierta: iOS puede cortar el micrófono si la bloqueás.</Text>
          </View>
        )}

        <View style={styles.encabezadoLista}>
          <Text style={styles.titulo}>Clases grabadas</Text>
          {cola.pendientes > 0 ? (
            <TouchableOpacity onPress={reintentarAhora}>
              <Text style={styles.enlace}>Reintentar pendientes ({cola.pendientes})</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {sesiones.length === 0 ? <Text style={styles.textoMuted}>Todavía no hay clases grabadas en este teléfono.</Text> : null}
        {sesiones.map((s) => (
          <FilaSesion
            key={s.id}
            sesion={s}
            activa={g.sesion?.id === s.id}
            puedeContinuar={!hayGrabacion && (s.estado === 'pausada' || s.estado === 'interrumpida')}
            onContinuar={() => void ejecutar(() => g.continuar(s.id), 'No se pudo continuar')}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function etiquetaEstado(s: Sesion): string {
  switch (s.estado) {
    case 'grabando':
      return 'Grabando';
    case 'pausada':
      return 'En pausa';
    case 'interrumpida':
      return 'Interrumpida (la app se cerró)';
    case 'terminada':
      return 'Terminada';
    default:
      return s.estado;
  }
}

function FilaSesion({
  sesion,
  activa,
  puedeContinuar,
  onContinuar,
}: {
  sesion: Sesion;
  activa: boolean;
  puedeContinuar: boolean;
  onContinuar: () => void;
}) {
  const total = sesion.fragmentos.length;
  const listos = sesion.fragmentos.filter((f) => f.estado === 'transcripto').length;
  const conError = sesion.fragmentos.filter((f) => f.estado === 'error');
  const duracion = sesion.fragmentos.reduce((acc, f) => acc + (f.duracionSeg || 0), 0);

  let guardado: string;
  if (total === 0) guardado = 'Sin audio todavía';
  else if (listos < total) guardado = `Transcribiendo: ${listos} de ${total} fragmentos`;
  else if (sesion.apuntePendiente) guardado = 'Transcripta. Guardando en PsiEstudio...';
  else if (sesion.apunteGuardadoEn) guardado = `Guardada en PsiEstudio (${fechaLegible(sesion.apunteGuardadoEn)})`;
  else guardado = 'Transcripta';

  return (
    <View style={[styles.fila, activa && styles.filaActiva]}>
      <Text style={styles.filaTitulo}>
        {sesion.materiaNombre} · Clase {sesion.claseNum}
        {sesion.tema ? ` · ${sesion.tema}` : ''}
      </Text>
      <Text style={styles.textoMuted}>
        {fechaLegible(sesion.creadoEn)} · {formatearTiempo(duracion)} · {etiquetaEstado(sesion)}
      </Text>
      <Text style={styles.filaEstado}>{guardado}</Text>
      {conError.length > 0 ? (
        <Text style={styles.textoError} numberOfLines={2}>
          {conError.length} fragmento(s) con error, se reintentan solos: {conError[0].ultimoError}
        </Text>
      ) : null}
      {sesion.errorGuardado ? (
        <Text style={styles.textoError} numberOfLines={2}>
          PsiEstudio: {sesion.errorGuardado}
        </Text>
      ) : null}
      {puedeContinuar ? (
        <TouchableOpacity onPress={onContinuar} style={styles.botonSecundario}>
          <Text style={styles.botonSecundarioTexto}>Continuar grabando esta clase</Text>
        </TouchableOpacity>
      ) : null}
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
  filaEntreTitulo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  enlace: { color: '#34d399', fontWeight: '700', fontSize: 13 },
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
  encabezadoLista: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  fila: { backgroundColor: '#121a24', borderRadius: 14, padding: 14, gap: 4, borderWidth: 1, borderColor: '#1f2f40' },
  filaActiva: { borderColor: '#10b981' },
  filaTitulo: { color: '#e6edf3', fontWeight: '700', fontSize: 15 },
  filaEstado: { color: '#cbd5e1', fontSize: 13 },
  textoMuted: { color: '#8b98a5', fontSize: 12, lineHeight: 17 },
  textoError: { color: '#fca5a5', fontSize: 12 },
});
