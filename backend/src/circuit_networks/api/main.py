"""Local FastAPI API (no external services; localhost only default)."""

from __future__ import annotations

import json
import re
import shutil
import tempfile
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from ..core.config import ProfileConfig
from ..core.constants import (
    E_BACKMATTER,
    E_CAPTION,
    E_CHAPTER,
    E_FIGURE_CAPTION,
    E_FRONTMATTER,
    E_PARAGRAPH,
    E_SECTION,
    E_SUBSECTION,
    E_SUBSUBSECTION,
    E_TABLE,
    E_TABLE_CAPTION,
    E_TITLE,
)
from ..core.paths import frontend_dir, profiles_dir
from ..core.pipeline import run_pipeline, version_string
from ..review.queue import ReviewDecision
from ..velox.history import append_version, initial_history, load_history

from ..velox.package import embed_manifest, embed_original, read_manifest, read_original

_TEMP_MAX_AGE_SECONDS = 24 * 60 * 60  # sweep job dirs older than 24h

UPLOADS = Path(tempfile.gettempdir()) / "circuit-networks"
UPLOADS.mkdir(parents=True, exist_ok=True)

# R11: refuse oversized uploads (plenty for 400+ page manuscripts)
MAX_UPLOAD_BYTES = 200 * 1024 * 1024
_UNSAFE_FILENAME = re.compile(r"[^\w.\- ]")


@asynccontextmanager
async def _lifespan(app: FastAPI):
    UPLOADS.mkdir(parents=True, exist_ok=True)
    _sweep_old_jobs()
    yield


app = FastAPI(title="Circuit Networks", version="0.2.0", lifespan=_lifespan)


def _sweep_old_jobs() -> None:
    """Delete temp job/batch directories that are no longer serving downloads."""
    now = time.time()
    try:
        for entry in UPLOADS.iterdir():
            try:
                if entry.is_dir() and now - entry.stat().st_mtime > _TEMP_MAX_AGE_SECONDS:
                    shutil.rmtree(entry, ignore_errors=True)
            except OSError:
                continue
    except OSError:
        pass


def _safe_filename(filename: str) -> str:
    """Keep only the file name, stripped of any directory components (R11)."""
    name = Path(filename).name
    cleaned = _UNSAFE_FILENAME.sub("_", name)
    return cleaned or f"manuscript{uuid.uuid4().hex[:8]}.docx"


def _read_upload(file: UploadFile, dest: Path) -> None:
    """Stream an upload to ``dest``, enforcing the R11 size cap in flight."""
    total = 0
    with dest.open("wb") as fh:
        while chunk := file.file.read(1024 * 1024):
            total += len(chunk)
            if total > MAX_UPLOAD_BYTES:
                raise HTTPException(
                    status_code=413,
                    detail=f"File exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit",
                )
            fh.write(chunk)


class ReviewRequest(BaseModel):
    source_index: int
    action: str
    new_element_type: str | None = None


class ProcessRequest(BaseModel):
    profile_id: str = "default"
    reviews: list[ReviewRequest] = []


class EditItem(BaseModel):
    kind: str = "paragraph"  # "paragraph" (text/role/format edits)
    source_index: int
    text: str | None = None
    element_type: str | None = None
    # Formatting-only fix: normalize a body paragraph's line spacing to the
    # profile value (never touches word content); feeds spacing_mismatch.
    line_spacing: float | None = None


class ApplyEditsRequest(BaseModel):
    job_id: str
    edits: list[EditItem] = []
    message: str = ""
    # Metadata-only fix: fill an empty core-property title (metadata_missing);
    # lives in docProps/core.xml, never in body text.
    set_title: str | None = None


@app.get("/api/health")
def health() -> dict:
    return {"name": "Circuit Networks API", "version": version_string()}


@app.get("/api/profiles")
def list_profiles() -> list[dict]:
    profiles_dir_path = profiles_dir()
    out: list[dict] = []
    for f in sorted(profiles_dir_path.glob("*.json")):
        try:
            cfg = ProfileConfig.from_file(f)
            out.append(
                {
                    "id": cfg.id,
                    "name": cfg.name,
                    "description": cfg.description,
                    "path": str(f),
                }
            )
        except Exception:
            continue
    return out


@app.post("/api/process")
async def process_document(
    file: UploadFile = File(...),
    profile_id: str = Form("default"),
    review_json: str = Form("[]"),
):
    result = await _process_upload(file, profile_id, review_json)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result.get("error"))
    return result


@app.post("/api/process-batch")
async def process_batch(
    files: list[UploadFile] = File(...),
    profile_id: str = Form("default"),
):
    """F107: process several manuscripts in one request."""
    if not files:
        raise HTTPException(status_code=400, detail="No files selected")
    if len(files) > 50:
        raise HTTPException(
            status_code=400, detail="Batch is limited to 50 files at once"
        )
    job_dir = UPLOADS / f"batch-{uuid.uuid4().hex[:8]}"
    job_dir.mkdir(parents=True, exist_ok=True)
    results = []
    for file in files:
        try:
            result = await _process_upload(file, profile_id, "[]", base_dir=job_dir)
        except HTTPException as exc:
            # R9 safe failure: isolate the bad file without aborting the batch
            result = {
                "filename": _safe_filename(file.filename or "unknown.docx"),
                "integrity_status": "failed",
                "error": exc.detail if isinstance(exc.detail, str) else "Invalid file",
                "stage": "upload",
            }
        results.append(result)
    return {"count": len(results), "results": results}


async def _process_upload(
    file: UploadFile,
    profile_id: str,
    review_json: str = "[]",
    base_dir: Path | None = None,
) -> dict:
    safe_name = _safe_filename(file.filename or "")
    if not safe_name.lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail="File must be .docx")

    # Isolate each job in its own directory so names never collide and the
    # client-provided name can never influence the on-disk location (R11).
    target = base_dir or UPLOADS
    job_dir = target / f"{Path(safe_name).stem}-{uuid.uuid4().hex[:8]}"
    job_dir.mkdir(parents=True, exist_ok=True)
    source = job_dir / safe_name

    try:
        _read_upload(file, source)
    except HTTPException:
        shutil.rmtree(job_dir, ignore_errors=True)
        raise

    profile = _load_profile(profile_id)
    decisions = _parse_reviews(review_json)
    result = run_pipeline(str(source), profile, output_dir=str(job_dir), decisions=decisions)

    if result.error:
        return {
            "filename": safe_name,
            "integrity_status": "failed",
            "error": result.error,
            "stage": result.stage,
        }

    _save_job_meta(job_dir, profile_id=profile_id, filename=safe_name)
    _save_reviews(job_dir, review_json)
    payload = result.payload()
    velox_path, history = _finalize_velox(
        job_dir, result, profile_id=profile_id, message="Automatic formatting", edits=[],
        stats=payload["processing_stats"],
    )
    return {
        "filename": safe_name,
        "job_id": job_dir.name,
        "integrity_status": result.integrity_status,
        "output_docx": result.output_docx,
        "velox_docx": str(velox_path),
        "audit_json": result.audit_json,
        "audit_html": result.audit_html,
        "payload": payload,
        "history": history,
    }


def _load_profile(profile_id: str) -> ProfileConfig:
    for f in sorted(profiles_dir().glob("*.json")):
        cfg = ProfileConfig.from_file(f)
        if cfg.id == profile_id or cfg.name.lower() == profile_id.lower():
            return cfg
    return ProfileConfig()


def _parse_reviews(review_json: str) -> list[ReviewDecision]:
    import json

    try:
        data = json.loads(review_json)
    except json.JSONDecodeError:
        return []
    if not isinstance(data, list):
        return []
    decisions = []
    for item in data:
        if not isinstance(item, dict):
            continue
        decisions.append(
            ReviewDecision(
                source_index=item.get("source_index", -1),
                action=item.get("action", "accept"),
                new_element_type=item.get("new_element_type"),
            )
        )
    return decisions


# ---------------------------------------------------------------- F110 Job state
_VALID_JOB_ID = re.compile(r"^[\w .\-]+$")


def _resolve_job_dir(job_id: str) -> Path:
    """Resolve a client-supplied job id inside the UPLOADS root (R11-safe)."""
    if not job_id or ".." in job_id or not _VALID_JOB_ID.match(job_id):
        raise HTTPException(status_code=400, detail="Invalid job id")
    candidate = (UPLOADS / job_id).resolve()
    root = UPLOADS.resolve()
    if root not in candidate.parents:
        raise HTTPException(status_code=400, detail="Invalid job id")
    if not candidate.is_dir():
        raise HTTPException(status_code=404, detail="Job not found")
    return candidate


def _save_job_meta(job_dir: Path, profile_id: str, filename: str) -> None:
    (job_dir / "job.json").write_text(
        json.dumps({"profile_id": profile_id, "filename": filename}),
        encoding="utf-8",
    )


def _save_set_title(job_dir: Path, title: str | None) -> None:
    """Persist the metadata title patch so later applies reuse it (R14/F111)."""
    meta = _load_job_meta(job_dir)
    meta["set_title"] = title
    (job_dir / "job.json").write_text(
        json.dumps(meta, ensure_ascii=False), encoding="utf-8"
    )


def _load_job_meta(job_dir: Path) -> dict:
    try:
        return json.loads((job_dir / "job.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def _save_reviews(job_dir: Path, review_json: str) -> None:
    try:
        items = json.loads(review_json)
    except json.JSONDecodeError:
        items = []
    (job_dir / "reviews.json").write_text(
        json.dumps(items, ensure_ascii=False), encoding="utf-8"
    )


def _load_reviews(job_dir: Path) -> list[ReviewDecision]:
    try:
        items = json.loads((job_dir / "reviews.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        items = []
    if not isinstance(items, list):
        return []
    return [
        ReviewDecision(
            source_index=item.get("source_index", -1),
            action=item.get("action", "accept"),
            new_element_type=item.get("new_element_type"),
        )
        for item in items
        if isinstance(item, dict)
    ]


def _load_edits(job_dir: Path) -> list[dict]:
    try:
        return json.loads((job_dir / "edits.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []


def _finalize_velox(
    job_dir: Path,
    result,
    profile_id: str,
    message: str,
    edits: list[dict],
    stats: dict | None = None,
    set_title: str | None = None,
) -> tuple[Path, dict]:
    """Copy the formatted docx, embed the manifest, and record a history version."""
    base = Path(result.model.source_path).stem
    velox = job_dir / f"{base}_velox.docx"
    shutil.copyfile(result.output_docx, velox)

    history = load_history(str(job_dir / "history.json"))
    if not history["source"]:
        history["source"] = {
            "filename": Path(result.model.source_path).name,
            "size_bytes": getattr(result.model, "source_size_bytes", None),
            "sha256": getattr(result.model, "source_sha256", None),
        }
    # Callers build the (large) payload once; pass its stats to avoid building
    # a second complete payload just for the history entry (R13).
    stats = stats or result.payload()["processing_stats"]
    append_version(history, message, edits, result.integrity_status, stats)
    (job_dir / "history.json").write_text(
        json.dumps(history, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    manifest = {
        "format": "circuit-networks-velox",
        "engine": version_string(),
        "profile": profile_id,
        "source": history["source"],
        "history": history["versions"],
        "integrity_status": result.integrity_status,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    if set_title:
        manifest["set_title"] = set_title
    orig = Path(result.model.source_path)
    if orig.is_file():
        manifest["has_original"] = True
    embed_manifest(str(velox), manifest)
    if orig.is_file():
        embed_original(str(velox), orig.read_bytes())
    return velox, history


@app.post("/api/apply-edits")
def apply_edits(req: ApplyEditsRequest):
    """F110: apply the user's full working edit set and reprocess the job."""
    job_dir = _resolve_job_dir(req.job_id)
    meta = _load_job_meta(job_dir)
    profile = _load_profile(meta.get("profile_id", "default"))
    source = job_dir / meta.get("filename", "")
    if not source.is_file():
        raise HTTPException(status_code=404, detail="Source file not found")

    # The client always submits its full current edit set (replace semantics),
    # so restore/undo maps 1:1 to a working set per version (F111).
    edits_list = _merge_edits(req.edits)
    (job_dir / "edits.json").write_text(
        json.dumps(edits_list, ensure_ascii=False), encoding="utf-8"
    )
    effective_title = req.set_title if req.set_title is not None else meta.get("set_title")
    if req.set_title is not None:
        _save_set_title(job_dir, req.set_title.strip() or None)

    result = run_pipeline(
        str(source),
        profile,
        output_dir=str(job_dir),
        decisions=_load_reviews(job_dir),
        edits=edits_list,
        set_title=effective_title,
    )
    if result.error:
        raise HTTPException(status_code=500, detail=result.error)

    message = req.message or _default_edit_message(edits_list)
    payload = result.payload()
    velox_path, history = _finalize_velox(
        job_dir, result, profile_id=meta.get("profile_id", "default"), message=message,
        edits=edits_list, stats=payload["processing_stats"], set_title=effective_title,
    )
    return {
        "filename": meta.get("filename", ""),
        "job_id": job_dir.name,
        "integrity_status": result.integrity_status,
        "output_docx": result.output_docx,
        "velox_docx": str(velox_path),
        "audit_json": result.audit_json,
        "audit_html": result.audit_html,
        "payload": payload,
        "history": history,
    }


_KNOWN_ELEMENT_TYPES = {
    E_TITLE,
    E_CHAPTER,
    E_SECTION,
    E_SUBSECTION,
    E_SUBSUBSECTION,
    E_PARAGRAPH,
    E_TABLE,
    E_FIGURE_CAPTION,
    E_TABLE_CAPTION,
    E_CAPTION,
    E_FRONTMATTER,
    E_BACKMATTER,
}
_EDIT_KINDS = {"paragraph"}
_MAX_EDITS_PER_REQUEST = 2000


def _merge_edits(req_edits: list[EditItem]) -> list[dict]:
    """Validate + merge the full working edit set (replace semantics, F111).

    Rejects malformed edits up front (400) so a bad payload can never be
    silently dropped yet reported as a successful commit (data-integrity).
    """
    if len(req_edits) > _MAX_EDITS_PER_REQUEST:
        raise HTTPException(status_code=400, detail="Too many edits in one request")
    merged: dict[tuple[str, int], dict] = {}
    for e in req_edits:
        kind = e.kind if e.kind is not None else "paragraph"
        if kind not in _EDIT_KINDS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported edit kind {kind!r} (expected 'paragraph')",
            )
        if not isinstance(e.source_index, int) or e.source_index < 0:
            raise HTTPException(status_code=400, detail="Edit source_index must be a non-negative integer")
        if e.element_type is not None and e.element_type not in _KNOWN_ELEMENT_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown element_type {e.element_type!r}",
            )
        if e.text is not None and not isinstance(e.text, str):
            raise HTTPException(status_code=400, detail="Edit text must be a string")
        if e.line_spacing is not None:
            if (
                isinstance(e.line_spacing, bool)
                or not isinstance(e.line_spacing, (int, float))
                or not 0 < e.line_spacing <= 3
            ):
                raise HTTPException(
                    status_code=400,
                    detail="Edit line_spacing must be a number in (0, 3]",
                )
        merged[(kind, e.source_index)] = {
            "kind": kind,
            "source_index": e.source_index,
            "text": e.text,
            "element_type": e.element_type,
            "line_spacing": e.line_spacing,
        }
    return [
        merged[key]
        for key in sorted(merged, key=lambda k: (0 if k[0] == "paragraph" else 1, k[1]))
    ]


def _default_edit_message(edits: list[dict]) -> str:
    text = sum(1 for e in edits if e.get("text") is not None)
    roles = sum(1 for e in edits if e.get("element_type") is not None)
    parts = []
    if text:
        parts.append(f"{text} text edit{'s' if text != 1 else ''}")
    if roles:
        parts.append(f"{roles} role change{'s' if roles != 1 else ''}")
    return "Applied edits" + (f": {', '.join(parts)}" if parts else "")


@app.get("/api/history/{job_id}")
def get_history(job_id: str):
    job_dir = _resolve_job_dir(job_id)
    history = load_history(str(job_dir / "history.json"))
    meta = _load_job_meta(job_dir)
    return {"job_id": job_dir.name, "filename": meta.get("filename", ""), "history": history}


@app.post("/api/open")
async def open_velox(file: UploadFile = File(...)):
    """F112: reopen a *_velox.docx and restore its manifest (history, profile)."""
    safe_name = _safe_filename(file.filename or "")
    if not safe_name.lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail="File must be .docx")
    tmp = Path(tempfile.mkdtemp(prefix="circuit-networks-open-")) / safe_name
    tmp.parent.mkdir(parents=True, exist_ok=True)
    try:
        _read_upload(file, tmp)
        manifest = read_manifest(str(tmp))
    finally:
        shutil.rmtree(tmp.parent, ignore_errors=True)
    if manifest is None:
        raise HTTPException(
            status_code=400,
            detail="Not a Circuit Networks document — no .velox manifest embedded. Process it first.",
        )
    return {
        "filename": safe_name,
        "manifest": manifest,
        "history": load_history_for(manifest),
    }


@app.post("/api/open-apply")
async def apply_open_edits(
    file: UploadFile = File(...),
    edits_json: str = Form("[]"),
    message: str = Form(""),
):
    """F112: edit a re-opened *_velox.docx.

    The embedded original manuscript is re-processed with the submitted
    (cumulative) edit set, so restore to any past version is reproducible and
    integrity-safe (R3 / R14).  History carries over from the opened file.
    """
    safe_name = _safe_filename(file.filename or "")
    if not safe_name.lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail="File must be .docx")
    tmp = Path(tempfile.mkdtemp(prefix="circuit-networks-open-")) / safe_name
    tmp.parent.mkdir(parents=True, exist_ok=True)
    try:
        _read_upload(file, tmp)
        manifest = read_manifest(str(tmp))
        if manifest is None:
            raise HTTPException(
                status_code=400,
                detail="Not a Circuit Networks document — no .velox manifest embedded. Process it first.",
            )
        original_bytes = read_original(str(tmp))
        if original_bytes is None:
            raise HTTPException(
                status_code=400,
                detail="This .velox document has no embedded original — restore is unavailable.",
            )
        edits_items = _parse_edit_items(edits_json)
    finally:
        shutil.rmtree(tmp.parent, ignore_errors=True)

    job_dir = UPLOADS / f"open-{uuid.uuid4().hex[:8]}"
    job_dir.mkdir(parents=True, exist_ok=True)
    source_meta = manifest.get("source")
    if not isinstance(source_meta, dict):
        source_meta = {}
    orig_name = _safe_filename(source_meta.get("filename") or "original.docx") or "original.docx"
    original = job_dir / orig_name
    original.write_bytes(original_bytes)

    edits_list = _merge_edits(edits_items)
    (job_dir / "edits.json").write_text(
        json.dumps(edits_list, ensure_ascii=False), encoding="utf-8"
    )
    profile = _load_profile(manifest.get("profile", "default"))
    effective_title = manifest.get("set_title") or None
    result = run_pipeline(
        str(original),
        profile,
        output_dir=str(job_dir),
        edits=edits_list,
        set_title=effective_title,
    )
    if result.error:
        raise HTTPException(status_code=500, detail=result.error)

    _save_job_meta(job_dir, profile_id=profile.id, filename=orig_name)
    _save_set_title(job_dir, effective_title)
    seeded = initial_history(source_meta)
    for entry in manifest.get("history", []) or []:
        seeded.setdefault("versions", []).append(entry)
    (job_dir / "history.json").write_text(
        json.dumps(seeded, ensure_ascii=False), encoding="utf-8"
    )
    msg = message or _default_edit_message(edits_list)
    payload = result.payload()
    velox_path, history = _finalize_velox(
        job_dir, result, profile_id=profile.id, message=msg, edits=edits_list,
        stats=payload["processing_stats"], set_title=effective_title,
    )
    return {
        "filename": orig_name,
        "job_id": job_dir.name,
        "integrity_status": result.integrity_status,
        "output_docx": result.output_docx,
        "velox_docx": str(velox_path),
        "audit_json": result.audit_json,
        "audit_html": result.audit_html,
        "payload": payload,
        "history": history,
    }


def _parse_edit_items(edits_json: str) -> list[EditItem]:
    try:
        raw = json.loads(edits_json)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid edits payload")
    items = []
    for r in raw if isinstance(raw, list) else []:
        if not isinstance(r, dict):
            continue
        try:
            sidx = int(r.get("source_index", -1))
        except (TypeError, ValueError):
            raise HTTPException(
                status_code=400, detail="Invalid source_index in edits payload"
            )
        items.append(
            EditItem(
                kind=str(r.get("kind", "paragraph")),
                source_index=sidx,
                text=r.get("text"),
                element_type=r.get("element_type"),
            )
        )
    return items


def load_history_for(manifest: dict) -> dict:
    source_meta = manifest.get("source")
    if not isinstance(source_meta, dict):
        source_meta = {}
    history = initial_history(source_meta)
    for entry in manifest.get("history", []) or []:
        history.setdefault("versions", []).append(entry)
    history["engine"] = manifest.get("engine", history["engine"])
    return history


@app.get("/api/download/{filename}")
def download(filename: str):
    safe = Path(filename).name
    matches = [c for c in UPLOADS.rglob(safe) if c.is_file()]
    if not matches:
        raise HTTPException(status_code=404, detail="File not found")
    # Same basename can exist in several job dirs (e.g. *_velox.docx after
    # open-apply); always serve the newest so a download is never stale.
    newest = max(matches, key=lambda p: p.stat().st_mtime)
    return FileResponse(str(newest), filename=safe)


def _mount_frontend() -> None:
    frontend = frontend_dir()
    if frontend is not None and frontend.exists():
        if not any(getattr(r, "path", None) == "/" for r in app.router.routes):
            app.mount("/", StaticFiles(directory=str(frontend), html=True), name="frontend")


def serve(host: str = "127.0.0.1", port: int = 8000) -> None:
    _mount_frontend()
    uvicorn.run(app, host=host, port=port, log_level="warning")


if __name__ == "__main__":
    serve()