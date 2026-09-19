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
  New rules that have a one-click fix should also be added to
  `frontend/src/lib/roles.js` (`autoFix`).
- **Formatting:** extend the profile-driven application in
  `formatter/engine.py`.
- **Edits (F110):** run the pipeline with `edits=[{kind, source_index, text?,
  element_type?}]`. `core/pipeline.py` derives `text_overrides`/`role_decisions`
  from them and both the formatter and the integrity checker consume them, so
  declared changes pass integrity by construction (R24).
- **History (F111):** `velox/history.py` `append_version` takes the cumulative
  edit set; `diff_edits` renders per-version diffs in the UI timeline.
- **.velox format (F112):** `velox/package.py` embeds `velox/manifest.json` and
  `velox/original.docx` into the DOCX zip (R8-safe). `/api/open-apply` restores
  a version by re-processing the embedded original with the version's edits.

## Testing coverage (tests/)

- `test_parser.py` — extraction, ordering, validation
- `test_classifier.py` — title/heading/caption detection, references context
- `test_preflight_review_structure.py` — issues, review decisions, hierarchy
- `test_integrity.py` — pass/fail fingerprints, counts
- `test_pipeline.py` — end-to-end, review decisions, failure handling,
  text-edit + role-change edits, undeclared-change failure (F110)
- `test_api.py` — local API: single upload, **batch (F107)**, hostile filename
  (R11), review change (F101), apply-edits + history + reopen (F110/F111/F112),
  restore roundtrip on a reopened `.velox` (F112)
- `test_large_document.py` — **R13 stress**: three ~400-page manuscripts
  (unstructured / wall-of-text / table-heavy), ≥120 k words each, integrity
  pass, linear time, and edit survival at scale (F110)
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

## Behavior notes

- **Preflight `chapter_seq_gap` (roman chapters):** only heading paragraphs
  participate (`professional.py`); a body paragraph starting with a Roman-like
  token must never flag a gap. The message renders the expected numeral via
  `_int_to_roman`.
- **Upload limits (R11):** every upload path — `/api/process`, `/api/open`,
  `/api/open-apply` — streams through `_read_upload` and rejects with HTTP 413
  over `MAX_UPLOAD_BYTES` (`api/main.py`).
- **Desktop single instance (R27):** `desktop.py` computes a free port once and
  caches the live port in a temp file; a second launch reads the cache, verifies
  the server is reachable, and reopens the running app's URL instead of
  scanning a new port.

## Frontend (React premium UI)

The UI lives in `frontend/` as a React + Vite + Tailwind v4 + Framer Motion
single-page app. It never loads external resources at runtime (fonts are
bundled via `@fontsource-variable/*`), which keeps the offline constraint (R1).

- Views: Import (multi-file dropzone + publisher profile picker + **Open .velox
  — F112**), Processing (staged pipeline animation per F106), **Workspace
  (F110/F111)** — the unified findings + inline-editing IDE — plus Opened (.velox
  restart — F112) and Batch results (F107) with drill-down into per-file reports.
- **Workspace (F110):** `WorkspaceView.jsx` — findings list with severity/
  category filters on the left, a draggable split (`ResizeSplit`) with
  `DocEditor` (per-element text + role select + inline warnings with **Auto-fix**
  where `lib/roles.js` defines a rule, "Auto-Fix All" deep-merges into existing
  pending edits) and a live `DocPreview`. "Commit & re-audit" calls
  `POST /api/apply-edits` with the full cumulative edit set.
- **History (F111):** `HistoryTimeline.jsx` renders versions v1..vN with inline
  diffs and a selected-version **Restore** (append-only).
- **.velox (F112):** primary deliverable `*_velox.docx`; `OpenedView.jsx` +
  `POST /api/open` restore the manifest; "Resume editing"/"Restore" use
  `POST /api/open-apply` and re-process the embedded original. A plain DOCX and
  audit JSON/HTML downloads remain in the deliverables bar.
- **Warnings (F113/R26):** the workspace findings list paginates at 10 items
  with "Show all N more" / "Show fewer" (R26).
- **Compare (F104):** backend `structure_view` rows pair each detected element
  with its profile target style so the UI can render source-vs-formatted.
- **Locate (F105):** IssuesList asks the Structure tab to highlight the element
  whose `source_index` matches, then smooth-scrolls to it.
- **Findings queue (F101):** the workspace findings list doubles as the review
  queue — `low_confidence` cards offer inline **Accept** (records
  `human_review_accepted`) and **Reject** (`reject_to_paragraph`,
  `human_review_rejected`); role **change** goes through the editor's role
  select, which the pipeline converts to a `change` decision
  (`core/pipeline.py` `_role_decisions`). Decided items are recorded in
  `review.json` per job, replayed on every re-run (R14), reported in the audit
  payload under `review.decisions` (R16), and cleared from the queue after a
  "Re-analyze with decisions" run.
- UI design system (R22/R23): **Dark Neumorphism** — reuse `neu-raised`,
  `neu-inset`, `neu-chip` from `index.css` (no borders; dual soft shadows on
  #121212/#1a1a1a) + Framer Motion springs (whileTap 0.98, stiffness 300,
  damping 20).
- API client: `frontend/src/lib/api.js` talks to `/api/*` served by FastAPI
  (`processDocument`, `processBatch`, `fetchProfiles`, `applyEdits`,
  `fetchHistory`, `openVelox`, `applyOpenEdits`).

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
4. (optional) `ISCC packaging/circuit-networks.iss` → `release\CircuitNetworks-Setup-0.2.1.exe`

The PyInstaller bundle (`datas` in `packaging/velox.spec`) includes the built
React app under `_internal/frontend` and profiles under `_internal/profiles`.
`core/paths.py` resolves these in dev, PyInstaller, and installed layouts.