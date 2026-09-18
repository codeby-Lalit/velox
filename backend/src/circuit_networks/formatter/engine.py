"""Formatting engine (F008).

Applies a publisher profile to a copy of the source DOCX so all content
parts are preserved (R8). Formatting only changes presentation: styles,
fonts, spacing, indentation, alignment, headings, captions, tables.
"""

from __future__ import annotations

import shutil
from pathlib import Path

from docx import Document
from docx.enum.section import WD_ORIENT
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.shared import Cm, Mm, Pt
from docx.text.paragraph import Paragraph

from ..core import constants as C
from ..core.config import ProfileConfig
from ..core.models import DocumentModel
from ..structure.model import Classification, StructureMap

_ALIGNMENT = {
    "left": WD_ALIGN_PARAGRAPH.LEFT,
    "center": WD_ALIGN_PARAGRAPH.CENTER,
    "right": WD_ALIGN_PARAGRAPH.RIGHT,
    "justify": WD_ALIGN_PARAGRAPH.JUSTIFY,
}

_TYPE_TO_HEADING_STYLE = C.TYPE_TO_HEADING_STYLE
_LEVEL_INDEX = C.TYPE_TO_LEVEL_INDEX


def _set_run_font(run, spec) -> None:
    run.font.name = spec.name
    run.font.size = Pt(spec.size)
    run.font.bold = bool(spec.bold)
    run.font.italic = bool(spec.italic)
    rpr = run._element.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = rpr.makeelement(qn("w:rFonts"), {})
        rpr.insert(0, rfonts)
    for attr in ("ascii", "hAnsi", "cs", "eastAsia"):
        rfonts.set(qn(f"w:{attr}"), spec.name)
    if spec.color:
        color = rpr.find(qn("w:color"))
        if color is None:
            color = rpr.makeelement(qn("w:color"), {})
            rpr.append(color)
        color.set(qn("w:val"), spec.color.lstrip("#"))


def _apply_paragraph_format(paragraph: Paragraph, spec) -> None:
    pf = paragraph.paragraph_format
    spacing = spec.spacing
    pf.space_before = Pt(spacing.before)
    pf.space_after = Pt(spacing.after)
    if spacing.line and spacing.line > 0:
        try:
            pf.line_spacing = spacing.line
        except Exception:
            pass
    if spacing.first_line_indent:
        pf.first_line_indent = Pt(spacing.first_line_indent)
    if spec.alignment in _ALIGNMENT:
        pf.alignment = _ALIGNMENT[spec.alignment]
    if getattr(spec, "keep_with_next", False):
        try:
            pf.keep_with_next = True
        except Exception:
            pass


def _apply_body_format(paragraph: Paragraph, profile: ProfileConfig) -> None:
    spec = profile.body
    font_spec = profile.font_for("body", "Times New Roman", 12.0)
    _apply_paragraph_format(paragraph, spec)
    for run in paragraph.runs:
        _set_run_font(run, _ComposeFont(font_spec, run))


class _ComposeFont:
    """Merge profile font with source run bold/italic when profile is neutral."""

    def __init__(self, base, run):
        self.name = base.name
        self.color = base.color
        self.size = base.size
        b = run.font.bold if run.font.bold is not None else False
        i = run.font.italic if run.font.italic is not None else False
        self.bold = base.bold or b
        self.italic = base.italic or i


def _apply_heading_format(
    paragraph: Paragraph,
    classification: Classification,
    profile: ProfileConfig,
) -> None:
    style_for = _TYPE_TO_HEADING_STYLE.get(classification.element_type)
    if style_for:
        try:
            paragraph.style = style_for
        except Exception:
            pass
    spec = profile.heading_spec(_LEVEL_INDEX.get(classification.element_type, 2))
    _apply_paragraph_format(paragraph, spec)
    font_spec = spec.font
    for run in paragraph.runs:
        if run.text.strip():
            _set_run_font(run, font_spec)


def _apply_caption_format(paragraph: Paragraph, profile: ProfileConfig) -> None:
    spec = profile.captions
    font_spec = profile.font_for("caption", "Times New Roman", 10.0)
    _apply_paragraph_format(paragraph, spec)
    for run in paragraph.runs:
        if run.text.strip():
            _set_run_font(run, _ComposeFont(font_spec, run))


def _apply_table_format(table, profile: ProfileConfig) -> None:
    table_spec = profile.tables
    try:
        table.style = table_spec.style
    except Exception:
        pass
    try:
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
    except Exception:
        pass
    if table.rows:
        for cell in table.rows[0].cells:
            for p in cell.paragraphs:
                for run in p.runs:
                    run.font.bold = True


def _apply_section_format(document: Document, profile: ProfileConfig) -> None:
    page = profile.page
    landscape = page.orientation == "landscape"
    for section in document.sections:
        section.orientation = WD_ORIENT.LANDSCAPE if landscape else WD_ORIENT.PORTRAIT
        section.page_width, section.page_height = _page_dimensions(page)
        section.top_margin = Cm(page.margins.get("top", 2.54))
        section.bottom_margin = Cm(page.margins.get("bottom", 2.54))
        section.left_margin = Cm(page.margins.get("left", 3.18))
        section.right_margin = Cm(page.margins.get("right", 3.18))


def _page_dimensions(page):
    if page.size == "Letter":
        portrait = (Mm(215.9), Mm(279.4))
    else:  # A4 default
        portrait = (Mm(210), Mm(297))
    if page.orientation == "landscape":
        return portrait[1], portrait[0]
    return portrait


def format_document(
    source_path: str,
    output_path: str,
    profile: ProfileConfig,
    model: DocumentModel,
    structure: StructureMap,
    text_overrides: dict[int, str] | None = None,
) -> None:
    """Produce output_path from a copy of source_path with profile formatting.

    ``text_overrides`` maps paragraph index -> intended text for user-driven
    edits (F110). Only explicitly edited paragraphs are rewritten; everything
    else stays byte-preserved from the source copy (R3/R8)."""
    output_path = str(Path(output_path))
    shutil.copyfile(source_path, output_path)

    document = Document(output_path)
    _apply_section_format(document, profile)

    paragraphs = document.paragraphs
    tables = document.tables

    para_index = 0
    table_index = 0
    for kind, idx in model.body_order:
        if kind == "paragraph":
            if para_index >= len(paragraphs):
                continue
            classification = structure.get(idx)
            paragraph = paragraphs[para_index]
            para_index += 1
            if text_overrides and idx in text_overrides:
                _replace_paragraph_text(paragraph, text_overrides[idx])
            if classification is None or not paragraph.text and not paragraph.runs:
                continue
            if classification.element_type in _TYPE_TO_HEADING_STYLE:
                _apply_heading_format(paragraph, classification, profile)
            elif classification.is_caption:
                _apply_caption_format(paragraph, profile)
            else:
                _apply_body_format(paragraph, profile)
        elif kind == "table":
            if table_index >= len(tables):
                continue
            _apply_table_format(tables[table_index], profile)
            table_index += 1

    document.save(output_path)


def _replace_paragraph_text(paragraph: Paragraph, text: str) -> None:
    """Rewrite a paragraph's runs with the edited text (user-driven, kept minimal)."""
    runs = paragraph.runs
    if runs:
        runs[0].text = text
        for run in runs[1:]:
            run.text = ""
    else:
        paragraph.add_run(text)