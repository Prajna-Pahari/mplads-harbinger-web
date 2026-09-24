@echo off
echo Starting MPLADS HARBINGER Frontend...
set PATH=%~dp0node_extracted\node-v20.17.0-win-x64;%PATH%
cd /d "%~dp0frontend"
npm run dev
