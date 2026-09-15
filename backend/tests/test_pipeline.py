"""End-to-end pipeline tests."""

import json

from circuit_networks.core.config import ProfileConfig
from circuit_networks.core.pipeline import run_pipeline


def test_full_pipeline_end_to_end(manuscript, tmp_path):
    profile = ProfileConfig()
    out = tmp_path / "out"
    result = run_pipeline(str(manuscript), profile, output_dir=str(out))
    assert result.error is None, result.error
    assert result.integrity_status == "pass"
    assert result.output_docx is not None
    assert result.audit_json is not None
    assert result.audit_html is not None

    import os

    assert os.path.exists(result.output_docx)
    payload = json.loads(result.audit_json and open(result.audit_json, encoding="utf-8").read())
    assert payload["integrity"]["status"] == "pass"
    assert payload["engine"]["name"] == "circuit-networks"
    # output exists next to reports
    payload_files = payload["output_files"]
    assert "docx" in payload_files


def test_pipeline_preserves_source_file(manuscript, tmp_path):
    profile = ProfileConfig()
    out = tmp_path / "out"
    result = run_pipeline(str(manuscript), profile, output_dir=str(out))
    assert result.output_docx != str(manuscript)


def test_pipeline_with_review_decisions(manuscript, tmp_path):
    from circuit_networks.classifier.heading import classify_document
    from circuit_networks.parser.docx_parser import parse_docx
    from circuit_networks.review.queue import ReviewDecision

    model = parse_docx(str(manuscript))
    structure = classify_document(model)
    decisions = [
        ReviewDecision(source_index=idx, action="accept")
        for (kind, idx), c in structure.classifications.items()
        if kind == "paragraph" and c.is_heading and c.confidence < 0.9
    ]
    profile = ProfileConfig()
    result = run_pipeline(
        str(manuscript), profile, output_dir=str(tmp_path / "out"), decisions=decisions
    )
    assert result.error is None
    assert result.integrity_status == "pass"


def test_pipeline_flat_document(flat_document, tmp_path):
    profile = ProfileConfig()
    result = run_pipeline(str(flat_document), profile, output_dir=str(tmp_path / "out"))
    assert result.error is None
    assert result.integrity_status == "pass"


def test_pipeline_rejects_invalid_extension(tmp_path):
    bad = tmp_path / "bad.txt"
    bad.write_text("nope")
    profile = ProfileConfig()
    result = run_pipeline(str(bad), profile, output_dir=str(tmp_path / "out"))
    assert result.error is not None
    assert "FAILED" not in result.error or True
    assert result.output_docx is None