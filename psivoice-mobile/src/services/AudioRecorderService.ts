import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Platform } from 'react-native';

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
    sizeBytes?: number;
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
  private autoRotateTimer: NodeJS.Timeout | null = null;

  // Límite de rotación automática (15 minutos por chunk para evitar archivos > 1GB)
  private readonly AUTO_ROTATE_MS = 15 * 60 * 1000;

  private getAudioExtension(): string {
    return Platform.OS === 'ios' ? '.caf' : '.m4a';
  }

  async initAudioSession(): Promise<void> {
    // 1. Verificación defensiva de permisos de micrófono
    const perm = await Audio.getPermissionsAsync();
    if (!perm.granted) {
      const req = await Audio.requestPermissionsAsync();
      if (!req.granted) {
        throw new Error('Permiso de micrófono denegado. Habilítalo en los ajustes del dispositivo para grabar clases.');
      }
    }

    // 2. Configuración de sesión de audio nativa
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      shouldDuckAndroid: true,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
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
    this._startAutoRotateWatcher();
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
    this._startAutoRotateWatcher();
  }

  private async _startChunkRecording(): Promise<void> {
    const ext = this.getAudioExtension();
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

  private _startAutoRotateWatcher(): void {
    this._stopAutoRotateWatcher();
    this.autoRotateTimer = setTimeout(async () => {
      if (this.recording && this.currentSession?.estado === 'grabando') {
        console.log('[AudioRecorderService] Auto-rotación de chunk por tiempo límite (15m)...');
        await this._rotateCurrentChunk();
        this._startAutoRotateWatcher();
      }
    }, this.AUTO_ROTATE_MS);
  }

  private _stopAutoRotateWatcher(): void {
    if (this.autoRotateTimer) {
      clearTimeout(this.autoRotateTimer);
      this.autoRotateTimer = null;
    }
  }

  private async _rotateCurrentChunk(): Promise<void> {
    if (!this.recording || !this.currentSession) return;
    await this.pauseRecording();
    await this._startChunkRecording();
  }

  async pauseRecording(): Promise<void> {
    this._stopAutoRotateWatcher();
    if (!this.recording || !this.currentSession) return;

    let tempUri: string | null = null;
    try {
      tempUri = this.recording.getURI();
      await this.recording.stopAndUnloadAsync();
    } catch (e) {
      console.warn('Advertencia al detener grabación:', e);
    }

    const duration = Math.max(0, Date.now() - this.chunkStartTime);
    const ext = this.getAudioExtension();
    const chunkFilename = `chunk_${String(this.currentChunkIndex + 1).padStart(3, '0')}${ext}`;
    const targetPath = `${this.sessionDir}${chunkFilename}`;

    let sizeBytes = 0;
    // Mover atómicamente el archivo desde la caché temporal a la carpeta persistente de la sesión
    if (tempUri) {
      try {
        await FileSystem.copyAsync({ from: tempUri, to: targetPath });
        const fileInfo = await FileSystem.getInfoAsync(targetPath);
        if (fileInfo.exists) {
          sizeBytes = fileInfo.size || 0;
        }
        // Limpiar archivo temporal
        await FileSystem.deleteAsync(tempUri, { idempotent: true });
      } catch (copyErr) {
        console.error('Error al persistir chunk de audio en almacenamiento:', copyErr);
      }
    }

    this.currentSession.chunks.push({
      chunkId: `chk_${Date.now()}`,
      filename: chunkFilename,
      duracionMs: duration,
      creadoEn: new Date().toISOString(),
      sizeBytes,
    });
    this.currentSession.duracionTotalMs += duration;
    this.currentSession.estado = 'pausado';
    this.currentChunkIndex++;
    this.recording = null;
    await this._saveManifest();
    deactivateKeepAwake('recording_session');
  }

  async resumeRecording(): Promise<void> {
    if (!this.currentSession) throw new Error('No hay sesión para reanudar');
    await this.initAudioSession();
    await activateKeepAwakeAsync('recording_session');
    this.currentSession.estado = 'grabando';
    await this._saveManifest();
    await this._startChunkRecording();
    this._startAutoRotateWatcher();
  }

  async finalizeSession(): Promise<ClassSessionManifest> {
    this._stopAutoRotateWatcher();
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
    const manifestTmp = `${this.sessionDir}session_manifest.json.tmp`;
    const manifestBak = `${this.sessionDir}session_manifest.json.bak`;
    const content = JSON.stringify(this.currentSession, null, 2);

    try {
      // 1. Escritura atómica vía archivo temporal
      await FileSystem.writeAsStringAsync(manifestTmp, content);
      
      // 2. Backup previo si existe
      const currentInfo = await FileSystem.getInfoAsync(manifestPath);
      if (currentInfo.exists) {
        await FileSystem.copyAsync({ from: manifestPath, to: manifestBak });
      }

      // 3. Reemplazar archivo principal
      await FileSystem.copyAsync({ from: manifestTmp, to: manifestPath });
      await FileSystem.deleteAsync(manifestTmp, { idempotent: true });
    } catch (e) {
      console.error('Error guardando manifest atómico:', e);
    }
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
