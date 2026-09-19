# INTRACTION.md

## Purpose

This file defines how AI coding agents should interact with and develop the Circuit Networks project.

> Filename intentionally follows the requested project convention: `INTRACTION.md`.

## 1. Mandatory Startup Procedure

Before changing code:

1. Read `README.md`.
2. Read `RULES.md`.
3. Read `FEATURES.md`.
4. Inspect the repository tree.
5. Identify existing architecture before creating new modules.
6. Run existing tests if available.
7. Create a short implementation plan.
8. Implement the smallest coherent change.
9. Run tests/lint/type checks relevant to the change.
10. Update documentation when behavior changes.

## 2. Agent Working Mode

Agents should behave as senior software engineers.

Do:
- inspect before editing
- reuse existing abstractions
- keep modules small
- write tests with new logic
- explain non-obvious algorithms
- use typed models where practical
- handle errors explicitly
- preserve backwards compatibility where possible

Do not:
- rewrite the entire project unnecessarily
- add random libraries
- add an LLM just because a task is difficult
- send document data to external services
- silently change user content
- hide failed validation
- claim a feature works without testing it

## 3. Architecture Boundaries

Keep these concerns separate:

```text
Parser
  ↓
Structure Model
  ↓
Classifier
  ↓
Preflight
  ↓
Formatter
  ↓
Integrity
  ↓
Report
```

The formatter must not become responsible for parsing arbitrary DOCX internals.

The integrity checker must read independently from the formatter whenever practical so that verification is meaningful.

## 4. Decision Policy

When multiple approaches are possible, rank them:

1. correctness
2. content preservation
3. offline compliance
4. determinism
5. scalability
6. explainability
7. maintainability
8. user experience

A flashy feature is not valuable if it weakens any of the first four.

## 5. Handling Ambiguity

The shipped default trust boundary (`core/constants.py`) is one value for both
`AUTO_THRESHOLD` and `REVIEW_THRESHOLD`. It was tightened to **0.60** (was
0.70/0.90) so 0.6–0.9 classifications are trusted without a review nag, while
low-confidence findings stay explicitly manual:

```text
confidence > 0.60  → trusted (classification stands, determinism preserved)
confidence <= 0.60 → low-confidence manual finding, never applied implicitly
```

Thresholds remain configurable per profile.

Never convert low-confidence content into a structural element without exposing that uncertainty.

## 6. Code Change Protocol

For each meaningful feature:

```text
Understand
   ↓
Plan
   ↓
Implement
   ↓
Unit test
   ↓
Integration test
   ↓
Performance check if document-scale code changed
   ↓
Review integrity impact
   ↓
Document
```

## 7. Large Document Policy

The target includes 400+ page manuscripts.

Agents should avoid:
- repeatedly reparsing the complete DOCX
- loading unnecessary binary media into memory
- O(n²) document scans
- copying large strings unnecessarily
- keeping duplicate full-document representations without reason

Prefer:
- one-pass extraction where practical
- indexed metadata
- lazy access to expensive OpenXML parts
- chunked processing
- cached analysis results
- streaming/report pagination where useful

## 8. UI Agent Behavior

The UI should expose:
- upload
- document analysis
- structure overview
- preflight issues
- confidence/review queue
- publisher profile
- formatting progress
- integrity result
- output download
- audit report

Do not expose internal implementation complexity unless it helps an editor understand a decision.

## 9. Testing Expectations

Test at minimum:
- empty DOCX
- normal DOCX
- large DOCX
- mixed formatting
- missing heading levels
- numbering gaps
- captions
- tables
- Unicode text
- punctuation-heavy text
- hyperlinks
- headers/footers
- malformed/unusual OpenXML
- repeated formatting
- documents with tracked changes if supported
- integrity mismatch scenarios

## 10. Agent Output Format

When reporting a completed task, provide:

```text
Implemented:
- ...

Files changed:
- ...

Tests:
- ...

Validation:
- ...

Known limitations:
- ...

Next recommended step:
- ...
```

Never say "100% correct" unless the corresponding automated validation actually supports that claim.
