# Architecture

## Offline-first pipeline

```text
DOCX input
   │
   ▼
Parser (docx_parser.py) ──→ DocumentModel (normalized, body order preserved)
   │
   ▼
Classifier (classifier/heading.py) ──→ StructureMap (explainable, reason codes)
   │
   ▼
Preflight (preflight/engine.py) ──→ PreflightIssue[]
   │
   ▼
Formatter (formatter/engine.py) ──→ publication_ready.docx
   │
   ▼
Integrity (integrity/verify.py) ──→ IntegrityReport (fingerprints, counts)
   │
   ▼
Reports (reports/audit.py) ──→ audit_report.json + audit_report.html
   │
   ▼
.velox packaging (velox/package.py) ──→ *_velox.docx
   │   manifest.json (F111 history, profile, integrity)
   │   original.docx (embedded source for F112 restore)
   ▼
Open/Resume (api /api/open, /api/open-apply) ──→ restore any version (F112)
```

## Key design decisions

- **Content preservation:** the formatter copies the source DOCX and only
  rewrites presentation properties (styles, fonts, spacing, alignment). It
  never touches `w:t` text nodes. Integrity verification reads the package
  via raw ZIP/lxml independently from the formatter.
- **Explainability:** every classification carries `element_type`,
  `confidence`, `reason_codes` and `source_index` (R5/R6).
- **Namespaced structure keys:** StructureMap keys are
  `("paragraph", idx)` / `("table", idx)` so paragraph and table indices
  never collide.
- **Determinism:** with the same input and profile, output is reproducible
  (R14). No randomness, no network, no LLM (R1/R2).
- **Declared edits (F110):** pipeline stages accept a `text_overrides` map and
  role decisions. The formatter applies overrides to matching paragraph
  indices; the integrity checker regenerates the *expected* paragraph list from
  the source + declared overrides, so status is `pass` only for declared
  content changes (R3 / R24).
- **Append-only history (F111):** the `velox/history.py` model stores versions
  as cumulative edit sets keyed by `(kind, source_index)`. Diff is computed
  against the previous version. Restore appends a new version — never mutates
  the past (R25).
- **Self-contained format (F112):** ``velox/package.py`` injects
  `velox/manifest.json` and `velox/original.docx` into the DOCX zip without
  touching other parts (R8). Word ignores unknown parts, so `.velox` files are
  plain Word documents; the app reads them back to reconstruct any version.

## Module boundaries

- `parser/` — DOCX → DocumentModel
- `structure/` — StructureMap + hierarchical outline
- `classifier/` — rule/statistical classification only
- `preflight/` — problem detection before formatting
- `formatter/` — profile-driven formatting (+ `text_overrides`)
- `integrity/` — independent content verification (+ `declared_edits`)
- `reports/` — JSON/HTML audit + `document_view` for the editor
- `review/` — human review decision application
- `velox/` — `.velox` package parts + append-only history (F111/F112)
- `api/` — local FastAPI over the pipeline (+ apply-edits / history / open / open-apply)
- `core/` — models, config, pipeline orchestration, paths, versioning

## UI surface (F110 / F111 / F112)

- `views/WorkspaceView.jsx` — unified editor+findings IDE: findings list and
  filters on the left, draggable inline editor (`components/DocEditor.jsx`:
  per-element text + role select with inline warnings and Auto-fix via
  `lib/roles.autoFix`) beside/above a live preview (`DocPreview`) toggle;
  "Commit & re-audit" posts the full edit set to `/api/apply-edits`.
- `components/HistoryTimeline.jsx` — versions v1..vN with inline diffs; Restore
  resubmits that version's cumulative edits (append-only).
- `views/OpenedView.jsx` — re-opened `.velox`: "Resume editing" or "Restore"
  both call `/api/open-apply`, which re-runs the **embedded original** with the
  chosen edits, preserving index semantics (R14).
- Design system: Dark Neumorphism (`neu-raised`/`neu-inset` classes in
  `index.css`) + Framer Motion springs — see RULES.md R22/R23.

## Desktop offline packaging

The deliverable is a standalone desktop application (`packaging/velox.spec`
via PyInstaller). It bundles the backend engine, the local API server, and
the static `frontend/` UI. Data never leaves the machine (R1).