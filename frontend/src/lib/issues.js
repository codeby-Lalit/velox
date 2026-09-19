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

export function isFixable(issue) {
  return autoFix(issue?.code, issue?.details) !== null;
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
      return decisions[issue.source_index] !== undefined;
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
      if (text === undefined && elementType === undefined) return null;
      return {
        kind: "paragraph",
        source_index: Number(idx),
        ...(text !== undefined ? { text } : {}),
        ...(elementType !== undefined ? { element_type: elementType } : {}),
      };
    })
    .filter(Boolean);
}

export function autoFixAll(issues, byIndex) {
  const patches = {};
  for (const issue of issues) {
    if (issue.source_index < 0) continue;
    const fix = autoFix(issue?.code, issue?.details);
    if (!fix) continue;
    const el = byIndex.get(issue.source_index);
    const current = el?.element_type;
    if (current && fix.element_type === current) continue;
    patches[issue.source_index] = { ...(patches[issue.source_index] || {}), ...fix };
  }
  return patches;
}