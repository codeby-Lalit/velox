# RULES.md

## Non-Negotiable Project Rules

These rules override convenience and shortcut-driven implementation decisions.

## R1 — Offline First

The manuscript-processing pipeline MUST operate without internet access.

No document content may be sent to:
- cloud AI services
- external APIs
- hosted OCR/document services
- telemetry endpoints
- analytics services

Network access is not a dependency of core processing.

## R2 — No Generative AI / LLM

Do not use:
- ChatGPT/OpenAI APIs
- Gemini APIs
- Claude APIs
- local LLMs
- RAG
- generative rewriting
- prompt-based classification

The intelligent behavior must be implemented through deterministic/rule/statistical document analysis.

## R3 — Content Preservation

The author's content must not be rewritten.

Formatting operations may change:
- styles
- fonts
- sizes
- spacing
- margins
- indentation
- alignment
- numbering presentation when explicitly supported
- other presentation/layout properties

Formatting operations must NOT silently change:
- words
- characters
- paragraph text
- table cell text
- caption text
- reference text

If a transformation could change content, stop and flag it.

## R4 — Integrity Verification

Every formatted output should be independently compared with its source.

At minimum compare:
- paragraph text
- table cell text
- relevant textual OpenXML content
- word count
- character count
- paragraph count

Use cryptographic fingerprints where appropriate.

A successful output should contain an explicit integrity status.

## R5 — No Silent Guessing

Ambiguous classification must be surfaced.

Every structural classification should ideally contain:

```text
element_type
confidence
reason_codes
source_location
```

Example:

```json
{
  "element_type": "section_heading",
  "confidence": 0.94,
  "reason_codes": [
    "numbering_pattern",
    "bold",
    "large_font",
    "spacing_before"
  ]
}
```

## R6 — Explainability

A reviewer should be able to understand why the system classified an element.

Avoid opaque scoring without reason codes.

## R7 — Publisher Profiles

Formatting rules should be configurable.

Do not hardcode one publisher's style into the parser.

## R8 — OpenXML Safety

Do not corrupt unrelated DOCX parts.

When modifying XML:
- preserve namespaces
- preserve relationships
- preserve media unless intentionally changed
- preserve unsupported content where possible
- validate generated package structure

## R9 — Safe Failure

If a document cannot be safely processed:
- do not produce a misleading "success"
- preserve the original
- report the failure
- identify the failing stage
- provide actionable diagnostics

## R10 — Original File Safety

Never overwrite the user's original input by default.

Always create a new output artifact.

## R11 — Security

Treat uploaded DOCX files as untrusted input.

Do not execute:
- macros
- embedded executables
- arbitrary scripts
- external commands originating from document content

Sanitize file names and enforce reasonable file-size/resource limits.

## R12 — Dependency Discipline

Every new dependency must have a reason.

Prefer standard library or already-approved dependencies when adequate.

## R13 — Performance

The architecture must remain practical for 400+ page documents.

Measure before optimizing, but do not introduce obvious quadratic algorithms in core document traversal.

## R14 — Determinism

Given the same input document and same publisher profile/version, the processing result should be reproducible.

## R15 — Human Review

Human review is a feature, not a failure.

The system should identify:
- low-confidence headings
- conflicting hierarchy signals
- numbering anomalies
- caption/reference mismatches
- unsupported structures

## R16 — Auditability

Record:
- source metadata
- processing version
- selected profile
- detected issues
- decisions
- confidence
- integrity results
- timestamps where appropriate

Do not store document content externally.

## R17 — Testing

Do not merge a behavior-changing feature without tests unless a documented exception is necessary.

## R18 — No Fake AI

Do not label ordinary regex/rules as "AI" just for marketing.

Use accurate terminology such as:
- intelligent document analysis
- rule-based classification
- statistical scoring
- structural inference
- confidence-based classification

## R19 — Competitive Improvements

Agents MAY implement stronger engineering approaches than the initial design if they remain compliant.

Examples:
- better heading classification
- improved OpenXML handling
- more robust fingerprints
- parallel processing
- local search/indexing
- visual document preview
- better review workflows
- profile inheritance
- regression-test corpus
- performance instrumentation

Every major improvement must be documented.

## R20 — Hackathon Alignment

The implementation must continue to satisfy:
- DOCX input/output
- structure recognition
- publication formatting
- content preservation
- offline operation
- Microsoft Word compatibility
- 400+ page scalability
- preflight validation
- post-format verification

## R21 — Offline Packaging (Desktop Standalone)

The final deliverable of this project MUST be a self-contained offline package,
not a server-dependent deployment. The primary packaging target is a
**desktop offline application** — a standalone executable bundle
(e.g. PyInstaller) for Windows/macOS/Linux that runs the full manuscript
formatting pipeline locally.

A mobile **APK/AAB** or an offline **PWA** may be considered only as a
secondary alternative after the desktop bundle works.

The packaging MUST enforce:
- complete offline processing with zero network/telemetry calls (R1)
- no generative-AI/LLM components (R2)
- content integrity verification shipped with the user (R4)
- deterministic, reproducible results on the same device (R14)
- local storage of publisher profiles and audit reports (R7 / R16)

The packaging pipeline itself is part of the Definition of Done. The produced
artifact must run without a development machine, build tools or internet.
