"""Offline desktop launcher.

Starts the local API server and opens the bundled web UI in the default
browser. All heavy lifting stays on localhost; no internet is used.

Run directly (dev):  python -m circuit_networks.desktop
Packaged binary:     PyInstaller entry point (see packaging/velox.spec)
"""

from __future__ import annotations

import argparse
import socket
import sys
import tempfile
import threading
import time
import webbrowser
from pathlib import Path

from circuit_networks.api.main import serve

_MUTEX_NAME = "Local\\CircuitNetworks-SingleInstance"
_MUTEX_HANDLE = None

# The winner writes the bound port here so a later single-instance launch
# opens the URL the running server actually listens on (R27).
_PORT_CACHE = Path(tempfile.gettempdir()) / "circuit-networks" / "port.txt"


def _mutex_taken() -> bool:
    """Return True if another instance already owns the single-instance mutex.

    On the winning instance we keep the handle alive for the process lifetime,
    so a later launch reliably detects the running server instead of crashing
    with an 'address already in use' bind error.
    """
    global _MUTEX_HANDLE
    try:
        import ctypes
        from ctypes import wintypes

        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel32.CreateMutexW.restype = wintypes.HANDLE
        handle = kernel32.CreateMutexW(None, False, _MUTEX_NAME)
        if not handle:
            return False  # unexpected failure -> do not block startups
        if ctypes.get_last_error() == 183:  # ERROR_ALREADY_EXISTS
            return True
        _MUTEX_HANDLE = handle  # keep alive for process lifetime
        return False
    except Exception:
        return False


def _find_free_port(start: int = 8000, tries: int = 21) -> int | None:
    """Return the first free localhost port starting at ``start``.

    Returns ``None`` when the whole range is occupied instead of silently
    handing back a busy port that would crash the bind.
    """
    for port in range(start, start + tries):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    return None


def _save_port(port: int) -> None:
    try:
        _PORT_CACHE.parent.mkdir(parents=True, exist_ok=True)
        _PORT_CACHE.write_text(str(port), encoding="utf-8")
    except OSError:
        pass


def _port_is_live(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.4)
        try:
            s.connect(("127.0.0.1", port))
            return True
        except OSError:
            return False


def _read_running_port(fallback: int) -> int:
    """Return the port the running instance saved, if it is actually live."""
    try:
        port = int(_PORT_CACHE.read_text(encoding="utf-8").strip())
    except (OSError, ValueError):
        return fallback
    if 1 <= port <= 65535 and _port_is_live(port):
        return port
    return fallback


def _open_browser(port: int) -> None:
    time.sleep(1.2)
    webbrowser.open(f"http://127.0.0.1:{port}")


def main(host: str = "127.0.0.1", port: int = 8000, no_browser: bool = False) -> None:
    if _mutex_taken():
        running = _read_running_port(port)
        print("Circuit Networks is already running. Opening the existing instance...")
        if not no_browser:
            webbrowser.open(f"http://{host}:{running}")
        return

    chosen = _find_free_port(port)
    if chosen is None:
        print(
            f"No free localhost port between {port} and {port + 20}; "
            "close a program using one and try again.",
            file=sys.stderr,
        )
        return
    if chosen != port:
        print("Desired port is busy; picking the first free localhost port.")
    _save_port(chosen)
    port = chosen

    if not no_browser:
        threading.Thread(target=_open_browser, args=(port,), daemon=True).start()
    print("Circuit Networks desktop app starting on localhost only.")
    print(f"  UI: http://{host}:{port}")
    print("  Press Ctrl+C to stop.")
    try:
        serve(host=host, port=port)
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Circuit Networks desktop app")
    parser.add_argument("--host", default="127.0.0.1", help="bind host (localhost only by default)")
    parser.add_argument("--port", type=int, default=8000, help="localhost port (default: 8000)")
    parser.add_argument("--no-browser", action="store_true", help="do not auto-open the browser")
    args = parser.parse_args()
    main(host=args.host, port=args.port, no_browser=args.no_browser)