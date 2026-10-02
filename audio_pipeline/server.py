"""
API Backend para el Pipeline de Grabación, DSP y Desgrabación Textual de PsiEstudio
===================================================================================
Ecosistema: PsiVoice / PsiEstudio (Etapa 1 - Paso 4: API REST y Servidor de Inferencia)
Grado: Ingeniería de Producción y Procesamiento Asíncrono No Bloqueante

Características de Grado Industrial:
1. Arquitectura de Background Jobs asíncronos con polling de progreso en tiempo real (evita HTTP 504).
2. Streaming de audio con soporte de HTTP Byte Ranges (206 Partial Content) para seek instantáneo.
3. Subida atómica de fragmentos (.part -> validación -> commit) tolerante a fallos de red móvil.
4. Parámetros acústicos adaptativos (presets de aula) y glosarios dinámicos por materia.
5. Endpoints dedicados para consumo directo desde PsiEstudio Web (JSON interactivo, VTT, TXT, M4A).
6. CORS permisivo y manejo robusto de excepciones.
"""

import os
import re
import json
import uuid
import shutil
import logging
import threading
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional
from concurrent.futures import ThreadPoolExecutor

from fastapi import (
    FastAPI,
    UploadFile,
    File,
    Form,
    HTTPException,
    BackgroundTasks,
    Request,
    status,
)
from fastapi.responses import JSONResponse, FileResponse, Response, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from cleaner import LectureAudioCleaner, ClassroomAcousticPreset
from transcriber import VerbatimLectureTranscriber
from session_merger import AudioSessionManager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [AudioAPI] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("AudioAPI")

app = FastAPI(
    title="PsiEstudio Verbatim Audio & DSP API",
    description="Motor de Restauración Acústica de Aulas y Desgrabación Textual para la Facultad de Psicología",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inicialización de servicios
BASE_SESSIONS_DIR = Path("./uploaded_sessions").resolve()
BASE_SESSIONS_DIR.mkdir(parents=True, exist_ok=True)

session_manager = AudioSessionManager(base_dir=str(BASE_SESSIONS_DIR))
cleaner = LectureAudioCleaner()
transcriber = VerbatimLectureTranscriber(model_size="small")

executor = ThreadPoolExecutor(max_workers=2)

# Almacén en memoria de estados de Jobs
jobs_lock = threading.Lock()
ACTIVE_JOBS: Dict[str, Dict[str, Any]] = {}


# --- Modelos Pydantic ---
class CreateSessionRequest(BaseModel):
    session_id: Optional[str] = None
    materia: str = Field(default="General", description="Nombre de la materia universitaria")
    clase_numero: int = Field(default=1, ge=1, description="Número de clase")
    docente: Optional[str] = Field(default="", description="Nombre del docente")
    tema: Optional[str] = Field(default="", description="Tema de la clase")


class ProcessSessionRequest(BaseModel):
    preset: ClassroomAcousticPreset = Field(
        default=ClassroomAcousticPreset.ESTUDIO_BALANCEADO,
        description="Preset acústico para el filtrado DSP",
    )
    apply_dsp: bool = Field(default=True, description="Si se debe aplicar la limpieza acústica")
    transcribe: bool = Field(default=True, description="Si se debe generar la transcripción verbatim")
    custom_glossary: Optional[List[str]] = Field(default=None, description="Términos técnicos adicionales")


# --- Utilidad de Streaming de Audio por Rangos ---
def send_audio_bytes_range(file_path: Path, range_header: Optional[str]) -> Response:
    """Envía fragmentos de audio según la cabecera HTTP Range (206 Partial Content)."""
    file_size = file_path.stat().st_size
    content_type = "audio/mp4" if file_path.suffix.lower() in [".m4a", ".mp4", ".aac"] else "audio/wav"

    if not range_header:
        return FileResponse(file_path, media_type=content_type, headers={"Accept-Ranges": "bytes"})

    range_match = re.match(r"bytes=(\d+)-(\d*)", range_header)
    if not range_match:
        return Response(status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE)

    start = int(range_match.group(1))
    end = int(range_match.group(2)) if range_match.group(2) else file_size - 1

    if start >= file_size or end >= file_size or start > end:
        return Response(status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE)

    chunk_length = end - start + 1

    def iter_file():
        with open(file_path, "rb") as f:
            f.seek(start)
            bytes_left = chunk_length
            while bytes_left > 0:
                read_size = min(64 * 1024, bytes_left)
                data = f.read(read_size)
                if not data:
                    break
                bytes_left -= len(data)
                yield data

    headers = {
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Accept-Ranges": "bytes",
        "Content-Length": str(chunk_length),
        "Content-Type": content_type,
    }
    return StreamingResponse(iter_file(), status_code=status.HTTP_206_PARTIAL_CONTENT, headers=headers)


# --- Worker Asíncrono de Procesamiento ---
def _run_processing_job(job_id: str, session_id: str, options: ProcessSessionRequest):
    """Tarea en segundo plano que ejecuta el merge, filtrado DSP y transcripción sin bloquear el servidor."""
    with jobs_lock:
        ACTIVE_JOBS[job_id]["status"] = "in_progress"
        ACTIVE_JOBS[job_id]["step"] = "merging_chunks"
        ACTIVE_JOBS[job_id]["progress_pct"] = 5.0

    try:
        session_folder = BASE_SESSIONS_DIR / session_id
        manifest_file = session_folder / "session_manifest.json"
        
        with open(manifest_file, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        subject = manifest.get("materia", "General")

        # 1. Fusión Lossless de fragmentos
        logger.info(f"[Job {job_id}] Fusionando fragmentos de sesión {session_id}...")
        merge_result = session_manager.merge_session_chunks(session_id)
        master_raw_path = Path(merge_result["master_path"])

        with jobs_lock:
            ACTIVE_JOBS[job_id]["step"] = "dsp_cleaning"
            ACTIVE_JOBS[job_id]["progress_pct"] = 15.0

        # 2. Procesamiento DSP y Normalización EBU R128
        target_audio_for_whisper = master_raw_path
        clean_m4a_path = master_raw_path

        if options.apply_dsp:
            logger.info(f"[Job {job_id}] Iniciando DSP con preset: {options.preset.value}...")
            cleaner.preset = options.preset

            def dsp_progress(pct):
                with jobs_lock:
                    ACTIVE_JOBS[job_id]["progress_pct"] = round(15.0 + (pct * 0.35), 1)  # DSP = 15% a 50%
                    ACTIVE_JOBS[job_id]["step_detail"] = f"Filtrando audio ({pct:.0f}%)"

            dsp_res = cleaner.clean_audio_file(
                str(master_raw_path),
                export_whisper_wav=True,
                progress_callback=dsp_progress,
            )
            clean_m4a_path = Path(dsp_res["clean_m4a"])
            target_audio_for_whisper = Path(dsp_res.get("whisper_wav", dsp_res["clean_m4a"]))

        # 3. Transcripción Verbatim con Faster-Whisper
        transcription_result = None
        if options.transcribe:
            with jobs_lock:
                ACTIVE_JOBS[job_id]["step"] = "transcribing"
                ACTIVE_JOBS[job_id]["progress_pct"] = 50.0

            logger.info(f"[Job {job_id}] Iniciando transcripción Whisper de: {target_audio_for_whisper.name}...")

            def whisper_progress(pct, current_seg):
                with jobs_lock:
                    ACTIVE_JOBS[job_id]["progress_pct"] = round(50.0 + (pct * 0.48), 1)  # Whisper = 50% a 98%
                    ACTIVE_JOBS[job_id]["step_detail"] = f"Transcribiendo [{current_seg['timestamp']}]"

            transcription_result = transcriber.transcribe_verbatim(
                str(target_audio_for_whisper),
                subject=subject,
                custom_glossary=options.custom_glossary,
                progress_callback=whisper_progress,
            )

        with jobs_lock:
            ACTIVE_JOBS[job_id]["status"] = "completed"
            ACTIVE_JOBS[job_id]["progress_pct"] = 100.0
            ACTIVE_JOBS[job_id]["step"] = "done"
            ACTIVE_JOBS[job_id]["completed_at"] = datetime.utcnow().isoformat() + "Z"
            ACTIVE_JOBS[job_id]["result"] = {
                "session_id": session_id,
                "clean_audio_file": clean_m4a_path.name,
                "has_transcription": transcription_result is not None,
            }
        logger.info(f"[Job {job_id}] Procesamiento de sesión {session_id} completado con éxito.")

    except Exception as e:
        logger.error(f"[Job {job_id}] Error fatal durante el procesamiento: {e}", exc_info=True)
        with jobs_lock:
            ACTIVE_JOBS[job_id]["status"] = "failed"
            ACTIVE_JOBS[job_id]["error"] = str(e)


# --- Endpoints de la API ---

@app.get("/api/health")
def health_check():
    """Comprobación de estado del servicio."""
    return {
        "status": "healthy",
        "service": "PsiEstudio Verbatim Audio API",
        "version": "2.0.0",
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }


@app.get("/api/sessions")
def list_sessions():
    """Lista todas las sesiones registradas en el servidor."""
    sessions = []
    for item in BASE_SESSIONS_DIR.iterdir():
        if item.is_dir():
            manifest_file = item / "session_manifest.json"
            if manifest_file.exists():
                try:
                    with open(manifest_file, "r", encoding="utf-8") as f:
                        sessions.append(json.load(f))
                except Exception:
                    continue
    return {"total": len(sessions), "sessions": sessions}


@app.post("/api/sessions/create")
def create_session(payload: CreateSessionRequest):
    """Crea una nueva sesión académica con ID único o personalizado."""
    s_id = payload.session_id or f"session_{uuid.uuid4().hex[:10]}"
    folder = session_manager.get_or_create_session(
        session_id=s_id,
        materia=payload.materia,
        clase_num=payload.clase_numero,
        docente=payload.docente or "",
        tema=payload.tema or "",
    )
    return {
        "status": "created",
        "session_id": s_id,
        "folder": str(folder),
    }


@app.post("/api/sessions/{session_id}/upload-chunk")
async def upload_chunk(session_id: str, file: UploadFile = File(...)):
    """
    Sube un fragmento de audio de forma atómica (.part -> validación -> commit).
    """
    session_folder = session_manager.get_or_create_session(session_id)
    target_filename = file.filename or f"chunk_{uuid.uuid4().hex[:8]}.caf"
    target_path = session_folder / target_filename
    temp_part_path = session_folder / f".{target_filename}.part"

    try:
        with open(temp_part_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Validación de tamaño
        if temp_part_path.stat().st_size == 0:
            temp_part_path.unlink()
            raise HTTPException(status_code=400, detail="El fragmento subido está vacío (0 bytes).")

        # Renombrado atómico
        temp_part_path.replace(target_path)

        # Registro en el manifest
        manifest = session_manager.register_chunk(session_id, target_filename)

        return {
            "status": "chunk_saved",
            "session_id": session_id,
            "filename": target_filename,
            "total_chunks": manifest["total_chunks"],
            "session_duration_sec": manifest["total_duration_sec"],
        }
    except Exception as e:
        if temp_part_path.exists():
            temp_part_path.unlink()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/sessions/{session_id}/process", status_code=status.HTTP_202_ACCEPTED)
def trigger_processing(
    session_id: str,
    options: ProcessSessionRequest = ProcessSessionRequest(),
):
    """
    Inicia el procesamiento asíncrono en segundo plano (Merge + DSP + Whisper)
    y retorna inmediatamente un `job_id` para consultar el progreso sin timeouts.
    """
    session_folder = BASE_SESSIONS_DIR / session_id
    if not (session_folder / "session_manifest.json").exists():
        raise HTTPException(status_code=404, detail=f"Sesión no encontrada: {session_id}")

    job_id = f"job_{uuid.uuid4().hex[:12]}"
    with jobs_lock:
        ACTIVE_JOBS[job_id] = {
            "job_id": job_id,
            "session_id": session_id,
            "status": "queued",
            "progress_pct": 0.0,
            "step": "pending",
            "step_detail": "En cola de procesamiento",
            "created_at": datetime.utcnow().isoformat() + "Z",
        }

    executor.submit(_run_processing_job, job_id, session_id, options)

    return {
        "status": "accepted",
        "job_id": job_id,
        "session_id": session_id,
        "status_url": f"/api/jobs/{job_id}",
    }


@app.get("/api/jobs/{job_id}")
def get_job_status(job_id: str):
    """Consulta el estado y progreso en tiempo real de un trabajo de procesamiento."""
    with jobs_lock:
        job = ACTIVE_JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job no encontrado")
    return job


@app.get("/api/sessions/{session_id}/audio")
def stream_session_audio(session_id: str, request: Request):
    """
    Transmite el audio limpio de la clase con soporte de HTTP Byte Ranges (seek instantáneo).
    """
    session_folder = BASE_SESSIONS_DIR / session_id
    manifest_file = session_folder / "session_manifest.json"

    if not manifest_file.exists():
        raise HTTPException(status_code=404, detail="Sesión no encontrada")

    # Buscar master limpio prioritario, luego master raw
    candidates = list(session_folder.glob("*_limpio.m4a"))
    if not candidates:
        candidates = list(session_folder.glob("master_completo.m4a"))
    if not candidates:
        # Buscar primer chunk si es único
        candidates = list(session_folder.glob("*.m4a")) + list(session_folder.glob("*.caf"))

    if not candidates:
        raise HTTPException(status_code=404, detail="Pista de audio no disponible para esta sesión")

    target_audio = candidates[0]
    range_header = request.headers.get("range")
    return send_audio_bytes_range(target_audio, range_header)


@app.get("/api/sessions/{session_id}/transcript")
def get_session_transcript_json(session_id: str):
    """
    Retorna el documento JSON interactivo con marcas de tiempo a nivel de palabra
    para el visor de desgrabaciones de PsiEstudio Web.
    """
    session_folder = BASE_SESSIONS_DIR / session_id
    json_files = list(session_folder.glob("*_desgrabacion.json"))

    if not json_files:
        raise HTTPException(status_code=404, detail="Desgrabación JSON aún no disponible para esta sesión")

    with open(json_files[0], "r", encoding="utf-8") as f:
        return json.load(f)


@app.get("/api/sessions/{session_id}/vtt")
def get_session_vtt(session_id: str):
    """Entrega los subtítulos WebVTT de la clase."""
    session_folder = BASE_SESSIONS_DIR / session_id
    vtt_files = list(session_folder.glob("*.vtt"))
    if not vtt_files:
        raise HTTPException(status_code=404, detail="Archivo VTT no disponible")
    return FileResponse(vtt_files[0], media_type="text/vtt")


@app.get("/api/sessions/{session_id}/txt")
def get_session_txt(session_id: str):
    """Entrega el texto plano con timestamps [HH:MM:SS]."""
    session_folder = BASE_SESSIONS_DIR / session_id
    txt_files = list(session_folder.glob("*_transcripcion.txt"))
    if not txt_files:
        raise HTTPException(status_code=404, detail="Transcripción TXT no disponible")
    return FileResponse(txt_files[0], media_type="text/plain; charset=utf-8")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
