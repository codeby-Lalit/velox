"""Integrity verification (F009 / R4).

Independently reads the source and the output DOCX packages (via lxml ZIP
extraction, decoupled from the formatter) and compares textual content:
paragraphs, table cells, counts, and cryptographic fingerprints.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from typing import Iterable

from lxml import etree

NSMAP = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
}
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
TEXT_TAGS = {f"{W}t", f"{W}delText"}


@dataclass
class IntegrityReport:
    status: str  # "pass" | "fail"
    source_paragraphs: int = 0
    output_paragraphs: int = 0
    source_words: int = 0
    output_words: int = 0
    source_chars: int = 0
    output_chars: int = 0
    source_fingerprint: str = ""
    output_fingerprint: str = ""
    mismatches: list[dict] = field(default_factory=list)
    checked: dict = field(default_factory=dict)
    declared_edits: int = 0  # intentional user text edits recorded (R4-aware)

    def to_json(self) -> dict:
        return {
            "status": self.status,
            "source_paragraphs": self.source_paragraphs,
            "output_paragraphs": self.output_paragraphs,
            "source_words": self.source_words,
            "output_words": self.output_words,
            "source_chars": self.source_chars,
            "output_chars": self.output_chars,
            "source_fingerprint": self.source_fingerprint,
            "output_fingerprint": self.output_fingerprint,
            "mismatches": self.mismatches,
            "checked": self.checked,
            "declared_edits": self.declared_edits,
        }


def _read_document_xml(path: str) -> etree._Element:
    import zipfile

    with zipfile.ZipFile(path) as zf:
        xml_bytes = zf.read("word/document.xml")
    return etree.fromstring(xml_bytes)


def _extract_paragraph_texts(root: etree._Element) -> list[str]:
    texts: list[str] = []
    for p in root.iter(f"{W}p"):
        # skip paragraphs that belong to tables
        if _is_inside_table_cell(p):
            continue
        runs: list[str] = []
        for node in p.iter():
            if node.tag in TEXT_TAGS:
                runs.append(node.text or "")
        texts.append("".join(runs))
    return texts


def _is_inside_table_cell(element: etree._Element) -> bool:
    parent = element.getparent()
    while parent is not None:
        if parent.tag == f"{W}tc":
            return True
        parent = parent.getparent()
    return False


def _extract_cell_texts(root: etree._Element) -> list[str]:
    """Collect all table cell texts (rows order preserved by document order)."""
    cells: list[str] = []
    for tc in root.iter(f"{W}tc"):
        parts: list[str] = []
        for p in tc.iter(f"{W}p"):
            runs = [n.text or "" for n in p.iter() if n.tag in TEXT_TAGS]
            parts.append("".join(runs))
        cells.append("\n".join(p for p in parts if p))
    return cells


def _normalize(texts: Iterable[str]) -> tuple[str, int, int]:
    joined = "\n".join(text for text in texts if text.strip() != "\ufeff")
    words = len(joined.split())
    chars = len(joined.replace("\u200b", ""))
    return joined, words, chars


def _fingerprint(joined: str) -> str:
    return hashlib.sha256(joined.encode("utf-8")).hexdigest()


def verify_integrity(
    source_path: str,
    output_path: str,
    text_overrides: dict[int, str] | None = None,
) -> IntegrityReport:
    """Compare source and output content against the *intended* output.

    ``text_overrides`` maps paragraph index -> intended new text for
    user-driven edits (F110). Declared edits become the expected baseline, so
    an output that matches them still passes integrity while every unintended
    change is still flagged (R3/R4).
    """
    overrides = {int(k): v for k, v in (text_overrides or {}).items() if v is not None}
    report = IntegrityReport(status="pass")
    src_root = _read_document_xml(source_path)
    out_root = _read_document_xml(output_path)

    src_paras, _, _ = src_lens = _paragraphs_with_texts(src_root)
    out_paras, _, _ = out_lens = _paragraphs_with_texts(out_root)

    src_para_texts, src_words, src_chars = src_lens
    out_para_texts, out_words, out_chars = out_lens

    expected_paras = [
        overrides.get(i, text) if i in overrides else text
        for i, text in enumerate(src_paras)
    ]
    exp_joined, exp_words, exp_chars = _normalize(expected_paras)
    report.declared_edits = len(overrides)

    src_cells = _extract_cell_texts(src_root)
    out_cells = _extract_cell_texts(out_root)

    report.source_paragraphs = len(src_paras)
    report.output_paragraphs = len(out_paras)
    report.source_words = src_words
    report.output_words = out_words
    report.source_chars = src_chars
    report.output_chars = out_chars
    report.source_fingerprint = _fingerprint("\n".join(src_paras))
    report.output_fingerprint = _fingerprint("\n".join(out_paras))
    report.checked = {
        "paragraph_text": True,
        "table_cell_text": True,
        "paragraph_count": True,
        "word_count": True,
        "character_count": True,
        "fingerprint": True,
        "declared_edits": len(overrides),
    }

    if len(expected_paras) != len(out_paras):
        report.status = "fail"
        report.mismatches.append(
            {
                "kind": "paragraph_count",
                "expected": len(expected_paras),
                "actual": len(out_paras),
            }
        )

    for i, (a, b) in enumerate(zip(expected_paras, out_paras)):
        if a != b:
            report.status = "fail"
            report.mismatches.append(
                {
                    "kind": "paragraph_text",
                    "index": i,
                    "expected": a[:200],
                    "actual": b[:200],
                }
            )

    if len(src_cells) != len(out_cells):
        report.status = "fail"
        report.mismatches.append(
            {"kind": "cell_count", "expected": len(src_cells), "actual": len(out_cells)}
        )
    for i, (a, b) in enumerate(zip(src_cells, out_cells)):
        if a != b:
            report.status = "fail"
            report.mismatches.append(
                {"kind": "cell_text", "index": i, "expected": a[:200], "actual": b[:200]}
            )

    if exp_words != report.output_words:
        report.status = "fail"
        report.mismatches.append(
            {
                "kind": "word_count",
                "expected": exp_words,
                "actual": report.output_words,
            }
        )
    if exp_chars != report.output_chars:
        report.status = "fail"
        report.mismatches.append(
            {
                "kind": "character_count",
                "expected": exp_chars,
                "actual": report.output_chars,
            }
        )
    if _fingerprint(exp_joined) != report.output_fingerprint:
        report.status = "fail"
        report.mismatches.append(
            {
                "kind": "fingerprint",
                "expected": _fingerprint(exp_joined)[:16],
                "actual": report.output_fingerprint[:16],
            }
        )

    # Trim mismatches for large corrupted docs; keep first 50.
    report.mismatches = report.mismatches[:50]
    return report


def _paragraphs_with_texts(root: etree._Element) -> tuple[list[str], int, int]:
    texts = _extract_paragraph_texts(root)
    joined, words, chars = _normalize(texts)
    return texts, words, chars