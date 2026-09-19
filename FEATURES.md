# FEATURES.md

# Circuit Networks Feature Specification

## Priority Legend

- P0 = must-have for hackathon MVP
- P1 = high-value competitive feature
- P2 = advanced enhancement

---

## P0 — Core Features

### F001 — DOCX Import

Accept `.docx` files through the local application.

Requirements:
- validate extension/package
- validate basic OpenXML structure
- preserve original file
- report invalid files clearly

### F002 — Document Parser

Extract:
- paragraphs
- runs
- styles
- tables
- table cells
- headers/footers where supported
- relationships where required
- document metadata
- relevant OpenXML properties

### F003 — Document Structure Map

Create an internal representation such as:

```text
Document
 ├── FrontMatter
 ├── Chapter
 │    ├── Section
 │    │    ├── Paragraph
 │    │    ├── Table
 │    │    └── FigureCaption
 │    └── Section
 ├── References
 └── Appendix
```

The structure map must retain source locations.

### F004 — Heading Classification

Detect probable:
- title
- chapter
- section
- subsection
- subsubsection
- normal paragraph

Use multiple signals rather than one rule.

### F005 — Table Detection

Detect and classify tables.

Validate:
- table structure
- repeated header patterns where detectable
- captions where applicable

Never rewrite table text.

### F006 — Caption Detection

Detect probable:
- Figure captions
- Table captions
- other supported caption forms

Check nearby relationships and numbering.

### F007 — Preflight Engine

Before formatting, identify:
- hierarchy problems
- numbering gaps
- inconsistent levels
- caption mismatches
- suspicious references
- low-confidence classifications

### F008 — Publisher Formatting

Apply profile-defined:
- page size
- margins
- fonts
- typography
- paragraph spacing
- indentation
- alignment
- heading styles
- table styles

### F009 — Integrity Verification

Compare source and output content.

Produce:
- paragraph counts
- word counts
- character counts
- fingerprints
- mismatch locations if any

> UI content view: the Compare panel measures **Total words** and **Characters**
> excluding whitespace, so formatting-only fixes (double-space collapse, line
> spacing, indentation) never move the numbers and never look like content
> changes (R3). Hard raw counts remain inside the integrity verification.

### F010 — Audit Report

Generate machine-readable JSON and human-readable HTML.

Report:
- input information
- detected structure
- preflight findings
- formatting summary
- integrity result
- warnings
- review items
- processing statistics

### F011 — Output DOCX

Generate a Microsoft Word compatible publication-ready DOCX without replacing the source.

---

## P1 — Competitive Features

### F101 — Confidence-Based Human Review

Provide a review queue:

```text
HIGH CONFIDENCE
✓ Auto-approved

MEDIUM CONFIDENCE
⚠ Review suggested

LOW CONFIDENCE
! Review required
```

Reviewer actions:
- accept
- change classification
- reject classification
- apply to similar elements where safe

### F102 — Explainable Classification

For every classification show reason codes, e.g.:

```text
Section Heading
Confidence: 92%

Reasons:
✓ Numbering pattern 2.3
✓ Bold
✓ Font size > body
✓ Spacing before
✓ Similarity to neighboring headings
```

> Status note: the standalone "Why" tab was removed (UI decision). Reason codes
> and confidence remain in the audit payload, the inline review queue (F101)
> and the classification panel data; explainability is not lost.

### F103 — Publisher Profile Manager

Allow multiple local profiles.

Example:

```text
Publisher A
Publisher B
University Thesis
Journal Article
Custom Profile
```

Profiles must be stored locally.

### F104 — Before/After Structure View

Show:

```text
RAW DOCUMENT
    ↓
DETECTED STRUCTURE
    ↓
FORMATTED STRUCTURE
```

This helps editors verify decisions without reading the entire manuscript.

### F105 — Issue Navigation

Click an audit issue and jump to its source location in the review interface where technically possible.

### F106 — Processing Progress

Show stage-level progress:

```text
Parsing             ██████████ 100%
Structure Analysis  ████████░░  80%
Preflight           ██████░░░░  60%
Formatting          ██░░░░░░░░  20%
Integrity           ░░░░░░░░░░   0%
```

### F107 — Batch Processing

Allow multiple DOCX files to be processed using the same profile.

All processing remains local.

### F108 — Regression Corpus

Maintain sample documents representing:
- simple manuscripts
- academic papers
- books
- bad formatting
- numbering errors
- complex tables
- mixed styles

Run automated regression tests against them.

### F109 — Processing Metrics

Track locally:
- pages/paragraphs processed
- elapsed time
- peak memory
- classifications
- review count
- warnings
- integrity status

---

### F110 — Manual Editor With Live Preview (P1)

A two-pane editor where:
- **left pane**: live preview of the formatted document, updated on every
  keystroke
- **right pane**: per-paragraph editing (manual text change + role select) with
  inline warnings showing both an Auto-fix button (for supported rules) and full
  manual control (Light Premium UI — R22)

Constraints:
- edits are **declared** and cumulative — the editor submits its full current
  edit set on every apply (replace semantics, R24)
- integrity passes only for declared edits
- 10 warnings at a time with progressive disclosure (R26)

### F111 — Git-Like Version History (P1)

An append-only edit timeline (v1 → v2 → …) visible in both the editor and the
results view:
- each version records: message, cumulative edits, integrity status, elapsed
- restore to any past version creates a new version (R25) — nothing is erased
- diff between any two adjacent versions is displayed inline

### F112 — Self-Contained `.velox` Document (P1)

A `.velox` document is a standard Word `.docx` with two extra ZIP parts:
- `velox/manifest.json` — engine, profile, history (F111), integrity status
- `velox/original.docx` — the raw pre-format manuscript bytes (F112 restore)

User-facing behavior:
- primary download is `*_velox.docx`; a plain DOCX is also available
- "Open .velox" button reopens the file and restores full history (F112)
- "Resume editing" re-processes the embedded original with the latest version's
  edits, producing a new editor session without re-uploading (R25)
- restoring to an older version via the history timeline re-applies that
  version's cumulative edits to the embedded original (R14 deterministic)

### F113 — Warning Pagination (P1)

All warning lists (preflight issues, edit-panel warnings) display **10 items at
a time** with a "Show more" button (R26). The total count and remaining count
are always visible to keep the user informed on large documents (R13).

### F114 — Production Standard Profile (P1)

A `production_standard` publisher profile applies publication-grade
formatting: A4 with 1.52/1.52/1.97/1.96 cm margins plus a 1.0 cm gutter,
footer page numbers, widowed-content control, page-break-before on top-level
chapters/sections, Times New Roman 12pt justified body with 1.5 line spacing
and 1.27 cm first-line indents, centered italic captions, horizontal-bordered
tables with repeating headers and uncuttable rows, and hanging indents for
lists and References. Marginal values are centimetres (never points).

### F115 — Professional Publication Checks (P1)

Strict-mode preflight (18 professional rules) validates structure (missing
title, dangling headings, chapter/section numbering gaps, TOC / References /
Abstract presence and Abstract word count), cleanliness (placeholders, double
spaces, document metadata) and per-paragraph conformance to the active profile
(font, size, indent, alignment, line spacing) plus DOCX section margins and
page size. Every report exposes `rules_checked` (24), `accuracy_score` and
per-category counts; every issue carries a `category` and best-effort page
anchor.

### F116 — Unified Split-Pane IDE (P1)

A single-screen working surface replaces tab-hop review: resizable split pane
with live issues left (35–40%) and the inline-editable document right
(60–65%), severity-coded inline highlights, hover/click deep-linking, inline
"Apply Fix" chips, optimistic live re-scoring, category/severity filters,
Auto-Fix All and background "Apply & re-scan" — all dependency-free.

### F117 — Desktop Single-Instance Guard (P1)

A Windows named mutex plus a free-port scan keep relaunches (incl. installer
[Run] hook and desktop-icon opens) crash-free: a second instance simply opens
the running app and exits 0 (R27).

### F118 — Auto-Fix All (Formatting-Only, Content-Safe) (P1)

One-click resolution for the safe, formatting-only fixable rules:
- `double_space` — collapses duplicate spaces (whitespace-only; words identical)
- `spacing_mismatch` — applies the profile line spacing as a formatting override
- `metadata_missing` — patches the document title in docProps (never body text)

Fixes are declared edits (R24): integrity still passes only for declared
changes, and no manuscript word is ever rewritten (R3).

### F119 — Whitespace-Excluded Content Metrics (P1)

The Compare panel's **Characters** metric excludes whitespace entirely, so
formatting-only fixes (double-space collapse, line spacing, indentation) never
move the numbers and never look like content changes (R3). Hard raw counts
stay inside integrity verification (F009).

### F120 — 60% Trust Boundary (P1)

The classification trust boundary (previously 0.70/0.90) is a single **0.60**
for both `AUTO_THRESHOLD` and `REVIEW_THRESHOLD`:
- confidence > 0.60 → trusted (deterministic, no review nag)
- confidence ≤ 0.60 → manual low-confidence finding, always surfaced (R5)
Thresholds remain per-profile configurable.

### F121 — Persistent Metadata Title Patch (P1)

The `metadata_missing` title patch survives:
- later applies to the same job (stored in `job.json`)
- opening the `.velox` document again (carried in `velox/manifest.json`)
So once fixed, it stays fixed across re-audits and resumes (R14/F111).

## P2 — Advanced Features

### F201 — Visual Layout Analysis

Use document geometry and OpenXML layout-related signals to improve classification where reliable.

Do not use cloud vision services.

### F202 — Structural Similarity Clustering

Group visually/structurally similar paragraphs to identify repeated heading styles or anomalies.

Possible approach:
- feature extraction
- normalization
- local clustering/statistical grouping

### F203 — Profile Inheritance

Allow:

```text
Base Profile
   ↓
Publisher Profile
   ↓
Book/Project Override
```

### F204 — Safe Recovery

If one unsupported element cannot be transformed:
- preserve it
- mark it
- continue only when safe
- report it

### F205 — Large-Document Optimization

Target 400+ page documents with:
- efficient parsing
- cached structure
- low-copy data handling
- incremental processing
- memory instrumentation

### F206 — Local Document Search

Search the parsed manuscript locally by:
- paragraph
- heading
- caption
- table
- issue type

No external search service.

### F207 — Versioned Audit

Store processing configuration and engine version so an editor can reproduce the result.

### F208 — Integrity Diff

If integrity fails, show the exact:
- paragraph
- table cell
- character/word region where possible
- before/after value

The default behavior should be to fail safely rather than automatically repair content.

---

# Suggested MVP Demo

For a strong hackathon demonstration:

```text
1. Upload intentionally messy DOCX
2. Analyze 400+ pages
3. Show detected document structure
4. Show preflight warnings
5. Show 2–3 low-confidence review items
6. Accept/reject review items
7. Select publisher profile
8. Format document
9. Run integrity verification
10. Show "100% integrity pass" only when actually verified
11. Download formatted DOCX
12. Download audit report
```

# Success Metrics

The project should measure, not merely claim:

### Structure Accuracy
Correct classification of headings, tables, captions and paragraphs.

### Formatting Consistency
Conformance to selected publisher profile.

### Processing Performance
Time and memory for representative documents, including 400+ page cases.

### Integrity
Zero unintended textual changes.

### Review Efficiency
Number of ambiguous items surfaced and resolved.

### Reliability
Successful handling of malformed or unusual documents without corrupting output.

# Future Direction

Potential future versions can add:
- more publisher profiles
- advanced local statistical models
- desktop packaging
- document repair suggestions
- richer Word-compatible formatting
- enterprise batch workflows

Any future feature must remain compliant with `RULES.md`.
