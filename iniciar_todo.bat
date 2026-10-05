@echo off
title PsiEstudio — Iniciar Suite Académica Completa
color 0A
echo ==============================================================
echo   PSIESTUDIO — SUITE ACADÉMICA (FRONTEND + BACKEND DSP)
echo ==============================================================
echo.
echo [1/2] Iniciando Servidor Backend Python en puerto 8000...
start "Backend DSP Python (Puerto 8000)" cmd /k "cd /d %~dp0audio_pipeline && python server.py"

echo [2/2] Iniciando Servidor Frontend en puerto 3000...
start "Frontend Web (Puerto 3000)" cmd /k "cd /d %~dp0audio_pipeline && python servir_web.py"

echo.
echo Abriendo la aplicación en el navegador...
timeout /t 3 >nul
start http://localhost:3000

echo ==============================================================
echo   PsiEstudio en ejecución en http://localhost:3000
echo ==============================================================
