import { AppState, AppStateStatus } from 'react-native';
import { Audio } from 'expo-av';
import { AudioRecorderService } from './AudioRecorderService';

export interface InterruptionListener {
  onInterruptionBegan: () => void | Promise<void>;
  onInterruptionEnded: (shouldResume: boolean) => void | Promise<void>;
}

export class InterruptionHandler {
  private listener: InterruptionListener | null = null;
  private recorderService: AudioRecorderService | null = null;
  private appStateSubscription: any = null;
  private currentAppState: AppStateStatus = AppState.currentState;
  private wasRecordingBeforeInterruption: boolean = false;

  constructor(recorderService?: AudioRecorderService, listener?: InterruptionListener) {
    if (recorderService) {
      this.recorderService = recorderService;
    }
    if (listener) {
      this.listener = listener;
    }
    this._setupAppStateListener();
  }

  public setRecorderService(recorderService: AudioRecorderService) {
    this.recorderService = recorderService;
  }

  public setListener(listener: InterruptionListener) {
    this.listener = listener;
  }

  private _setupAppStateListener() {
    this.appStateSubscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      const isComingToForeground = this.currentAppState.match(/inactive|background/) && nextAppState === 'active';
      const isGoingToBackground = nextAppState.match(/inactive|background/);

      if (isGoingToBackground) {
        console.log('[InterruptionHandler] App pasando a segundo plano. Preservando sesión de grabación activa.');
      }

      if (isComingToForeground) {
        console.log('[InterruptionHandler] App regresó al primer plano.');
        // Re-verificar estado de sesión de audio por si el sistema operativo revocó el foco
        if (this.recorderService) {
          try {
            await this.recorderService.initAudioSession();
          } catch (e) {
            console.warn('[InterruptionHandler] Re-inicialización de sesión de audio post-foreground:', e);
          }
        }
      }

      this.currentAppState = nextAppState;
    });
  }

  /**
   * Maneja el inicio de una interrupción de audio de hardware (llamada entrante, alarma, etc.)
   */
  public async handleNativeInterruptionBegan(isCurrentlyRecording: boolean): Promise<void> {
    console.warn('[InterruptionHandler] Interrupción nativa iniciada. Salvaguardando buffer...');
    this.wasRecordingBeforeInterruption = isCurrentlyRecording;

    if (this.recorderService && isCurrentlyRecording) {
      try {
        // Pausar y persistir atómicamente el chunk actual para que no se pierda nada
        await this.recorderService.pauseRecording();
      } catch (e) {
        console.error('[InterruptionHandler] Error al salvaguardar chunk en interrupción:', e);
      }
    }

    if (this.listener?.onInterruptionBegan) {
      await this.listener.onInterruptionBegan();
    }
  }

  /**
   * Maneja la finalización de la interrupción (llamada terminada, foco de audio recuperado)
   */
  public async handleNativeInterruptionEnded(): Promise<void> {
    console.log('[InterruptionHandler] Interrupción nativa finalizada.');
    const shouldResume = this.wasRecordingBeforeInterruption;
    this.wasRecordingBeforeInterruption = false;

    if (this.recorderService) {
      try {
        await this.recorderService.initAudioSession();
      } catch (e) {
        console.warn('[InterruptionHandler] Error al re-inicializar audio post-interrupción:', e);
      }
    }

    if (this.listener?.onInterruptionEnded) {
      await this.listener.onInterruptionEnded(shouldResume);
    }
  }

  public cleanup() {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }
}
