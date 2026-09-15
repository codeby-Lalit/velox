"""Generate a deliberately "messy" manuscript DOCX for demos/tests.

Run: python scripts/make_sample.py [output.docx]
"""

from __future__ import annotations

import sys
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Pt

ROOT = Path(__file__).resolve().parents[1]


def _add_paragraph(doc: Document, text: str, **kw):
    p = doc.add_paragraph()
    run = p.add_run(text)
    size = kw.pop("size", None)
    if size:
        run.font.size = Pt(size)
    for key, val in kw.items():
        setattr(run.font, key, val)
    if kw.get("align") is None and not kw:
        pass
    return p


def build() -> Document:
    doc = Document()

    # Inconsistent formatting: default Word body style used throughout,
    # headings are just bold text with no Heading styles.

    p = doc.add_paragraph()
    r = p.add_run("A Study of Open Document Processing Pipelines")
    r.font.size = Pt(26)
    r.font.bold = True

    p = doc.add_paragraph()
    r = p.add_run("Final Report — Subject Area 4")
    r.font.size = Pt(14)
    r.font.italic = True

    p = doc.add_paragraph()
    r = p.add_run("Author Name")
    r.font.size = Pt(12)
    p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER

    _add_paragraph(doc, "", size=8)

    p = doc.add_paragraph()
    r = p.add_run("1. Introduction")
    r.font.bold = True
    r.font.size = Pt(16)
    p.paragraph_format.space_before = Pt(18)

    doc.add_paragraph(
        "Manuscripts arrive in widely varying states of formatting. This report "
        "describes a deterministic, offline-first pipeline that takes an "
        "inconsistent Word document and produces a publication-ready copy while "
        "preserving the exact textual content."
    )
    doc.add_paragraph(
        "The system never rewrites author prose. It only adjusts presentation "
        "attributes such as styles, fonts, margins, spacing, alignment and "
        "numbering display. Every structural decision it makes is explainable "
        "through reason codes and confidence scores."
    )

    p = doc.add_paragraph()
    r = p.add_run("1.1 Background")
    r.font.bold = True
    r.font.size = Pt(14)

    doc.add_paragraph(
        "Existing formatting practice relies on manual repetition in a word "
        "processor. Editors therefore spend large amounts of time on mechanical "
        "work and also risk unintended changes to the source text."
    )

    p = doc.add_paragraph()
    r = p.add_run("1.1.1 Scope")
    r.font.bold = True
    r.font.size = Pt(13)

    doc.add_paragraph(
        "We scope the pipeline to DOCX manuscripts of up to several hundred "
        "pages, including tables, captions and mixed heading hierarchies."
    )

    p = doc.add_paragraph()
    r = p.add_run("2. Design Principles")
    r.font.bold = True
    r.font.size = Pt(16)
    p.paragraph_format.space_before = Pt(18)

    doc.add_paragraph("The following rules govern every component.")

    p = doc.add_paragraph()
    r = p.add_run("2.1 Offline first")
    r.font.bold = True
    r.font.size = Pt(14)

    doc.add_paragraph(
        "No document content may leave the device. All analysis, classification "
        "and formatting runs locally with deterministic algorithms."
    )

    p = doc.add_paragraph()
    r = p.add_run("2.2 Content preservation")
    r.font.bold = True
    r.font.size = Pt(14)

    doc.add_paragraph(
        "Paragraph text, table cell text, caption text and reference text are "
        "treated as immutable. The pipeline verifies this with integrity "
        "fingerprints after formatting."
    )

    p = doc.add_paragraph()
    r = p.add_run("2.3 Explainability")
    r.font.bold = True
    r.font.size = Pt(14)

    doc.add_paragraph(
        "Every element classification includes a confidence value and a set of "
        "human-readable reason codes so that an editor can understand and accept "
        "or override a decision."
    )

    p = doc.add_paragraph()
    r = p.add_run("3. Implementation")
    r.font.bold = True
    r.font.size = Pt(16)
    p.paragraph_format.space_before = Pt(18)

    doc.add_paragraph(
        "The engine is written in Python. It opens the DOCX as an OpenXML "
        "package, builds a normalized document model and walks the body in order."
    )

    p = doc.add_paragraph()
    r = p.add_run("4. Evaluation")
    r.font.bold = True
    r.font.size = Pt(16)
    p.paragraph_format.space_before = Pt(18)

    doc.add_paragraph(
        "We evaluate structure accuracy, formatting conformance, processing "
        "performance and content integrity on the sample corpus below."
    )

    p = doc.add_paragraph()
    r = p.add_run("Table 1: Evaluation corpus")
    r.font.bold = True
    r.font.italic = True

    rows = [
        ["Simple manuscript", "4", "1", "true"],
        ["Academic paper", "9", "3", "true"],
        ["Book chapter", "41", "7", "true"],
    ]
    table = doc.add_table(rows=1 + len(rows), cols=4)
    table.style = "Table Grid"
    headers = ["Document", "Pages", "Tables", "Pass"]
    for j, h in enumerate(headers):
        table.rows[0].cells[j].text = h
    for i, row in enumerate(rows, start=1):
        for j, val in enumerate(row):
            table.rows[i].cells[j].text = val

    p = doc.add_paragraph()
    r = p.add_run("Figure 1. Pipeline architecture overview")
    r.font.italic = True

    p = doc.add_paragraph()
    r = p.add_run("5. Conclusion")
    r.font.bold = True
    r.font.size = Pt(16)
    p.paragraph_format.space_before = Pt(18)

    doc.add_paragraph(
        "An offline manuscript pipeline is achievable with deterministic "
        "document analysis. The result remains fully reproducible and verifiable "
        "without any internet connection or generative model."
    )

    p = doc.add_paragraph()
    r = p.add_run("6. References")
    r.font.bold = True
    r.font.size = Pt(16)
    p.paragraph_format.space_before = Pt(18)

    doc.add_paragraph("1. Open Packaging Conventions, ECMA-376.")
    doc.add_paragraph("2. W3C XML Working Group, XML 1.0.")

    return doc


def main() -> None:
    default = ROOT / "samples" / "messy_manuscript.docx"
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else default
    out.parent.mkdir(parents=True, exist_ok=True)
    build().save(str(out))
    print(f"Saved sample to {out}")


if __name__ == "__main__":
    main()