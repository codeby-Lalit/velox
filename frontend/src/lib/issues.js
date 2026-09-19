/* Client-side helpers for the unified IDE: severity/category metadata,
   optimistic issue resolution, and edit-payload construction. */

import { autoFix, ROLE_TYPES } from "./roles";

export const SEVERITY_META = {
  error: {
    label: "Error",
    text: "text-rose-300",
    dot: "bg-rose-400",
    chip: "bg-rose-400/10 text-rose-300 ring-rose-400/30",
    mark: "border-l-rose-400/80 bg-rose-400/[0.05]",
    underline: "decoration-rose-400/80",
  },
  warning: {
    label: "Warning",
    text: "text-amber-300",
    dot: "bg-amber-400",
    chip: "bg-amber-400/10 text-amber-300 ring-amber-400/30",
    mark: "border-l-amber-400/80 bg-amber-400/[0.05]",
    underline: "decoration-amber-400/80",
  },
  info: {
    label: "Info",
    text: "text-aqua-300",
    dot: "bg-aqua-400",
    chip: "bg-aqua-400/10 text-aqua-300 ring-aqua-400/30",
    mark: "border-l-aqua-400/70 bg-aqua-400/[0.04]",
    underline: "decoration-aqua-400/70",
  },
};

export const CATEGORY_META = {
  formatting: { label: "Formatting", tone: "aqua" },
  structure: { label: "Structure", tone: "iris" },
  suggestion: { label: "Suggestions", tone: "slate" },
};

export const CATEGORY_ORDER = ["structure", "formatting", "suggestion"];
export const SEVERITY_ORDER = ["error", "warning", "info"];

/* ---- optimistic re-audit ------------------------------------------------ */

const PLACEHOLDER_RE =
  /(TODO|FIXME|TBD|PLACEHOLDER|LOREM IPSUM|INSERT TEXT|\(INSERT|\[YOUR )/;

export function isFixable(issue, el) {
  return autoFix(issue?.code, issue?.details, el?.text) !== null;
}

/* ---- F101 human review --------------------------------------------------- */

/** Only classification-quality findings enter the review queue (no one-click
    fix; the reviewer decides accept / reject / change). */
export function isReviewable(issue) {
  return issue?.code === "low_confidence";
}

/** Build a ReviewDecision payload for the backend (change goes through the
    editor's role select, which the pipeline converts to a "change" decision). */
export function reviewDecision(issue, action) {
  return {
    source_index: issue.source_index,
    action, // "accept" | "reject_to_paragraph"
    new_element_type: null,
  };
}

export function issueIsResolved(issue, el, override, decisions = {}) {
  if (!el) return false;
  const role = override?.element_type ?? el.element_type;
  switch (issue?.code) {
    case "low_confidence":
      // Accepted as decided, OR reclassified via the right-panel role picker
      // (an override element_type only persists when it differs from base).
      return decisions[issue.source_index] !== undefined || Boolean(override?.element_type);
    case "hierarchy_jump": {
      const target = autoFix(issue.code, issue.details);
      return Boolean(target && target.element_type === role);
    }
    case "caption_without_heading":
    case "table_caption_without_table":
      return role === "paragraph";
    case "placeholder_text": {
      const text = override?.text ?? el.text ?? "";
      return !PLACEHOLDER_RE.test(text.toUpperCase());
    }
    case "double_space": {
      const text = override?.text ?? el.text ?? "";
      return !/ {2,}/.test(text);
    }
    case "spacing_mismatch":
      return Boolean(override?.line_spacing);
    default:
      return false;
  }
}

/* ---- edit payload -------------------------------------------------------- */

export function buildEdits(overrides, elements) {
  const byIndex = new Map((elements || []).map((e) => [e.source_index, e]));
  return Object.keys(overrides)
    .map((idx) => {
      const patch = overrides[idx];
      const el = byIndex.get(Number(idx));
      const text =
        patch.text !== undefined && el && patch.text === el.text
          ? undefined
          : patch.text;
      const elementType =
        patch.element_type !== undefined && el && patch.element_type === el.element_type
          ? undefined
          : patch.element_type;
      if (text === undefined && elementType === undefined && patch.line_spacing === undefined)
        return null;
      return {
        kind: "paragraph",
        source_index: Number(idx),
        ...(text !== undefined ? { text } : {}),
        ...(elementType !== undefined ? { element_type: elementType } : {}),
        ...(patch.line_spacing !== undefined ? { line_spacing: patch.line_spacing } : {}),
      };
    })
    .filter(Boolean);
}

/* ---- confidence-aware auto-fix ----------------------------------------- */

/**
 * Split the pending fixes for Auto-Fix All into three buckets:
 *   auto         — confidence >= 0.5 (or unstated): apply directly.
 *   lowConfidence— confidence < 0.5: never apply automatically; the user
 *                  must review manually first (per-finding notification).
 *   manual       — element was already touched by a manual edit: skip.
 */
export function planAutoFix(issues, byIndex, overrides = {}) {
  const auto = {};
  const lowConfidence = [];
  const manual = [];
  for (const issue of issues) {
    if (issue.source_index < 0) continue;
    const idx = issue.source_index;
    const el = byIndex.get(idx);
    const fix = autoFix(issue?.code, issue?.details, el?.text);
    if (!fix) continue;
    if (el?.element_type && fix.element_type === el.element_type) continue;
    if (overrides[idx]) {
      manual.push({ index: idx, issue });
      continue;
    }
    if (issue.details?.confidence !== undefined && issue.details.confidence < 0.5) {
      lowConfidence.push({ index: idx, issue, fix });
      continue;
    }
    auto[idx] = { ...(auto[idx] || {}), ...fix };
  }
  return { auto, lowConfidence, manual };
}

/**
 * Publication-mode Auto-Fix All: leave NOTHING fixable behind. Every finding
 * with a one-click fix maps to an override (text / element_type). Low-confidence
 * classifications are deliberately excluded — they need a human decision on the
 * finding card (Accept or Manual role pick). Returns the override map + count.
 */
export function planFullFix(issues, byIndex) {
  const overrides = {};
  let fixed = 0;
  for (const issue of issues) {
    if (issue.source_index < 0) continue;
    const idx = issue.source_index;
    const el = byIndex.get(idx);
    if (!el) continue;
    const fix = autoFix(issue?.code, issue?.details, el?.text);
    if (!fix) continue;
    overrides[idx] = { ...(overrides[idx] || {}), ...fix };
    fixed++;
  }
  return { overrides, fixed };
}

/* ---- live before/after stats ------------------------------------------- */

/* Element kinds that count into the Compare matrix's role buckets (mirrors
   backend E_* sets, not the ROLE_TYPES picker list). */
const HEADING_TYPES = new Set(["title", "chapter", "section", "subsection", "subsubsection"]);
const CAPTION_TYPES = new Set(["caption", "figure_caption", "table_caption"]);
const WORDS_PER_PAGE = 300;

/**
 * Re-derive the backend `processing_stats` keys from the document elements
 * plus any staged overrides so the Compare panel's "after" column updates in
 * real time (role changes shift headings/paragraphs, text fixes shrink
 * characters, and the issue delta follows unresolved findings). Keys we
 * cannot derive locally (headers/footers) are left out — the caller keeps the
 * pipeline's values for those.
 */
export function computeLiveStats(elements, overrides = {}) {
  let words = 0;
  let characters = 0;
  let charactersNoWs = 0;
  let paragraphs = 0;
  let nonEmptyParagraphs = 0;
  let headings = 0;
  let captions = 0;
  let tables = 0;
  let tableCells = 0;
  const addText = (t) => {
    const s = t || "";
    characters += s.length;
    charactersNoWs += s.replace(/\s+/g, "").length;
    words += (s.match(/\S+/g) || []).length;
  };
  for (const el of elements || []) {
    if (el?.kind === "table") {
      tables += 1;
      for (const row of el.rows || []) {
        for (const cell of row || []) {
          addText(cell?.text || "");
          tableCells += 1;
        }
      }
      continue;
    }
    const o = overrides[el?.source_index];
    const role = o?.element_type ?? el?.element_type;
    const text = o?.text !== undefined ? o.text : el?.text ?? "";
    addText(text);
    paragraphs += 1;
    if (text.trim()) nonEmptyParagraphs += 1;
    if (HEADING_TYPES.has(role)) headings += 1;
    if (CAPTION_TYPES.has(role)) captions += 1;
  }
  return {
    words,
    characters,
    characters_no_ws: charactersNoWs,
    paragraphs,
    non_empty_paragraphs: nonEmptyParagraphs,
    headings,
    captions,
    tables,
    table_cells: tableCells,
    pages_estimate: Math.max(1, Math.round(words / WORDS_PER_PAGE)),
  };
}