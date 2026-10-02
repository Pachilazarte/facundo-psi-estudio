import * as FileSystem from 'expo-file-system';
import { ClassSessionManifest } from './AudioRecorderService';

export interface SyncProgressCallback {
  (progressPct: number, currentChunk: string, message: string): void;
}

export interface JobStatusResponse {
  job_id: string;
  session_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  step?: string;
  progress?: number;
  error?: string;
  result?: {
    transcript_url: string;
    audio_url: string;
    duration_seconds: number;
    total_segments: number;
  };
}

export class SyncService {
  private serverUrl: string;

  constructor(serverUrl: string = 'http://localhost:8000') {
    this.serverUrl = serverUrl.replace(/\/$/, '');
  }

  public setServerUrl(url: string) {
    this.serverUrl = url.replace(/\/$/, '');
  }

  public getServerUrl(): string {
    return this.serverUrl;
  }

  /**
   * Comprueba el estado de salud del servidor con timeout defensivo de 3.5s
   */
  async checkServerHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.serverUrl}/api/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3500),
      });
      if (!response.ok) return false;
      const data = await response.json();
      return data.status === 'healthy' || data.status === 'ok';
    } catch {
      return false;
    }
  }

  /**
   * Helper para reintentos exponenciales ante cortes de red
   */
  private async _uploadWithRetry(
    url: string,
    filePath: string,
    maxRetries: number = 3
  ): Promise<FileSystem.FileSystemUploadResult> {
    let attempt = 0;
    let lastError: any = null;

    while (attempt < maxRetries) {
      try {
        const uploadResult = await FileSystem.uploadAsync(url, filePath, {
          fieldName: 'file',
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        });

        if (uploadResult.status === 200 || uploadResult.status === 201) {
          return uploadResult;
        } else {
          throw new Error(`HTTP ${uploadResult.status}: ${uploadResult.body}`);
        }
      } catch (err) {
        attempt++;
        lastError = err;
        console.warn(`[SyncService] Reintento ${attempt}/${maxRetries} para ${filePath}:`, err);
        if (attempt < maxRetries) {
          const delayMs = Math.pow(2, attempt - 1) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    throw new Error(`Error definitivo tras ${maxRetries} intentos al subir ${filePath}: ${lastError?.message || lastError}`);
  }

  /**
   * Sincroniza una sesión completa de clase subiendo chunks y encolando el job de inferencia
   */
  async syncSession(
    session: ClassSessionManifest,
    onProgress?: SyncProgressCallback,
    options: {
      preset?: string;
      applyDsp?: boolean;
      transcribe?: boolean;
    } = {}
  ): Promise<{ jobId: string; statusUrl: string }> {
    const totalChunks = session.chunks.length;
    if (totalChunks === 0) {
      throw new Error('La sesión no contiene fragmentos de audio para sincronizar.');
    }

    // 1. Crear sesión en el backend si no existe (con timeout defensivo)
    if (onProgress) onProgress(5, '', 'Creando sesión remota...');
    const createRes = await fetch(`${this.serverUrl}/api/sessions/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: session.sessionId,
        materia: session.materiaNombre,
        clase_numero: session.claseNumero,
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (!createRes.ok && createRes.status !== 409) {
      throw new Error(`Error creando sesión remota: HTTP ${createRes.status}`);
    }

    // 2. Subir chunks de audio con reintentos y reporte de progreso
    const baseDir = `${FileSystem.documentDirectory}classes/${session.sessionId}/`;
    let uploadedCount = 0;

    for (let i = 0; i < totalChunks; i++) {
      const chunk = session.chunks[i];
      const chunkPath = `${baseDir}${chunk.filename}`;
      const fileInfo = await FileSystem.getInfoAsync(chunkPath);

      if (!fileInfo.exists) {
        console.warn(`[SyncService] Archivo de chunk no encontrado localmente: ${chunkPath}`);
        continue;
      }

      if (onProgress) {
        const pct = 10 + Math.floor((uploadedCount / totalChunks) * 55);
        onProgress(pct, chunk.filename, `Subiendo fragmento ${i + 1}/${totalChunks}...`);
      }

      const uploadUrl = `${this.serverUrl}/api/sessions/${session.sessionId}/upload-chunk`;
      await this._uploadWithRetry(uploadUrl, chunkPath, 3);
      uploadedCount++;
    }

    // 3. Disparar procesamiento asíncrono en FastAPI
    if (onProgress) onProgress(70, '', 'Encolando DSP EBU R128 y transcripción Faster-Whisper...');
    const processRes = await fetch(`${this.serverUrl}/api/sessions/${session.sessionId}/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preset: options.preset || 'estudio_balanceado',
        apply_dsp: options.applyDsp ?? true,
        transcribe: options.transcribe ?? true,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!processRes.ok) {
      throw new Error(`Error al iniciar procesamiento: HTTP ${processRes.status}`);
    }

    const processData = await processRes.json();
    if (onProgress) onProgress(80, '', 'Procesamiento encolado con éxito en el servidor.');

    return {
      jobId: processData.job_id,
      statusUrl: `${this.serverUrl}${processData.status_url}`,
    };
  }

  /**
   * Consulta el estado actual de un job de inferencia
   */
  async pollJobStatus(jobId: string): Promise<JobStatusResponse> {
    const res = await fetch(`${this.serverUrl}/api/jobs/${jobId}`, {
      method: 'GET',
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`Job no encontrado (HTTP ${res.status})`);
    return await res.json();
  }

  /**
   * Sondeo continuo con timeout de seguridad (15m) hasta que el job finalice
   */
  async waitForJobCompletion(
    jobId: string,
    onProgress?: (progressPct: number, step: string) => void,
    maxTimeoutMs: number = 900000
  ): Promise<JobStatusResponse> {
    const startTime = Date.now();
    const pollIntervalMs = 2000;

    while (Date.now() - startTime < maxTimeoutMs) {
      try {
        const job = await this.pollJobStatus(jobId);

        if (job.status === 'completed') {
          if (onProgress) onProgress(100, '¡Desgrabación completada con éxito!');
          return job;
        }

        if (job.status === 'failed') {
          throw new Error(job.error || 'El procesamiento de audio falló en el servidor backend.');
        }

        if (onProgress) {
          const rawProgress = job.progress || 80;
          const mappedProgress = 80 + Math.floor((rawProgress / 100) * 20);
          onProgress(mappedProgress, job.step || 'Procesando audio y generando transcripción...');
        }
      } catch (err: any) {
        if (err.message && err.message.includes('falló en el servidor')) {
          throw err;
        }
        console.warn('[SyncService] Advertencia en polling (reintentando...):', err);
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error('Tiempo de espera agotado (Timeout de 15m) esperando la respuesta del servidor de inferencia.');
  }

  /**
   * Descarga el JSON estructurado de la transcripción final
   */
  async fetchTranscriptResult(sessionId: string): Promise<any> {
    const res = await fetch(`${this.serverUrl}/api/sessions/${sessionId}/transcript`, {
      method: 'GET',
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`Transcripción no disponible (HTTP ${res.status})`);
    return await res.json();
  }
}
