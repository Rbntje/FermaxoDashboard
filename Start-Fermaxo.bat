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
set /p UDP_HOST=UDP listen IP [127.0.0.1; console: gaming PC LAN IP]: 
if "%UDP_HOST%"=="" set "UDP_HOST=127.0.0.1"
set "UDP_PORT=20777"
set /p UDP_PORT=UDP listen port [20777]: 
if "%UDP_PORT%"=="" set "UDP_PORT=20777"
echo Checking bridge dependency...
py -m pip install -r requirements.txt
if errorlevel 1 (
  echo Could not install the WebSocket dependency.
  pause
  exit /b 1
)
echo Opening dashboard. Leave this window open while racing.
start "" "http://127.0.0.1:20780/"
py bridge.py --udp-host "%UDP_HOST%" --udp-port "%UDP_PORT%"
pause
