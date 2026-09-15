@echo off
setlocal
REM Build the Circuit Networks offline desktop deliverable (Windows).
REM 1. Builds the React premium UI
REM 2. Bundles backend + UI with PyInstaller -> dist\CircuitNetworks\
REM 3. Compiles a Setup.exe installer with Inno Setup (if ISCC is found)

set "ROOT=%~dp0.."
pushd "%ROOT%"

echo [1/3] Installing/updating backend dependencies...
call pip install -e backend
if errorlevel 1 goto :fail

echo [2/3] Building React UI...
pushd frontend
call npm install
if errorlevel 1 goto :fail
call npm run build
if errorlevel 1 goto :fail
popd

echo [3/3] Bundling offline desktop app with PyInstaller...
call python -m PyInstaller packaging/velox.spec --noconfirm
if errorlevel 1 goto :fail

echo.
echo Bundle ready:  dist\CircuitNetworks\CircuitNetworks.exe
echo.

REM Optional installer - look for ISCC on PATH, then common install paths
set "ISCC_EXE="
where ISCC >nul 2>nul
if "%errorlevel%"=="0" set "ISCC_EXE=ISCC"
if defined ISCC_EXE goto :compile_iscc
if exist "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" set "ISCC_EXE=C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if defined ISCC_EXE goto :compile_iscc
if exist "C:\Program Files\Inno Setup 6\ISCC.exe" set "ISCC_EXE=C:\Program Files\Inno Setup 6\ISCC.exe"
if defined ISCC_EXE goto :compile_iscc
echo Inno Setup (ISCC) not found - skipped installer.
echo Install Inno Setup 6 from https://jrsoftware.org/isinfo.php
goto :done

:compile_iscc
echo Compiling installer with Inno Setup...
"%ISCC_EXE%" packaging\circuit-networks.iss
if errorlevel 1 goto :fail
echo Installer ready: release\CircuitNetworks-Setup-0.1.0.exe
goto :done

:fail
echo Build FAILED. See messages above.
exit /b 1

:done
popd
endlocal
exit /b 0