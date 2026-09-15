"""Parser tests."""

import pytest

from circuit_networks.core.models import DocumentModel
from circuit_networks.parser.docx_parser import (
    DocxValidationError,
    parse_docx,
    validate_docx,
)
from tests.conftest import build_manuscript


def test_parse_paragraphs_and_order(manuscript):
    model = parse_docx(str(manuscript))
    assert isinstance(model, DocumentModel)
    assert len(model.paragraphs) > 0
    assert [p.text for p in model.paragraphs][0] == "Test Manuscript Title"


def test_parse_tables(manuscript):
    model = parse_docx(str(manuscript))
    assert len(model.tables) == 1
    table = model.tables[0]
    assert table.cell_texts[0] == "Metric"
    assert table.rows[1][0].text == "Accuracy"


def test_body_order_interleaves_paragraphs_and_tables(manuscript):
    model = parse_docx(str(manuscript))
    kinds = [k for k, _ in model.body_order]
    assert "table" in kinds
    assert kinds.count("paragraph") == len(model.paragraphs)
    assert kinds.count("table") == len(model.tables)


def test_sha256_and_metadata(manuscript):
    model = parse_docx(str(manuscript))
    assert len(model.source_sha256) == 64
    assert model.source_size_bytes is not None


def test_validate_non_docx_rejected(tmp_path):
    bad = tmp_path / "note.txt"
    bad.write_text("not a docx")
    with pytest.raises(DocxValidationError):
        validate_docx(str(bad))


def test_text_preserved_on_parse(manuscript):
    model = parse_docx(str(manuscript))
    joined = "\n".join(p.text for p in model.paragraphs)
    assert "Test Manuscript Title" in joined
    assert "processing pipelines" not in joined.lower()