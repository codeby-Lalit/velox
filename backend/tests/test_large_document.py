"""R13 stress test: large 400+ page manuscripts in three distinct shapes.

Ensures the pipeline (parse -> classify -> preflight -> format -> integrity)
terminates in linear time and never corrupts content on very large documents.
"""

import time

import pytest

from circuit_networks.core.config import ProfileConfig
from circuit_networks.core.pipeline import run_pipeline


def _build_large(tmp_path, paragraphs=1800, mode="unstructured"):
    from tests.conftest import build_large_unstructured_document

    path = tmp_path / f"large_{mode}.docx"
    build_large_unstructured_document(body_paragraphs=paragraphs, mode=mode).save(str(path))
    return path


def _words(docx_path) -> int:
    from docx import Document

    doc = Document(docx_path)
    return sum(len(p.text.split()) for p in doc.paragraphs)


@pytest.mark.parametrize(
    "mode", ["unstructured", "wall_of_text", "table_heavy"], ids=["mixed", "no-headings", "table-heavy"]
)
def test_large_unstructured_400plus_pages(tmp_path, mode):
    import os

    src = _build_large(tmp_path, mode=mode)
    words = _words(str(src))
    # ~300 words/page => 400+ pages of pure content in every variant
    assert words >= 120_000, f"expected 400+ pages of content, got {words} words"

    out = tmp_path / f"out-{mode}"
    t0 = time.perf_counter()
    result = run_pipeline(str(src), ProfileConfig(), output_dir=str(out))
    elapsed = time.perf_counter() - t0

    assert result.error is None, result.error
    assert result.integrity_status == "pass"
    assert os.path.exists(result.output_docx)
    assert result.peak_memory_bytes >= 0

    payload = result.payload()
    stats = payload["processing_stats"]
    assert stats["paragraphs"] >= 1800
    assert stats["words"] >= 120_000
    # linear behavior: must complete promptly even on 400+ pages
    assert elapsed < 180, f"large doc pipeline took {elapsed:.1f}s (R13 violated)"
    # document_view exposes every paragraph for the editor
    assert len(payload["document_view"]) >= 1800


def test_large_unstructured_survives_edits(tmp_path):
    """F110 on 400+ pages: a declared edit round keeps integrity green."""
    from circuit_networks.parser.docx_parser import parse_docx

    src = _build_large(tmp_path, paragraphs=1000, mode="unstructured")
    model = parse_docx(str(src))
    edit_idx = model.paragraphs[200].index
    edits = [
        {
            "kind": "paragraph",
            "source_index": edit_idx,
            "text": "A short declaration replacing the original long body text here.",
        }
    ]
    result = run_pipeline(
        str(src), ProfileConfig(), output_dir=str(tmp_path / "out2"), edits=edits
    )
    assert result.error is None, result.error
    assert result.integrity_status == "pass", "declared edits must not fail integrity"
    assert result.integrity.declared_edits == 1
    output_text = _words_text(result.output_docx)
    assert "short declaration replacing" in output_text


def _words_text(docx_path) -> str:
    from docx import Document

    doc = Document(docx_path)
    return "\n".join(p.text for p in doc.paragraphs)