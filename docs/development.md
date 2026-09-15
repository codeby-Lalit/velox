# Layout, README updates

This document captures cross-cutting conventions and how to extend the engine.

## Adding a feature

1. Read `README.md`, `INTRACTION.md`, `RULES.md`, `FEATURES.md`.
2. Implement the smallest coherent change in the matching module.
3. Add tests under `backend/tests/` (unit + integration where applicable).
4. Run `python -m pytest backend/tests`.
5. Document behaviour changes in the relevant `docs/*.md`.

## Extension points

- **Classification:** add signals in `classifier/heading.py`. Each signal
  contributes a confidence increment and a reason code. Thresholds stay in
  `core/constants.py` and can be overridden per profile.
- **Profiles:** add JSON files under `profiles/` matching
  `ProfileConfig` (`core/config.py`).
- **Preflight rules:** append to `run_preflight` (`preflight/engine.py`).
- **Formatting:** extend the profile-driven application in
  `formatter/engine.py`.

## Testing coverage (tests/)

- `test_parser.py` — extraction, ordering, validation
- `test_classifier.py` — title/heading/caption detection, references context
- `test_preflight_review_structure.py` — issues, review decisions, hierarchy
- `test_integrity.py` — pass/fail fingerprints, counts
- `test_pipeline.py` — end-to-end, review decisions, failure handling
- `test_api.py` — local API: single upload, **batch (F107)**, hostile filename
  (R11), review change (F101), metrics/headers/structure-view assertions
- `test_samples_corpus.py` — F108 regression: every `samples/*.docx` processed
  end-to-end with integrity pass; preflight expectations for tricky samples

## Sample corpus (F108)

`samples/` holds six demo manuscripts: `messy_manuscript`, `academic_paper`
(header/footer), `book_style` (chapter-prefixed), `bad_levels` (hierarchy jumps +
duplicate captions), `unicode_manuscript` (Devanagari + math, header/footer),
and `empty_document` (no headings). Rebuild with:

```bash
python scripts/make_sample.py --corpus
```

## Frontend (React premium UI)

The UI lives in `frontend/` as a React + Vite + Tailwind v4 + Framer Motion
single-page app. It never loads external resources at runtime (fonts are
bundled via `@fontsource-variable/*`), which keeps the offline constraint (R1).

- Views: Import (multi-file dropzone + publisher profile picker), Processing
  (staged pipeline animation per F106), Results (integrity banner, stats,
  tabbed **Structure / Before-After / Issues / Review / Why** panels) and
  Batch results (F107) with drill-down into per-file reports.
- **Compare (F104):** backend `structure_view` rows pair each detected element
  with its profile target style so the UI can render source-vs-formatted.
- **Locate (F105):** IssuesList asks the Structure tab to highlight the element
  whose `source_index` matches, then smooth-scrolls to it.
- Review flow (F101): accept / change / reject per low-confidence item, then
  "Re-analyze with decisions" re-runs the local pipeline with the decisions.
- API client: `frontend/src/lib/api.js` talks to `/api/*` served by FastAPI
  (`processDocument`, `processBatch`, `fetchProfiles`).

### Building the frontend

```bash
cd frontend
npm install
npm run build    # outputs frontend/dist (React + bundled fonts, offline-safe)
```

The local API server (in dev or packaged) serves `frontend/dist` when present,
falling back to the source `frontend/`.

## Desktop deliverable (R21)

`scripts/build_desktop.bat` runs, in order:

1. `pip install -e backend`
2. `npm install && npm run build` in `frontend/`
3. `python -m PyInstaller packaging/velox.spec` → `dist/CircuitNetworks\`
4. (optional) `ISCC packaging/circuit-networks.iss` → `release\CircuitNetworks-Setup-0.1.0.exe`

The PyInstaller bundle (`datas` in `packaging/velox.spec`) includes the built
React app under `_internal/frontend` and profiles under `_internal/profiles`.
`core/paths.py` resolves these in dev, PyInstaller, and installed layouts.