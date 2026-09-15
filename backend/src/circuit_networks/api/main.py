"""Local FastAPI API (no external services; localhost only default)."""

from __future__ import annotations

import shutil
import tempfile
from pathlib import Path

import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from ..core.config import ProfileConfig
from ..core.paths import frontend_dir, profiles_dir
from ..core.pipeline import run_pipeline, version_string
from ..review.queue import ReviewDecision

app = FastAPI(title="Circuit Networks", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOADS = Path(tempfile.gettempdir()) / "circuit-networks"
UPLOADS.mkdir(parents=True, exist_ok=True)


class ReviewRequest(BaseModel):
    source_index: int
    action: str
    new_element_type: str | None = None


class ProcessRequest(BaseModel):
    profile_id: str = "default"
    reviews: list[ReviewRequest] = []


@app.get("/")
def index() -> dict:
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
    if not file.filename or not file.filename.lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail="File must be .docx")

    job_dir = UPLOADS / file.filename
    job_dir.mkdir(parents=True, exist_ok=True)
    source = job_dir / file.filename
    with source.open("wb") as fh:
        shutil.copyfileobj(file.file, fh)

    profile = _load_profile(profile_id)
    decisions = _parse_reviews(review_json)
    result = run_pipeline(str(source), profile, output_dir=str(job_dir), decisions=decisions)

    if result.error:
        raise HTTPException(status_code=500, detail=result.error)

    return {
        "integrity_status": result.integrity_status,
        "output_docx": result.output_docx,
        "audit_json": result.audit_json,
        "audit_html": result.audit_html,
        "payload": result.payload(),
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
    decisions = []
    for item in data:
        decisions.append(
            ReviewDecision(
                source_index=item.get("source_index", -1),
                action=item.get("action", "accept"),
                new_element_type=item.get("new_element_type"),
            )
        )
    return decisions


@app.get("/api/download/{filename}")
def download(filename: str):
    safe = Path(filename).name
    for candidate in UPLOADS.rglob(safe):
        return FileResponse(str(candidate), filename=safe)
    raise HTTPException(status_code=404, detail="File not found")


def _mount_frontend() -> None:
    from fastapi.staticfiles import StaticFiles

    frontend = frontend_dir()
    if frontend is not None and frontend.exists():
        if not any(getattr(r, "path", None) == "/" for r in app.router.routes):
            app.mount("/", StaticFiles(directory=str(frontend), html=True), name="frontend")


def serve(host: str = "127.0.0.1", port: int = 8000) -> None:
    _mount_frontend()
    uvicorn.run(app, host=host, port=port, log_level="warning")


if __name__ == "__main__":
    serve()