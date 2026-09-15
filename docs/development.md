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