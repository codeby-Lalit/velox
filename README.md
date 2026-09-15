# Circuit Networks — Offline Intelligent Manuscript Processing System

## 1. Project Overview

Circuit Networks is an offline-first intelligent DOCX manuscript processing system for HackNIMA 2026, Domain 4 — AI-Driven IT Solutions.

The system converts an unformatted or inconsistently formatted Microsoft Word manuscript into a publication-ready DOCX while preserving the author's textual content exactly.

### Core constraint

The production pipeline MUST work without:
- Generative AI / LLMs
- Cloud APIs
- Internet connectivity
- External online document-processing services

The intelligence comes from deterministic document analysis, statistical/rule-based classification, confidence scoring, OpenXML inspection, validation, and content fingerprinting.

## 2. Problem

Large manuscripts (including 400+ page documents) create:
- manual formatting bottlenecks
- inconsistent heading hierarchies
- numbering gaps
- table/caption mismatches
- formatting errors
- difficulty proving that original content was not changed

## 3. Product Goal

Input:
`messy_manuscript.docx`

Output:
1. `publication_ready.docx`
2. `audit_report.html`
3. `audit_report.json`

The system should make formatting changes to presentation and structure, never silently rewrite author content.

## 4. Competitive Product Vision

Build this as a serious document-engineering product, not a simple DOCX formatter.

Key differentiators:
- 100% offline operation
- exact content-integrity verification
- document structure map
- confidence-based classification
- human review queue for ambiguous elements
- publisher profiles
- preflight validation before formatting
- post-format validation
- OpenXML compatibility checks
- scalable streaming/chunked processing
- explainable decisions
- reproducible audit reports

## 5. Recommended Architecture

```text
                    ┌──────────────────────┐
                    │      DOCX INPUT      │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │   DOCX / OpenXML     │
                    │       Parser         │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ Document Structure    │
                    │ Analyzer              │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │ Structure Map / AST   │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │   Preflight Engine   │
                    └──────────┬───────────┘
                               │
                ┌──────────────┴──────────────┐
                ▼                             ▼
       ┌────────────────┐            ┌────────────────┐
       │ Auto classify  │            │ Human review   │
       │ high confidence│            │ low confidence │
       └───────┬────────┘            └───────┬────────┘
               └──────────────┬──────────────┘
                              ▼
                    ┌──────────────────────┐
                    │ Formatting Engine    │
                    │ Publisher Profiles   │
                    └──────────┬───────────┘
                               ▼
                    ┌──────────────────────┐
                    │ Integrity Verifier   │
                    └──────────┬───────────┘
                               ▼
              ┌────────────────┴────────────────┐
              ▼                                 ▼
      ┌─────────────────┐              ┌─────────────────┐
      │ Publication DOCX│              │ Audit Reports   │
      └─────────────────┘              └─────────────────┘
```

## 6. Suggested Repository Structure

```text
circuit-networks/
├── README.md
├── INTRACTION.md
├── RULES.md
├── FEATURES.md
├── LICENSE
├── .gitignore
├── docs/
│   ├── architecture.md
│   ├── data-model.md
│   ├── classification.md
│   ├── integrity.md
│   ├── performance.md
│   └── publisher-profiles.md
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── parser/
│   │   ├── structure/
│   │   ├── classifier/
│   │   ├── preflight/
│   │   ├── formatter/
│   │   ├── integrity/
│   │   ├── reports/
│   │   └── review/
│   ├── tests/
│   └── pyproject.toml
├── frontend/
├── profiles/
│   ├── default.json
│   └── examples/
├── samples/
│   └── README.md
└── scripts/
```

## 7. Technology Direction

Preferred implementation:
- Python 3.12+
- `python-docx`
- `lxml`
- standard-library ZIP/XML/hash utilities
- FastAPI for local API
- React/Next.js for UI
- SQLite for local metadata where needed
- PyInstaller or equivalent for offline packaging

Avoid unnecessary dependencies.

## 8. Engineering Principles

1. Preserve source content.
2. Never silently guess.
3. Every classification should be explainable.
4. Separate parsing, analysis, formatting, and verification.
5. Keep the core engine usable without the UI.
6. Prefer deterministic/reproducible results.
7. Design for large documents.
8. Fail safely.
9. Never require network access in the processing path.
10. Test with adversarial and malformed documents.

## 9. Definition of Done

A feature is complete only when:
- implemented
- unit tested
- integration tested where applicable
- documented
- error-handled
- deterministic
- compatible with the project rules
- does not violate content-preservation requirements

## 10. Agent Instructions

AI coding agents should read, in order:
1. `README.md`
2. `INTRACTION.md`
3. `RULES.md`
4. `FEATURES.md`
5. relevant files under `docs/`

Do not start coding before understanding these documents.

Agents may improve implementation details when the improvement:
- preserves the hackathon requirements
- does not introduce prohibited online/LLM dependencies
- improves reliability, performance, UX, explainability, or testing
- is documented
- does not alter source text content

When uncertain, prefer the safest reversible implementation and flag the decision for human review.
