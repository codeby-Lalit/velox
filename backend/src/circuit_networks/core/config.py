"""Publisher profile configuration (R7). Profiles are stored locally as JSON."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field

from .constants import AUTO_THRESHOLD, REVIEW_THRESHOLD
from .version import PROFILE_SCHEMA_VERSION


class FontSpec(BaseModel):
    name: str = "Times New Roman"
    size: float = 12.0
    bold: bool = False
    italic: bool = False
    color: str | None = None


class SpacingSpec(BaseModel):
    before: float = 0.0
    after: float = 6.0
    line: float = 1.5
    first_line_indent: float = 0.0
    widow_control: bool = True


class ParagraphSpec(BaseModel):
    alignment: str = "justify"  # left|center|right|justify
    spacing: SpacingSpec = Field(default_factory=SpacingSpec)


class HeadingSpec(ParagraphSpec):
    font: FontSpec = Field(default_factory=lambda: FontSpec(name="Times New Roman", size=16, bold=True))
    keep_with_next: bool = True
    page_break: bool = False
    alignment: str = "left"  # headings default to left, not justify


class SectionPageSpec(BaseModel):
    size: str = "A4"
    orientation: str = "portrait"
    margins: dict[str, float] = Field(
        default_factory=lambda: {"top": 2.54, "bottom": 2.54, "left": 3.18, "right": 3.18}
    )
    gutter: float = 0.0
    footer_page_number: bool = False


class TableSpec(BaseModel):
    style: str = "Table Grid"
    header_bold: bool = True
    cant_split: bool = True
    header_repeat: bool = True
    borders: str = "grid"  # grid|horizontal (clean top/bottom/header separator lines only)
    cell_margins: dict[str, float] = Field(
        default_factory=lambda: {"top": 0.05, "bottom": 0.05, "left": 0.1, "right": 0.1}
    )


class ListSpec(BaseModel):
    """Professional bullet/numbered-list typography."""
    enabled: bool = True
    indent: float = 0.63
    hanging: float = 0.63
    item_spacing_before: float = 0.0
    item_spacing_after: float = 3.0


class ReferencesSpec(BaseModel):
    """Scholarly back-matter typography (hanging indent, compact line)."""
    enabled: bool = False
    hanging_indent: float = 1.27
    font_name: str = "Times New Roman"
    font_size: float = 10.5
    line_spacing: float = 1.15
    heading_markers: tuple[str, ...] = ("references", "bibliography", "works cited", "literature")


class StrictSpec(BaseModel):
    """Toggle professional publication-level validation checks."""
    enabled: bool = True
    allowed_fonts: tuple[str, ...] = ("times new roman", "garamond", "georgia", "book antiqua", "libertinus")


class ThresholdsSpec(BaseModel):
    auto: float = AUTO_THRESHOLD
    review: float = REVIEW_THRESHOLD


class ProfileConfig(BaseModel):
    """Typed publisher profile."""

    id: str = "default"
    name: str = "Default Publisher"
    description: str = ""
    schema_version: int = PROFILE_SCHEMA_VERSION
    thresholds: ThresholdsSpec = Field(default_factory=ThresholdsSpec)
    page: SectionPageSpec = Field(default_factory=SectionPageSpec)
    fonts: dict[str, FontSpec] = Field(default_factory=dict)
    body: ParagraphSpec = Field(default_factory=ParagraphSpec)
    captions: ParagraphSpec = Field(default_factory=lambda: ParagraphSpec(alignment="left"))
    headings: dict[str, HeadingSpec] = Field(default_factory=dict)
    tables: TableSpec = Field(default_factory=TableSpec)
    lists: ListSpec = Field(default_factory=ListSpec)
    references: ReferencesSpec = Field(default_factory=ReferencesSpec)
    strict: StrictSpec = Field(default_factory=StrictSpec)

    def heading_spec(self, level: int) -> HeadingSpec:
        """Heading style for 0-based level with fallback to defaults."""
        plan = {
            0: FontSpec(name="Times New Roman", size=18, bold=True),
            1: FontSpec(name="Times New Roman", size=16, bold=True),
            2: FontSpec(name="Times New Roman", size=14, bold=True),
            3: FontSpec(name="Times New Roman", size=12, bold=True, italic=True),
            4: FontSpec(name="Times New Roman", size=12, bold=True),
        }
        candidates = {
            "h0": plan[0],
            "h1": plan[1],
            "h2": plan[2],
            "h3": plan[3],
            "h4": plan[4],
        }
        for key in (f"h{level}", f"h{min(level, 4)}"):
            spec = self.headings.get(key)
            if spec is not None:
                return spec
        base = plan[min(level, 4)]
        return HeadingSpec(
            font=base,
            spacing=SpacingSpec(
                before=18 if level <= 1 else 14,
                after=8 if level <= 1 else 6,
                line=1.15,
            ),
        )

    def font_for(self, key: str, default_name: str = "Times New Roman", default_size: float = 12.0) -> FontSpec:
        return self.fonts.get(key, FontSpec(name=default_name, size=default_size))

    @classmethod
    def from_file(cls, path: str | Path) -> "ProfileConfig":
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        return cls.model_validate(data)

    def to_dict(self) -> dict:
        return json.loads(self.model_dump_json())