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

## Module boundaries

- `parser/` — DOCX → DocumentModel
- `structure/` — StructureMap + hierarchical outline
- `classifier/` — rule/statistical classification only
- `preflight/` — problem detection before formatting
- `formatter/` — profile-driven formatting
- `integrity/` — independent content verification
- `reports/` — JSON/HTML audit
- `review/` — human review decision application
- `api/` — local FastAPI over the pipeline
- `core/` — models, config, pipeline orchestration, paths, versioning

## Desktop offline packaging

The deliverable is a standalone desktop application (`packaging/velox.spec`
via PyInstaller). It bundles the backend engine, the local API server, and
the static `frontend/` UI. Data never leaves the machine (R1).