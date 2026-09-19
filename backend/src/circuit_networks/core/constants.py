"""Validation thresholds and engine-wide constants.

Trust boundary: a classification ABOVE AUTO_THRESHOLD is trusted (never
flagged for review, auto-applied). At or below it the classification needs
human review (manual).
"""

from __future__ import annotations

AUTO_THRESHOLD = 0.60
REVIEW_THRESHOLD = 0.60

REASON_CODES = {
    "title_position",
    "single_short_line",
    "bold",
    "italic",
    "all_caps",
    "large_font",
    "heading_style",
    "numbering_pattern",
    "roman_numbering",
    "spacing_before",
    "spacing_after",
    "small_percent_after_or_before",
    "similarity_to_headings",
    "short_line",
    "non_heading_font_discontinuity",
    "table_caption_keyword",
    "figure_caption_keyword",
    "caption_numbering_pattern",
    "adjacent_numbered_reference",
    "starts_with_caption_label",
}

# Element types
E_TITLE = "title"
E_CHAPTER = "chapter"
E_SECTION = "section"
E_SUBSECTION = "subsection"
E_SUBSUBSECTION = "subsubsection"
E_PARAGRAPH = "paragraph"
E_TABLE = "table"
E_FIGURE_CAPTION = "figure_caption"
E_TABLE_CAPTION = "table_caption"
E_CAPTION = "caption"
E_FRONTMATTER = "front_matter"
E_BACKMATTER = "back_matter"

# Structural element kinds assigned to paragraphs
HEADING_KINDS = {E_TITLE, E_CHAPTER, E_SECTION, E_SUBSECTION, E_SUBSUBSECTION}
CAPTION_KINDS = {E_FIGURE_CAPTION, E_TABLE_CAPTION, E_CAPTION}

# Word style targeted for each detected element type (single source of truth)
TYPE_TO_HEADING_STYLE = {
    E_TITLE: "Title",
    E_CHAPTER: "Heading 1",
    E_SECTION: "Heading 2",
    E_SUBSECTION: "Heading 3",
    E_SUBSUBSECTION: "Heading 4",
}

# Heading index used to pick per-level formatting specs from a profile
TYPE_TO_LEVEL_INDEX = {
    E_TITLE: 0,
    E_CHAPTER: 1,
    E_SECTION: 2,
    E_SUBSECTION: 3,
    E_SUBSUBSECTION: 4,
}