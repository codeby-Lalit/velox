@echo off
REM Build the Circuit Networks offline desktop deliverable (Windows).
REM 1. Builds the React premium UI
REM 2. Bundles backend + UI with PyInstaller -> dist\CircuitNetworks\
REM 3. Optionally compiles a Setup.exe installer with Inno Setup (if ISCC is on PATH)

set "ROOT=%~dp0.."
pushd "%ROOT%"

echo [1/3] Installing/updating backend dependencies...
pip install -e backend

echo [2/3] Building React UI...
pushd frontend
call npm install
call npm run build
popd

echo [3/3] Bundling offline desktop app with PyInstaller...
python -m PyInstaller packaging/velox.spec --noconfirm

echo.
echo Bundle ready:  dist\CircuitNetworks\CircuitNetworks.exe
echo.

REM Optional installer
where ISCC >nul 2>nul
if %errorlevel%==0 (
    echo Compiling installer with Inno Setup...
    ISCC packaging\circuit-networks.iss
    echo Installer ready: release\CircuitNetworks-Setup-0.1.0.exe
) else (
    echo Inno Setup (ISCC) not found - skipped installer.
    echo Install Inno Setup 6 from https://jrsoftware.org/isinfo.php then run:
    echo   ISCC packaging\circuit-networks.iss
)

popd