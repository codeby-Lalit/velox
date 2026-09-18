export const ROLE_TYPES = [
  "title",
  "chapter",
  "section",
  "subsection",
  "subsubsection",
  "table_caption",
  "figure_caption",
  "paragraph",
];

const DEMOTE = {
  1: "section",
  2: "subsection",
  3: "subsubsection",
};

/* Client-side auto-fix suggestions for preflight rules (F110).
   Returns { element_type } patch or null when the rule has no one-click fix. */
export function autoFix(code, details) {
  switch (code) {
    case "hierarchy_jump": {
      const target = DEMOTE[details?.jumped_from];
      return target ? { element_type: target } : null;
    }
    case "caption_without_heading":
    case "table_caption_without_table":
      return { element_type: "paragraph" };
    case "low_confidence":
      return null;
    default:
      return null;
  }
}