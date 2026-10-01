import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

export interface ClassSessionManifest {
  sessionId: string;
  materiaId: string;
  materiaNombre: string;
  claseNumero: number;
  fechaCreacion: string;
  duracionTotalMs: number;
  chunks: Array<{
    chunkId: string;
    filename: string;
    duracionMs: number;
    creadoEn: string;
  }>;
  estado: 'grabando' | 'pausado' | 'completado';
}

export class AudioRecorderService {
  private recording: Audio.Recording | null = null;
  private currentSession: ClassSessionManifest | null = null;
  private sessionDir: string = '';
  private currentChunkIndex: number = 0;
  private chunkStartTime: number = 0;
  private onMeteringCallback: ((metering: number) => void) | null = null;

  async initAudioSession(): Promise<void> {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      interruptionModeIOS: Audio.InterruptionModeIOS.DoNotMix,
      shouldDuckAndroid: true,
      interruptionModeAndroid: Audio.InterruptionModeAndroid.DoNotMix,
      playThroughEarpieceAndroid: false,
    });
  }

  setMeteringCallback(cb: (metering: number) => void) {
    this.onMeteringCallback = cb;
  }

  async startNewClassSession(materiaId: string, materiaNombre: string, claseNumero: number): Promise<string> {
    await this.initAudioSession();
    await activateKeepAwakeAsync('recording_session');

    const sessionId = `session_${Date.now()}`;
    this.sessionDir = `${FileSystem.documentDirectory}classes/${sessionId}/`;
    await FileSystem.makeDirectoryAsync(this.sessionDir, { intermediates: true });

    this.currentSession = {
      sessionId,
      materiaId,
      materiaNombre,
      claseNumero,
      fechaCreacion: new Date().toISOString(),
      duracionTotalMs: 0,
      chunks: [],
      estado: 'grabando',
    };

    await this._saveManifest();
    await this._startChunkRecording();
    return sessionId;
  }

  async appendToExistingSession(sessionId: string): Promise<void> {
    await this.initAudioSession();
    await activateKeepAwakeAsync('recording_session');

    this.sessionDir = `${FileSystem.documentDirectory}classes/${sessionId}/`;
    const manifestPath = `${this.sessionDir}session_manifest.json`;
    const manifestStr = await FileSystem.readAsStringAsync(manifestPath);
    this.currentSession = JSON.parse(manifestStr);

    if (!this.currentSession) throw new Error('Sesión no encontrada');
    this.currentChunkIndex = this.currentSession.chunks.length;
    this.currentSession.estado = 'grabando';
    await this._saveManifest();
    await this._startChunkRecording();
  }

  private async _startChunkRecording(): Promise<void> {
    const chunkFilename = `chunk_${String(this.currentChunkIndex + 1).padStart(3, '0')}.caf`;

    const recordingOptions: Audio.RecordingOptions = {
      android: {
        extension: '.m4a',
        outputFormat: Audio.AndroidOutputFormat.MPEG_4,
        audioEncoder: Audio.AndroidAudioEncoder.AAC,
        sampleRate: 44100,
        numberOfChannels: 1,
        bitRate: 128000,
      },
      ios: {
        extension: '.caf',
        audioQuality: Audio.IOSAudioQuality.HIGH,
        sampleRate: 44100,
        numberOfChannels: 1,
        bitRate: 128000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
      web: {},
    };

    this.recording = new Audio.Recording();
    await this.recording.prepareToRecordAsync(recordingOptions);

    this.recording.setOnRecordingStatusUpdate((status) => {
      if (status.isRecording && status.metering !== undefined && this.onMeteringCallback) {
        this.onMeteringCallback(status.metering);
      }
    });

    this.chunkStartTime = Date.now();
    await this.recording.startAsync();
  }

  async pauseRecording(): Promise<void> {
    if (!this.recording || !this.currentSession) return;

    try {
      await this.recording.stopAndUnloadAsync();
    } catch (e) {
      console.warn('Grabación ya detenida:', e);
    }

    const duration = Date.now() - this.chunkStartTime;
    const chunkFilename = `chunk_${String(this.currentChunkIndex + 1).padStart(3, '0')}.caf`;

    this.currentSession.chunks.push({
      chunkId: `chk_${Date.now()}`,
      filename: chunkFilename,
      duracionMs: duration,
      creadoEn: new Date().toISOString(),
    });
    this.currentSession.duracionTotalMs += duration;
    this.currentSession.estado = 'pausado';
    this.currentChunkIndex++;
    this.recording = null;
    await this._saveManifest();
    deactivateKeepAwake('recording_session');
  }

  async finalizeSession(): Promise<ClassSessionManifest> {
    if (this.recording) {
      await this.pauseRecording();
    }
    if (!this.currentSession) throw new Error('No hay sesión activa');
    this.currentSession.estado = 'completado';
    await this._saveManifest();
    deactivateKeepAwake('recording_session');
    return this.currentSession;
  }

  private async _saveManifest(): Promise<void> {
    if (!this.currentSession) return;
    const manifestPath = `${this.sessionDir}session_manifest.json`;
    await FileSystem.writeAsStringAsync(manifestPath, JSON.stringify(this.currentSession, null, 2));
  }

  static async listAllSessions(): Promise<ClassSessionManifest[]> {
    const baseDir = `${FileSystem.documentDirectory}classes/`;
    const dirInfo = await FileSystem.getInfoAsync(baseDir);
    if (!dirInfo.exists) return [];

    const dirs = await FileSystem.readDirectoryAsync(baseDir);
    const manifests: ClassSessionManifest[] = [];

    for (const d of dirs) {
      const manifestPath = `${baseDir}${d}/session_manifest.json`;
      const info = await FileSystem.getInfoAsync(manifestPath);
      if (info.exists) {
        try {
          const str = await FileSystem.readAsStringAsync(manifestPath);
          manifests.push(JSON.parse(str));
        } catch (e) {
          console.warn('Error leyendo manifest:', manifestPath);
        }
      }
    }
    return manifests.sort((a, b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime());
  }
}
