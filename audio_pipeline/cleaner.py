"""
Módulo de Procesamiento Digital de Señales (DSP) para Clases Universitarias
=============================================================================
Ecosistema: PsiVoice / PsiEstudio (Etapa 1 - Paso 1: Motor de Restauración Acústica)
Grado: Ingeniería de Producción y Procesamiento Masivo de Audio (120+ minutos)

Características de Grado Industrial:
1. Streaming seguro de subprocesos sin riesgo de Deadlock en buffers de SO.
2. Modo Dual-Pass EBU R128 / ITU-R BS.1770-4 (eliminación de artefactos de bombeo).
3. Rango de frecuencias de inteligibilidad fonética optimizada (95 Hz - 7800 Hz).
4. Presets acústicos adaptativos para distintos entornos de aula universitaria.
5. Inspección defensiva con ffprobe (duración, sample rate, canales e integridad).
6. Exportación dual: M4A/AAC (reproductor web) y WAV 16kHz PCM (Whisper nativo).
7. Monitoreo de progreso en tiempo real mediante callbacks.
"""

import os
import re
import json
import shutil
import logging
import tempfile
import subprocess
from enum import Enum
from pathlib import Path
from typing import Optional, Callable, Dict, Any, Tuple

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [AudioDSP] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("AudioDSP")


class ClassroomAcousticPreset(str, Enum):
    """Presets acústicos adaptados a los escenarios comunes de la Facultad."""
    ESTUDIO_BALANCEADO = "estudio_balanceado"
    AULA_MAGNA_ECO = "aula_magna_eco"
    DOCENTE_LEJANO = "docente_lejano"
    RUIDO_VENTILADOR = "ruido_ventilador"


class AudioMetadata:
    """Contenedor de metadatos extraídos mediante ffprobe."""
    def __init__(self, duration_sec: float, sample_rate: int, channels: int, codec_name: str, size_bytes: int):
        self.duration_sec = duration_sec
        self.sample_rate = sample_rate
        self.channels = channels
        self.codec_name = codec_name
        self.size_bytes = size_bytes

    def __repr__(self) -> str:
        mins = int(self.duration_sec // 60)
        secs = int(self.duration_sec % 60)
        return (
            f"<AudioMetadata {mins}m{secs}s, {self.sample_rate}Hz, "
            f"{self.channels}ch, codec={self.codec_name}, size={self.size_bytes / (1024*1024):.2f}MB>"
        )


class LectureAudioCleaner:
    """
    Motor DSP de alto rendimiento para limpieza, eliminación de ruido de aula,
    balanceo dinámico de voz docente y normalización EBU R128.
    """

    def __init__(
        self,
        preset: ClassroomAcousticPreset = ClassroomAcousticPreset.ESTUDIO_BALANCEADO,
        highpass_freq: int = 95,
        lowpass_freq: int = 7800,
        target_lufs: float = -16.0,
        peak_limit_db: float = -1.5,
        max_loudness_range: float = 11.0,
    ):
        self.preset = preset
        self.highpass_freq = highpass_freq
        self.lowpass_freq = lowpass_freq
        self.target_lufs = target_lufs
        self.peak_limit_db = peak_limit_db
        self.max_loudness_range = max_loudness_range
        self._verify_ffmpeg_installation()

    @staticmethod
    def _verify_ffmpeg_installation() -> None:
        """Verifica que ffmpeg y ffprobe estén disponibles en el PATH del sistema."""
        if not shutil.which("ffmpeg"):
            raise EnvironmentError("FFmpeg no está instalado o no se encuentra en el PATH del sistema.")
        if not shutil.which("ffprobe"):
            raise EnvironmentError("FFprobe no está instalado o no se encuentra en el PATH del sistema.")

    def probe_audio(self, audio_path: Path) -> AudioMetadata:
        """
        Inspecciona defensivamente el archivo de audio para validar su integridad y extraer metadatos.
        """
        cmd = [
            "ffprobe",
            "-v", "error",
            "-show_entries", "format=duration,size:stream=sample_rate,channels,codec_name",
            "-of", "json",
            str(audio_path),
        ]

        try:
            res = subprocess.run(cmd, capture_output=True, text=True, check=True)
            info = json.loads(res.stdout)
            streams = info.get("streams", [])
            fmt = info.get("format", {})

            if not streams:
                raise ValueError(f"El archivo {audio_path.name} no contiene pistas de audio válidas.")

            audio_stream = next((s for s in streams if s.get("codec_name")), streams[0])
            duration = float(fmt.get("duration", 0.0) or audio_stream.get("duration", 0.0))
            sample_rate = int(audio_stream.get("sample_rate", 44100))
            channels = int(audio_stream.get("channels", 1))
            codec = audio_stream.get("codec_name", "unknown")
            size_bytes = int(fmt.get("size", audio_path.stat().st_size))

            return AudioMetadata(duration, sample_rate, channels, codec, size_bytes)
        except subprocess.CalledProcessError as e:
            logger.error(f"Error al analizar con ffprobe: {e.stderr}")
            raise RuntimeError(f"Archivo de audio corrupto o ilegible: {audio_path}")
        except Exception as e:
            logger.error(f"Fallo al parsear metadatos de audio: {e}")
            raise

    def _get_preset_filters(self) -> Tuple[int, int, str]:
        """
        Configura los parámetros acústicos según el preset de aula seleccionado.
        Retorna (hp_freq, lp_freq, afftdn_params, dynaudnorm_params).
        """
        if self.preset == ClassroomAcousticPreset.AULA_MAGNA_ECO:
            # Atenuación agresiva de frecuencias bajas resonantes y control rápido de picos
            hp = max(self.highpass_freq, 110)
            lp = min(self.lowpass_freq, 7200)
            afftdn = "afftdn=nr=16:nf=-22:tn=1"
            dyn = "dynaudnorm=f=120:g=18:m=12.0:r=0.95:p=0.95"
        elif self.preset == ClassroomAcousticPreset.DOCENTE_LEJANO:
            # Gran realce dinámico de susurros/docente que se aleja del micrófono + ecualización de presencia
            hp = 90
            lp = 7800
            afftdn = "afftdn=nr=14:nf=-25"
            dyn = "dynaudnorm=f=180:g=25:m=18.0:r=0.88,equalizer=f=3200:t=q:w=1.5:g=3.5"
        elif self.preset == ClassroomAcousticPreset.RUIDO_VENTILADOR:
            # Filtro notch para armónicos eléctricos (50Hz / 100Hz) y supresor estacionario
            hp = 120
            lp = 7500
            afftdn = "afftdn=nr=18:nf=-20:om=o,bandreject=f=50:w=5,bandreject=f=100:w=5"
            dyn = "dynaudnorm=f=150:g=15:m=10.0:r=0.90"
        else:  # ESTUDIO_BALANCEADO
            hp = self.highpass_freq
            lp = self.lowpass_freq
            afftdn = "afftdn=nr=12:nf=-25"
            dyn = "dynaudnorm=f=150:g=15:m=10.0:r=0.90"

        return hp, lp, f"{afftdn},{dyn}"

    def _measure_loudness_first_pass(self, input_path: Path, base_filters: str) -> Dict[str, str]:
        """
        Pase 1 de EBU R128: Mide la sonoridad integrada y los picos verdaderos
        en modo turbo sin generar archivo de audio de salida.
        """
        filter_str = f"{base_filters},loudnorm=I={self.target_lufs}:TP={self.peak_limit_db}:LRA={self.max_loudness_range}:print_format=json"

        cmd = [
            "ffmpeg",
            "-hide_banner",
            "-nostats",
            "-i", str(input_path),
            "-af", filter_str,
            "-vn",
            "-sn",
            "-f", "null",
            "-" if os.name != "nt" else "NUL",
        ]

        logger.info("Ejecutando Pase 1 (Medición de Sonoridad EBU R128)...")
        res = subprocess.run(cmd, capture_output=True, text=True)
        stderr_output = res.stderr

        # Extraer el bloque JSON que arroja loudnorm
        json_match = re.search(r"\{\s*\"input_i\"[\s\S]*?\}", stderr_output)
        if not json_match:
            logger.warning("No se pudo extraer el bloque JSON de loudnorm. Usando valores medidos por defecto.")
            return {
                "measured_I": "-24.0",
                "measured_TP": "-2.0",
                "measured_LRA": "10.0",
                "measured_thresh": "-34.0",
                "offset": "0.0",
            }

        try:
            parsed = json.loads(json_match.group(0))
            return {
                "measured_I": parsed.get("input_i", "-24.0"),
                "measured_TP": parsed.get("input_tp", "-2.0"),
                "measured_LRA": parsed.get("input_lra", "10.0"),
                "measured_thresh": parsed.get("input_thresh", "-34.0"),
                "offset": parsed.get("target_offset", "0.0"),
            }
        except Exception as e:
            logger.warning(f"Fallo al decodificar JSON de loudnorm: {e}. Usando valores base.")
            return {
                "measured_I": "-24.0",
                "measured_TP": "-2.0",
                "measured_LRA": "10.0",
                "measured_thresh": "-34.0",
                "offset": "0.0",
            }

    def _execute_ffmpeg_with_progress(
        self,
        cmd: list,
        total_duration_sec: float,
        progress_callback: Optional[Callable[[float], None]] = None,
        timeout_sec: Optional[int] = None,
    ) -> None:
        """
        Ejecuta FFmpeg con streaming de stderr línea por línea para evitar Deadlocks
        de buffer en archivos largos de 2+ horas y emite el porcentaje de progreso.
        """
        # Calcular timeout defensivo si no fue especificado (mínimo 300s o 3x duración)
        effective_timeout = timeout_sec or max(300, int(total_duration_sec * 3.0))

        process = subprocess.Popen(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            universal_newlines=True,
            encoding="utf-8",
            errors="ignore",
            bufsize=1,
        )

        time_pattern = re.compile(r"time=(\d+):(\d+):(\d+\.\d+)")

        try:
            for line in process.stderr:
                match = time_pattern.search(line)
                if match and total_duration_sec > 0:
                    hours, minutes, seconds = match.groups()
                    current_sec = int(hours) * 3600 + int(minutes) * 60 + float(seconds)
                    pct = min(100.0, (current_sec / total_duration_sec) * 100.0)
                    if progress_callback:
                        progress_callback(pct)

            process.wait(timeout=effective_timeout)
            if process.returncode != 0:
                raise RuntimeError(f"FFmpeg finalizó con código de error {process.returncode}")

            if progress_callback:
                progress_callback(100.0)

        except subprocess.TimeoutExpired:
            process.kill()
            raise TimeoutError(f"El procesamiento de audio excedió el tiempo límite de {effective_timeout}s.")
        except Exception:
            process.kill()
            raise

    def clean_audio_file(
        self,
        input_path: str,
        output_path: Optional[str] = None,
        export_whisper_wav: bool = True,
        progress_callback: Optional[Callable[[float], None]] = None,
    ) -> Dict[str, str]:
        """
        Procesa el archivo aplicando la cadena completa DSP de Grado Producción.
        
        Retorna un diccionario con:
        - "clean_m4a": Ruta del audio restaurado en M4A AAC (para reproducción en PsiEstudio).
        - "whisper_wav": Ruta opcional del audio en WAV PCM 16kHz mono (optimizado para transcripción).
        """
        in_file = Path(input_path).resolve()
        if not in_file.exists():
            raise FileNotFoundError(f"Archivo de entrada no encontrado: {input_path}")

        meta = self.probe_audio(in_file)
        logger.info(f"Audio verificado: {in_file.name} | {meta}")

        # Definición de rutas de salida
        if output_path is None:
            out_m4a = in_file.parent / f"{in_file.stem}_limpio.m4a"
        else:
            out_m4a = Path(output_path).resolve()

        hp, lp, dsp_body = self._get_preset_filters()
        base_filter_chain = f"highpass=f={hp},lowpass=f={lp},{dsp_body}"

        # Pase 1: Medición de sonoridad integrada EBU R128
        def p1_callback(pct: float):
            if progress_callback:
                progress_callback(pct * 0.3)  # Pase 1 representa el 30% del progreso total

        loud_stats = self._measure_loudness_first_pass(in_file, base_filter_chain)
        logger.info(f"Estadísticas de sonoridad obtenidas: {loud_stats}")

        # Pase 2: Construcción del filtro lineal exacto
        pass2_loudnorm = (
            f"loudnorm=I={self.target_lufs}:TP={self.peak_limit_db}:LRA={self.max_loudness_range}:"
            f"measured_I={loud_stats['measured_I']}:measured_TP={loud_stats['measured_TP']}:"
            f"measured_LRA={loud_stats['measured_LRA']}:measured_thresh={loud_stats['measured_thresh']}:"
            f"offset={loud_stats['offset']}:linear=true"
        )
        final_filter_chain = f"{base_filter_chain},{pass2_loudnorm}"

        logger.info(f"Ejecutando Pase 2 (Filtrado DSP y Normalización Lineal)...")

        # Comando principal para generar el M4A optimizado para web (AAC 128k mono 44.1kHz)
        cmd_m4a = [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-i", str(in_file),
            "-af", final_filter_chain,
            "-c:a", "aac",
            "-b:a", "128k",
            "-ar", "44100",
            "-ac", "1",
            str(out_m4a),
        ]

        def p2_callback(pct: float):
            if progress_callback:
                progress_callback(30.0 + pct * 0.7)  # Pase 2 representa el 70% restante

        self._execute_ffmpeg_with_progress(
            cmd_m4a,
            total_duration_sec=meta.duration_sec,
            progress_callback=p2_callback,
        )

        results = {"clean_m4a": str(out_m4a)}
        logger.info(f"Audio limpio para reproducción generado: {out_m4a.name}")

        # Exportación opcional de WAV 16kHz PCM nativo para acelerar Faster-Whisper
        if export_whisper_wav:
            out_wav = in_file.parent / f"{in_file.stem}_whisper16k.wav"
            cmd_wav = [
                "ffmpeg",
                "-y",
                "-hide_banner",
                "-i", str(out_m4a),
                "-c:a", "pcm_s16le",
                "-ar", "16000",
                "-ac", "1",
                str(out_wav),
            ]
            logger.info("Generando pista WAV 16kHz PCM mono para Whisper...")
            subprocess.run(cmd_wav, capture_output=True, check=True)
            results["whisper_wav"] = str(out_wav)
            logger.info(f"Pista optimizada para Whisper generada: {out_wav.name}")

        return results


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        cleaner = LectureAudioCleaner(preset=ClassroomAcousticPreset.ESTUDIO_BALANCEADO)
        res = cleaner.clean_audio_file(
            sys.argv[1],
            progress_callback=lambda p: print(f"\rProgreso DSP: {p:.1f}%", end="", flush=True)
        )
        print(f"\nProcesamiento exitoso:\n{res}")
    else:
        print("Uso: python cleaner.py <ruta_audio_clase.caf|m4a|mp3>")
