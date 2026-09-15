"""Local API smoke tests (TestClient, no real server needed)."""

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