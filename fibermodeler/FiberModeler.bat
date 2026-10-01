@echo off
rem FiberModeler - double-click launcher for Windows.
rem Starts the local server and opens the app in the default browser.
setlocal
cd /d "%~dp0"

set "PY="
where py >nul 2>nul
if not errorlevel 1 set "PY=py -3"

if not defined PY (
  where python >nul 2>nul
  if not errorlevel 1 set "PY=python"
)

if not defined PY (
  echo.
  echo   Python 3 not found / Python 3 ne naiden.
  echo.
  echo   Install Python from https://www.python.org/downloads/windows/
  echo   and tick "Add python.exe to PATH" during setup.
  echo.
  echo   Or simply open  dist\FiberModeler.html  - it needs nothing at all.
  echo.
  pause
  exit /b 1
)

echo Starting FiberModeler... press Ctrl+C to stop.
%PY% serve.py %*
if errorlevel 1 pause
endlocal
