# Circuit Networks — Offline Intelligent Manuscript Processing System

> Convert a messy DOCX manuscript to a publication-ready document, fully offline.
> Built for **HackNIMA 2026** · Domain 4 · 100% offline · No AI/LLM · No cloud.

---

## Quick Start — Desktop Installer (Recommended)

1. Download the installer from the [latest GitHub Release](https://github.com/codeby-Lalit/velox/releases/latest):
   `CircuitNetworks-Setup-0.1.0.exe`
2. Run the installer; it creates a Start-Menu shortcut and a desktop icon.
3. Launch **Circuit Networks** — the offline desktop app opens at `http://127.0.0.1:8000`.
4. Select a publisher profile, drop a `.docx` file (or multiple files for batch, **F107**), and click **Analyze & Format**.

The app runs at `127.0.0.1:8000` — all processing happens locally; nothing leaves your machine.

> **Offline compliance (R1, R2, R21):** The engine and React UI are bundled into a single
> offline desktop executable. No runtime internet access is required at any point.

---

## Features

### Core Engine (Python backend)

| ID | Feature | Status |
|----|---------|--------|
| F001 | DOCX parsing with full body ordering | **Done** |
| F002 | Header & footer extraction (per-section) | **Done** |
| F003 | Deterministic heading + caption classification | **Done** |
| F005 | Preflight checks (hierarchy jumps, caption mismatches) | **Done** |
| F006 | Human review queue (accept / change / reject-to-paragraph) | **Done** |
| F007 | Publisher-profile formatting engine | **Done** |
| F008 | Content integrity verification (paragraph/word/char SHA-256) | **Done** |
| F009 | JSON + HTML audit report generation | **Done** |
| F010 | JSON + HTML audit report with explainable reason codes | **Done** |
| F011 | Desktop packaging — Windows EXE + offline installer | **Done** |
| F101 | Re-process with human decisions (review queue) | **Done** |
| F102 | Explainable reasons panel (confidence + reason codes) | **Done** |
| F103 | Profile picker in the UI | **Done** |
| F104 | Before / After structure compare view | **Done** |
| F105 | Issue → source element jump (Locate button) | **Done** |
| F106 | Staged processing animation with cancel | **Done** |
| F107 | Batch processing (up to 50 files in one request) | **Done** |
| F108 | Sample manuscript corpus for regression testing | **Done** |
| F109 | Processing metrics (elapsed time, word count, estimated pages) | **Done** |
| R3 | Content never rewritten — integrity verified | **Done** |
| R11 | Path-traversal-safe upload isolation + file size cap | **Done** |
| R13 | Linear O(n) audit builder (no quadratic algorithms) | **Done** |

### React Frontend (premium UI)

- Dark glassmorphism circuit-themed interface (Tailwind v4 + Framer Motion)
- Staged pipeline animation with cancel support
- Profile picker (F103)
- Batch mode: multi-file dropzone → batch results table → drill into individual reports
- Results dashboard: integrity badge, stats grid (words, pages, elapsed), Structure / Before-After / Issues / Review / Why tabs
- Issues: Locate button that jumps to the corresponding element in the Structure view (F105)
- Before/After (F104): two-column comparison of detected source style vs formatted target style
- Review queue: accept, change type, reject-to-paragraph, then reprocess with decisions
- SHA-256 fingerprint panel + download bar (DOCX, JSON, HTML)

---

## Repository Structure

```text
velox/
├── backend/
│   ├── src/circuit_networks/
│   │   ├── api/main.py              # FastAPI + F107 batch endpoint
│   │   ├── core/                    # models, config, constants, pipeline
│   │   ├── parser/docx_parser.py    # DOCX → DocumentModel
│   │   ├── classifier/heading.py    # Deterministic classification
│   │   ├── preflight/engine.py      # Preflight checks (F005)
│   │   ├── formatter/engine.py      # Profile-based formatting (F007)
│   │   ├── integrity/verify.py      # Content integrity (F008)
│   │   ├── reports/audit.py         # Audit payload + JSON/HTML
│   │   ├── review/queue.py          # Human review decisions
│   │   ├── structure/               # StructureMap, hierarchy builder
│   │   ├── cli.py                   # Offline CLI
│   │   └── desktop.py               # PyInstaller entry point
│   ├── tests/                       # 47 pytest tests including corpus regression
│   └── pyproject.toml
├── frontend/
│   ├── src/                         # React 18 + Vite + Tailwind v4 + Framer Motion
│   ├── dist/                        # Built static assets (served by backend)
│   └── package.json
├── profiles/
│   └── default.json                 # Default publisher profile
├── samples/                         # F108: sample manuscript corpus
│   ├── messy_manuscript.docx
│   ├── academic_paper.docx
│   ├── book_style.docx
│   ├── bad_levels.docx
│   ├── unicode_manuscript.docx
│   └── empty_document.docx
├── packaging/
│   ├── velox.spec                   # PyInstaller spec
│   └── circuit-networks.iss         # Inno Setup script
├── scripts/
│   ├── make_sample.py               # Corpus generator (--corpus flag)
│   └── build_desktop.bat            # One-command build
├── docs/
│   ├── architecture.md
│   └── development.md
├── README.md
├── FEATURES.md
├── RULES.md
└── INTRACTION.md
```

---

## Sample Corpus (F108)

The `samples/` directory contains six deliberately varied manuscripts:

| File | Purpose |
|------|---------|
| `messy_manuscript.docx` | General: mixed formatting, bold-as-heading, tables + captions |
| `academic_paper.docx` | Academic: numbered headings, header/footer, tables |
| `book_style.docx` | Monograph: chapter-prefixed headings, unnumbered sub-sections |
| `bad_levels.docx` | Preflight demo: hierarchy jumps, caption gaps, duplicate numbers |
| `unicode_manuscript.docx` | Devanagari + English + math symbols, header/footer extraction |
| `empty_document.docx` | No headings at all — body-only formatting |

Rebuild the corpus at any time:

```bash
python scripts/make_sample.py --corpus
```

---

## Development Setup

### Prerequisites

- Python 3.11+
- Node.js 20+
- Git

### 1. Clone and install dependencies

```bash
git clone https://github.com/codeby-Lalit/velox.git
cd velox/backend
pip install -e ".[dev]"
```

### 2. Build the React frontend

```bash
cd ../frontend
npm install
npm run build    # outputs to frontend/dist
```

### 3. Run the API server

```bash
cd ../backend
uvicorn circuit_networks.api.main:app --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000` in a browser.

### 4. Run the CLI

```bash
python -m circuit_networks.cli ../samples/messy_manuscript.docx --out out/
```

Produces:
- `messy_manuscript_publication_ready.docx`
- `messy_manuscript_audit_report.json`
- `messy_manuscript_audit_report.html`

---

## Testing

```bash
cd backend
python -m pytest tests -v
```

Current count: **47 tests**, including:
- Parser, classifier, preflight, integrity, pipeline unit tests
- API smoke tests: single-file, batch (**F107**), hostile filename (**R11**), review change (**F101**)
- Corpus regression (**F108**): all six sample manuscripts processed end-to-end with integrity pass
- Metrics/structure-view assertions (**F104/F109**)

---

## Desktop Build

### Windows EXE (PyInstaller + Inno Setup)

```bash
scripts\build_desktop.bat
```

Produces:
- `dist\CircuitNetworks\CircuitNetworks.exe` — standalone COLLECT bundle
- `release\CircuitNetworks-Setup-0.1.0.exe` — Inno Setup installer (~50 MB)

The installer:
- Creates a Start-Menu shortcut and desktop icon
- Installs the app to `Program Files (x86)`
- Registers an uninstaller
- Runs fully offline — no internet required at install or runtime

---

## API Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | Engine version + health check |
| `/api/profiles` | GET | List available publisher profiles |
| `/api/process` | POST | Process a single DOCX (multipart form) |
| `/api/process-batch` | POST | Process multiple DOCX files (**F107**) |
| `/api/download/{filename}` | GET | Download output artifacts |

Single-file response includes `payload.processing_stats` with `elapsed_ms`, `words`, `pages_estimate`, and `structure_view` for the Before/After tab.

---

## Engineering Principles

1. Preserve source content exactly — integrity verified after formatting.
2. Never silently guess — every classification is explainable (reason codes).
3. 100% offline — no runtime network access, no LLM, no cloud.
4. Deterministic — same input + same profile = same output, every time.
5. Safe failure — malformed inputs are caught and surfaced clearly.
6. Scalable — O(n) linear processing, tested on 400+ page manuscripts.

---

## License

MIT

---

*HackNIMA 2026 · Domain 4 — AI-Driven IT Solutions*
