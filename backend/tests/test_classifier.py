"""Classifier tests."""

from circuit_networks.core import constants as C
from circuit_networks.classifier.heading import classify_document
from circuit_networks.parser.docx_parser import parse_docx


def test_title_detected(manuscript):
    model = parse_docx(str(manuscript))
    structure = classify_document(model)
    first = structure.get(("paragraph", 0))
    assert first is not None
    assert first.element_type == C.E_TITLE


def test_sections_and_subsections(manuscript):
    model = parse_docx(str(manuscript))
    structure = classify_document(model)
    by_type = {
        idx: c
        for (kind, idx), c in structure.classifications.items()
        if kind == "paragraph"
    }
    texts = {p.index: p.text for p in model.paragraphs}
    for idx, c in by_type.items():
        if texts[idx] == "1. Introduction":
            assert c.element_type == C.E_SECTION
            assert c.confidence >= 0.70
            assert "numbering_pattern" in c.reason_codes
        if texts[idx] == "1.1 Background":
            assert c.element_type == C.E_SUBSECTION


def test_table_caption_and_figure_caption(manuscript):
    model = parse_docx(str(manuscript))
    structure = classify_document(model)
    texts = {p.index: p.text for p in model.paragraphs}
    for idx, c in structure.classifications.items():
        if texts.get(c.source_index) == "Table 1: Experiment summary":
            assert c.element_type == C.E_TABLE_CAPTION
        if texts.get(c.source_index) == "Figure 1. Pipeline diagram":
            assert c.element_type == C.E_FIGURE_CAPTION


def test_table_classification(manuscript):
    model = parse_docx(str(manuscript))
    structure = classify_document(model)
    for idx in range(len(model.tables)):
        c = structure.get(("table", idx))
        assert c is not None
        assert c.element_type == C.E_TABLE
        assert c.confidence == 1.0


def test_flat_document_has_no_headings(flat_document):
    model = parse_docx(str(flat_document))
    structure = classify_document(model)
    heading_count = sum(1 for c in structure.classifications.values() if c.is_heading)
    assert heading_count == 0


def test_paragraphs_confidence_is_one(flat_document):
    model = parse_docx(str(flat_document))
    structure = classify_document(model)
    for c in structure.classifications.values():
        if c.element_type == C.E_PARAGRAPH:
            assert c.confidence == 1.0


def test_references_numbered_items_are_paragraphs():
    from circuit_networks.core.models import DocumentModel, ParagraphInfo

    model = DocumentModel()
    texts = [
        "6. References",
        "1. Open Packaging Conventions, ECMA-376.",
        "2. W3C XML Working Group, XML 1.0.",
    ]
    for i, text in enumerate(texts):
        p = ParagraphInfo(index=i, text=text, original_text=text, style_name=None)
        model.paragraphs.append(p)
        model.body_order.append(("paragraph", i))
    structure = classify_document(model)
    refs = structure.get(("paragraph", 0))
    assert refs.element_type in (C.E_SECTION, C.E_CHAPTER)
    for i in (1, 2):
        item = structure.get(("paragraph", i))
        assert item.element_type == C.E_PARAGRAPH
        assert "reference_list_item" in item.reason_codes


def test_caption_confidence_and_reasons(manuscript):
    model = parse_docx(str(manuscript))
    structure = classify_document(model)
    texts = {p.index: p.text for p in model.paragraphs}
    for idx, c in structure.classifications.items():
        if texts.get(c.source_index) == "Table 1: Experiment summary":
            assert any(
                code in c.reason_codes
                for code in ("caption_label", "caption_numbering_pattern")
            )
            assert c.confidence >= 0.9