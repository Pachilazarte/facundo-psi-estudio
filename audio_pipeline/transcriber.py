"""
Módulo de Transcripción Textual Verbatim (Estilo TurboScribe / Notas de Voz iOS)
===============================================================================
Genera la desgrabación palabra por palabra, exacta y fiel a lo hablado en clase,
con marcas de tiempo limpias, puntuación precisa y sin resúmenes ni alteraciones.
"""

import os
import json
import logging
from pathlib import Path
from typing import Dict, Any, List

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("VerbatimTranscriber")


class VerbatimLectureTranscriber:
    def __init__(self, model_size: str = "large-v3", device: str = "auto", compute_type: str = "auto"):
        self.model_size = model_size
        self.device = device
        self.compute_type = compute_type
        self._model = None

    def _load_model(self):
        if self._model is None:
            try:
                from faster_whisper import WhisperModel
                logger.info(f"Cargando motor de transcripción Faster-Whisper ({self.model_size})...")
                self._model = WhisperModel(
                    self.model_size,
                    device=self.device,
                    compute_type=self.compute_type
                )
                logger.info("Motor cargado correctamente.")
            except ImportError:
                raise ImportError("Por favor instala 'faster-whisper': pip install faster-whisper")

    def transcribe_verbatim(
        self,
        audio_path: str,
        language: str = "es",
        beam_size: int = 5
    ) -> Dict[str, Any]:
        """
        Transcribe el audio de forma 100% textual y exacta (estilo TurboScribe).
        Devuelve el texto continuo en párrafos y el desglose con marcas de tiempo.
        """
        self._load_model()
        audio_file = Path(audio_path).resolve()
        if not audio_file.exists():
            raise FileNotFoundError(f"Audio no encontrado: {audio_path}")

        logger.info(f"Iniciando transcripción textual de: {audio_file.name}")

        # VAD (Voice Activity Detection) para omitir baches largos sin perder palabras
        segments_generator, info = self._model.transcribe(
            str(audio_file),
            language=language,
            beam_size=beam_size,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500),
            word_timestamps=True  # Marcas de tiempo precisas palabra por palabra
        )

        segments = []
        parrafos = []
        lineas_timestamped = []

        current_paragraph = []
        current_char_count = 0

        for seg in segments_generator:
            start_m, start_s = divmod(int(seg.start), 60)
            start_h, start_m = divmod(start_m, 60)
            timestamp_str = f"{start_h:02d}:{start_m:02d}:{start_s:02d}"

            clean_text = seg.text.strip()
            if not clean_text:
                continue

            segments.append({
                "start": seg.start,
                "end": seg.end,
                "timestamp": timestamp_str,
                "text": clean_text
            })

            lineas_timestamped.append(f"[{timestamp_str}] {clean_text}")

            # Agrupar en párrafos naturales cada ~400 caracteres para lectura cómoda
            current_paragraph.append(clean_text)
            current_char_count += len(clean_text)
            if current_char_count > 400 and (clean_text.endswith(".") or clean_text.endswith("?")):
                parrafos.append(" ".join(current_paragraph))
                current_paragraph = []
                current_char_count = 0

        if current_paragraph:
            parrafos.append(" ".join(current_paragraph))

        texto_plano = "\n\n".join(parrafos)
        texto_con_tiempos = "\n".join(lineas_timestamped)

        logger.info(f"Transcripción finalizada: {len(segments)} segmentos procesados.")

        # Guardar archivo .txt idéntico a la descarga de TurboScribe
        txt_output = audio_file.parent / f"{audio_file.stem}_transcripcion.txt"
        with open(txt_output, "w", encoding="utf-8") as f:
            f.write(texto_con_tiempos)

        return {
            "archivo": audio_file.name,
            "duracion_segundos": info.duration,
            "texto_plano": texto_plano,
            "texto_con_marcas_tiempo": texto_con_tiempos,
            "segmentos": segments,
            "archivo_guardado": str(txt_output)
        }


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        t = VerbatimLectureTranscriber(model_size="small")
        res = t.transcribe_verbatim(sys.argv[1])
        print("=== TRANSCRIPCIÓN TEXTUAL ===")
        print(res["texto_con_marcas_tiempo"][:800])
    else:
        print("Uso: python transcriber.py <audio.m4a>")
