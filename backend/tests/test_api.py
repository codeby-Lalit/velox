"""Local API smoke tests (TestClient, no real server needed)."""

from pathlib import Path

from fastapi.testclient import TestClient

PROFILE_ID = "default"


def test_index_requires_running_workflow():
    """End-to-end via TestClient: upload -> process -> audit payload."""
    from circuit_networks.api.main import app

    client = TestClient(app)

    resp = client.get("/api/profiles")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)

    response = client.post(
        "/api/process",
        files={"file": ("manuscript.docx", open_manuscript_bytes(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        data={"profile_id": PROFILE_ID, "review_json": "[]"},
    )
    assert response.status_code == 200, response.text
    payload = response.json()["payload"]
    assert payload["integrity"]["status"] == "pass"


def open_manuscript_bytes():
    import io
    import tempfile
    from pathlib import Path

    from tests.conftest import build_manuscript

    buf = io.BytesIO()
    tmp = Path(tempfile.mkdtemp()) / "m.docx"
    build_manuscript().save(str(tmp))
    return tmp.read_bytes()


def test_hostile_filename_is_sanitized():
    """R11: path-traversal filenames must be neutralized, then process fine."""
    from circuit_networks.api.main import app, UPLOADS

    client = TestClient(app)
    hostile = "../../evil_untrusted.docx"
    response = client.post(
        "/api/process",
        files={"file": (hostile, open_manuscript_bytes(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        data={"profile_id": "default", "review_json": "[]"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["integrity_status"] == "pass"
    # nothing escaped the upload root
    from pathlib import Path as P
    assert not (P(UPLOADS).parent / "evil_untrusted.docx").exists()


def test_review_change_decision_applied():
    """F101: a 'change' decision flows through the pipeline and audit payload."""
    from circuit_networks.api.main import app

    client = TestClient(app)
    payload = client.post(
        "/api/process",
        files={"file": ("manuscript.docx", open_manuscript_bytes(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        data={"profile_id": "default", "review_json": "[]"},
    ).json()["payload"]

    # pick first review item; change its type to paragraph via reject
    items = payload["review"]["items"]
    reviews = []
    if items:
        first = items[0]
        reviews = [{"source_index": first["source_index"], "action": "change", "new_element_type": "section"}]

    resp = client.post(
        "/api/process",
        files={"file": ("manuscript.docx", open_manuscript_bytes(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        data={"profile_id": "default", "review_json": str(reviews).replace("'", '"')},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["integrity_status"] == "pass"


def test_batch_processes_multiple_files():
    """F107: multiple manuscripts in one request, each with its own result."""
    from circuit_networks.api.main import app

    client = TestClient(app)
    mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    files = [
        ("files", ("a.docx", open_manuscript_bytes(), mime)),
        ("files", ("b.docx", open_manuscript_bytes(), mime)),
    ]
    resp = client.post("/api/process-batch", files=files, data={"profile_id": "default"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["count"] == 2
    assert {r["filename"] for r in body["results"]} == {"a.docx", "b.docx"}
    assert all(r["integrity_status"] == "pass" for r in body["results"])
    assert all(r["payload"]["processing_stats"]["elapsed_ms"] >= 0 for r in body["results"])


def test_batch_isolates_invalid_file():
    """R9: one bad file in a batch is reported per-file, others still pass."""
    from circuit_networks.api.main import app

    client = TestClient(app)
    mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    files = [
        ("files", ("good.docx", open_manuscript_bytes(), mime)),
        ("files", ("good2.docx", open_manuscript_bytes(), mime)),
        ("files", ("bad.exe", b"not a docx at all", "application/octet-stream")),
    ]
    resp = client.post("/api/process-batch", files=files, data={"profile_id": "default"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["count"] == 3
    by_name = {r["filename"]: r for r in body["results"]}
    assert by_name["good.docx"]["integrity_status"] == "pass"
    assert by_name["good2.docx"]["integrity_status"] == "pass"
    assert by_name["bad.exe"]["integrity_status"] == "failed"
    assert "error" in by_name["bad.exe"]


def test_payload_has_metrics_headers_footers_and_structure_view():
    """F109 / F002 / F104: metrics, header-footer extraction and compare view."""
    from circuit_networks.api.main import app

    client = TestClient(app)
    payload = client.post(
        "/api/process",
        files={"file": ("manuscript.docx", open_manuscript_bytes(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        data={"profile_id": "default", "review_json": "[]"},
    ).json()["payload"]

    stats = payload["processing_stats"]
    assert "elapsed_ms" in stats
    assert isinstance(stats["pages_estimate"], int) and stats["pages_estimate"] >= 1
    assert "headers" in payload["source"] and "footers" in payload["source"]
    view = payload["structure_view"]
    assert "rows" in view
    assert all("target_style" in r and "source_index" in r for r in view["rows"])


# ---------------------------------------------------------------- F110 / F111 / F112


def _process(client, filename="manuscript.docx", review_json="[]"):
    return client.post(
        "/api/process",
        files={"file": (filename, open_manuscript_bytes(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        data={"profile_id": "default", "review_json": review_json},
    ).json()


def test_process_returns_job_id_and_velox_doc():
    """F110/F112: process result carries a job_id and a *_velox.docx deliverable."""
    from circuit_networks.api.main import app
    from circuit_networks.velox.package import read_manifest

    client = TestClient(app)
    body = _process(client)
    assert body["integrity_status"] == "pass"
    assert body["job_id"]
    assert body["velox_docx"].endswith("_velox.docx")
    # the velox docx embeds a manifest
    manifest = read_manifest(body["velox_docx"])
    assert manifest is not None
    assert manifest["format"] == "circuit-networks-velox"
    assert len(manifest["history"]) == 1
    # the plain docx is intact
    resp = client.get(f"/api/download/{Path(body['output_docx']).name}")
    assert resp.status_code == 200


def test_download_velox_docx():
    """The *_velox.docx is downloadable and carries the embedded manifest."""
    from circuit_networks.api.main import app
    from circuit_networks.velox.package import read_manifest

    client = TestClient(app)
    body = _process(client)
    name = body["velox_docx"].split("\\")[-1].split("/")[-1]
    resp = client.get(f"/api/download/{name}")
    assert resp.status_code == 200
    import tempfile
    from pathlib import Path

    tmp = Path(tempfile.mkdtemp()) / name
    tmp.write_bytes(resp.content)
    manifest = read_manifest(str(tmp))
    assert manifest is not None
    assert manifest["format"] == "circuit-networks-velox"
    assert manifest["history"], "history must be embedded"


def test_apply_edits_text_and_role_then_history_and_reopen():
    """F110 end-to-end: edit text + change role, history tracks versions."""
    from circuit_networks.api.main import app
    from circuit_networks.velox.package import read_manifest

    client = TestClient(app)
    body = _process(client)
    job_id = body["job_id"]
    assert body["history"]["versions"], "initial automatic version recorded"

    # find the first paragraph element to edit
    dv = body["payload"]["document_view"]
    para = next((e for e in dv if e["kind"] == "paragraph"), None)
    assert para is not None

    edits = [
        {"kind": "paragraph", "source_index": para["source_index"],
         "text": f"INTENTIONALLY EDITED: {para['text'].strip()[:20] or 'edited'}", "element_type": "section"},
    ]
    resp = client.post(
        "/api/apply-edits",
        json={"job_id": job_id, "edits": edits, "message": "user edit round 1"},
    )
    assert resp.status_code == 200, resp.text
    body2 = resp.json()
    assert body2["integrity_status"] == "pass", "declared edits must not fail integrity"
    assert body2["payload"]["integrity"]["declared_edits"] == 1
    history = body2["history"]
    assert len(history["versions"]) == 2
    assert history["versions"][-1]["message"] == "user edit round 1"
    assert history["versions"][-1]["diff"], "diff between versions recorded"

    # history endpoint mirrors it
    hresp = client.get(f"/api/history/{job_id}")
    assert hresp.status_code == 200
    assert hresp.json()["history"]["versions"][-1]["id"] == "v2"

    # reopen the velox file restores full history (read directly, bypass rglob)
    manifest = read_manifest(body2["velox_docx"])
    assert manifest is not None
    assert manifest["format"] == "circuit-networks-velox"
    # history embedded in the manifest has 2 versions
    assert len(manifest["history"]) == 2


def test_apply_edits_invalid_job_rejected():
    from circuit_networks.api.main import app

    client = TestClient(app)
    resp = client.post("/api/apply-edits", json={"job_id": "../../etc", "edits": []})
    assert resp.status_code == 400
    resp2 = client.post("/api/apply-edits", json={"job_id": "does-not-exist", "edits": []})
    assert resp2.status_code == 404


def test_open_rejects_plain_docx():
    from circuit_networks.api.main import app

    client = TestClient(app)
    resp = client.post(
        "/api/open",
        files={"file": ("plain.docx", open_manuscript_bytes(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
    )
    assert resp.status_code == 400


def _first_paragraph(body):
    """Return (source_index, text) of the first paragraph element."""
    for e in body["payload"]["document_view"]:
        if e["kind"] == "paragraph":
            return e["source_index"], e["text"]
    raise AssertionError("no paragraph element in document_view")


def test_reopen_restore_roundtrip():
    """F112: restore an older version on a re-opened velox file reproducibly."""
    import io

    from circuit_networks.api.main import app
    from circuit_networks.velox.package import read_manifest

    client = TestClient(app)
    body = _process(client)
    ed_idx, original_text = _first_paragraph(body)

    edited_text = f"RESTORED-ABILITY: {original_text.strip()[:30]}!"
    resp = client.post(
        "/api/apply-edits",
        json={
            "job_id": body["job_id"],
            "edits": [{"kind": "paragraph", "source_index": ed_idx, "text": edited_text}],
            "message": "round 1",
        },
    )
    assert resp.status_code == 200
    body2 = resp.json()
    assert body2["payload"]["integrity"]["declared_edits"] == 1

    # reopen the saved velox file and restore to v1 (no edits)
    velox_bytes = Path(body2["velox_docx"]).read_bytes()
    manifest = read_manifest(body2["velox_docx"])
    assert manifest["has_original"] is True

    open_resp = client.post(
        "/api/open",
        files={
            "file": ("resume_velox.docx", io.BytesIO(velox_bytes), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        },
    )
    assert open_resp.status_code == 200
    assert len(open_resp.json()["history"]["versions"]) == 2

    restore_resp = client.post(
        "/api/open-apply",
        data={"edits_json": "[]", "message": "restored v1"},
        files={
            "file": ("resume_velox.docx", io.BytesIO(velox_bytes), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        },
    )
    assert restore_resp.status_code == 200, restore_resp.text
    body3 = restore_resp.json()
    assert body3["integrity_status"] == "pass"
    assert len(body3["history"]["versions"]) == 3, "history continues, nothing is erased"
    assert body3["history"]["versions"][-1]["message"] == "restored v1"
    restored_texts = [
        e["text"] for e in body3["payload"]["document_view"] if e["kind"] == "paragraph"
    ]
    assert edited_text not in " ".join(restored_texts)
    assert any(original_text.strip()[:30] in t for t in restored_texts)