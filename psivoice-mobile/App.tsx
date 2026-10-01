import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { AudioRecorderService, ClassSessionManifest } from './src/services/AudioRecorderService';
import { WaveformVisualizer } from './src/components/WaveformVisualizer';

const MATERIAS_DEFAULT = [
  { id: 'mat_tecnicas_psicometricas', nombre: 'Técnicas Psicométricas' },
  { id: 'mat_evaluacion_psicologica', nombre: 'Evaluación Psicológica' },
  { id: 'mat_psicopatologia', nombre: 'Psicopatología Clínica' },
  { id: 'mat_neurociencias', nombre: 'Neurociencias y Neuropsicología' },
  { id: 'mat_psicoanalisis', nombre: 'Psicoanálisis y Teoría' },
];

export default function App() {
  const [recorder] = useState(() => new AudioRecorderService());
  const [isRecording, setIsRecording] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [selectedMateria, setSelectedMateria] = useState(MATERIAS_DEFAULT[0]);
  const [claseNumero, setClaseNumero] = useState(1);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [meteringHistory, setMeteringHistory] = useState<number[]>(new Array(24).fill(-60));
  const [sessions, setSessions] = useState<ClassSessionManifest[]>([]);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadSessions();
    recorder.setMeteringCallback((metering) => {
      setMeteringHistory((prev) => [...prev.slice(1), metering]);
    });
  }, []);

  const loadSessions = async () => {
    const list = await AudioRecorderService.listAllSessions();
    setSessions(list);
  };

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleStartNewClass = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      const sessionId = await recorder.startNewClassSession(
        selectedMateria.id,
        selectedMateria.nombre,
        claseNumero
      );
      setActiveSessionId(sessionId);
      setIsRecording(true);
      setElapsedSeconds(0);
      startTimer();
    } catch (e: any) {
      Alert.alert('Error al iniciar', e.message);
    }
  };

  const handlePause = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await recorder.pauseRecording();
      setIsRecording(false);
      stopTimer();
      await loadSessions();
    } catch (e: any) {
      Alert.alert('Error al pausar', e.message);
    }
  };

  const handleResumeAppend = async (sessionId: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await recorder.appendToExistingSession(sessionId);
      setActiveSessionId(sessionId);
      setIsRecording(true);
      startTimer();
    } catch (e: any) {
      Alert.alert('Error al reanudar', e.message);
    }
  };

  const handleFinalize = async () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      stopTimer();
      const manifest = await recorder.finalizeSession();
      setIsRecording(false);
      setActiveSessionId(null);
      setElapsedSeconds(0);
      await loadSessions();
      Alert.alert(
        'Clase Finalizada',
        `Sesión guardada con éxito (${manifest.chunks.length} fragmentos). Lista para sincronizar con PsiEstudio.`
      );
    } catch (e: any) {
      Alert.alert('Error al finalizar', e.message);
    }
  };

  const formatTime = (totalSec: number) => {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.logoTitle}>PsiVoice</Text>
          <Text style={styles.logoSubtitle}>Grabación de Alta Fidelidad &bull; iOS CoreAudio</Text>
        </View>
        <View style={[styles.badge, isRecording ? styles.badgeRecording : styles.badgeIdle]}>
          <Text style={styles.badgeText}>{isRecording ? 'GRABANDO' : 'LISTO'}</Text>
        </View>
      </View>

      {/* Selector de Materia */}
      <View style={styles.selectorContainer}>
        <Text style={styles.sectionLabel}>MATERIA ACADÉMICA:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.materiaScroll}>
          {MATERIAS_DEFAULT.map((m) => {
            const isSelected = selectedMateria.id === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                onPress={() => setSelectedMateria(m)}
                style={[styles.materiaChip, isSelected && styles.materiaChipSelected]}
              >
                <Text style={[styles.materiaChipText, isSelected && styles.materiaChipTextSelected]}>
                  {m.nombre}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Timer & Waveform */}
      <View style={styles.recordingCard}>
        <Text style={styles.materiaDisplay}>{selectedMateria.nombre} &bull; Clase #{claseNumero}</Text>
        <Text style={styles.timerText}>{formatTime(elapsedSeconds)}</Text>

        <WaveformVisualizer meteringValues={meteringHistory} isRecording={isRecording} />

        {/* Action Controls */}
        <View style={styles.controlsRow}>
          {!isRecording ? (
            <TouchableOpacity style={styles.recordButton} onPress={handleStartNewClass}>
              <View style={styles.recordIconInside} />
              <Text style={styles.recordButtonText}>INICIAR GRABACIÓN</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.activeControlsGroup}>
              <TouchableOpacity style={styles.pauseButton} onPress={handlePause}>
                <Text style={styles.pauseButtonText}>⏸ Pausar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.finalizeButton} onPress={handleFinalize}>
                <Text style={styles.finalizeButtonText}>⏹ Finalizar Clase</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Grabaciones Guardadas / Append */}
      <View style={styles.historyContainer}>
        <Text style={styles.sectionLabel}>GRABACIONES DE CLASES ({sessions.length})</Text>
        <ScrollView style={styles.historyScroll}>
          {sessions.map((s) => {
            const totalMin = Math.round(s.duracionTotalMs / 60000);
            return (
              <View key={s.sessionId} style={styles.sessionCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sessionMateria}>{s.materiaNombre} &bull; Clase #{s.claseNumero}</Text>
                  <Text style={styles.sessionMeta}>
                    {new Date(s.fechaCreacion).toLocaleDateString()} &bull; {totalMin} min ({s.chunks.length} partes)
                  </Text>
                </View>

                {s.estado !== 'completado' && (
                  <TouchableOpacity
                    style={styles.appendButton}
                    onPress={() => handleResumeAppend(s.sessionId)}
                  >
                    <Text style={styles.appendButtonText}>+ Continuar</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  logoTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#00e599',
    letterSpacing: 0.5,
  },
  logoSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeRecording: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  badgeIdle: {
    backgroundColor: 'rgba(51, 65, 85, 0.3)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#f8fafc',
  },
  selectorContainer: {
    marginTop: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 1,
    marginBottom: 8,
  },
  materiaScroll: {
    flexDirection: 'row',
  },
  materiaChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#1e293b',
    borderRadius: 20,
    marginRight: 8,
  },
  materiaChipSelected: {
    backgroundColor: '#00e599',
  },
  materiaChipText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
  },
  materiaChipTextSelected: {
    color: '#090d16',
    fontWeight: '800',
  },
  recordingCard: {
    marginTop: 20,
    backgroundColor: '#131c2e',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  materiaDisplay: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '600',
  },
  timerText: {
    fontSize: 44,
    fontWeight: '900',
    color: '#ffffff',
    fontVariant: ['tabular-nums'],
    marginVertical: 10,
  },
  controlsRow: {
    marginTop: 12,
    width: '100%',
  },
  recordButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 14,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  recordIconInside: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ffffff',
  },
  recordButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  activeControlsGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  pauseButton: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  pauseButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  finalizeButton: {
    flex: 1,
    backgroundColor: '#00e599',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  finalizeButtonText: {
    color: '#090d16',
    fontSize: 14,
    fontWeight: '800',
  },
  historyContainer: {
    flex: 1,
    marginTop: 24,
  },
  historyScroll: {
    flex: 1,
  },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131c2e',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  sessionMateria: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  sessionMeta: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  appendButton: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00e599',
  },
  appendButtonText: {
    color: '#00e599',
    fontSize: 12,
    fontWeight: '700',
  },
});
