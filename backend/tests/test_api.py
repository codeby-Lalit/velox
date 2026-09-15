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