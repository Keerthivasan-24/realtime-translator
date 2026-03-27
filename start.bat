@echo off
echo Starting Realtime Translator...

:: Start backend in a new window
start "Backend" cmd /k "cd /d %~dp0backend && python -m uvicorn main:app --reload --port 8000"

:: Wait 2 seconds for backend to boot
timeout /t 2 /nobreak >nul

:: Start frontend in a new window
start "Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Both servers are starting in separate windows.
echo Open http://localhost:5173 in your browser.
echo.
pause
