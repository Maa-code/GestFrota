@echo off
chcp 65001 > nul
title GestFrota - Ambiente Completo Local
cd /d "%~dp0"

echo ============================================================
echo   GestFrota - Inicializando Banco, API, Worker, Gestao e PWA
echo ============================================================
echo.

call pnpm dev
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo [AVISO] A execucao foi interrompida ou encontrou um erro.
  pause
)
