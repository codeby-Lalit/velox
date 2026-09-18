"""Edit history manifest (git-like versions) for .velox documents."""

from __future__ import annotations

import json
import time
from pathlib import Path

from ..core.version import ENGINE_VERSION

FORMAT_ID = "circuit-networks-velox"
SCHEMA_VERSION = 1


def load_history(path: str) -> dict:
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        if data.get("format") == FORMAT_ID:
            return data
    except (OSError, json.JSONDecodeError):
        pass
    return initial_history()


def initial_history(source: dict | None = None) -> dict:
    return {
        "format": FORMAT_ID,
        "schema": SCHEMA_VERSION,
        "engine": f"circuit-networks {ENGINE_VERSION}",
        "source": source or {},
        "created_at": int(time.time() * 1000),
        "versions": [],
    }


def _plain_edits(edits: list[dict]) -> list[dict]:
    out = []
    for e in edits or []:
        item = {"kind": e.get("kind", "paragraph"), "source_index": int(e.get("source_index", -1))}
        if e.get("text") is not None:
            item["text"] = e["text"]
        if e.get("element_type") is not None:
            item["element_type"] = e["element_type"]
        out.append(item)
    return out


def append_version(
    history: dict,
    message: str,
    edits: list[dict],
    integrity_status: str,
    stats: dict,
) -> dict:
    """Append a commit-style version entry. Mutates and returns history."""
    version = {
        "id": f"v{len(history.get('versions', [])) + 1}",
        "at": int(time.time() * 1000),
        "message": message,
        "edits": _plain_edits(edits),
        "integrity_status": integrity_status,
        "stats": {k: v for k, v in (stats or {}).items() if isinstance(v, (int, float, str, bool)) or v is None},
    }
    latest = history.get("versions")[-1]["edits"] if history.get("versions") else []
    version["diff"] = diff_edits(latest, version["edits"])
    history.setdefault("versions", []).append(version)
    history["updated_at"] = version["at"]
    return history


def diff_edits(before: list[dict], after: list[dict]) -> list[dict]:
    """Return a compact before/after diff between two cumulative edit sets."""
    key = lambda e: (e.get("kind", "paragraph"), e.get("source_index", -1))
    bmap = {key(e): e for e in before}
    amap = {key(e): e for e in after}
    diff = []
    for k, e in sorted(amap.items(), key=lambda kv: kv[0][1]):
        prev = bmap.get(k)
        if prev != e:
            diff.append(
                {
                    "kind": e.get("kind", "paragraph"),
                    "source_index": e.get("source_index", -1),
                    "before": (prev or {}).get("text"),
                    "after": e.get("text"),
                    "before_type": (prev or {}).get("element_type"),
                    "after_type": e.get("element_type"),
                }
            )
    return diff