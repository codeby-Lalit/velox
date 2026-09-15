"""Generate the sample manuscript corpus for demos, tests and regression (F108).

Run:
    python scripts/make_sample.py                       -> samples/messy_manuscript.docx
    python scripts/make_sample.py --corpus              -> rebuild all samples/
    python scripts/make_sample.py --kind academic       -> one variant
"""

from __future__ import annotations

import sys
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Pt

ROOT = Path(__file__).resolve().parents[1]
SAMPLES = ROOT / "samples"

KINDS = ("messy", "academic", "book", "bad_levels", "unicode", "empty")


def _paragraph(doc: Document, text: str, bold=False, italic=False, size=None, space_before=None, align=None):
    p = doc.add_paragraph()
    r = p.add_run(text)
    if size:
        r.font.size = Pt(size)
    if bold:
        r.font.bold = True
    if italic:
        r.font.italic = True
    if space_before:
        p.paragraph_format.space_before = Pt(space_before)
    if align:
        p.paragraph_format.alignment = align
    return p


def build_messy() -> Document:
    doc = Document()
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

    _paragraph(doc, "", size=8)

    _paragraph(doc, "1. Introduction", bold=True, size=16, space_before=18)
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

    _paragraph(doc, "1.1 Background", bold=True, size=14)
    doc.add_paragraph(
        "Existing formatting practice relies on manual repetition in a word "
        "processor. Editors therefore spend large amounts of time on mechanical "
        "work and also risk unintended changes to the source text."
    )

    _paragraph(doc, "1.1.1 Scope", bold=True, size=13)
    doc.add_paragraph(
        "We scope the pipeline to DOCX manuscripts of up to several hundred "
        "pages, including tables, captions and mixed heading hierarchies."
    )

    _paragraph(doc, "2. Design Principles", bold=True, size=16, space_before=18)
    doc.add_paragraph("The following rules govern every component.")

    _paragraph(doc, "2.1 Offline first", bold=True, size=14)
    doc.add_paragraph(
        "No document content may leave the device. All analysis, classification "
        "and formatting runs locally with deterministic algorithms."
    )

    _paragraph(doc, "2.2 Content preservation", bold=True, size=14)
    doc.add_paragraph(
        "Paragraph text, table cell text, caption text and reference text are "
        "treated as immutable. The pipeline verifies this with integrity "
        "fingerprints after formatting."
    )

    _paragraph(doc, "2.3 Explainability", bold=True, size=14)
    doc.add_paragraph(
        "Every element classification includes a confidence value and a set of "
        "human-readable reason codes so that an editor can understand and accept "
        "or override a decision."
    )

    _paragraph(doc, "3. Implementation", bold=True, size=16, space_before=18)
    doc.add_paragraph(
        "The engine is written in Python. It opens the DOCX as an OpenXML "
        "package, builds a normalized document model and walks the body in order."
    )

    _paragraph(doc, "4. Evaluation", bold=True, size=16, space_before=18)
    doc.add_paragraph(
        "We evaluate structure accuracy, formatting conformance, processing "
        "performance and content integrity on the sample corpus below."
    )

    _paragraph(doc, "Table 1: Evaluation corpus", bold=True, italic=True)
    rows = [
        ["Simple manuscript", "4", "1", "true"],
        ["Academic paper", "9", "3", "true"],
        ["Book chapter", "41", "7", "true"],
    ]
    table = doc.add_table(rows=1 + len(rows), cols=4)
    table.style = "Table Grid"
    for j, h in enumerate(["Document", "Pages", "Tables", "Pass"]):
        table.rows[0].cells[j].text = h
    for i, row in enumerate(rows, start=1):
        for j, val in enumerate(row):
            table.rows[i].cells[j].text = val

    _paragraph(doc, "Figure 1. Pipeline architecture overview", italic=True)

    _paragraph(doc, "5. Conclusion", bold=True, size=16, space_before=18)
    doc.add_paragraph(
        "An offline manuscript pipeline is achievable with deterministic "
        "document analysis. The result remains fully reproducible and verifiable "
        "without any internet connection or generative model."
    )

    _paragraph(doc, "6. References", bold=True, size=16, space_before=18)
    doc.add_paragraph("1. Open Packaging Conventions, ECMA-376.")
    doc.add_paragraph("2. W3C XML Working Group, XML 1.0.")
    return doc


def build_academic() -> Document:
    doc = Document()
    section = doc.sections[0]
    section.header.is_linked_to_previous = False
    section.header.paragraphs[0].text = "Journal of Manuscript Automation"
    p = section.header.add_paragraph("HackNIMA 2026 · Submission format")
    p.runs[0].italic = True
    section.footer.is_linked_to_previous = False
    section.footer.paragraphs[0].text = "Page — preprint, for review only"

    _paragraph(doc, "A Robust Pipeline for Offline Document Structuring",
               bold=True, size=24, align=WD_ALIGN_PARAGRAPH.CENTER)
    _paragraph(doc, "L. Kushwaha, R. Sharma", size=12, align=WD_ALIGN_PARAGRAPH.CENTER)
    _paragraph(doc, "Department of Computer Science, Demo University", size=11, align=WD_ALIGN_PARAGRAPH.CENTER)

    _paragraph(doc, "Abstract", bold=True, size=14)
    doc.add_paragraph(
        "We present a fully offline pipeline that turns unstructured DOCX "
        "manuscripts into publication-ready documents. The system combines "
        "deterministic structural classification with explainable confidence "
        "scores and a content-integrity fingerprint so that no author text is "
        "ever altered during formatting."
    )

    _paragraph(doc, "1. Introduction", bold=True)
    doc.add_paragraph(
        "Publishers receive manuscripts in inconsistent formats. Manual "
        "correction is slow, error-prone and not reproducible. Our goal is a "
        "tool that an editor can run locally, offline, with full auditability."
    )

    _paragraph(doc, "2. Method", bold=True)
    doc.add_paragraph(
        "The pipeline parses the OpenXML package, builds an ordered document "
        "model and classifies each body element deterministically. We extract "
        "heading levels, captions, tables and reference lists without any "
        "network access or machine-learned model."
    )
    _paragraph(doc, "2.1 Structural classification", bold=True)
    doc.add_paragraph(
        "Signals such as numbering patterns, heading styles, bold, font size "
        "and spacing are combined into a confidence score. Every decision "
        "records the reason codes that produced it."
    )
    _paragraph(doc, "2.2 Preflight checks", bold=True)
    doc.add_paragraph(
        "Before formatting, the engine flags hierarchy jumps, duplicated "
        "caption numbers and missing headings so an editor can review them."
    )

    _paragraph(doc, "3. Experiments", bold=True)
    _paragraph(doc, "Table 1: Word-level preservation on the corpus", italic=True)
    rows = [
        ["messy_manuscript", "100.0", "100.0"],
        ["academic_paper", "100.0", "100.0"],
        ["book_style", "100.0", "100.0"],
    ]
    table = doc.add_table(rows=1 + len(rows), cols=3)
    table.style = "Table Grid"
    for j, h in enumerate(["Sample", "Words kept %", "Chars kept %"]):
        table.rows[0].cells[j].text = h
    for i, row in enumerate(rows, start=1):
        for j, val in enumerate(row):
            table.rows[i].cells[j].text = val
    doc.add_paragraph(
        "Every formatted file is compared against its source by paragraph "
        "count, word count, character count and SHA-256 fingerprints."
    )

    _paragraph(doc, "4. Conclusion", bold=True)
    doc.add_paragraph(
        "Deterministic, offline formatting is practical and trustworthy. The "
        "full audit trail produced for each file makes every formatting "
        "decision explainable and verifiable."
    )

    _paragraph(doc, "References", bold=True)
    doc.add_paragraph("1. ECMA-376, Office Open XML File Formats.")
    doc.add_paragraph("2. W3C, Extensible Markup Language (XML) 1.0.")
    doc.add_paragraph("3. OASIS, OpenDocument Format for Office Applications.")
    return doc


def build_book() -> Document:
    doc = Document()
    _paragraph(doc, "Fields of Signal", bold=True, size=28,
               align=WD_ALIGN_PARAGRAPH.CENTER)
    _paragraph(doc, "A monograph in three parts", italic=True, size=14,
               align=WD_ALIGN_PARAGRAPH.CENTER)

    _paragraph(doc, "Chapter 1 Beginnings", bold=True, size=18, space_before=24)
    _paragraph(doc, "Introduction", bold=True, size=14)
    doc.add_paragraph(
        "Every system has a beginning. This chapter traces the ideas that "
        "became the modern deterministic manuscript pipeline, from early word "
        "processors to structured document formats."
    )
    _paragraph(doc, "Motivation", bold=True, size=14)
    doc.add_paragraph(
        "Editors need tools that compress repetitive formatting work without "
        "changing a single word written by an author."
    )

    _paragraph(doc, "Chapter 2 Origins", bold=True, size=18, space_before=24)
    _paragraph(doc, "The document model", bold=True, size=14)
    doc.add_paragraph(
        "A document is an ordered sequence of paragraph and table elements. "
        "Preserving that order is essential for correct reformatting."
    )
    _paragraph(doc, "An aside", italic=True, size=12)
    doc.add_paragraph(
        "Interesting digressions belong in sidebars, but a paragraph can "
        "sometimes carry them gracefully."
    )

    _paragraph(doc, "Chapter 3 Conclusions", bold=True, size=18, space_before=24)
    _paragraph(doc, "What we learned", bold=True, size=14)
    doc.add_paragraph(
        "Determinism wins. When every step is reproducible, an editor can "
        "trust the output and verify it afterwards."
    )
    return doc


def build_bad_levels() -> Document:
    """Deliberately messy: hierarchy jumps, captions before headings, dupes."""
    doc = Document()
    _paragraph(doc, "Broken Manuscript for Preflight Demo", bold=True, size=20)

    _paragraph(doc, "Table 2: Orphan caption before any heading", italic=True)
    rows = [["A", "B"], ["1", "2"]]
    table = doc.add_table(rows=2, cols=2)
    table.style = "Table Grid"
    for i, row in enumerate(rows):
        for j, val in enumerate(row):
            table.rows[i].cells[j].text = val

    _paragraph(doc, "1. Introduction", bold=True, size=16, space_before=16)
    doc.add_paragraph("This document intentionally breaks several rules.")
    _paragraph(doc, "1.1.1 Scope", bold=True, size=13, space_before=12)
    doc.add_paragraph("A hierarchy jump: subsection appears directly under section.")
    _paragraph(doc, "1.1.1.1 Deep cut", bold=True, size=12, space_before=10)
    doc.add_paragraph("Deeper still, another jump from level 3 to level 4.")
    _paragraph(doc, "2. Findings", bold=True, size=16, space_before=16)
    _paragraph(doc, "Table 1: First occurrence", italic=True)
    doc.add_paragraph("Table caption declares number 1 here while the orphan above used 2.")
    _paragraph(doc, "Table 1: A duplicated caption number", italic=True)
    doc.add_paragraph("The duplicate-check should flag this caption number.")
    _paragraph(doc, "Figure 3. Skipped figure number", italic=True)
    doc.add_paragraph("No figure 1 or 2 exists — a numbering gap that is visible to editors.")
    _paragraph(doc, "3. Normalisation of form, a heading", bold=True, size=16)
    doc.add_paragraph("A sensible numbered section follows after the anomalies.")
    return doc


def build_unicode() -> Document:
    doc = Document()
    section = doc.sections[0]
    section.header.is_linked_to_previous = False
    section.header.paragraphs[0].text = "अध्याय संकेत — Chapter Devanagari"

    _paragraph(doc, "Bilingual Manuscript Demo", bold=True, size=22,
               align=WD_ALIGN_PARAGRAPH.CENTER)
    _paragraph(doc, "डिजिटल दस्तावेज़ प्रसंस्करण की रूपरेखा", size=16,
               align=WD_ALIGN_PARAGRAPH.CENTER)

    _paragraph(doc, "1. परिचय", bold=True, size=16, space_before=16)
    doc.add_paragraph(
        "यह दस्तावेज़ दर्शाता है कि पार्सर देवनागरी लिपि और यूनिकोड को बिना "
        "किसी बदलाव के संरक्षित करता है। Multilingual text — हिन्दी + English "
        "— must survive formatting byte-for-byte."
    )
    _paragraph(doc, "1.1 गणितीय व्यंजक", bold=True, size=14)
    doc.add_paragraph("Equation E = mc² and Greek letters α, β, γ plus ₹ 1,000 in currency.")
    _paragraph(doc, "2. सारणी", bold=True, size=16, space_before=16)
    _paragraph(doc, "Table 1: अनुवाद तालिका", italic=True)
    rows = [["शब्द", "Translation"], ["प्रणाली", "system"], ["स्वतंत्र", "offline"]]
    table = doc.add_table(rows=len(rows), cols=2)
    table.style = "Table Grid"
    for i, row in enumerate(rows):
        for j, val in enumerate(row):
            table.rows[i].cells[j].text = val
    _paragraph(doc, "3. निष्कर्ष", bold=True, size=16, space_before=16)
    doc.add_paragraph(
        "यूनिकोड संरक्षण की पुष्टि शाब्दिक अखंडता जाँच (integrity check) से "
        "होती है। Unicode preservation is confirmed by the integrity check."
    )
    return doc


def build_empty() -> Document:
    doc = Document()
    doc.add_paragraph("A plain document.")
    doc.add_paragraph(
        "There are no headings here at all, only a couple of paragraphs of "
        "ordinary body text that will be formatted with body styles."
    )
    doc.add_paragraph(
        "The preflight engine should report that no headings were detected, "
        "and formatting should apply only body styles to this copy."
    )
    return doc


BUILDERS = {
    "messy": build_messy,
    "academic": build_academic,
    "book": build_book,
    "bad_levels": build_bad_levels,
    "unicode": build_unicode,
    "empty": build_empty,
}

FILES = {
    "messy": "messy_manuscript.docx",
    "academic": "academic_paper.docx",
    "book": "book_style.docx",
    "bad_levels": "bad_levels.docx",
    "unicode": "unicode_manuscript.docx",
    "empty": "empty_document.docx",
}


def main() -> None:
    SAMPLES.mkdir(parents=True, exist_ok=True)
    args = sys.argv[1:]
    if "--corpus" in args:
        for kind in KINDS:
            target = SAMPLES / FILES[kind]
            BUILDERS[kind]().save(str(target))
            print(f"Saved {target}")
        return
    if "--kind" in args:
        kind = args[args.index("--kind") + 1]
        if kind not in BUILDERS:
            raise SystemExit(f"Unknown kind '{kind}'. Choices: {', '.join(KINDS)}")
        target = SAMPLES / FILES[kind]
        BUILDERS[kind]().save(str(target))
        print(f"Saved {target}")
        return
    target = Path(args[0]) if args else SAMPLES / "messy_manuscript.docx"
    target.parent.mkdir(parents=True, exist_ok=True)
    build_messy().save(str(target))
    print(f"Saved sample to {target}")


if __name__ == "__main__":
    main()