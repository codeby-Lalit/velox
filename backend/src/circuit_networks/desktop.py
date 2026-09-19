"""Offline desktop launcher.

Starts the local API server and opens the bundled web UI in the default
browser. All heavy lifting stays on localhost; no internet is used.

Run directly (dev):  python -m circuit_networks.desktop
Packaged binary:     PyInstaller entry point (see packaging/velox.spec)
"""

from __future__ import annotations

import argparse
import socket
import threading
import time
import webbrowser

from circuit_networks.api.main import serve

_MUTEX_NAME = "Local\\CircuitNetworks-SingleInstance"
_MUTEX_HANDLE = None


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


def _find_free_port(start: int = 8000, tries: int = 21) -> int:
    """Return the first free localhost port starting at ``start``."""
    for port in range(start, start + tries):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    return start


def _open_browser(port: int) -> None:
    time.sleep(1.2)
    webbrowser.open(f"http://127.0.0.1:{port}")


def main(host: str = "127.0.0.1", port: int = 8000, no_browser: bool = False) -> None:
    if _mutex_taken():
        print("Circuit Networks is already running. Opening the existing instance...")
        if not no_browser:
            webbrowser.open(f"http://{host}:{port}")
        return

    if port != _find_free_port(port):
        print("Desired port is busy; picking the first free localhost port.")
        port = _find_free_port(port)

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