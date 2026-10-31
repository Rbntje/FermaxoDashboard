@echo off
setlocal
title Fermaxo Racing Dashboard
cd /d "%~dp0telemetry-bridge"
where py >nul 2>&1
if errorlevel 1 (
  echo Python launcher not found. Install Python 3.10+ and try again.
  pause
  exit /b 1
)
set "UDP_HOST=127.0.0.1"
set /p UDP_HOST=UDP listen IP [127.0.0.1; use gaming PC LAN IP for console]: 
if "%UDP_HOST%"=="" set "UDP_HOST=127.0.0.1"
echo Checking bridge dependency...
py -m pip install -r requirements.txt
if errorlevel 1 (
  echo Could not install the WebSocket dependency.
  pause
  exit /b 1
)
echo Opening dashboard. Leave this window open while racing.
start "" "%~dp0index.html"
py bridge.py --udp-host "%UDP_HOST%"
pause
