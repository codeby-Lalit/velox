"""Pipeline orchestrator: parser -> classifier -> preflight -> format -> integrity."""

from __future__ import annotations

import tempfile
import time
import tracemalloc
from dataclasses import dataclass, field
from pathlib import Path

from ..core.config import ProfileConfig
from ..core.version import ENGINE_NAME, ENGINE_VERSION
from ..formatter.engine import format_document
from ..integrity.verify import verify_integrity
from ..parser.docx_parser import parse_docx
from ..classifier.heading import classify_document
from ..preflight.engine import run_preflight
from ..reports.audit import (
    build_audit_payload,
    write_html_report,
    write_json_report,
)
from ..review.queue import ReviewDecision, apply_decisions
from ..structure.model import StructureMap


@dataclass
class PipelineResult:
    source_path: str
    output_docx: str | None = None
    audit_json: str | None = None
    audit_html: str | None = None
    model: object = None
    structure: StructureMap = field(default_factory=StructureMap)
    issues: list = field(default_factory=list)
    integrity: object = None
    integrity_status: str = "not_run"
    workdir: str = ""
    error: str | None = None
    stage: str = ""  # failed stage name
    elapsed_ms: int = 0
    peak_memory_bytes: int = 0

    def payload(self) -> dict:
        return build_audit_payload(
            model=self.model,
            structure=self.structure,
            issues=self.issues,
            integrity=self.integrity,
            profile_name=getattr(self, "_profile_name", ""),
            profile=getattr(self, "_profile", None),
            output_files={
                "docx": self.output_docx or "",
                "json": self.audit_json or "",
                "html": self.audit_html or "",
            },
            review_decisions={
                "items": [
                    {
                        "source_index": d.source_index,
                        "action": d.action,
                        "new_element_type": d.new_element_type,
                    }
                    for d in getattr(self, "_decisions", [])
                ]
            },
            elapsed_ms=self.elapsed_ms,
            peak_memory_bytes=self.peak_memory_bytes,
        )

    def write_reports(self) -> dict[str, str]:
        assert self.audit_json and self.audit_html
        payload = self.payload()
        write_json_report(payload, self.audit_json)
        write_html_report(payload, self.audit_html)
        return {"json": self.audit_json, "html": self.audit_html}


def run_pipeline(
    source_path: str,
    profile: ProfileConfig,
    output_dir: str | None = None,
    decisions: list[ReviewDecision] | None = None,
    edits: list[dict] | None = None,
) -> PipelineResult:
    """Run the full offline manuscript pipeline for one DOCX file.

    ``edits`` (F110) are user-driven manual changes: each item is
    ``{"kind": "paragraph", "source_index": i, "text": ..., "element_type": ...}``
    and may carry a text replacement, a role change, or both.
    """
    text_overrides = _text_overrides(edits)
    role_decisions = _role_decisions(edits)
    workdir = output_dir or tempfile.mkdtemp(prefix="circuit-networks-")
    Path(workdir).mkdir(parents=True, exist_ok=True)
    base = Path(source_path).stem

    result = PipelineResult(source_path=source_path, workdir=workdir)
    result._profile_name = profile.name  # type: ignore[attr-defined]
    result._profile = profile  # type: ignore[attr-defined]
    result._decisions = list(decisions or []) + role_decisions  # type: ignore[attr-defined]
    started = time.perf_counter()
    tracemalloc.start()

    try:
        result.stage = "parse"
        model = parse_docx(source_path)
        result.model = model

        result.stage = "classify"
        structure = classify_document(model)
        result.structure = structure

        if role_decisions or decisions:
            result.stage = "review"
            merged = list(decisions or []) + role_decisions
            result.structure = apply_decisions(structure, merged)

        if text_overrides:
            result.stage = "edits"
            _apply_text_overrides(model, text_overrides)

        result.stage = "preflight"
        result.issues = run_preflight(
            model, result.structure, profile=profile, source_path=source_path
        )

        result.stage = "format"
        output_docx = str(Path(workdir) / f"{base}_publication_ready.docx")
        format_document(
            source_path,
            output_docx,
            profile,
            model,
            result.structure,
            text_overrides=text_overrides,
        )
        result.output_docx = output_docx

        result.stage = "integrity"
        result.integrity = verify_integrity(
            source_path, output_docx, text_overrides=text_overrides
        )
        result.integrity_status = result.integrity.status

        result.elapsed_ms = int((time.perf_counter() - started) * 1000)

        result.stage = "reports"
        result.audit_json = str(Path(workdir) / f"{base}_audit_report.json")
        result.audit_html = str(Path(workdir) / f"{base}_audit_report.html")
        result.write_reports()

        result.stage = ""
        return result
    except Exception as exc:  # noqa: BLE001 - safe failure surfaced to caller
        result.error = f"{type(exc).__name__}: {exc}"
        result.stage = result.stage or "unknown"
        return result
    finally:
        result.peak_memory_bytes = tracemalloc.get_traced_memory()[1]
        if tracemalloc.is_tracing():
            tracemalloc.stop()


def _text_overrides(edits: list[dict] | None) -> dict[int, str]:
    out: dict[int, str] = {}
    for e in edits or []:
        if e.get("kind", "paragraph") == "paragraph" and e.get("text") is not None:
            out[int(e.get("source_index", -1))] = e["text"]
    return out


def _role_decisions(edits: list[dict] | None) -> list[ReviewDecision]:
    from ..review.queue import ReviewDecision

    decisions: list[ReviewDecision] = []
    for e in edits or []:
        if e.get("kind", "paragraph") == "paragraph" and e.get("element_type"):
            decisions.append(
                ReviewDecision(
                    source_index=int(e.get("source_index", -1)),
                    action="change",
                    new_element_type=e["element_type"],
                )
            )
    return decisions


def _apply_text_overrides(model, overrides: dict[int, str]) -> None:
    by_index = {p.index: p for p in model.paragraphs}
    for idx, text in overrides.items():
        p = by_index.get(idx)
        if p is not None:
            p.text = text


def version_string() -> str:
    return f"{ENGINE_NAME} {ENGINE_VERSION}"