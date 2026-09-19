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
   Returns { element_type } / { text } patch or null when the rule has no
   one-click fix. `text` is the element's current text, used by spacing fixes. */
export function autoFix(code, details, text) {
  switch (code) {
    case "hierarchy_jump": {
      const target = DEMOTE[details?.jumped_from];
      return target ? { element_type: target } : null;
    }
    case "caption_without_heading":
    case "table_caption_without_table":
      return { element_type: "paragraph" };
    case "double_space":
      // Typography-only (R3-safe): collapse runs of spaces back to one.
      if (text !== undefined && / {2,}/.test(text)) {
        return { text: text.replace(/ {2,}/g, " ") };
      }
      return null;
    case "spacing_mismatch":
      // Formatting-only (content-safe): normalize body paragraph line spacing
      // to the profile value. Resides in paragraph formatting, never in words.
      return { line_spacing: details?.expected ?? 1.5 };
    case "low_confidence":
      return null;
    default:
      return null;
  }
}