"""Preflight engine (F007): surface problems before formatting."""

from __future__ import annotations

from dataclasses import dataclass, field

from ..core import constants as C
from ..core.models import DocumentModel
from ..structure.model import Classification, StructureMap

SEVERITY_INFO = "info"
SEVERITY_WARNING = "warning"
SEVERITY_ERROR = "error"


@dataclass
class PreflightIssue:
    code: str
    severity: str
    message: str
    source_index: int = -1
    details: dict = field(default_factory=dict)

    def to_json(self) -> dict:
        return {
            "code": self.code,
            "severity": self.severity,
            "message": self.message,
            "source_index": self.source_index,
            "details": self.details,
        }


def _kind_weight(kind: str) -> int:
    weights = {
        # title is document-level; excluded from chapter hierarchy checks
        C.E_CHAPTER: 1,
        C.E_SECTION: 2,
        C.E_SUBSECTION: 3,
        C.E_SUBSUBSECTION: 4,
    }
    return weights.get(kind, 99)


def run_preflight(model: DocumentModel, structure: StructureMap) -> list[PreflightIssue]:
    issues: list[PreflightIssue] = []

    ordered = [
        (kind, idx)
        for kind, idx in model.body_order
        if kind == "paragraph"
        and (c := structure.get(("paragraph", idx)))
        and c.element_type in C.HEADING_KINDS
    ]

    # 1. Hierarchy jumps (level skips without prior level)
    prev_weight: int | None = None
    for kind, idx in ordered:
        classification = structure.get(("paragraph", idx))
        weight = _kind_weight(classification.element_type)
        if prev_weight is not None and weight - prev_weight > 1:
            issues.append(
                PreflightIssue(
                    code="hierarchy_jump",
                    severity=SEVERITY_WARNING,
                    message=(
                        f"Heading '{model.paragraphs[idx if idx < len(model.paragraphs) else -1].text[:60]}' "
                        f"jumps from level {prev_weight} to level {weight}."
                    ),
                    source_index=idx,
                    details={"jumped_from": prev_weight, "jumped_to": weight},
                )
            )
        prev_weight = weight

# 2. Caption mismatches / captions without any heading above
    seen_any_heading = False
    for kind, idx in model.body_order:
        if kind == "paragraph":
            c = structure.get(("paragraph", idx))
            if c and c.element_type in C.HEADING_KINDS:
                seen_any_heading = True
            if c and c.is_caption:
                if not seen_any_heading:
                    issues.append(
                        PreflightIssue(
                            code="caption_without_heading",
                            severity=SEVERITY_WARNING,
                            message="Caption found before any heading in the document.",
                            source_index=idx,
                        )
                    )
                nxt = _next_body(model, idx)
                if c.element_type == C.E_TABLE_CAPTION and not (nxt and nxt[0] == "table"):
                    issues.append(
                        PreflightIssue(
                            code="table_caption_without_table",
                            severity=SEVERITY_WARNING,
                            message="Table caption is not directly followed by a table.",
                            source_index=idx,
                        )
                    )
                num = _caption_num(c)
                if num is not None:
                    pass  # numbering continuity handled in duplicate check below

    # 3. Duplicate caption numbers within one type
    all_numbers: list[tuple[str, str]] = []
    for p in model.paragraphs:
        c = structure.get(("paragraph", p.index))
        if c and c.is_caption and c.subtype:
            all_numbers.append((c.element_type, c.subtype))
    seen_per_type: dict[str, set[str]] = {}
    for etype, subtype in all_numbers:
        counts = seen_per_type.setdefault(etype, set())
        if subtype in counts:
            issues.append(
                PreflightIssue(
                    code="duplicate_caption_number",
                    severity=SEVERITY_WARNING,
                    message=f"Duplicate caption number '{subtype}' for {etype}.",
                )
            )
        counts.add(subtype)

    # 4. Low confidence classifications
    for classification in structure.review_items():
        issues.append(
            PreflightIssue(
                code="low_confidence",
                severity=SEVERITY_INFO,
                message=(
                    f"Classification '{classification.element_type}' confidence "
                    f"{classification.confidence:.2f} requires review."
                ),
                source_index=classification.source_index,
                details={"confidence": classification.confidence},
            )
        )

    # 5. Document without any headings
    if not ordered:
        issues.append(
            PreflightIssue(
                code="no_headings",
                severity=SEVERITY_WARNING,
                message="No headings detected; formatting will only apply body styles.",
            )
        )

    return issues


def _next_body(model: DocumentModel, paragraph_index: int) -> tuple[str, int] | None:
    for i, (kind, idx) in enumerate(model.body_order):
        if kind == "paragraph" and idx == paragraph_index:
            return model.body_order[i + 1] if i + 1 < len(model.body_order) else None
    return None


def _caption_num(c: Classification) -> int | None:
    import re

    if not c.subtype:
        return None
    m = re.search(r"\d+", c.subtype)
    return int(m.group(0)) if m else None
