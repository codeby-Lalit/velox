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
- `test_api.py` — local API upload → process → audit flow

## Frontend (React premium UI)

The UI lives in `frontend/` as a React + Vite + Tailwind v4 + Framer Motion
single-page app. It never loads external resources at runtime (fonts are
bundled via `@fontsource-variable/*`), which keeps the offline constraint (R1).

- Views: Import (dropzone + publisher profile picker), Processing
  (staged pipeline animation per F106), Results (integrity banner, stats,
  and tabbed Structure / Issues / Review / Why panels).
- Review flow (F101): accept / change / reject per low-confidence item, then
  "Re-analyze with decisions" re-runs the local pipeline with the decisions.
- API client: `frontend/src/lib/api.js` talks to `/api/*` served by FastAPI.

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