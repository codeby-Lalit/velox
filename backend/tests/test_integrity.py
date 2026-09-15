"""Integrity verification tests."""

import shutil

from circuit_networks.integrity.verify import verify_integrity
from tests.conftest import build_manuscript


def test_integrity_pass_on_identical_copies(tmp_path):
    src = tmp_path / "a.docx"
    dst = tmp_path / "b.docx"
    build_manuscript().save(str(src))
    shutil.copyfile(src, dst)
    report = verify_integrity(str(src), str(dst))
    assert report.status == "pass"
    assert report.source_paragraphs == report.output_paragraphs
    assert report.source_words == report.output_words
    assert report.source_fingerprint == report.output_fingerprint
    assert report.mismatches == []


def test_integrity_fails_on_text_change(tmp_path):
    from docx import Document

    src = tmp_path / "a.docx"
    out = tmp_path / "b.docx"
    build_manuscript().save(str(src))
    doc = Document(str(src))
    doc.paragraphs[1].runs[0].text = "CHANGED WORDS"
    doc.save(str(out))
    report = verify_integrity(str(src), str(out))
    assert report.status == "fail"
    assert any(m["kind"] == "paragraph_text" for m in report.mismatches)
    assert any(m["kind"] == "fingerprint" for m in report.mismatches)


def test_integrity_counts_fields_populated(tmp_path):
    src = tmp_path / "a.docx"
    dst = tmp_path / "b.docx"
    build_manuscript().save(str(src))
    shutil.copyfile(src, dst)
    report = verify_integrity(str(src), str(dst))
    assert report.source_words > 0
    assert report.source_chars > 0
    assert len(report.source_fingerprint) == 64
    assert report.checked["paragraph_text"] is True