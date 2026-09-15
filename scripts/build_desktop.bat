@echo off
REM Build the Circuit Networks offline desktop bundle (Windows).
REM Requires: pip install pyinstaller

set "ROOT=%~dp0.."
pushd "%ROOT%"
pip install -e backend
pyinstaller packaging/velox.spec --noconfirm
echo.
echo If successful, the standalone app is at:  dist\CircuitNetworks\
echo Run  dist\CircuitNetworks\CircuitNetworks.exe  to start the offline app.
popd