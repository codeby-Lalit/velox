# Samples

Sample documents live outside version control (they are generated), except
small deterministic fixtures used by tests.

## Generate the demo manuscript

```bash
python scripts/make_sample.py samples/messy_manuscript.docx
```

This produces `messy_manuscript.docx` — an intentionally inconsistent document:
headings are plain bold text instead of Heading styles, spacing is uneven, and
tables/captions are mixed. It is the primary demo input for the pipeline.

## 400+ page stress documents (R13)

The large-document regression tests do **not** store big files in the repo.
`backend/tests/test_large_document.py` programmatically generates three distinct
>400-page manuscripts (≥120 k words each) via
`build_large_unstructured_document` in `tests/conftest.py`:

- `unstructured` — random inconsistent heading conventions + odd tables
- `wall_of_text` — no headings at all, endless body paragraphs
- `table_heavy` — many tables with out-of-order captions and raw data

Run them with:

```bash
cd backend
python -m pytest tests/test_large_document.py -v
```

They assert integrity `pass`, linear elapsed time, and that a declared edit on a
400+ page document survives reprocessing without failing integrity (F110).

## Processing a sample

```bash
python -m circuit_networks.cli samples/messy_manuscript.docx --profile profiles/default.json --out out/
```

Outputs (in `out/`):

- `<name>_publication_ready.docx`
- `<name>_audit_report.json`
- `<name>_audit_report.html`