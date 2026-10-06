// Pantalla de grabación: elegís materia y clase, grabás, y ves el estado de cada clase.

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { avisarCambioCargas, despertarCola } from '../cola';
import { Boton } from '../componentes/Boton';
import { useGrabacion } from '../grabacion/GrabacionContext';
import { useCargas } from '../hooks';
import { actualizarCarga, listarMaterias } from '../supabase';
import { TOQUE_MINIMO, tema } from '../tema';
import type { Carga, Materia } from '../tipos';
import { AvisoError, avisoDe, detalleTecnico, fechaLegible, formatearTiempo } from '../util';

export function PantallaGrabar({ visible }: { visible: boolean }) {
  const g = useGrabacion();
  const cargas = useCargas();

  const [materias, setMaterias] = useState<Materia[]>([]);
  const [errorMaterias, setErrorMaterias] = useState<string | null>(null);
  const [materiaId, setMateriaId] = useState<string | null>(null);
  const [claseNum, setClaseNum] = useState(1);
  const [temaClase, setTemaClase] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const cargarMaterias = useCallback(async () => {
    try {
      const lista = await listarMaterias();
      setMaterias(lista);
      setErrorMaterias(null);
    } catch (e) {
      setErrorMaterias(avisoDe('No se pudieron cargar las materias', e));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de las materias desde la base
    void cargarMaterias();
  }, [cargarMaterias]);

  const materiaActiva = materiaId ?? materias[0]?.id ?? null;

  const ejecutar = async (accion: () => Promise<void>, titulo: string) => {
    setOcupado(true);
    try {
      await accion();
    } catch (e) {
      console.warn('[PsiEstudio]', titulo, detalleTecnico(e));
      Alert.alert(titulo, e instanceof AvisoError ? e.message : avisoDe(titulo, e));
    } finally {
      setOcupado(false);
    }
  };

  const empezar = () => {
    const materia = materias.find((m) => m.id === materiaActiva) ?? null;
    void ejecutar(
      () =>
        g
          .iniciar({
            materiaId: materia ? materia.id : null,
            materiaNombre: materia ? materia.nombre : 'General',
            claseNum,
            tema: temaClase.trim(),
          })
          .then(() => avisarCambioCargas()),
      'No se pudo empezar',
    );
  };

  const confirmarTerminar = () => {
    Alert.alert('Terminar la clase', 'Se guarda lo grabado y se desgraba lo que falta. ¿Terminar?', [
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
  const ocupadoGrabando = ocupado || g.fase === 'preparando' || g.fase === 'cortando';

  return (
    <View style={[styles.contenedor, !visible && styles.oculta]}>
      <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
        {!hayGrabacion ? (
          <View style={styles.tarjeta}>
            <Text style={styles.titulo}>Nueva clase</Text>

            <Text style={styles.etiqueta}>Materia</Text>
            {errorMaterias ? <Text style={styles.textoError}>{errorMaterias}</Text> : null}
            {materias.length === 0 && !errorMaterias ? <ActivityIndicator color={tema.acentoIcono} /> : null}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {materias.map((m) => {
                const activa = m.id === materiaActiva;
                return (
                  <Pressable
                    key={m.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: activa }}
                    onPress={() => setMateriaId(m.id)}
                    style={[styles.chip, activa && styles.chipActivo]}
                  >
                    <Text style={[styles.chipTexto, activa && styles.chipTextoActivo]} numberOfLines={1}>
                      {m.abreviatura || m.nombre}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={styles.etiqueta}>Número de clase</Text>
            <View style={styles.filaNumero}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Restar una clase"
                onPress={() => setClaseNum((n) => Math.max(1, n - 1))}
                style={styles.botonNumero}
              >
                <Text style={styles.botonNumeroTexto}>−</Text>
              </Pressable>
              <Text style={styles.numero}>{claseNum}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sumar una clase"
                onPress={() => setClaseNum((n) => n + 1)}
                style={styles.botonNumero}
              >
                <Text style={styles.botonNumeroTexto}>+</Text>
              </Pressable>
            </View>

            <Text style={styles.etiqueta}>Tema (opcional)</Text>
            <TextInput
              value={temaClase}
              onChangeText={setTemaClase}
              placeholder="Ej: Transferencia y contratransferencia"
              placeholderTextColor={tema.textoSuave}
              style={styles.entrada}
            />

            <Boton texto="Empezar clase" icono="mic" variante="principal" onPress={empezar} cargando={ocupado} style={styles.botonEmpezar} />
            <Text style={styles.textoSuave}>
              Cada 2 minutos y medio la clase se guarda sola. La desgrabación aparece en el Historial. Podés usar las otras pestañas mientras grabás.
            </Text>
          </View>
        ) : (
          <View style={[styles.tarjeta, styles.tarjetaGrabando]}>
            <Text style={styles.titulo}>{g.etiqueta}</Text>
            <Text style={styles.reloj}>{formatearTiempo(g.segundos)}</Text>
            <Text style={styles.estadoGrabacion}>
              {g.fase === 'grabando' && 'Grabando'}
              {g.fase === 'cortando' && 'Guardando una parte...'}
              {g.fase === 'pausada' && 'En pausa'}
              {g.fase === 'preparando' && 'Preparando...'}
            </Text>

            <View style={styles.filaBotones}>
              {g.fase === 'grabando' ? (
                <Boton texto="Pausar" icono="pause" onPress={() => void ejecutar(() => g.pausar(), 'No se pudo pausar')} disabled={ocupado} style={styles.flexible} />
              ) : null}
              {g.fase === 'pausada' ? (
                <Boton texto="Reanudar" icono="play" onPress={() => void ejecutar(() => g.reanudar(), 'No se pudo reanudar')} disabled={ocupado} style={styles.flexible} />
              ) : null}
            </View>
            <Boton texto="Terminar clase" icono="square" variante="peligro" onPress={confirmarTerminar} disabled={ocupadoGrabando} />
            <Text style={styles.textoSuave}>Mantené la pantalla encendida: el teléfono puede cortar el micrófono si se bloquea.</Text>
          </View>
        )}

        <Text style={styles.titulo}>Tus clases</Text>
        {cargas.length === 0 ? <Text style={styles.textoSuave}>Todavía no hay clases. Grabá una o subí un audio desde la web.</Text> : null}
        {cargas.map((c) => {
          const actual = g.cargaId === c.id;
          return (
            <View key={c.id} style={[styles.fila, actual && styles.filaActiva]}>
              <Text style={styles.filaTitulo}>
                {c.materia} · Clase {c.clase_num}
                {c.tema ? ` · ${c.tema}` : ''}
              </Text>
              <Text style={styles.textoSuave}>{fechaLegible(c.created_at)}</Text>
              {c.estado === 'completada' ? <Text style={styles.ok}>Lista en el Historial</Text> : null}
              {c.estado === 'pendiente' || c.estado === 'en_proceso' ? (
                <Text style={styles.filaEstado}>
                  Desgrabando {c.partes_listas || 0} de {c.partes_total || '?'}
                </Text>
              ) : null}
              {c.estado === 'grabando' && actual ? <Text style={styles.ok}>Grabando ({c.partes_total || 0} partes guardadas)</Text> : null}
              {c.estado === 'grabando' && !actual ? (
                <Boton texto="Desgrabar lo que se guardó" icono="refresh-cw" onPress={() => reintentar(c)} />
              ) : null}
              {c.estado === 'error' ? (
                <View style={styles.bloqueError}>
                  <Text style={styles.textoError}>No se pudo desgrabar esta clase.</Text>
                  <Boton texto={`Reintentar (${c.partes_listas || 0} partes guardadas)`} icono="refresh-cw" onPress={() => reintentar(c)} />
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
  contenedor: { flex: 1, backgroundColor: tema.fondo },
  oculta: { display: 'none' },
  contenido: { padding: 16, gap: 14, paddingBottom: 40 },
  tarjeta: {
    backgroundColor: tema.superficie,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: tema.borde,
  },
  tarjetaGrabando: { borderColor: tema.acentoIcono, borderWidth: 2 },
  titulo: { color: tema.texto, fontSize: 19, fontWeight: '800' },
  etiqueta: { color: tema.textoSuave, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },
  chips: { gap: 8, paddingVertical: 4 },
  chip: {
    minHeight: TOQUE_MINIMO,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: tema.superficieSuave,
    borderWidth: 1,
    borderColor: tema.borde,
    maxWidth: 220,
  },
  chipActivo: { backgroundColor: tema.acento, borderColor: tema.acento },
  chipTexto: { color: tema.texto, fontWeight: '600', fontSize: 15 },
  chipTextoActivo: { color: tema.textoSobreAcento },
  filaNumero: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  botonNumero: {
    width: TOQUE_MINIMO,
    height: TOQUE_MINIMO,
    borderRadius: 12,
    backgroundColor: tema.superficieSuave,
    borderWidth: 1,
    borderColor: tema.borde,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonNumeroTexto: { color: tema.texto, fontSize: 22, fontWeight: '700' },
  numero: { color: tema.texto, fontSize: 24, fontWeight: '800', minWidth: 36, textAlign: 'center' },
  entrada: {
    backgroundColor: tema.superficieSuave,
    borderWidth: 1,
    borderColor: tema.borde,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: TOQUE_MINIMO,
    color: tema.texto,
    fontSize: 15,
  },
  botonEmpezar: { marginTop: 8 },
  filaBotones: { flexDirection: 'row', gap: 10 },
  flexible: { flex: 1 },
  reloj: { color: tema.texto, fontSize: 46, fontWeight: '800', fontVariant: ['tabular-nums'], textAlign: 'center', marginVertical: 6 },
  estadoGrabacion: { color: tema.acento, textAlign: 'center', fontWeight: '700', fontSize: 15 },
  fila: { backgroundColor: tema.superficie, borderRadius: 14, padding: 14, gap: 6, borderWidth: 1, borderColor: tema.borde },
  filaActiva: { borderColor: tema.acentoIcono, borderWidth: 2 },
  filaTitulo: { color: tema.texto, fontWeight: '700', fontSize: 16 },
  filaEstado: { color: tema.aviso, fontSize: 14, fontWeight: '600' },
  ok: { color: tema.acento, fontWeight: '700', fontSize: 14 },
  bloqueError: { gap: 8 },
  textoSuave: { color: tema.textoSuave, fontSize: 13, lineHeight: 19 },
  textoError: { color: tema.error, fontSize: 14, fontWeight: '600' },
});
