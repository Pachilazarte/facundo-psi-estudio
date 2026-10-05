@echo off
title PsiEstudio — Servidor Backend DSP & Desgrabador Verbatim
color 0A
echo ==============================================================
echo   PSIESTUDIO — SERVIDOR BACKEND DSP VERBATIM (FASTER-WHISPER)
echo ==============================================================
echo.
echo [1/2] Verificando dependencias de Python y FFmpeg...
pip install -r requirements.txt audioop-lts imageio-ffmpeg >nul 2>&1

echo.
echo [2/2] Iniciando Servidor FastAPI en http://localhost:8000...
echo.
echo ==============================================================
echo  - Servidor listo para escuchar en: http://localhost:8000
echo  - Abrir la app web en: http://localhost:3000 o Netlify
echo  - Presiona CTRL+C para detener el servidor en cualquier momento
echo ==============================================================
echo.

python server.py

pause
