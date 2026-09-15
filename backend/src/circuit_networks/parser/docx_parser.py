"""DOCX / OpenXML parser.

Extracts a normalized DocumentModel from a .docx file while preserving
body element ordering. Uses python-docx over lxml and the standard library.
"""

from __future__ import annotations

import hashlib
import os
import zipfile
from typing import Any

from docx import Document
from docx.document import Document as _Document
from docx.oxml.ns import qn
from docx.table import Table, _Cell
from docx.text.paragraph import Paragraph

from ..core.models import (
    CellInfo,
    DocumentMetadata,
    DocumentModel,
    ParagraphInfo,
    RunInfo,
    TableInfo,
)


class DocxValidationError(Exception):
    """Raised when a file is not a usable DOCX."""


def sha256_of_file(path: str) -> str:
    with open(path, "rb") as fh:
        return hashlib.sha256(fh.read()).hexdigest()


def validate_docx(path: str) -> None:
    if not path.lower().endswith(".docx"):
        raise DocxValidationError("File must have a .docx extension")
    try:
        with zipfile.ZipFile(path) as zf:
            names = set(zf.namelist())
            if "word/document.xml" not in names:
                raise DocxValidationError(
                    "Invalid OpenXML package: missing word/document.xml"
                )
    except zipfile.BadZipFile as exc:
        raise DocxValidationError("Invalid DOCX package (not a zip archive)") from exc


def _size_pt(value) -> float | None:
    if value is None:
        return None
    try:
        return round(float(value.pt), 2)
    except (AttributeError, TypeError, ValueError):
        return None


def _spacing_pt(value) -> float | None:
    if value is None:
        return None
    try:
        return round(float(value), 2)
    except (AttributeError, TypeError, ValueError):
        return None


def _resolve_style(doc: _Document, paragraph: Paragraph) -> str | None:
    try:
        style = paragraph.style
        if style is None:
            return None
        return style.name or style.style_id
    except Exception:
        return None


def _heading_level_of(style_name: str | None) -> int | None:
    if not style_name:
        return None
    lname = style_name.lower()
    if lname.startswith("heading"):
        tokens = [t for t in lname.split() if t.isdigit()]
        if tokens:
            return int(tokens[0])
    return None


def _run_text(run) -> str:
    text = run.text or ""
    # python-docx returns already-unescaped text; tabs/newlines preserved.
    if run._element.tag == qn("w:br"):
        return ""
    return text


def _parse_runs(paragraph: Paragraph) -> list[RunInfo]:
    runs: list[RunInfo] = []
    properties = {
        "bold": "bold",
        "italic": "italic",
        "underline": "underline",
        "all_caps": "all_caps",
    }
    for run in paragraph.runs:
        font = run.font
        runs.append(
            RunInfo(
                text=_run_text(run),
                bold=font.bold,
                italic=font.italic,
                underline=font.underline,
                size=_size_pt(font.size),
                font_name=font.name,
                all_caps=getattr(font, properties["all_caps"]),
                style_name=_resolve_style_any(run),
            )
        )
    return runs


def _resolve_style_any(obj) -> str | None:
    try:
        style = obj.style
        return style.name if style is not None else None
    except Exception:
        return None


def _outline_level(paragraph: Paragraph, style_name: str | None) -> int | None:
    try:
        char_style = paragraph.style
        if char_style is not None and hasattr(char_style, "outline_level"):
            level = char_style.outline_level
            if isinstance(level, int):
                return level
    except Exception:
        level = None
    return _heading_level_of(style_name)


def _parse_paragraph(doc: _Document, paragraph: Paragraph, index: int) -> ParagraphInfo:
    style_name = _resolve_style(doc, paragraph)
    pf = paragraph.paragraph_format
    runs = _parse_runs(paragraph)
    text = "".join(r.text for r in runs)
    heading_level = _heading_level_of(style_name)
    return ParagraphInfo(
        index=index,
        text=text.strip(),
        original_text=text,
        style_name=style_name,
        runs=runs,
        alignment=int(pf.alignment) if pf.alignment is not None else None,
        outline_level=_outline_level(paragraph, style_name),
        spacing_before=_spacing_pt(getattr(pf, "space_before", None)),
        spacing_after=_spacing_pt(getattr(pf, "space_after", None)),
        first_line_indent=_spacing_pt(pf.first_line_indent),
        is_heading_style="heading" in (style_name or "").lower(),
        heading_level=heading_level,
        is_table=False,
    )


def _parse_cell(cell: _Cell, row_index: int, col_index: int) -> CellInfo:
    texts = []
    for paragraph in cell.paragraphs:
        text = "".join(r.text or "" for r in paragraph.runs)
        if text:
            texts.append(text)
    return CellInfo(text="\n".join(texts), row_index=row_index, col_index=col_index)


def _parse_table(table: Table, index: int) -> TableInfo:
    info = TableInfo(index=index)
    for ri, row in enumerate(table.rows):
        cells: list[CellInfo] = []
        for ci, cell in enumerate(row.cells):
            cells.append(_parse_cell(cell, ri, ci))
        info.rows.append(cells)
    return info


def _extract_metadata(doc: _Document) -> DocumentMetadata:
    cp = doc.core_properties
    return DocumentMetadata(
        title=cp.title or None,
        author=cp.author or None,
        created=cp.created.isoformat() if cp.created else None,
        modified=cp.modified.isoformat() if cp.modified else None,
        language=cp.language or None,
    )


def parse_docx(path: str) -> DocumentModel:
    """Parse a DOCX file into a DocumentModel preserving body order."""
    validate_docx(path)
    doc = Document(path)

    paragraphs: list[ParagraphInfo] = []
    tables: list[TableInfo] = []
    body_order: list[tuple[str, int]] = []
    paragraph_counter = 0
    table_counter = 0

    body = doc.element.body
    for child in body.iterchildren():
        if child.tag == qn("w:p"):
            paragraph = Paragraph(child, doc)
            paragraphs.append(_parse_paragraph(doc, paragraph, paragraph_counter))
            body_order.append(("paragraph", paragraph_counter))
            paragraph_counter += 1
        elif child.tag == qn("w:tbl"):
            table = Table(child, doc)
            tables.append(_parse_table(table, table_counter))
            body_order.append(("table", table_counter))
            table_counter += 1
        # w:sectPr and others are ignored for body content

    return DocumentModel(
        paragraphs=paragraphs,
        tables=tables,
        metadata=_extract_metadata(doc),
        source_path=os.path.abspath(path),
        source_size_bytes=os.path.getsize(path),
        source_sha256=sha256_of_file(path),
        body_order=body_order,
    )