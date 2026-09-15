"""Offline desktop launcher.

Starts the local API server and opens the bundled web UI in the default
browser. All heavy lifting stays on localhost; no internet is used.

Run directly (dev):  python -m circuit_networks.desktop
Packaged binary:     PyInstaller entry point (see packaging/velox.spec)
"""

from __future__ import annotations

import argparse
import threading
import time
import webbrowser

from circuit_networks.api.main import serve


def _open_browser(port: int) -> None:
    time.sleep(1.2)
    webbrowser.open(f"http://127.0.0.1:{port}")


def main(host: str = "127.0.0.1", port: int = 8000, no_browser: bool = False) -> None:
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