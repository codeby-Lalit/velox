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

## Processing a sample

```bash
python -m circuit_networks.cli samples/messy_manuscript.docx --profile profiles/default.json --out out/
```

Outputs (in `out/`):

- `<name>_publication_ready.docx`
- `<name>_audit_report.json`
- `<name>_audit_report.html`