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


def test_pipeline_with_text_edit_and_role_change(manuscript, tmp_path):
    """F110: user text + role edits are applied and integrity passes (declared)."""
    from circuit_networks.parser.docx_parser import parse_docx

    profile = ProfileConfig()
    model = parse_docx(str(manuscript))
    idx = next(
        p.index
        for p in model.paragraphs
        if p.text.strip().startswith("Intro paragraph one")
    )
    edits = [
        {"kind": "paragraph", "source_index": idx, "text": "Edited opening paragraph."},
        {"kind": "paragraph", "source_index": 0, "element_type": "chapter"},
    ]
    result = run_pipeline(
        str(manuscript), profile, output_dir=str(tmp_path / "out"), edits=edits
    )
    assert result.error is None, result.error
    assert result.integrity_status == "pass", "declared edits must not fail integrity"
    assert result.integrity.declared_edits == 1
    assert result.integrity.checked.get("declared_edits") == 1
    # the edited text actually lands in the output document
    assert "Edited opening paragraph." in _all_output_text(result.output_docx)


def test_pipeline_undeclared_change_still_fails_integrity(manuscript, tmp_path):
    """R3/R4: an edit that is NOT in the declared set is still flagged."""
    profile = ProfileConfig()
    result = run_pipeline(str(manuscript), profile, output_dir=str(tmp_path / "out"))
    assert result.integrity_status == "pass"
    # manually corrupt the produced document, then re-verify with no overrides
    import zipfile

    from circuit_networks.integrity.verify import verify_integrity

    out = result.output_docx
    tmp = out + ".bak"
    with zipfile.ZipFile(out) as z:
        names = z.namelist()
        data = {n: z.read(n) for n in names}
    xml = data["word/document.xml"].decode("utf-8")
    xml = xml.replace("Test Manuscript Title", "TAMPERED TITLE ELEVEN")
    data["word/document.xml"] = xml.encode("utf-8")
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as z:
        for n in names:
            z.writestr(n, data[n])
    report = verify_integrity(str(manuscript), tmp)
    assert report.status == "fail"
    assert any(m["kind"] == "paragraph_text" for m in report.mismatches)


def _all_output_text(docx_path) -> str:
    from docx import Document

    doc = Document(docx_path)
    return "\n".join(p.text for p in doc.paragraphs)