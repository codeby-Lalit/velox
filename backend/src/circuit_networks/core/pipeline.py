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
    build_source_stats,
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
            source_stats=getattr(self, "_source_stats", None),
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
    set_title: str | None = None,
) -> PipelineResult:
    """Run the full offline manuscript pipeline for one DOCX file.

    ``edits`` (F110) are user-driven manual changes: each item is
    ``{"kind": "paragraph", "source_index": i, "text": ..., "element_type": ...,
    "line_spacing": ...}`` and may carry a text replacement, a role change, a
    formatting-only line-spacing fix, or any combination.
    ``set_title`` (F-metadata) fills an empty core-property title — a
    metadata-only fix in docProps/core.xml that never touches body text.
    """
    text_overrides = _text_overrides(edits)
    role_decisions = _role_decisions(edits)
    spacing_overrides = _spacing_overrides(edits)
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
        # F200: snapshot the pristine original before edits/formatting/decisions
        # mutate the model, so the audit can prove content preservation (R3/R4).
        result._source_stats = build_source_stats(model, structure)
        # F200: "before" compliance state — the same audit run on the pristine
        # classified structure (before review decisions / manual edits mutate it)
        # so the Compare panel can prove the fixes reduced issues in place.
        raw_issues = run_preflight(
            model, structure, profile=profile, source_path=source_path
        )
        result._source_stats["issues"] = {
            "total": len(raw_issues),
            "errors": sum(1 for i in raw_issues if i.severity == "error"),
            "warnings": sum(1 for i in raw_issues if i.severity == "warning"),
            "info": sum(1 for i in raw_issues if i.severity == "info"),
        }

        if role_decisions or decisions:
            result.stage = "review"
            merged = list(decisions or []) + role_decisions
            result.structure = apply_decisions(structure, merged)

        if text_overrides:
            result.stage = "edits"
            _apply_text_overrides(model, text_overrides)

        if spacing_overrides:
            result.stage = "edits"
            _apply_spacing_overrides(model, spacing_overrides)

        if set_title:
            model.metadata.title = set_title.strip()

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
            set_title=set_title,
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


def _spacing_overrides(edits: list[dict] | None) -> dict[int, float]:
    out: dict[int, float] = {}
    for e in edits or []:
        if e.get("kind", "paragraph") == "paragraph" and e.get("line_spacing"):
            out[int(e.get("source_index", -1))] = float(e["line_spacing"])
    return out


def _apply_text_overrides(model, overrides: dict[int, str]) -> None:
    by_index = {p.index: p for p in model.paragraphs}
    for idx, text in overrides.items():
        p = by_index.get(idx)
        if p is not None:
            p.text = text


def _apply_spacing_overrides(model, overrides: dict[int, float]) -> None:
    """Formatting-only fixes: normalize body paragraphs to the profile line
    spacing. Words are never touched, so integrity (R4) is unaffected."""
    by_index = {p.index: p for p in model.paragraphs}
    for idx, line_spacing in overrides.items():
        p = by_index.get(idx)
        if p is not None:
            p.line_spacing = line_spacing


def version_string() -> str:
    return f"{ENGINE_NAME} {ENGINE_VERSION}"