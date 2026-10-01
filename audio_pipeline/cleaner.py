"""
Módulo de Procesamiento Digital de Señales (DSP) para Clases Universitarias
=============================================================================
Aplica una cadena de 5 etapas para transformar grabaciones de aula ruidosas
con eco y distancia variable del docente en una pista limpia y nítida.
"""

import os
import subprocess
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("AudioDSP")


class LectureAudioCleaner:
    def __init__(
        self,
        highpass_freq: int = 100,
        lowpass_freq: int = 3800,
        noise_reduction_db: int = 12,
        noise_floor_db: int = -25,
        target_lufs: float = -16.0,
        peak_limit_db: float = -1.5,
    ):
        self.highpass_freq = highpass_freq
        self.lowpass_freq = lowpass_freq
        self.noise_reduction_db = noise_reduction_db
        self.noise_floor_db = noise_floor_db
        self.target_lufs = target_lufs
        self.peak_limit_db = peak_limit_db

    def build_filter_chain(self) -> str:
        """Construye la cadena de filtros FFmpeg optimizada para voz en aulas."""
        filters = [
            f"highpass=f={self.highpass_freq}",
            f"lowpass=f={self.lowpass_freq}",
            f"afftdn=nr={self.noise_reduction_db}:nf={self.noise_floor_db}",
            "dynaudnorm=f=150:g=15:m=10.0:r=0.9",
            f"loudnorm=I={self.target_lufs}:TP={self.peak_limit_db}:LRA=11",
        ]
        return ",".join(filters)

    def clean_audio_file(self, input_path: str, output_path: str = None) -> str:
        """
        Procesa el archivo de audio con FFmpeg aplicando la cadena DSP completa.
        Retorna la ruta del archivo limpio en formato M4A (AAC 128k).
        """
        in_file = Path(input_path).resolve()
        if not in_file.exists():
            raise FileNotFoundError(f"Archivo de entrada no encontrado: {input_path}")

        if output_path is None:
            output_path = in_file.parent / f"{in_file.stem}_limpio.m4a"
        out_file = Path(output_path).resolve()

        filter_chain = self.build_filter_chain()

        cmd = [
            "ffmpeg",
            "-y",  # Sobrescribir salida si existe
            "-i", str(in_file),
            "-af", filter_chain,
            "-c:a", "aac",
            "-b:a", "128k",
            "-ar", "44100",
            "-ac", "1",  # Mono para mayor claridad fonética y menor peso
            str(out_file),
        ]

        logger.info(f"Iniciando limpieza acústica DSP: {in_file.name} -> {out_file.name}")
        logger.info(f"Filtro aplicado: {filter_chain}")

        try:
            result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
            logger.info(f"Limpieza completada con éxito: {out_file}")
            return str(out_file)
        except subprocess.CalledProcessError as e:
            logger.error(f"Error al ejecutar FFmpeg: {e.stderr.decode('utf-8', errors='ignore')}")
            raise RuntimeError(f"Fallo en el procesamiento de FFmpeg: {e}")
        except FileNotFoundError:
            raise EnvironmentError("FFmpeg no está instalado en el PATH del sistema.")


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        cleaner = LectureAudioCleaner()
        out = cleaner.clean_audio_file(sys.argv[1])
        print(f"Resultado procesado: {out}")
    else:
        print("Uso: python cleaner.py <ruta_audio_clase.m4a>")
