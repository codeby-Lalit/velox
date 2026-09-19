"""Structural classification results.

Every classification carries element_type, confidence and reason_codes so
that decisions stay explainable (R5/R6).
"""

from __future__ import annotations

from dataclasses import dataclass, field

from ..core import constants as C


@dataclass
class Classification:
    element_type: str
    confidence: float
    reason_codes: list[str] = field(default_factory=list)
    source_index: int = -1  # paragraph index (or table index) in source
    subtype: str | None = None  # e.g. numbering string of a heading

    @property
    def is_heading(self) -> bool:
        return self.element_type in C.HEADING_KINDS

    @property
    def is_caption(self) -> bool:
        return self.element_type in C.CAPTION_KINDS

    @property
    def needs_review(self) -> bool:
        return self.confidence <= C.AUTO_THRESHOLD

    def to_json(self) -> dict:
        return {
            "element_type": self.element_type,
            "confidence": round(self.confidence, 4),
            "reason_codes": sorted(self.reason_codes),
            "source_index": self.source_index,
            "subtype": self.subtype,
            "review_required": self.confidence <= C.REVIEW_THRESHOLD,
            "review_suggested": (
                C.REVIEW_THRESHOLD < self.confidence < C.AUTO_THRESHOLD
            ),
        }


@dataclass
class StructureMap:
    """Ordered map of body element -> classification.

    Keys are ``("paragraph", idx)`` or ``("table", idx)`` so paragraph and
    table indices never collide.
    """

    classifications: dict[tuple[str, int], Classification] = field(default_factory=dict)

    @staticmethod
    def _key(index: int | tuple[str, int]) -> tuple[str, int]:
        if isinstance(index, tuple):
            return index
        return ("paragraph", index)

    def add(self, index: int | tuple[str, int], classification: Classification) -> None:
        self.classifications[self._key(index)] = classification

    def get(self, index: int | tuple[str, int]) -> Classification | None:
        return self.classifications.get(self._key(index))

    def review_items(self) -> list[Classification]:
        return [c for c in self.classifications.values() if c.needs_review]

    def summary(self) -> dict[str, int]:
        counts: dict[str, int] = {}
        for c in self.classifications.values():
            counts[c.element_type] = counts.get(c.element_type, 0) + 1
        return counts