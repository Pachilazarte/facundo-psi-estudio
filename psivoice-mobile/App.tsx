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
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { AudioRecorderService, ClassSessionManifest } from './src/services/AudioRecorderService';
import { InterruptionHandler } from './src/services/InterruptionHandler';
import { SyncService } from './src/services/SyncService';
import { WaveformVisualizer } from './src/components/WaveformVisualizer';

const MATERIAS_DEFAULT = [
  { id: 'mat_tecnicas_psicometricas', nombre: 'Técnicas Psicométricas' },
  { id: 'mat_evaluacion_psicologica', nombre: 'Evaluación Psicológica' },
  { id: 'mat_psicopatologia', nombre: 'Psicopatología Clínica' },
  { id: 'mat_neurociencias', nombre: 'Neurociencias y Neuropsicología' },
  { id: 'mat_psicoanalisis', nombre: 'Psicoanálisis y Teoría' },
];

const PRESETS_ACUSTICOS = [
  { id: 'estudio_balanceado', label: 'Balanceado', desc: 'Estudio o aula pequeña' },
  { id: 'aula_magna_eco', label: 'Aula con Eco', desc: 'Anfiteatros o aulas grandes' },
  { id: 'docente_lejano', label: 'Docente Lejano', desc: 'Grabado desde filas traseras' },
  { id: 'ruido_ventilador', label: 'Ventilador / Ruido', desc: 'Filtro de aire acondicionado o murmullo' },
];

export default function App() {
  const [recorder] = useState(() => new AudioRecorderService());
  const [syncService] = useState(() => new SyncService('http://192.168.1.50:8000'));
  const [interruptionHandler] = useState(() => new InterruptionHandler(recorder));

  const [isRecording, setIsRecording] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [selectedMateria, setSelectedMateria] = useState(MATERIAS_DEFAULT[0]);
  const [claseNumero, setClaseNumero] = useState(1);
  const [selectedPreset, setSelectedPreset] = useState(PRESETS_ACUSTICOS[0].id);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [meteringHistory, setMeteringHistory] = useState<number[]>(new Array(24).fill(-60));
  const [sessions, setSessions] = useState<ClassSessionManifest[]>([]);

  // Configuración de Servidor
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState(syncService.getServerUrl());
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [isTestingServer, setIsTestingServer] = useState(false);
  const [tokenInput, setTokenInput] = useState('');

  // Sincronización
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStep, setSyncStep] = useState('');

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Cargar el token guardado en el celular (SecureStore) al abrir la app
  useEffect(() => {
    SecureStore.getItemAsync('psi_api_token').then((saved) => {
      if (saved) {
        setTokenInput(saved);
        syncService.setToken(saved);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    loadSessions();
    checkServer();

    recorder.setMeteringCallback((metering) => {
      setMeteringHistory((prev) => [...prev.slice(1), metering]);
    });

    interruptionHandler.setListener({
      onInterruptionBegan: () => {
        setIsRecording(false);
        stopTimer();
      },
      onInterruptionEnded: (shouldResume) => {
        if (shouldResume) {
          Alert.alert(
            'Llamada finalizada',
            '¿Deseas reanudar la grabación de la clase?',
            [
              { text: 'No', style: 'cancel' },
              {
                text: 'Reanudar',
                onPress: () => {
                  recorder.resumeRecording();
                  setIsRecording(true);
                  startTimer();
                },
              },
            ]
          );
        }
      },
    });

    return () => {
      interruptionHandler.cleanup();
      stopTimer();
    };
  }, []);

  const checkServer = async (urlToCheck?: string) => {
    if (urlToCheck) syncService.setServerUrl(urlToCheck);
    setIsTestingServer(true);
    const online = await syncService.checkServerHealth();
    setServerOnline(online);
    setIsTestingServer(false);
  };

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
      Alert.alert('Error al iniciar grabación', e.message);
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
        `Sesión guardada con éxito (${manifest.chunks.length} fragmentos).\nPuedes sincronizarla ahora con el backend de inferencia.`
      );
    } catch (e: any) {
      Alert.alert('Error al finalizar', e.message);
    }
  };

  const handleSyncSession = async (session: ClassSessionManifest) => {
    if (!serverOnline) {
      Alert.alert(
        'Servidor Desconectado',
        'No se puede conectar con el servidor backend FastAPI. Verifica la IP en Ajustes.'
      );
      return;
    }

    try {
      setIsSyncing(true);
      setSyncProgress(5);
      setSyncStep('Preparando fragmentos...');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const { jobId } = await syncService.syncSession(
        session,
        (progressPct, _, message) => {
          setSyncProgress(progressPct);
          setSyncStep(message);
        },
        {
          preset: selectedPreset,
          applyDsp: true,
          transcribe: true,
        }
      );

      setSyncStep('Procesando DSP & Faster-Whisper en servidor...');
      await syncService.waitForJobCompletion(jobId, (progressPct, step) => {
        setSyncProgress(progressPct);
        setSyncStep(step);
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsSyncing(false);
      Alert.alert('¡Sincronización Exitosa!', 'La clase fue desgrabada y está disponible en PsiEstudio.');
    } catch (err: any) {
      setIsSyncing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error de Sincronización', err.message || 'Ocurrió un problema durante la subida.');
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
          <Text style={styles.logoTitle}>PsiVoice &bull; Mobile</Text>
          <Text style={styles.logoSubtitle}>Grabación de Alta Fidelidad &bull; CoreAudio / AAudio</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.badge, serverOnline ? styles.badgeServerOnline : styles.badgeServerOffline]}
            onPress={() => setShowConfigModal(true)}
          >
            <View style={[styles.statusDot, serverOnline ? styles.dotOnline : styles.dotOffline]} />
            <Text style={styles.badgeText}>{serverOnline ? 'SERVER OK' : 'OFFLINE'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Selector de Materia */}
        <View style={styles.selectorContainer}>
          <Text style={styles.sectionLabel}>CÁTEDRA / MATERIA:</Text>
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

        {/* Selector de Preset Acústico */}
        <View style={styles.selectorContainer}>
          <Text style={styles.sectionLabel}>PRESET ACÚSTICO (DSP EBU R128):</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.materiaScroll}>
            {PRESETS_ACUSTICOS.map((p) => {
              const isSelected = selectedPreset === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => setSelectedPreset(p.id)}
                  style={[styles.presetChip, isSelected && styles.presetChipSelected]}
                >
                  <Text style={[styles.presetChipText, isSelected && styles.presetChipTextSelected]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Tarjeta Principal de Grabación */}
        <View style={styles.recordingCard}>
          <Text style={styles.materiaDisplay}>
            {selectedMateria.nombre} &bull; Clase #{claseNumero}
          </Text>
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
                  <Text style={styles.finalizeButtonText}>⏹ Finalizar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Grabaciones Guardadas / Sincronización */}
        <View style={styles.historyContainer}>
          <Text style={styles.sectionLabel}>SESIONES GUARDADAS ({sessions.length})</Text>
          {sessions.map((s) => {
            const totalMin = Math.round(s.duracionTotalMs / 60000);
            return (
              <View key={s.sessionId} style={styles.sessionCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sessionMateria}>{s.materiaNombre}</Text>
                  <Text style={styles.sessionMeta}>
                    Clase #{s.claseNumero} &bull; {new Date(s.fechaCreacion).toLocaleDateString()} &bull; {totalMin} min ({s.chunks.length} partes)
                  </Text>
                </View>

                <View style={styles.sessionActions}>
                  {s.estado !== 'completado' ? (
                    <TouchableOpacity
                      style={styles.appendButton}
                      onPress={() => handleResumeAppend(s.sessionId)}
                    >
                      <Text style={styles.appendButtonText}>+ Continuar</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.syncButton}
                      onPress={() => handleSyncSession(s)}
                    >
                      <Text style={styles.syncButtonText}>☁ Sincronizar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Modal de Sincronización en Progreso */}
      <Modal visible={isSyncing} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.syncModalCard}>
            <ActivityIndicator size="large" color="#00e599" />
            <Text style={styles.syncModalTitle}>Sincronizando con PsiEstudio</Text>
            <Text style={styles.syncModalStep}>{syncStep}</Text>

            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${syncProgress}%` }]} />
            </View>
            <Text style={styles.syncProgressText}>{syncProgress}%</Text>
          </View>
        </View>
      </Modal>

      {/* Modal de Configuración de Servidor */}
      <Modal visible={showConfigModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.configModalCard}>
            <Text style={styles.configModalTitle}>Ajustes de Servidor Backend</Text>
            <Text style={styles.configModalSubtitle}>
              Introduce la IP y puerto de tu computadora corriendo FastAPI (ej: http://192.168.1.50:8000)
            </Text>

            <TextInput
              value={serverUrlInput}
              onChangeText={setServerUrlInput}
              placeholder="http://192.168.1.X:8000"
              placeholderTextColor="#64748b"
              style={styles.serverInput}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.configModalSubtitle}>
              Token del servidor (el mismo PSI_API_TOKEN de audio_pipeline/.env)
            </Text>
            <TextInput
              value={tokenInput}
              onChangeText={setTokenInput}
              placeholder="Token"
              placeholderTextColor="#64748b"
              style={styles.serverInput}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />

            <View style={styles.configButtonsRow}>
              <TouchableOpacity
                style={styles.testButton}
                onPress={() => checkServer(serverUrlInput)}
                disabled={isTestingServer}
              >
                <Text style={styles.testButtonText}>
                  {isTestingServer ? 'Probando...' : 'Probar Conexión'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveConfigButton}
                onPress={async () => {
                  syncService.setServerUrl(serverUrlInput);
                  syncService.setToken(tokenInput);
                  await SecureStore.setItemAsync('psi_api_token', tokenInput.trim());
                  setShowConfigModal(false);
                }}
              >
                <Text style={styles.saveConfigButtonText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#00e599',
    letterSpacing: 0.5,
  },
  logoSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeServerOnline: {
    backgroundColor: 'rgba(0, 229, 153, 0.15)',
    borderColor: 'rgba(0, 229, 153, 0.4)',
  },
  badgeServerOffline: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotOnline: {
    backgroundColor: '#00e599',
  },
  dotOffline: {
    backgroundColor: '#ef4444',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#f8fafc',
  },
  selectorContainer: {
    marginTop: 14,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  materiaScroll: {
    flexDirection: 'row',
  },
  materiaChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#131c2e',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginRight: 8,
  },
  materiaChipSelected: {
    backgroundColor: '#00e599',
    borderColor: '#00e599',
  },
  materiaChipText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  materiaChipTextSelected: {
    color: '#090d16',
    fontWeight: '900',
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#131c2e',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginRight: 8,
  },
  presetChipSelected: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  presetChipText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
  },
  presetChipTextSelected: {
    color: '#ffffff',
    fontWeight: '800',
  },
  recordingCard: {
    marginTop: 18,
    backgroundColor: '#131c2e',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  materiaDisplay: {
    fontSize: 13,
    fontWeight: '800',
    color: '#00e599',
    marginBottom: 4,
  },
  timerText: {
    fontSize: 48,
    fontWeight: '900',
    color: '#f8fafc',
    fontVariant: ['tabular-nums'],
    marginVertical: 4,
  },
  controlsRow: {
    marginTop: 14,
    width: '100%',
  },
  recordButton: {
    backgroundColor: '#00e599',
    paddingVertical: 14,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  recordIconInside: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#090d16',
  },
  recordButtonText: {
    color: '#090d16',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  activeControlsGroup: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  pauseButton: {
    flex: 1,
    backgroundColor: '#f59e0b',
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
  },
  pauseButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  finalizeButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
  },
  finalizeButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  historyContainer: {
    marginTop: 22,
  },
  sessionCard: {
    backgroundColor: '#131c2e',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  sessionMateria: {
    fontSize: 13,
    fontWeight: '800',
    color: '#f8fafc',
  },
  sessionMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  sessionActions: {
    flexDirection: 'row',
    gap: 8,
  },
  appendButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#1e293b',
    borderRadius: 12,
  },
  appendButtonText: {
    color: '#00e599',
    fontSize: 11,
    fontWeight: '800',
  },
  syncButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#00e599',
    borderRadius: 12,
  },
  syncButtonText: {
    color: '#090d16',
    fontSize: 11,
    fontWeight: '900',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  syncModalCard: {
    backgroundColor: '#131c2e',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  syncModalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#f8fafc',
    marginTop: 14,
  },
  syncModalStep: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
    textAlign: 'center',
  },
  progressBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: '#1e293b',
    borderRadius: 3,
    marginTop: 16,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#00e599',
  },
  syncProgressText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#00e599',
    marginTop: 6,
  },
  configModalCard: {
    backgroundColor: '#131c2e',
    borderRadius: 24,
    padding: 22,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  configModalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#f8fafc',
  },
  configModalSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 16,
  },
  serverInput: {
    backgroundColor: '#090d16',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 13,
    fontFamily: 'monospace',
    marginTop: 14,
  },
  configButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  testButton: {
    flex: 1,
    backgroundColor: '#1e293b',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  testButtonText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  saveConfigButton: {
    flex: 1,
    backgroundColor: '#00e599',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveConfigButtonText: {
    color: '#090d16',
    fontSize: 12,
    fontWeight: '900',
  },
});
