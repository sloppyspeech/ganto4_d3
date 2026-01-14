@echo off
title OptiFlow Launcher
echo ========================================
echo     OptiFlow - Starting Application
echo ========================================
echo.

:: Store the project root directory
set PROJECT_ROOT=%~dp0

:: Start Backend in a new terminal window
echo Starting Backend Server (Flask)...
start "OptiFlow Backend" cmd /k "cd /d %PROJECT_ROOT%backend && call %PROJECT_ROOT%euv_gantod3\Scripts\activate && python app.py"

:: Wait a moment for backend to initialize
timeout /t 3 /nobreak > nul

:: Start Frontend in a new terminal window
echo Starting Frontend Server (Vite)...
start "OptiFlow Frontend" cmd /k "cd /d %PROJECT_ROOT%frontend && npm run dev"

echo.
echo ========================================
echo     Servers are starting...
echo ========================================
echo.
echo   Backend:  http://127.0.0.1:5000
echo   Frontend: http://localhost:5173
echo.
echo   Close both terminal windows to stop
echo ========================================
