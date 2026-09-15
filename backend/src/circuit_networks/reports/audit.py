"""Audit report generation (F010): JSON and human-readable HTML."""

from __future__ import annotations

import html as html_mod
import json
from datetime import datetime, timezone
from pathlib import Path

from ..core.version import ENGINE_NAME, ENGINE_VERSION
from ..core.models import DocumentModel
from ..integrity.verify import IntegrityReport
from ..preflight.engine import PreflightIssue
from ..structure.builder import outline
from ..structure.model import StructureMap


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_audit_payload(
    model: DocumentModel,
    structure: StructureMap,
    issues: list[PreflightIssue],
    integrity: IntegrityReport,
    profile_name: str,
    output_files: dict[str, str],
    review_decisions: dict | None = None,
) -> dict:
    # Index texts once so large documents stay linear (R13).
    text_by_index = {p.index: p.text for p in model.paragraphs}
    paragraph_text = text_by_index.get
    return {
        "engine": {"name": ENGINE_NAME, "version": ENGINE_VERSION},
        "generated_at": _iso_now(),
        "source": {
            "path": model.source_path,
            "size_bytes": model.source_size_bytes,
            "sha256": model.source_sha256,
            "metadata": {
                "title": model.metadata.title,
                "author": model.metadata.author,
                "created": model.metadata.created,
                "modified": model.metadata.modified,
                "language": model.metadata.language,
            },
        },
        "profile": profile_name,
        "structure_summary": structure.summary(),
        "structure_outline": outline(model, structure),
        "classifications": [
            {
                "source_index": c.source_index,
                "element_type": c.element_type,
                "confidence": round(c.confidence, 4),
                "reason_codes": sorted(c.reason_codes),
                "subtype": c.subtype,
                "text": paragraph_text(c.source_index),
            }
            for _, c in sorted(
                structure.classifications.items(),
                key=lambda item: (0 if item[0][0] == "paragraph" else 1, item[0][1]),
            )
        ],
        "preflight_issues": [issue.to_json() for issue in issues],
        "review": {
            "items": [
                {
                    "source_index": c.source_index,
                    "element_type": c.element_type,
                    "confidence": round(c.confidence, 4),
                    "reason_codes": sorted(c.reason_codes),
                    "text": paragraph_text(c.source_index),
                }
                for c in structure.review_items()
            ],
            "decisions": review_decisions or {},
        },
        "integrity": integrity.to_json(),
        "output_files": output_files,
        "processing_stats": {
            "paragraphs": len(model.paragraphs),
            "tables": len(model.tables),
            "headings": sum(
                1 for c in structure.classifications.values() if c.is_heading
            ),
            "captions": sum(
                1 for c in structure.classifications.values() if c.is_caption
            ),
            "review_items": len(structure.review_items()),
            "preflight_errors": sum(
                1 for i in issues if i.severity == "error"
            ),
            "preflight_warnings": sum(
                1 for i in issues if i.severity == "warning"
            ),
        },
    }


def write_json_report(payload: dict, path: str) -> str:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(
        json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    return path


def write_html_report(payload: dict, path: str) -> str:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(_render_html(payload), encoding="utf-8")
    return path


def _render_html(payload: dict) -> str:
    source = payload["source"]
    engine = payload["engine"]
    integrity = payload["integrity"]
    status = integrity["status"]
    badge = (
        '<span class="badge pass">INTEGRITY PASS</span>'
        if status == "pass"
        else '<span class="badge fail">INTEGRITY FAIL</span>'
    )

    issues_rows = "".join(
        f"<tr class='{i['severity']}'><td>{html_escape(i['code'])}</td>"
        f"<td>{html_escape(i['severity'])}</td>"
        f"<td>{html_escape(i['message'])}</td></tr>"
        for i in payload["preflight_issues"]
    )
    outline_rows = "".join(
        f"<tr><td>{'&nbsp;' * o['depth'] * 3}{html_escape(o['text'] or '')}</td>"
        f"<td>{o['element_type']}</td><td>{o['confidence']:.2f}</td></tr>"
        for o in payload["structure_outline"]
    )
    review_rows = "".join(
        f"<tr><td>{r['source_index']}</td><td>{r['element_type']}</td>"
        f"<td>{r['confidence']:.2f}</td><td>{html_escape(r['text'] or '')}</td></tr>"
        for r in payload["review"]["items"]
    )
    conn = payload["engine"]["name"]
    miss_rows = "".join(
        f"<tr><td>{m['kind']}</td><td>{m.get('index', '')}</td>"
        f"<td>{html_escape(str(m.get('expected', '')))}</td>"
        f"<td>{html_escape(str(m.get('actual', '')))}</td></tr>"
        for m in integrity["mismatches"]
    )

    stats = payload["processing_stats"]
    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<title>Audit Report — {html_escape(engine['name'])}</title>
<style>
body {{ font-family: 'Segoe UI', Arial, sans-serif; margin: 2rem; color: #1f2328; }}
h1 {{ border-bottom: 2px solid #0969da; padding-bottom: .3rem; }}
h2 {{ margin-top: 1.6rem; }}
.badge {{ padding: 4px 10px; border-radius: 12px; font-weight: 700; }}
.pass {{ background: #dafbe1; color: #116329; }}
.fail {{ background: #ffebe9; color: #b42318; }}
table {{ border-collapse: collapse; width: 100%; margin-top: .5rem; font-size: .9rem; }}
th, td {{ border: 1px solid #d0d7de; padding: 5px 8px; text-align: left; }}
th {{ background: #f6f8fa; }}
tr.warning td {{ background: #fff8c5; }}
tr.error {{ background: #ffebe9; }}
.kv {{ display: grid; grid-template-columns: 220px 1fr; gap: 4px 12px; }}
.kv dt {{ font-weight: 600; }}
.kv dd {{ margin: 0; }}
</style></head><body>
<h1>Audit Report — {html_escape(engine['name'])} v{html_escape(engine['version'])}</h1>
<p>Generated: {html_escape(payload['generated_at'])} &nbsp; {badge}</p>

<h2>Source</h2>
<dl class="kv">
<dt>File</dt><dd>{html_escape(source['path'] or '')}</dd>
<dt>Size</dt><dd>{source['size_bytes']} bytes</dd>
<dt>SHA-256</dt><dd><code>{html_escape(source['sha256'] or '')}</code></dd>
<dt>Title</dt><dd>{html_escape(source['metadata']['title'] or '—')}</dd>
<dt>Author</dt><dd>{html_escape(source['metadata']['author'] or '—')}</dd>
<dt>Profile</dt><dd>{html_escape(payload['profile'])}</dd>
</dl>

<h2>Integrity Verification</h2>
<table>
<tr><th>Metric</th><th>Source</th><th>Output</th></tr>
<tr><td>Paragraphs</td><td>{integrity['source_paragraphs']}</td><td>{integrity['output_paragraphs']}</td></tr>
<tr><td>Words</td><td>{integrity['source_words']}</td><td>{integrity['output_words']}</td></tr>
<tr><td>Characters</td><td>{integrity['source_chars']}</td><td>{integrity['output_chars']}</td></tr>
</table>
<h3>Mismatches</h3>
<table><tr><th>Kind</th><th>Index</th><th>Expected</th><th>Actual</th></tr>
{miss_rows or '<tr><td colspan="4">None — content preserved.</td></tr>'}</table>

<h2>Detected Structure</h2>
<table><tr><th>Heading / Element</th><th>Type</th><th>Confidence</th></tr>
{outline_rows or '<tr><td colspan="3">No headings detected.</td></tr>'}</table>

<h2>Preflight Issues ({len(payload['preflight_issues'])})</h2>
<table><tr><th>Code</th><th>Severity</th><th>Message</th></tr>
{issues_rows or '<tr><td colspan="3">No preflight issues.</td></tr>'}</table>

<h2>Review Queue ({len(payload['review']['items'])})</h2>
<table><tr><th>#</th><th>Type</th><th>Confidence</th><th>Text</th></tr>
{review_rows or '<tr><td colspan="4">No review items.</td></tr>'}</table>

<h2>Processing Stats</h2>
<dl class="kv">
<dt>Paragraphs</dt><dd>{stats['paragraphs']}</dd>
<dt>Tables</dt><dd>{stats['tables']}</dd>
<dt>Headings</dt><dd>{stats['headings']}</dd>
<dt>Captions</dt><dd>{stats['captions']}</dd>
<dt>Review items</dt><dd>{stats['review_items']}</dd>
<dt>Output files</dt><dd>{', '.join(html_escape(v) for v in payload['output_files'].values())}</dd>
</dl>
</body></html>"""


def html_escape(value: str) -> str:
    return html_mod.escape(str(value))