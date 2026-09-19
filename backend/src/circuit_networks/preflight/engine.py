"""Preflight engine (F007): surface problems before formatting."""

from __future__ import annotations

from dataclasses import dataclass, field

from ..core.config import ProfileConfig
from ..core import constants as C
from ..core.models import DocumentModel
from ..structure.model import Classification, StructureMap

SEVERITY_INFO = "info"
SEVERITY_WARNING = "warning"
SEVERITY_ERROR = "error"

CATEGORY_STRUCTURE = "structure"
CATEGORY_FORMATTING = "formatting"
CATEGORY_SUGGESTION = "suggestion"


@dataclass
class PreflightIssue:
    code: str
    severity: str
    message: str
    source_index: int = -1
    details: dict = field(default_factory=dict)
    category: str = CATEGORY_STRUCTURE

    def to_json(self) -> dict:
        return {
            "code": self.code,
            "severity": self.severity,
            "message": self.message,
            "source_index": self.source_index,
            "details": self.details,
            "category": self.category,
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


def run_preflight(
    model: DocumentModel,
    structure: StructureMap,
    profile: ProfileConfig | None = None,
    source_path: str | None = None,
) -> list[PreflightIssue]:
    issues: list[PreflightIssue] = []
    text_by_index = {p.index: p.text for p in model.paragraphs}
    page_of = _build_page_estimator(model)

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
            heading_text = text_by_index.get(idx, "")
            issues.append(
                PreflightIssue(
                    code="hierarchy_jump",
                    severity=SEVERITY_WARNING,
                    message=(
                        f"Heading '{heading_text[:60]}' "
                        f"jumps from level {prev_weight} to level {weight}."
                    ),
                    source_index=idx,
                    details={"jumped_from": prev_weight, "jumped_to": weight, "page": page_of(idx)},
                    category=CATEGORY_STRUCTURE,
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
                            details={"page": page_of(idx)},
                            category=CATEGORY_STRUCTURE,
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
                            details={"page": page_of(idx)},
                            category=CATEGORY_STRUCTURE,
                        )
                    )

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
                    category=CATEGORY_STRUCTURE,
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
                details={"confidence": classification.confidence, "page": page_of(classification.source_index)},
                category=CATEGORY_SUGGESTION,
            )
        )

    # 5. Document without any headings
    if not ordered:
        issues.append(
            PreflightIssue(
                code="no_headings",
                severity=SEVERITY_WARNING,
                message="No headings detected; formatting will only apply body styles.",
                category=CATEGORY_STRUCTURE,
            )
        )

    # 6. Professional publication-level checks (profile-driven, R-series)
    if profile is not None:
        from .professional import run_professional_checks

        issues.extend(run_professional_checks(model, structure, profile, page_of))

    # 7. Section margin / page-size alignment with the profile (needs the DOCX)
    if profile is not None and profile.strict.enabled and source_path:
        from .professional import run_section_checks

        issues.extend(run_section_checks(source_path, profile))

    return issues


def _build_page_estimator(model: DocumentModel) -> callable:
    words_before: dict[int, float] = {}
    acc = 0.0
    for kind, idx in model.body_order:
        if kind == "paragraph":
            p = next((x for x in model.paragraphs if x.index == idx), None)
            acc += (p.word_count if p else 0) + 2
            words_before[idx] = acc

    def page_of(idx: int) -> int:
        return 1 + int((words_before.get(idx, 0) or 0) // 300.0)

    return page_of


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
