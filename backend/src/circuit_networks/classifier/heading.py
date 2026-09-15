"""Deterministic, rule-based document structure classification (no AI/LLM).

Produces a StructureMap where every element carries:
element_type, confidence, reason_codes (explainable, R5/R6).
"""

from __future__ import annotations

import re
from statistics import median

from ..core import constants as C
from ..core.models import DocumentModel, ParagraphInfo
from ..structure.model import Classification, StructureMap

_CHAPTER_PREFIX_RE = re.compile(
    r"^(Chapter|CHAPTER|Chapter\s+N[oº°\.]?|Appendices|APPENDICES|Appendix|APPENDIX|"
    r"Part|PART|Section|SECTION)\b"
)

_NUMBER_NESTED_RE = re.compile(
    r"^(?P<num>\d+(?:\.\d+){1,4})"
    r"(?P<sep>[\s\.\):;—-]+|[\s\.\):;—-]*\s+)"
    r"(?P<title>[^\d].+)$"
)

_NUMBER_FLAT_RE = re.compile(
    r"^(?P<num>\d+)"
    r"(?P<sep>[\s\.\):;—-]+)"
    r"(?P<title>.+)$"
)

_ROMAN_RE = re.compile(
    r"^(?P<num>(?:M{0,4}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})))"
    r"(?P<sep>\s*[\.\):]\s+)"
    r"(?P<title>.+)$",
    re.IGNORECASE,
)

_PAREN_NUMBER_RE = re.compile(
    r"^(?:\((?P<num>\d+[a-z]?)\)|\[(?P<num>\d+[a-z]?)\])\s+(?P<title>.+)$"
)

_CAPTION_RE = re.compile(
    r"^(?P<label>Table|Tab\.|Figure|Fig\.|Fig|Illustration|Exhibit|Box|"
    r"Diagram|Chart|Graph|Equation|Eq\.|Scheme)"
    r"\s+(?P<num>\d+(?:[\.\-]\d+){0,3})"
    r"\s*(?P<sep>[\.:—-])?\s*(?P<title>.*)$",
    re.IGNORECASE,
)

_CAPTION_WORD_RE = re.compile(
    r"^(?P<title>.+?)\s+(?P<label>Table|Figure|Fig\.)\s+(?P<num>\d+)"
    r"(?P<dot>\.)?$",
    re.IGNORECASE,
)

_CAPTION_LABELS = {
    "table": ("table", "Tab.", "Table"),
    "figure": ("figure", "Figure", "Fig.", "Fig"),
    "other": (
        "Illustration",
        "Exhibit",
        "Box",
        "Diagram",
        "Chart",
        "Graph",
        "Equation",
        "Eq.",
        "Scheme",
    ),
}

_SHORT_LINE_CHARS = 90
_SENTENCE_LIKE_CHARS = 140


def _roman_to_int(text: str) -> int:
    import re as _re

    values = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "D": 500, "M": 1000}
    if not _re.fullmatch(r"[IVXLCDM]+", text.upper()) or not text:
        return -1
    total = 0
    prev = 0
    for ch in reversed(text.upper()):
        val = values[ch]
        if val < prev:
            total -= val
        else:
            total += val
        prev = val
    return total


def _numbering_info(text: str) -> tuple[int | None, str | None]:
    """Return (heading_level, numbering_string) or (None, None)."""
    stripped = text.strip()
    if not stripped:
        return None, None

    m = _CHAPTER_PREFIX_RE.match(stripped)
    if m:
        rest = stripped[m.end():].strip()
        num_m = re.match(r"^(\d+|[IVXLCDM]+)", rest, re.IGNORECASE)
        num = num_m.group(1) if num_m else ""
        return 0, f"{m.group(0)} {num}".strip()

    m = _NUMBER_NESTED_RE.match(stripped)
    if m and _roman_to_int(m.group("num").split(".")[0]) > 0:  # 1.2 style, guard
        pass  # nested numeric matched
    if m:
        num = m.group("num")
        depth = num.count(".") + 1
        # depth 2 -> subsection (level 2); 3 -> subsubsection (level 3)
        return min(depth, 4), num

    m = _NUMBER_FLAT_RE.match(stripped)
    if m:
        return 1, m.group("num")

    m = _ROMAN_RE.match(stripped)
    if m and _roman_to_int(m.group("num")) > 0:
        return 1, m.group("num").upper()

    m = _PAREN_NUMBER_RE.match(stripped)
    if m:
        return 1, m.group("num")

    return None, None


def _caption_info(text: str) -> tuple[str | None, str | None, str | None] | None:
    """Return (caption_type, label, number) or None."""
    stripped = text.strip()
    m = _CAPTION_RE.match(stripped)
    if m:
        label = m.group("label")
        ctype = "other"
        for kind, labels in _CAPTION_LABELS.items():
            if label.lower() in (l.lower() for l in labels):
                ctype = kind
                break
        return ctype, m.group("label"), m.group("num")

    m = _CAPTION_WORD_RE.match(stripped)
    if m:
        label = m.group("label")
        ctype = "table" if label.lower().startswith("table") else "figure"
        return ctype, label, m.group("num")

    return None


def _level_to_kind(level: int | None, numbering: str | None, first_heading: bool) -> str:
    if numbering and re.match(r"^(Chapter|Appendix|Appendices|Part|SECTION)", numbering, re.IGNORECASE):
        return C.E_CHAPTER
    if level == 0:
        return C.E_CHAPTER
    if level == 1:
        return C.E_SECTION
    if level == 2:
        return C.E_SUBSECTION
    if level == 3:
        return C.E_SUBSUBSECTION
    if level is None:
        return C.E_SUBSECTION if not first_heading else C.E_SECTION
    return C.E_SUBSUBSECTION


class Statistics:
    def __init__(self, paragraphs: list[ParagraphInfo]):
        self.paragraphs = paragraphs
        self.all_sizes = [
            r.size for p in paragraphs for r in p.runs if r.size is not None
        ]
        self.body_median_size = median(self.all_sizes) if self.all_sizes else 11.0
        self.avg_len = (
            sum(len(p.text) for p in paragraphs) / len(paragraphs)
            if paragraphs
            else 0
        )

    def strictly_larger_than_body(self, paragraph: ParagraphInfo) -> bool:
        run_sizes = [r.size for r in paragraph.runs if r.size is not None]
        body = self.body_median_size
        if not run_sizes:
            return False
        return max(run_sizes) >= body + 1.5


class HeadingClassifier:
    """Confidence-based heading detection built from explainable signals."""

    def __init__(self, stats: Statistics):
        self.stats = stats

    def classify(
        self,
        paragraph: ParagraphInfo,
        prev_kind: str | None,
        first_heading: bool,
    ) -> Classification | None:
        text = paragraph.text
        if not text:
            return None

        numbering, numbering_str = _numbering_info(text)
        is_caption = _caption_info(text)
        if is_caption:
            return None  # captions handled separately

        signals = 0.0
        codes: list[str] = []

        if numbering is not None:
            signals += 0.45
            codes.append("numbering_pattern")

        if paragraph.is_heading_style:
            signals += 0.35
            codes.append("heading_style")

        if paragraph.runs and all(r.bold for r in paragraph.runs if r.text.strip()):
            signals += 0.15
            codes.append("bold")

        if self.stats.strictly_larger_than_body(paragraph):
            signals += 0.15
            codes.append("large_font")

        is_short = len(text) <= _SHORT_LINE_CHARS
        if is_short:
            signals += 0.10
            codes.append("short_line")

        runs_any_caps = paragraph.runs and any(r.all_caps for r in paragraph.runs if r.text)
        text_all_caps = bool(text) and text == text.upper() and len(text) > 3
        if runs_any_caps or text_all_caps:
            signals += 0.05
            codes.append("all_caps")

        if paragraph.spacing_before and paragraph.spacing_before >= 12:
            signals += 0.05
            codes.append("spacing_before")

        # Penalties reduce confidence for sentence-like numbered list items.
        if numbering is not None and len(text) > _SENTENCE_LIKE_CHARS:
            if not paragraph.is_heading_style and not self.stats.strictly_larger_than_body(paragraph):
                signals -= 0.30
                codes.append("non_heading_sentence_like")

        if signals <= 0.19:
            return Classification(
                element_type=C.E_PARAGRAPH,
                confidence=0.55,
                reason_codes=["no_heading_signals"],
                source_index=paragraph.index,
            )

        # Level resolution
        if paragraph.heading_level is not None:
            level = paragraph.heading_level - 1
        else:
            level = numbering

        if level is None:
            # infer from previous heading when first_heading flag is False
            if not first_heading and prev_kind == C.E_CHAPTER:
                level = 1
            elif not first_heading and prev_kind == C.E_SECTION:
                level = 2
            elif not first_heading and prev_kind == C.E_SUBSECTION:
                level = 3

        kind = _level_to_kind(level, numbering_str, first_heading)
        confidence = min(0.99, round(signals, 4))
        if confidence < C.AUTO_THRESHOLD and numbering is not None:
            pass  # still returned; review flags are applied downstream

        return Classification(
            element_type=kind,
            confidence=confidence,
            reason_codes=sorted(set(codes)),
            source_index=paragraph.index,
            subtype=numbering_str,
        )


class CaptionClassifier:
    def classify(self, paragraph: ParagraphInfo) -> Classification | None:
        text = paragraph.text
        if not text:
            return None
        info = _caption_info(text)
        if not info or info[0] is None:
            return None
        ctype, label, number = info
        kind = {
            "table": C.E_TABLE_CAPTION,
            "figure": C.E_FIGURE_CAPTION,
            "other": C.E_CAPTION,
        }[ctype]
        confidence = 0.90
        codes = ["caption_label", "caption_numbering_pattern"]
        if ":" in text.split(label, 1)[1][:20] or ". " in text or ". " in text:
            codes.append("starts_with_caption_label")
            confidence = min(0.98, confidence + 0.05)
        return Classification(
            element_type=kind,
            confidence=confidence,
            reason_codes=codes,
            source_index=paragraph.index,
            subtype=f"{label} {number}".strip(),
        )


def _is_first_paragraph_candidate(paragraph: ParagraphInfo) -> bool:
    return len(paragraph.text) > 3 and len(paragraph.text) <= _SHORT_LINE_CHARS


def classify_document(model: DocumentModel) -> StructureMap:
    stats = Statistics(model.paragraphs)
    heading_clf = HeadingClassifier(stats)
    caption_clf = CaptionClassifier()

    structure = StructureMap()
    seen_heading = False
    prev_kind: str | None = None
    caption_counts: dict[str, int] = {}

    # Map from paragraph index -> next body element info
    next_in_body: dict[int, tuple[str, int]] = {}
    for i, (kind, idx) in enumerate(model.body_order[:-1]):
        if kind == "paragraph":
            next_in_body[idx] = model.body_order[i + 1]

    first_body = model.body_order[0] if model.body_order else ("paragraph", -1)
    first_body_is_paragraph = first_body[0] == "paragraph"
    table_kinds = {i for k, i in model.body_order if k == "table"}

    for paragraph in model.paragraphs:
        text = paragraph.text
        if not text.strip():
            paragraph_c = Classification(
                element_type=C.E_PARAGRAPH,
                confidence=1.0,
                reason_codes=["empty"],
                source_index=paragraph.index,
            )
            structure.add(paragraph_c)
            prev_kind = C.E_PARAGRAPH
            continue

        caption = caption_clf.classify(paragraph)
        if caption:
            caption_counts[caption.element_type] = caption_counts.get(
                caption.element_type, 0
            ) + 1
            expected = caption_counts[caption.element_type]
            if caption.subtype and expected == _caption_number(caption.subtype):
                caption.confidence = min(0.98, caption.confidence + 0.06)
                caption.reason_codes.append("caption_sequence_continuity")
            # table caption directly preceding a table
            nxt = next_in_body.get(paragraph.index)
            if (
                nxt
                and nxt[0] == "table"
                and caption.element_type == C.E_TABLE_CAPTION
            ):
                caption.confidence = min(0.99, caption.confidence + 0.05)
                caption.reason_codes.append("adjacent_table")
            elif nxt and nxt[0] == "table":
                caption.element_type = C.E_TABLE_CAPTION
            structure.add(caption)
            prev_kind = caption.element_type
            continue

        # Title candidate: very first body paragraph
        if paragraph.index == model.body_order[0][1] and not seen_heading:
            if _is_first_paragraph_candidate(paragraph):
                signals = 0.55
                codes = ["title_position", "short_line"]
                if stats.strictly_larger_than_body(paragraph):
                    signals += 0.20
                    codes.append("large_font")
                if paragraph.runs and all(
                    r.bold for r in paragraph.runs if r.text.strip()
                ):
                    signals += 0.10
                    codes.append("bold")
                structure.add(
                    Classification(
                        element_type=C.E_TITLE,
                        confidence=min(0.98, round(signals, 4)),
                        reason_codes=codes,
                        source_index=paragraph.index,
                    )
                )
                prev_kind = C.E_TITLE
                continue

        cls = heading_clf.classify(paragraph, prev_kind, seen_heading)
        if cls is None:
            cls = Classification(
                element_type=C.E_PARAGRAPH,
                confidence=0.55,
                reason_codes=["empty_or_whitespace"],
                source_index=paragraph.index,
            )
        if cls.is_heading:
            seen_heading = True
        structure.add(cls)
        prev_kind = cls.element_type

    for table_index in sorted(table_kinds):
        structure.add(
            Classification(
                element_type=C.E_TABLE,
                confidence=1.0,
                reason_codes=["xml_table_element"],
                source_index=table_index,
            )
        )

    return structure


def _caption_number(subtype: str | None) -> int:
    if not subtype:
        return -1
    m = re.search(r"\d+", subtype)
    return int(m.group(0)) if m else -1