"""F108 regression corpus: every sample manuscript must pass the pipeline."""

from __future__ import annotations

from pathlib import Path

import pytest

from circuit_networks.core.config import ProfileConfig
from circuit_networks.core.pipeline import run_pipeline

SAMPLES = Path(__file__).resolve().parents[2] / "samples"
DOCX_FILES = sorted(SAMPLES.glob("*.docx"))


@pytest.mark.parametrize("path", DOCX_FILES, ids=lambda p: p.name)
def test_corpus_pipeline_passes(path: Path, tmp_path):
    profile = ProfileConfig()
    result = run_pipeline(str(path), profile, output_dir=str(tmp_path))
    assert result.error is None, f"stage={result.stage} error={result.error}"
    assert result.integrity_status == "pass"
    assert result.output_docx and Path(result.output_docx).exists()
    assert result.audit_json and result.audit_html

    payload = result.payload()
    stats = payload["processing_stats"]
    assert stats["elapsed_ms"] > 0
    assert isinstance(stats["pages_estimate"], int) and stats["pages_estimate"] >= 1
    assert isinstance(payload["structure_view"]["rows"], list)


def test_corpus_headers_footers_extracted():
    """F002: header/footer text is captured for samples that define them."""
    profile = ProfileConfig()
    unicode_file = SAMPLES / "unicode_manuscript.docx"
    result = run_pipeline(str(unicode_file), profile, output_dir="out/corpus-test")
    assert result.error is None
    payload = result.payload()
    assert any("अध्याय" in h for h in payload["source"]["headers"])


def test_bad_levels_sample_triggers_preflight_warnings():
    """bad_levels.docx intentionally jumps hierarchy and duplicates captions."""
    profile = ProfileConfig()
    result = run_pipeline(str(SAMPLES / "bad_levels.docx"), profile, output_dir="out/corpus-test")
    assert result.error is None
    codes = {i.code for i in result.issues}
    assert "hierarchy_jump" in codes
    assert "duplicate_caption_number" in codes
    assert "table_caption_without_table" in codes


def test_empty_document_reports_no_headings():
    profile = ProfileConfig()
    result = run_pipeline(str(SAMPLES / "empty_document.docx"), profile, output_dir="out/corpus-test")
    assert result.error is None
    assert any(i.code == "no_headings" for i in result.issues)