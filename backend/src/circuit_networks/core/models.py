"""Shared domain models for the document pipeline.

Keeping a pure data model (decoupled from python-docx objects) makes
classification, preview, and integrity checks easy to test in isolation.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class RunInfo:
    """A styled span of text inside a paragraph."""

    text: str  # deep-copied original text, never modified
    bold: bool | None = None
    italic: bool | None = None
    underline: bool | None = None
    size: float | None = None  # half-points, None = inherit
    font_name: str | None = None
    all_caps: bool | None = None
    style_name: str | None = None


@dataclass
class ParagraphInfo:
    """A paragraph extracted from the source document."""

    index: int  # ordinal position among all body elements
    text: str  # concatenated run text (display/window view)
    original_text: str  # exact source text (may include non-breaking spaces)
    style_name: str | None
    runs: list[RunInfo] = field(default_factory=list)
    alignment: int | None = None
    outline_level: int | None = None
    spacing_before: float | None = None
    spacing_after: float | None = None
    first_line_indent: float | None = None
    is_heading_style: bool = False
    heading_level: int | None = None
    is_table: bool = False

    @property
    def word_count(self) -> int:
        return len(self.text.split())


@dataclass
class CellInfo:
    text: str
    row_index: int
    col_index: int


@dataclass
class TableInfo:
    """A table extracted from the document body."""

    index: int
    rows: list[list[CellInfo]] = field(default_factory=list)
    caption_before: ParagraphInfo | None = None

    @property
    def cell_texts(self) -> list[str]:
        return [c.text for row in self.rows for c in row]

    @property
    def n_rows(self) -> int:
        return len(self.rows)


@dataclass
class DocumentMetadata:
    title: str | None = None
    author: str | None = None
    created: str | None = None
    modified: str | None = None
    language: str | None = None


@dataclass
class DocumentModel:
    """Normalized internal representation of a DOCX."""

    paragraphs: list[ParagraphInfo] = field(default_factory=list)
    tables: list[TableInfo] = field(default_factory=list)
    metadata: DocumentMetadata = field(default_factory=DocumentMetadata)
    source_path: str | None = None
    source_size_bytes: int | None = None
    source_sha256: str | None = None
    # global interleaved body order: list of ("paragraph", idx) / ("table", idx)
    body_order: list[tuple[str, int]] = field(default_factory=list)

    def body_elements(self) -> list[Any]:
        """In-order stream of paragraphs and tables (tables at correct positions)."""
        # Tables are appended after the paragraph they follow when the parser
        # cannot preserve interleaving; parser keeps order as is.
        return [*self.paragraphs, *self.tables]