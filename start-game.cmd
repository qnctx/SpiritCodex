@echo off
setlocal
if not exist "%~dp0index.html" (
  echo Game entry not found: %~dp0index.html
  pause
  exit /b 1
)
if not exist "%~dp0playable\spirit-codex.html" (
  echo Game file not found: %~dp0playable\spirit-codex.html
  pause
  exit /b 1
)
start "" "%~dp0index.html"
if errorlevel 1 (
  echo Could not open the default browser. Open index.html manually.
  pause
  exit /b 1
)
exit /b 0
