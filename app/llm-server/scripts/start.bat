@echo off
REM Start xLAM Server for Windows

setlocal

set SCRIPT_DIR=%~dp0
set BIN_DIR=%SCRIPT_DIR%..\bin

echo === Starting xLAM Server ===
echo Model: Salesforce/xLAM-2-3b-fc-r-gguf (Q4_K_M)
echo Port: 8080
echo API: http://localhost:8080/v1
echo.
echo First run will download the model (~1.9GB)...
echo.

"%BIN_DIR%\llama-server.exe" ^
    -hf Salesforce/xLAM-2-3b-fc-r-gguf:Q4_K_M ^
    -c 4096 ^
    --port 8080 ^
    --host 127.0.0.1

endlocal
