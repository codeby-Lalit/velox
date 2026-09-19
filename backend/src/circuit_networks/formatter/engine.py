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
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Mm, Pt
from docx.text.paragraph import Paragraph

from ..core import constants as C
from ..core.config import FontSpec, ParagraphSpec, ProfileConfig, SpacingSpec
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
        pf.first_line_indent = Cm(spacing.first_line_indent)
    if getattr(spec, "widow_control", True):
        try:
            pf.widow_control = True
        except Exception:
            pass
    if getattr(spec, "page_break", False):
        try:
            pf.page_break_before = True
        except Exception:
            pass
    if spec.alignment in _ALIGNMENT:
        pf.alignment = _ALIGNMENT[spec.alignment]
    if getattr(spec, "keep_with_next", False):
        try:
            pf.keep_with_next = True
        except Exception:
            pass


def _apply_body_format(
    paragraph: Paragraph,
    profile: ProfileConfig,
    is_list: bool = False,
) -> None:
    spec = profile.body
    if is_list and profile.lists.enabled:
        try:
            pf = paragraph.paragraph_format
            pf.left_indent = Cm(profile.lists.indent)
            pf.first_line_indent = Cm(-profile.lists.hanging)
            spec = ParagraphSpec(
                alignment=spec.alignment,
                spacing=SpacingSpec(
                    before=profile.lists.item_spacing_before,
                    after=profile.lists.item_spacing_after,
                    line=spec.spacing.line,
                    first_line_indent=0,
                    widow_control=True,
                ),
            )
        except Exception:
            pass
    font_spec = profile.font_for("body", "Times New Roman", 12.0)
    _apply_paragraph_format(paragraph, spec)
    for run in paragraph.runs:
        _set_run_font(run, _ComposeFont(font_spec, run))


def _is_list_paragraph(paragraph: Paragraph) -> bool:
    try:
        ppr = paragraph._p.find(qn("w:pPr"))
        return ppr is not None and ppr.find(qn("w:numPr")) is not None
    except Exception:
        return False


def _is_references_heading(text: str, profile: ProfileConfig) -> bool:
    lowered = (text or "").strip().lower()
    return any(marker in lowered for marker in profile.references.heading_markers)


def _apply_references_format(paragraph: Paragraph, profile: ProfileConfig) -> None:
    refs = profile.references
    font_spec = FontSpec(name=refs.font_name, size=refs.font_size)
    try:
        pf = paragraph.paragraph_format
        pf.left_indent = Cm(refs.hanging_indent)
        pf.first_line_indent = Cm(-refs.hanging_indent)
        pf.space_before = Pt(0)
        pf.space_after = Pt(4)
        pf.line_spacing = refs.line_spacing
        pf.widow_control = True
    except Exception:
        pass
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


def _set_row_cant_split(row) -> None:
    try:
        tr_pr = row._tr.get_or_add_trPr()
        if tr_pr.find(qn("w:cantSplit")) is None:
            tr_pr.append(OxmlElement("w:cantSplit"))
    except Exception:
        pass


def _set_header_repeat(row) -> None:
    try:
        tr_pr = row._tr.get_or_add_trPr()
        if tr_pr.find(qn("w:tblHeader")) is None:
            tr_pr.append(OxmlElement("w:tblHeader"))
    except Exception:
        pass


def _apply_horizontal_borders(table) -> None:
    """Clean publication table: top/bottom rule + separator under header only."""
    try:
        tbl_pr = table._tbl.tblPr
        borders = tbl_pr.find(qn("w:tblBorders"))
        if borders is None:
            borders = OxmlElement("w:tblBorders")
            tbl_pr.append(borders)
        for child in list(borders):
            borders.remove(child)

        def add(name: str, val: str) -> None:
            el = OxmlElement(f"w:{name}")
            el.set(qn("w:val"), val)
            el.set(qn("w:sz"), "8")
            el.set(qn("w:space"), "0")
            el.set(qn("w:color"), "000000")
            borders.append(el)

        add("top", "single")
        add("bottom", "single")
        add("left", "none")
        add("right", "none")
        add("insideH", "none")
        add("insideV", "none")
    except Exception:
        pass
    if table.rows:
        for cell in table.rows[0].cells:
            try:
                tc_pr = cell._tc.get_or_add_tcPr()
                cell_borders = tc_pr.find(qn("w:tcBorders"))
                if cell_borders is None:
                    cell_borders = OxmlElement("w:tcBorders")
                    tc_pr.append(cell_borders)
                bottom = cell_borders.find(qn("w:bottom"))
                if bottom is None:
                    bottom = OxmlElement("w:bottom")
                    cell_borders.append(bottom)
                for k, v in (
                    ("w:val", "single"),
                    ("w:sz", "8"),
                    ("w:space", "0"),
                    ("w:color", "000000"),
                ):
                    bottom.set(qn(k), v)
            except Exception:
                pass


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
        header_row = table.rows[0]
        if table_spec.header_bold:
            for cell in header_row.cells:
                for p in cell.paragraphs:
                    for run in p.runs:
                        run.font.bold = True
        if table_spec.header_repeat:
            _set_header_repeat(header_row)
        if table_spec.borders == "horizontal":
            _apply_horizontal_borders(table)
        if table_spec.cant_split:
            for row in table.rows:
                _set_row_cant_split(row)


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
        if page.gutter and page.gutter > 0:
            try:
                section._sectPr.pgMar.set(qn("w:gutter"), str(int(page.gutter * 567)))
            except Exception:
                pass
        if page.footer_page_number:
            _add_page_number_footer(section)


def _add_page_number_footer(section) -> None:
    """Bottom-center PAGE field on empty footers only (never clobber existing content)."""
    try:
        if section.footer.is_linked_to_previous:
            return
        if any(p.text.strip() for p in section.footer.paragraphs):
            return
    except Exception:
        return
    try:
        section.footer.is_linked_to_previous = False
        para = section.footer.paragraphs[0]
        para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = para.add_run()
        r = run._r
        begin = OxmlElement("w:fldChar")
        begin.set(qn("w:fldCharType"), "begin")
        instr = OxmlElement("w:instrText")
        instr.set(qn("xml:space"), "preserve")
        instr.text = " PAGE "
        end = OxmlElement("w:fldChar")
        end.set(qn("w:fldCharType"), "end")
        r.append(begin)
        r.append(instr)
        r.append(end)
        rpr = r.find(qn("w:rPr"))
        if rpr is None:
            rpr = OxmlElement("w:rPr")
            r.insert(0, rpr)
        font = rpr.find(qn("w:rFonts"))
        if font is None:
            font = OxmlElement("w:rFonts")
            rpr.insert(0, font)
        font.set(qn("w:ascii"), "Times New Roman")
        font.set(qn("w:hAnsi"), "Times New Roman")
        sz = rpr.find(qn("w:sz"))
        if sz is None:
            sz = OxmlElement("w:sz")
            rpr.append(sz)
        sz.set(qn("w:val"), "20")
    except Exception:
        pass


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
    set_title: str | None = None,
) -> None:
    """Produce output_path from a copy of source_path with profile formatting.

    ``text_overrides`` maps paragraph index -> intended text for user-driven
    edits (F110). Only explicitly edited paragraphs are rewritten; everything
    else stays byte-preserved from the source copy (R3/R8).
    ``set_title`` fills an empty core-property title (docProps/core.xml only —
    never body content), resolving metadata_missing without touching words."""
    output_path = str(Path(output_path))
    shutil.copyfile(source_path, output_path)

    document = Document(output_path)
    if set_title and set_title.strip():
        try:
            document.core_properties.title = set_title.strip()
        except Exception:
            pass
    _apply_section_format(document, profile)

    paragraphs = document.paragraphs
    tables = document.tables

    para_index = 0
    table_index = 0
    in_references = False
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
                if profile.references.enabled:
                    in_references = _is_references_heading(paragraph.text, profile)
            elif classification.is_caption:
                _apply_caption_format(paragraph, profile)
            elif profile.references.enabled and in_references:
                _apply_references_format(paragraph, profile)
            else:
                _apply_body_format(paragraph, profile, is_list=_is_list_paragraph(paragraph))
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