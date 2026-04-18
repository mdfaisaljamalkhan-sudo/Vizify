@echo off
REM SubaDash Auto Launcher
REM This script starts both backend and frontend servers, then opens the app in browser

setlocal enabledelayedexpansion

REM Get the directory where this script is located
set SCRIPT_DIR=%~dp0

echo.
echo ========================================
echo   SubaDash Auto Launcher
echo ========================================
echo.

REM Start Backend (FastAPI)
echo Starting Backend (FastAPI on port 8000)...
start "SubaDash Backend" cmd /k "cd /d "%SCRIPT_DIR%backend" && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

REM Start Frontend (Vite)
echo Starting Frontend (Vite on port 5173)...
start "SubaDash Frontend" cmd /k "cd /d "%SCRIPT_DIR%frontend" && npm run dev"

REM Wait for services to start (10 seconds)
echo.
echo Waiting for services to start (10 seconds)...
timeout /t 10 /nobreak

REM Open browser
echo.
echo Opening SubaDash in browser...
start http://localhost:5173

echo.
echo ========================================
echo   Services Started Successfully!
echo ========================================
echo.
echo Frontend:  http://localhost:5173
echo Backend:   http://localhost:8000
echo.
echo Close this window or the terminal windows to stop the servers.
echo ========================================
echo.
