# Circuit Networks — offline desktop app packaging (PyInstaller)
#
# Produces a single-folder standalone Windows app (no internet required):
#   pyinstaller packaging/velox.spec
#
# The bundle includes the backend engine, local FastAPI/UI server and the
# frontend static files, packaged as an offline desktop application.

# -*- mode: python ; coding: utf-8 -*-
import os
from pathlib import Path

ROOT = Path(SPECPATH).resolve().parents[1]

a = Analysis(
    [str(ROOT / "backend" / "src" / "circuit_networks" / "desktop.py")],
    pathex=[str(ROOT / "backend" / "src")],
    binaries=[],
    datas=[
        (str(ROOT / "frontend"), "frontend"),
        (str(ROOT / "profiles"), "profiles"),
    ],
    hiddenimports=[
        "uvicorn.logging",
        "uvicorn.loops",
        "uvicorn.loops.auto",
        "uvicorn.protocols",
        "uvicorn.protocols.http",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.websockets",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.lifespan",
        "uvicorn.lifespan.on",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="CircuitNetworks",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="CircuitNetworks",
)

# Bundle the app directory structure so profiles/frontend resolve inside dist.
for rel in ["frontend", "profiles"]:
    src = ROOT / rel
    if src.exists():
        dst = ROOT / "dist" / "CircuitNetworks" / "_internal" / rel
        dst.mkdir(parents=True, exist_ok=True)

print("PyInstaller spec loaded. Run: pyinstaller packaging/velox.spec")