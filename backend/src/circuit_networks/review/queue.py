"""Human review queue (F101). Resolutions are applied to classifications."""

from __future__ import annotations

from dataclasses import dataclass

from ..core import constants as C
from ..structure.model import Classification, StructureMap

ACCEPT = "accept"
CHANGE = "change"
REJECT_TO_PARAGRAPH = "reject_to_paragraph"


@dataclass
class ReviewDecision:
    source_index: int
    action: str
    new_element_type: str | None = None
    reviewer_note: str = ""

    def apply(self, classification: Classification) -> Classification:
        if self.action == ACCEPT:
            return Classification(
                element_type=classification.element_type,
                confidence=max(classification.confidence, C.AUTO_THRESHOLD + 0.01),
                reason_codes=classification.reason_codes + ["human_review_accepted"],
                source_index=classification.source_index,
                subtype=classification.subtype,
            )
        if self.action == CHANGE and self.new_element_type:
            return Classification(
                element_type=self.new_element_type,
                confidence=C.AUTO_THRESHOLD + 0.01,
                reason_codes=classification.reason_codes + ["human_review_changed"],
                source_index=classification.source_index,
                subtype=classification.subtype,
            )
        if self.action == REJECT_TO_PARAGRAPH:
            return Classification(
                element_type=C.E_PARAGRAPH,
                confidence=1.0,
                reason_codes=classification.reason_codes + ["human_review_rejected"],
                source_index=classification.source_index,
            )
        return classification


def list_review_queue(structure: StructureMap) -> list[Classification]:
    return structure.review_items()


def apply_decisions(
    structure: StructureMap, decisions: list[ReviewDecision]
) -> StructureMap:
    """Return a new StructureMap with review decisions applied (idempotent)."""
    applied = StructureMap()
    applied.classifications = dict(structure.classifications)
    for decision in decisions:
        current = applied.get(decision.source_index)
        if current is not None:
            applied.add(decision.source_index, decision.apply(current))
    return applied