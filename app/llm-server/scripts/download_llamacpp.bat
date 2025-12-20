@echo off
REM Download llama.cpp pre-built CPU binary for Windows

setlocal enabledelayedexpansion

set SCRIPT_DIR=%~dp0
set BIN_DIR=%SCRIPT_DIR%..\bin

if not exist "%BIN_DIR%" mkdir "%BIN_DIR%"
cd /d "%BIN_DIR%"

echo === Downloading llama.cpp (CPU version) ===

REM Get latest version using PowerShell
for /f "delims=" %%i in ('powershell -Command "(Invoke-RestMethod -Uri 'https://api.github.com/repos/ggml-org/llama.cpp/releases/latest').tag_name"') do set VERSION=%%i
echo Latest version: %VERSION%

set URL=https://github.com/ggml-org/llama.cpp/releases/download/%VERSION%/llama-%VERSION%-bin-win-cpu-x64.zip
set ARCHIVE=llama.zip

echo Downloading: %URL%
powershell -Command "Invoke-WebRequest -Uri '%URL%' -OutFile '%ARCHIVE%'"

echo Extracting...
powershell -Command "Expand-Archive -Path '%ARCHIVE%' -DestinationPath '.' -Force"
del "%ARCHIVE%"

REM Move binaries if in subfolder
if exist "build\bin" (
    move /Y build\bin\* . >nul 2>&1
    rmdir /S /Q build 2>nul
)

echo.
echo === Done! ===
echo Binary: %BIN_DIR%\llama-server.exe
dir "%BIN_DIR%\llama-server.exe"

endlocal
