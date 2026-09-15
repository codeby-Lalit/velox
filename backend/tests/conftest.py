"""Shared test fixtures: build DOCX documents in-memory."""

from __future__ import annotations

from pathlib import Path

import pytest
from docx import Document
from docx.shared import Pt


def _heading(doc: Document, text: str, size: float = 16, bold: bool = True, space_before: float = 18):
    p = doc.add_paragraph()
    r = p.add_run(text)
    r.font.bold = bold
    r.font.size = Pt(size)
    p.paragraph_format.space_before = Pt(space_before)
    return p


def build_manuscript() -> Document:
    doc = Document()
    p = doc.add_paragraph()
    r = p.add_run("Test Manuscript Title")
    r.font.size = Pt(24)
    r.font.bold = True

    _heading(doc, "1. Introduction")
    doc.add_paragraph("Intro paragraph one with enough words to look like body text.")
    doc.add_paragraph("Intro paragraph two with body-like length and more words inside.")

    _heading(doc, "1.1 Background", size=14)
    doc.add_paragraph("Background body paragraph with content that must not be changed.")

    _heading(doc, "2. Methods")
    doc.add_paragraph("Methods body text contains plenty of words for classification.")

    cap = doc.add_paragraph()
    cr = cap.add_run("Table 1: Experiment summary")
    cr.font.bold = True
    cr.font.italic = True

    table = doc.add_table(rows=2, cols=2)
    table.style = "Table Grid"
    table.rows[0].cells[0].text = "Metric"
    table.rows[0].cells[1].text = "Value"
    table.rows[1].cells[0].text = "Accuracy"
    table.rows[1].cells[1].text = "0.98"

    cap2 = doc.add_paragraph()
    cr2 = cap2.add_run("Figure 1. Pipeline diagram")
    cr2.font.italic = True

    _heading(doc, "3. Conclusion", size=16)
    doc.add_paragraph("Conclusion paragraph with normal body text content inside it.")
    return doc


def build_flat_document() -> Document:
    """Document with no structure: only plain body-like paragraphs."""
    doc = Document()
    for i in range(5):
        doc.add_paragraph(
            f"Plain paragraph {i} with a reasonable amount of body text and a period at the end."
        )
    return doc


@pytest.fixture()
def manuscript(tmp_path: Path) -> Path:
    path = tmp_path / "manuscript.docx"
    build_manuscript().save(str(path))
    return path


@pytest.fixture()
def flat_document(tmp_path: Path) -> Path:
    path = tmp_path / "flat.docx"
    build_flat_document().save(str(path))
    return path


@pytest.fixture()
def manuscript_document() -> Document:
    return build_manuscript()