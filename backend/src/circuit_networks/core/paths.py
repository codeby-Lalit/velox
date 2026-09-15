"""Robust path resolution for dev and PyInstaller-bundled runs."""

from __future__ import annotations

import sys
from pathlib import Path


def _meipass() -> Path:
    base = getattr(sys, "_MEIPASS", None)
    return Path(base) if base else Path(".")


def repo_root() -> Path:
    """Repository root when running from a checkout (dev mode)."""
    here = Path(__file__).resolve()
    for parent in here.parents:
        if (parent / "profiles").exists() and (parent / "backend").exists():
            return parent
    return here


def _exist(exists: Path, *must: str) -> Path | None:
    return exists if all((exists / m).exists() for m in must) else None


def profiles_dir() -> Path:
    """Locate the publisher profiles directory (dev or bundled)."""
    candidates = [
        _meipass() / "profiles",
        repo_root() / "profiles",
    ]
    for candidate in candidates:
        found = _exist(candidate, "default.json")
        if found:
            return found
    # fall back to whatever exists
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return candidates[0]


def frontend_dir() -> Path | None:
    """Locate the static frontend directory (built React app first, fallback to source)."""
    candidates = [
        _meipass() / "frontend",
        repo_root() / "frontend" / "dist",
        repo_root() / "frontend",
    ]
    for candidate in candidates:
        found = _exist(candidate, "index.html")
        if found:
            return found
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None