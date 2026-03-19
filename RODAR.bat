@echo off
title eSocial SST - Backend
echo.
echo ========================================
echo   Elaborador SST + eSocial SST
echo ========================================
echo.
cd /d "%~dp0backend"

if not exist node_modules (
    echo Instalando dependencias pela primeira vez...
    npm install
    echo.
)

echo Iniciando servidor...
echo.
echo Quando aparecer "Backend rodando", abra o navegador em:
echo   http://localhost:3001
echo.
echo Para parar: pressione Ctrl+C
echo.
node server.js
pause
