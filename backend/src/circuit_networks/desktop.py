"""Offline desktop launcher.

Starts the local API server and opens the bundled web UI in the default
browser. All heavy lifting stays on localhost; no internet is used.

Run directly (dev):  python -m circuit_networks.desktop
Packaged binary:     PyInstaller entry point (see packaging/velox.spec)
"""

from __future__ import annotations

import threading
import time
import webbrowser

from circuit_networks.api.main import serve


def _open_browser(port: int) -> None:
    time.sleep(1.2)
    webbrowser.open(f"http://127.0.0.1:{port}")


def main(host: str = "127.0.0.1", port: int = 8000, no_browser: bool = False) -> None:
    threading.Thread(target=_open_browser, args=(port,), daemon=True).start()
    print("Circuit Networks desktop app starting on localhost only.")
    print(f"  UI: http://{host}:{port}")
    print("  Press Ctrl+C to stop.")
    try:
        serve(host=host, port=port)
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()