@echo off
rem Buran-M: Odyssey - one-click start for Windows.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js not found. Install the LTS version from https://nodejs.org and run this file again.
  start "" https://nodejs.org
  pause
  exit /b 1
)
chcp 65001 >nul
node tools\launch.mjs
pause
