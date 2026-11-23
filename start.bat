@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\manage.ps1" start
if errorlevel 1 (
    pause
    exit /b 1
)
start "" "http://127.0.0.1:5173/#home"
exit /b 0
