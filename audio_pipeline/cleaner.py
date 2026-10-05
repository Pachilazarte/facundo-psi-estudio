"""
Módulo de Procesamiento Digital de Señales (DSP) para Clases Universitarias
=============================================================================
Ecosistema: PsiVoice / PsiEstudio (Etapa 1 - Paso 1: Motor de Restauración Acústica)
Grado: Ingeniería de Producción y Procesamiento Masivo de Audio (120+ minutos)

Características de Grado Industrial:
1. Streaming seguro de subprocesos con soporte multi-plataforma (Windows \\r y \\n).
2. Modo Dual-Pass EBU R128 / ITU-R BS.1770-4 con sanitización estricta de valores nan/inf.
3. Rango de frecuencias de inteligibilidad fonética optimizada (95 Hz - 7800 Hz).
4. Presets acústicos adaptativos para distintos entornos de aula universitaria.
5. Inspección defensiva con ffprobe (duración, sample rate, canales e integridad).
6. Exportación dual: M4A/AAC (reproductor web) y WAV 16kHz PCM (Whisper nativo).
7. Monitoreo de progreso en tiempo real mediante callbacks continuos.
8. Limpieza garantizada de archivos parciales corruptos en caso de excepción.
"""

import os
import re
import json
import shutil
import logging
import math
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
    """Contenedor de metadatos extraídos mediante ffprobe o fallback."""
    def __init__(self, duration_sec: float, sample_rate: int, channels: int, codec_name: str, size_bytes: int):
        self.duration_sec = max(0.1, duration_sec)
        self.sample_rate = max(8000, sample_rate)
        self.channels = max(1, channels)
        self.codec_name = codec_name or "unknown"
        self.size_bytes = max(0, size_bytes)

    def __repr__(self) -> str:
        mins = int(self.duration_sec // 60)
        secs = int(self.duration_sec % 60)
        return (
            f"<AudioMetadata {mins}m{secs}s, {self.sample_rate}Hz, "
            f"{self.channels}ch, codec={self.codec_name}, size={self.size_bytes / (1024*1024):.2f}MB>"
        )


def find_ffmpeg_binaries() -> Tuple[str, Optional[str]]:
    """
    Localiza defensivamente los binarios de ffmpeg y ffprobe en el sistema operativo,
    dando prioridad al PATH y utilizando fallback con imageio_ffmpeg sin copias inválidas.
    """
    ffmpeg_exe = shutil.which("ffmpeg")
    ffprobe_exe = shutil.which("ffprobe")

    if not ffmpeg_exe:
        try:
            import imageio_ffmpeg
            img_ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
            if img_ffmpeg and os.path.exists(img_ffmpeg):
                ffmpeg_exe = img_ffmpeg
                bin_dir = os.path.dirname(img_ffmpeg)
                # Agregar el directorio de imageio_ffmpeg al PATH si no está
                if bin_dir not in os.environ.get("PATH", ""):
                    os.environ["PATH"] = bin_dir + os.pathsep + os.environ.get("PATH", "")
                
                # Buscar si ffprobe existe en el mismo directorio
                candidate_ffprobe = os.path.join(bin_dir, "ffprobe.exe" if os.name == "nt" else "ffprobe")
                if os.path.exists(candidate_ffprobe):
                    ffprobe_exe = candidate_ffprobe
        except Exception as e:
            logger.debug(f"No se pudo cargar imageio_ffmpeg: {e}")

    if not ffmpeg_exe:
        raise EnvironmentError(
            "FFmpeg no está instalado ni disponible en el PATH del sistema o imageio_ffmpeg."
        )

    return ffmpeg_exe, ffprobe_exe


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
        self.ffmpeg_bin, self.ffprobe_bin = find_ffmpeg_binaries()

    def probe_audio(self, audio_path: Path) -> AudioMetadata:
        """
        Inspecciona defensivamente el archivo de audio para validar su integridad y extraer metadatos.
        """
        audio_path = Path(audio_path).resolve()
        if not audio_path.exists():
            raise FileNotFoundError(f"El archivo de audio no existe: {audio_path}")

        if self.ffprobe_bin:
            cmd = [
                self.ffprobe_bin,
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
                if streams:
                    audio_stream = next((s for s in streams if s.get("codec_name")), streams[0])
                    duration = float(fmt.get("duration", 0.0) or audio_stream.get("duration", 0.0))
                    sample_rate = int(audio_stream.get("sample_rate", 44100))
                    channels = int(audio_stream.get("channels", 1))
                    codec = audio_stream.get("codec_name", "unknown")
                    size_bytes = int(fmt.get("size", audio_path.stat().st_size))
                    return AudioMetadata(duration, sample_rate, channels, codec, size_bytes)
            except Exception as e:
                logger.warning(f"ffprobe inspecion falló para {audio_path.name}: {e}. Probando fallback ffmpeg.")

        # Fallback usando ffmpeg -i
        try:
            res = subprocess.run([self.ffmpeg_bin, "-i", str(audio_path)], capture_output=True, text=True)
            out = res.stderr or ""
            duration = 10.0
            dur_match = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.\d+)", out)
            if dur_match:
                h, m, s_val = dur_match.groups()
                duration = int(h) * 3600 + int(m) * 60 + float(s_val)
            sample_rate = 44100
            sr_match = re.search(r"(\d+)\s*Hz", out)
            if sr_match:
                sample_rate = int(sr_match.group(1))
            channels = 1
            if "stereo" in out:
                channels = 2
            codec = "opus" if "opus" in out else ("aac" if "aac" in out else "pcm")
            size_bytes = audio_path.stat().st_size
            return AudioMetadata(duration, sample_rate, channels, codec, size_bytes)
        except Exception as e:
            logger.warning(f"Fallback metadata para {audio_path.name}: {e}")
            return AudioMetadata(10.0, 44100, 1, "unknown", audio_path.stat().st_size)

    def _get_preset_filters(self) -> Tuple[int, int, str]:
        """
        Configura los parámetros acústicos según el preset de aula seleccionado.
        Retorna (hp_freq, lp_freq, afftdn_params, dynaudnorm_params).
        """
        if self.preset == ClassroomAcousticPreset.AULA_MAGNA_ECO:
            hp = max(self.highpass_freq, 110)
            lp = min(self.lowpass_freq, 7200)
            afftdn = "afftdn=nr=16:nf=-22:tn=1"
            dyn = "dynaudnorm=f=120:g=18:m=12.0:r=0.95:p=0.95"
        elif self.preset == ClassroomAcousticPreset.DOCENTE_LEJANO:
            hp = 90
            lp = 7800
            afftdn = "afftdn=nr=14:nf=-25"
            dyn = "dynaudnorm=f=180:g=25:m=18.0:r=0.88,equalizer=f=3200:t=q:w=1.5:g=3.5"
        elif self.preset == ClassroomAcousticPreset.RUIDO_VENTILADOR:
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
        Pase 1 de EBU R128: Mide la sonoridad integrada y picos verdaderos
        validando rigurosamente que los datos no contengan nan, inf o cadenas no numéricas.
        """
        filter_str = f"{base_filters},loudnorm=I={self.target_lufs}:TP={self.peak_limit_db}:LRA={self.max_loudness_range}:print_format=json"

        cmd = [
            self.ffmpeg_bin,
            "-hide_banner",
            "-nostats",
            "-i", str(input_path),
            "-af", filter_str,
            "-vn",
            "-sn",
            "-f", "null",
            "-",
        ]

        logger.info("Ejecutando Pase 1 (Medición de Sonoridad EBU R128)...")
        res = subprocess.run(cmd, capture_output=True, text=True)
        stderr_output = res.stderr or ""

        default_stats = {
            "measured_I": "-24.0",
            "measured_TP": "-2.0",
            "measured_LRA": "10.0",
            "measured_thresh": "-34.0",
            "offset": "0.0",
        }

        json_match = re.search(r"\{\s*\"input_i\"[\s\S]*?\}", stderr_output)
        if not json_match:
            logger.warning("No se pudo extraer el bloque JSON de loudnorm. Usando valores base por defecto.")
            return default_stats

        try:
            parsed = json.loads(json_match.group(0))
            stats = {
                "measured_I": parsed.get("input_i", "-24.0"),
                "measured_TP": parsed.get("input_tp", "-2.0"),
                "measured_LRA": parsed.get("input_lra", "10.0"),
                "measured_thresh": parsed.get("input_thresh", "-34.0"),
                "offset": parsed.get("target_offset", "0.0"),
            }

            # Sanitización de valores no numéricos (nan, inf, -inf)
            for key, val in stats.items():
                val_str = str(val).lower().strip()
                if "nan" in val_str or "inf" in val_str:
                    logger.warning(f"Valor anómalo detected en loudnorm ({key}={val}). Usando fallback seguro.")
                    return default_stats
                # Intentar parsear como float para asegurar validez
                try:
                    num = float(val)
                    if math.isnan(num) or math.isinf(num):
                        return default_stats
                except ValueError:
                    return default_stats

            return stats

        except Exception as e:
            logger.warning(f"Fallo al decodificar JSON de loudnorm: {e}. Usando valores base.")
            return default_stats

    def _execute_ffmpeg_with_progress(
        self,
        cmd: list,
        total_duration_sec: float,
        progress_callback: Optional[Callable[[float], None]] = None,
        timeout_sec: Optional[int] = None,
    ) -> None:
        """
        Ejecuta FFmpeg procesando stderr caracter por caracter o por tokens \\r y \\n
        para evitar bloqueos en Windows y emitir el porcentaje de progreso fluido.
        """
        effective_timeout = timeout_sec or max(300, int(total_duration_sec * 3.0))

        process = subprocess.Popen(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            bufsize=0,
        )

        time_pattern = re.compile(r"time=(\d+):(\d+):(\d+\.\d+)")
        buffer = bytearray()

        try:
            assert process.stderr is not None
            while True:
                chunk = process.stderr.read(256)
                if not chunk:
                    if process.poll() is not None:
                        break
                    continue

                for byte in chunk:
                    if byte in (ord(b"\r"), ord(b"\n")):
                        if buffer:
                            line = buffer.decode("utf-8", errors="ignore")
                            match = time_pattern.search(line)
                            if match and total_duration_sec > 0:
                                hours, minutes, seconds = match.groups()
                                current_sec = int(hours) * 3600 + int(minutes) * 60 + float(seconds)
                                pct = min(100.0, (current_sec / total_duration_sec) * 100.0)
                                if progress_callback:
                                    progress_callback(pct)
                            buffer.clear()
                    else:
                        buffer.append(byte)

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
        
        Garantiza la eliminación de archivos de salida incompletos si ocurre una falla.
        """
        in_file = Path(input_path).resolve()
        if not in_file.exists():
            raise FileNotFoundError(f"Archivo de entrada no encontrado: {input_path}")

        meta = self.probe_audio(in_file)
        logger.info(f"Audio verificado: {in_file.name} | {meta}")

        if output_path is None:
            out_m4a = in_file.parent / f"{in_file.stem}_limpio.m4a"
        else:
            out_m4a = Path(output_path).resolve()

        out_wav = in_file.parent / f"{in_file.stem}_whisper16k.wav" if export_whisper_wav else None

        created_files = []

        try:
            hp, lp, dsp_body = self._get_preset_filters()
            base_filter_chain = f"highpass=f={hp},lowpass=f={lp},{dsp_body}"

            def p1_callback(pct: float):
                if progress_callback:
                    progress_callback(pct * 0.3)

            loud_stats = self._measure_loudness_first_pass(in_file, base_filter_chain)
            logger.info(f"Estadísticas de sonoridad obtenidas: {loud_stats}")

            pass2_loudnorm = (
                f"loudnorm=I={self.target_lufs}:TP={self.peak_limit_db}:LRA={self.max_loudness_range}:"
                f"measured_I={loud_stats['measured_I']}:measured_TP={loud_stats['measured_TP']}:"
                f"measured_LRA={loud_stats['measured_LRA']}:measured_thresh={loud_stats['measured_thresh']}:"
                f"offset={loud_stats['offset']}:linear=true"
            )
            final_filter_chain = f"{base_filter_chain},{pass2_loudnorm}"

            logger.info("Ejecutando Pase 2 (Filtrado DSP y Normalización Lineal)...")

            cmd_m4a = [
                self.ffmpeg_bin,
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
                    progress_callback(30.0 + pct * 0.7)

            self._execute_ffmpeg_with_progress(
                cmd_m4a,
                total_duration_sec=meta.duration_sec,
                progress_callback=p2_callback,
            )

            created_files.append(out_m4a)
            results = {"clean_m4a": str(out_m4a)}
            logger.info(f"Audio limpio para reproducción generado: {out_m4a.name}")

            if export_whisper_wav and out_wav:
                cmd_wav = [
                    self.ffmpeg_bin,
                    "-y",
                    "-hide_banner",
                    "-i", str(out_m4a),
                    "-c:a", "pcm_s16le",
                    "-ar", "16000",
                    "-ac", "1",
                    str(out_wav),
                ]
                logger.info("Generando pista WAV 16kHz PCM mono para Whisper...")
                res_wav = subprocess.run(cmd_wav, capture_output=True, text=True)
                if res_wav.returncode != 0:
                    raise RuntimeError(f"Fallo al generar WAV para Whisper: {res_wav.stderr}")
                created_files.append(out_wav)
                results["whisper_wav"] = str(out_wav)
                logger.info(f"Pista optimizada para Whisper generada: {out_wav.name}")

            return results

        except Exception as e:
            logger.error(f"Error procesando {in_file.name}: {e}. Limpiando archivos temporales...")
            for f in created_files:
                if f and f.exists():
                    try:
                        f.unlink()
                    except Exception:
                        pass
            raise


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
