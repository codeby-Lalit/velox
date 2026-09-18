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


_SENTENCE = (
    "The experimental data collected over several sessions shows a clear trend, "
    "while the control group maintained a stable baseline throughout the study. "
    "Researchers noted that the observed variance remained well within the expected "
    "range, suggesting that the measurement apparatus and the calibration procedure "
    "both performed as designed. Subsequent analysis confirmed the initial hypothesis, "
    "although a few outliers required closer inspection before they could be safely excluded."
)


def build_large_unstructured_document(
    body_paragraphs: int = 1300, tables: int = 6, seed: int = 7, mode: str = "unstructured"
) -> Document:
    """A ~420 page, deliberately messy manuscript (R13 stress test).

    ``mode`` picks a distinct stress profile so tests cover different 400+ page
    documents:
      - "unstructured": random inconsistent heading conventions + odd tables
      - "wall_of_text": zero headings, endless body paragraphs (no structure)
      - "table_heavy": many tables with out-of-order captions and raw data
    """
    import random

    rng = random.Random(seed)
    doc = Document()
    para_counter = 0

    def body(idx):
        nonlocal para_counter
        p = doc.add_paragraph(f"{_SENTENCE} (paragraph {idx} of the large run.)")
        para_counter += 1

    def noisy_heading(idx):
        """One of several inconsistent 'heading' styles."""
        nonlocal para_counter
        p = doc.add_paragraph()
        style = rng.choice(["bold", "caps", "numbered", "mixed"])
        if style == "bold":
            r = p.add_run(f"Section {idx}")
            r.font.bold = True
            r.font.size = Pt(rng.choice([13, 14, 16]))
        elif style == "caps":
            r = p.add_run(f"APPENDIX {idx} — RAW NOTES")
            r.font.bold = True
            r.font.size = Pt(15)
        elif style == "numbered":
            r = p.add_run(f"{rng.randint(1, 9)}.{rng.randint(1, 9)}. {idx} discussion")
            r.font.bold = rng.random() > 0.3
            r.font.size = Pt(rng.choice([12, 13, 15]))
        else:  # mixed: capital first letters, no bold, larger size
            r = p.add_run(f"Overview Of The {idx}Th Experiment")
            r.font.size = Pt(14)
            r.font.bold = rng.random() > 0.5
        para_counter += 1

    def table_blob(tidx):
        nonlocal para_counter
        cap = doc.add_paragraph()
        cr = cap.add_run(rng.choice(
            [f"Table {tidx}: Measurement summary", "Result Analysis",
             f"Table {tidx} — comparison of conditions"]
        ))
        cr.font.italic = rng.random() > 0.4
        para_counter += 1
        tbl = doc.add_table(rows=4, cols=3)
        tbl.style = "Table Grid"
        for ri, row in enumerate(tbl.rows):
            for ci, cell in enumerate(row.cells):
                cell.text = f"c{ri}x{ci}={rng.randint(0, 999)}"
        doc.add_paragraph()  # separator
        para_counter += 1

    if mode == "wall_of_text":
        for i in range(body_paragraphs):
            body(i)
        return doc
    if mode == "table_heavy":
        for i in range(body_paragraphs):
            body(i)
            if i % 3 == 0:
                table_blob(rng.randint(1, 999))
        return doc

    headings = 0
    for i in range(body_paragraphs):
        if headings < 30 and rng.random() < 0.03:
            noisy_heading(headings)
            headings += 1
        elif rng.random() < 0.008:
            table_blob(rng.randint(1, 99))
        else:
            body(i)
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