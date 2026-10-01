"""
API Backend para el Pipeline de Grabación, DSP y Desgrabación Textual de PsiEstudio
===================================================================================
Endpoints para recibir audios, gestionar fragmentos de grabación (Append),
limpiar acústica mediante DSP y generar la transcripción 100% textual (estilo TurboScribe).
"""

import os
import shutil
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from cleaner import LectureAudioCleaner
from transcriber import VerbatimLectureTranscriber
from session_merger import AudioSessionManager

app = FastAPI(title="PsiEstudio Verbatim Audio API", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_SESSIONS_DIR = Path("./uploaded_sessions").resolve()
session_manager = AudioSessionManager(base_dir=str(BASE_SESSIONS_DIR))
cleaner = LectureAudioCleaner()
transcriber = VerbatimLectureTranscriber(model_size="small")


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "PsiEstudio Verbatim Audio & DSP Pipeline"}


@app.post("/api/sessions/create")
def create_session(session_id: str = Form(...), materia: str = Form(""), clase_num: int = Form(1)):
    session_folder = session_manager.get_or_create_session(session_id, materia, clase_num)
    return {"status": "created", "session_id": session_id, "folder": str(session_folder)}


@app.post("/api/sessions/{session_id}/upload-chunk")
async def upload_chunk(session_id: str, file: UploadFile = File(...)):
    session_folder = session_manager.get_or_create_session(session_id)
    chunk_path = session_folder / file.filename

    with open(chunk_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    manifest = session_manager.register_chunk(session_id, file.filename)
    return {
        "status": "chunk_saved",
        "session_id": session_id,
        "filename": file.filename,
        "total_chunks": len(manifest["chunks"])
    }


@app.post("/api/sessions/{session_id}/finalize")
def finalize_session(session_id: str, apply_dsp: bool = True, transcribe_verbatim: bool = True):
    try:
        # 1. Merge de chunks si hubo pausas/reanudaciones
        merged_audio = session_manager.merge_session_chunks(session_id)

        # 2. Limpieza acústica DSP con FFmpeg para máxima inteligibilidad
        final_audio = merged_audio
        if apply_dsp:
            final_audio = cleaner.clean_audio_file(merged_audio)

        # 3. Transcripción 100% textual idéntica a TurboScribe / Notas de Voz iOS
        transcription_data = None
        if transcribe_verbatim:
            transcription_data = transcriber.transcribe_verbatim(final_audio)

        return {
            "status": "success",
            "session_id": session_id,
            "master_audio": final_audio,
            "transcripcion": transcription_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
