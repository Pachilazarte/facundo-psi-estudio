"""
Módulo Gestor de Sesiones de Audio y Concatenación (Append / Chunks)
=====================================================================
Permite pausar una clase, reanudarla horas o días después, y fusionar
todos los fragmentos (chunks) en un archivo master unificado sin pérdida.
"""

import os
import json
import subprocess
import logging
from pathlib import Path
from typing import List, Dict, Any

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("SessionMerger")


class AudioSessionManager:
    def __init__(self, base_dir: str = "./sessions"):
        self.base_dir = Path(base_dir).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def get_or_create_session(self, session_id: str, materia: str = "", clase_num: int = 1) -> Path:
        """Crea o carga el directorio y manifest de la sesión."""
        session_folder = self.base_dir / session_id
        session_folder.mkdir(parents=True, exist_ok=True)
        manifest_path = session_folder / "session_manifest.json"

        if not manifest_path.exists():
            manifest = {
                "session_id": session_id,
                "materia": materia,
                "clase_numero": clase_num,
                "chunks": [],
                "estado": "activa",
                "master_file": None
            }
            with open(manifest_path, "w", encoding="utf-8") as f:
                json.dump(manifest, f, indent=2)

        return session_folder

    def register_chunk(self, session_id: str, chunk_filename: str) -> Dict[str, Any]:
        """Registra un nuevo fragmento de audio en el manifest."""
        session_folder = self.base_dir / session_id
        manifest_path = session_folder / "session_manifest.json"

        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        chunk_path = session_folder / chunk_filename
        if chunk_path.exists() and chunk_filename not in manifest["chunks"]:
            manifest["chunks"].append(chunk_filename)
            with open(manifest_path, "w", encoding="utf-8") as f:
                json.dump(manifest, f, indent=2)

        return manifest

    def merge_session_chunks(self, session_id: str, output_filename: str = "master_completo.m4a") -> str:
        """
        Concatena todos los fragmentos (.caf o .m4a) de forma lossless usando el demuxer de FFmpeg.
        """
        session_folder = self.base_dir / session_id
        manifest_path = session_folder / "session_manifest.json"

        if not manifest_path.exists():
            raise FileNotFoundError(f"Manifest no encontrado para la sesión: {session_id}")

        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        chunks = manifest.get("chunks", [])
        if not chunks:
            raise ValueError(f"No hay fragmentos de audio para unir en la sesión: {session_id}")

        if len(chunks) == 1:
            # Solo hay un chunk, no requiere merge
            single_chunk = session_folder / chunks[0]
            logger.info(f"Sesión con un único fragmento: {single_chunk}")
            return str(single_chunk)

        # Crear archivo temporal de lista para FFmpeg concat demuxer
        concat_list_file = session_folder / "concat_list.txt"
        with open(concat_list_file, "w", encoding="utf-8") as f:
            for c in chunks:
                chunk_file = (session_folder / c).resolve()
                f.write(f"file '{chunk_file.as_posix()}'\n")

        master_out = session_folder / output_filename

        cmd = [
            "ffmpeg",
            "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", str(concat_list_file),
            "-c:a", "aac",
            "-b:a", "128k",
            str(master_out)
        ]

        logger.info(f"Fusionando {len(chunks)} fragmentos de la sesión {session_id}...")
        try:
            subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
            manifest["master_file"] = output_filename
            manifest["estado"] = "finalizada"
            with open(manifest_path, "w", encoding="utf-8") as f:
                json.dump(manifest, f, indent=2)
            logger.info(f"Merge exitoso: {master_out}")
            return str(master_out)
        except subprocess.CalledProcessError as e:
            logger.error(f"Error al concatenar fragmentos: {e.stderr.decode('utf-8', errors='ignore')}")
            raise RuntimeError(f"Fallo al fusionar fragmentos: {e}")
