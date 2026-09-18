"""Circuit Networks .velox document format.

A `.velox` document is a regular Word DOCX (so it opens anywhere) whose
package carries two extra parts:

* ``velox/manifest.json`` — metadata: engine version, profile, edit history,
  integrity status, and the original filename so restore is possible.
* ``velox/original.docx`` — the raw unprocessed source bytes so that any past
  version can be reproduced by re-applying its cumulative edit set (F110/F112).

Word ignores both unknown parts; Circuit Networks reads them back on re-open.
"""

from __future__ import annotations

import json
import zipfile
from pathlib import Path

MANIFEST_PART = "velox/manifest.json"
ORIGINAL_PART = "velox/original.docx"


def embed_parts(docx_path: str, parts: dict[str, bytes | str]) -> str:
    """Inject named parts into a DOCX package, preserving every existing entry.

    Non-mutating: writes a brand new zip then replaces the original atomically
    (R8 / R10).  Each value in *parts* is written as UTF-8 if it is a ``str``
    (JSON manifest) or raw bytes (embedded original).
    """
    src = Path(docx_path)
    tmp = src.with_suffix(".velox-tmp")
    with zipfile.ZipFile(src) as zin, zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
        for info in zin.infolist():
            zout.writestr(info, zin.read(info.filename))
        for name, payload in parts.items():
            data = payload.encode("utf-8") if isinstance(payload, str) else payload
            zout.writestr(name, data)
    tmp.replace(src)
    return str(src)


def embed_manifest(docx_path: str, manifest: dict) -> str:
    """Inject ``velox/manifest.json`` into a DOCX package."""
    return embed_parts(docx_path, {MANIFEST_PART: json.dumps(manifest, ensure_ascii=False, indent=2)})


def embed_original(docx_path: str, original_bytes: bytes) -> str:
    """Inject ``velox/original.docx`` so a past version can be reproduced (F112)."""
    return embed_parts(docx_path, {ORIGINAL_PART: original_bytes})


def read_manifest(docx_path: str) -> dict | None:
    """Return the embedded manifest, or ``None`` if not a velox document."""
    try:
        with zipfile.ZipFile(docx_path) as zf:
            if MANIFEST_PART not in zf.namelist():
                return None
            return json.loads(zf.read(MANIFEST_PART).decode("utf-8"))
    except (KeyError, zipfile.BadZipFile, json.JSONDecodeError, OSError):
        return None


def read_original(docx_path: str) -> bytes | None:
    """Return the embedded original source bytes, or ``None`` if absent."""
    try:
        with zipfile.ZipFile(docx_path) as zf:
            if ORIGINAL_PART not in zf.namelist():
                return None
            return zf.read(ORIGINAL_PART)
    except (KeyError, zipfile.BadZipFile, OSError):
        return None