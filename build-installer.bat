@echo off
setlocal
set "SILENT_ARG="
if /I "%SILENT%"=="1" set "SILENT_ARG=-Silent"
if /I "%~1"=="/s" set "SILENT_ARG=-Silent"
if /I "%~1"=="--silent" set "SILENT_ARG=-Silent"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build.ps1" -Mode Installer %SILENT_ARG%
exit /b %ERRORLEVEL%
