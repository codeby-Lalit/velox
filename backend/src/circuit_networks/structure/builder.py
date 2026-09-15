"""Build a hierarchical structure map (F003) from classifications."""

from __future__ import annotations

from dataclasses import dataclass, field

from ..core import constants as C
from ..core.models import DocumentModel
from .model import Classification, StructureMap


@dataclass
class StructureNode:
    element_type: str
    path: str
    children: list["StructureNode"] = field(default_factory=list)
    source_indices: list[int] = field(default_factory=list)
    confidence: float = 1.0


def build_hierarchy(
    model: DocumentModel, structure: StructureMap
) -> list[StructureNode]:
    """Return a forest of top-level nodes based on classified body elements.

    Paragraphs are grouped under their nearest higher-or-equal heading.
    Captions are attached to the phase of the nearest preceding heading.
    Tables are placed in order at the cursor of the most recent heading.
    """
    roots: list[StructureNode] = []
    stack: list[StructureNode] = []
    heading_weights = {
        C.E_TITLE: 0,
        C.E_CHAPTER: 1,
        C.E_SECTION: 2,
        C.E_SUBSECTION: 3,
        C.E_SUBSUBSECTION: 4,
    }

    def _attach(node: StructureNode, weight: int) -> None:
        while stack and heading_weights.get(stack[-1].element_type, 99) >= weight:
            stack.pop()
        if stack:
            stack[-1].children.append(node)
        else:
            roots.append(node)

    for kind, idx in model.body_order:
        classification = structure.get((kind, idx))
        etype = classification.element_type if classification else C.E_PARAGRAPH
        if etype in heading_weights:
            node = StructureNode(
                element_type=etype,
                path=f"{etype}-{idx}",
                source_indices=[idx],
                confidence=classification.confidence if classification else 1.0,
            )
            _attach(node, heading_weights[etype])
            stack.append(node)
        elif etype == C.E_TABLE:
            node = StructureNode(
                element_type=C.E_TABLE,
                path=f"table-{idx}",
                source_indices=[idx],
            )
            _attach(node, heading_weights.get(C.E_PARAGRAPH, 99))
        elif classification and classification.is_caption:
            node = StructureNode(
                element_type=etype,
                path=f"{etype}-{idx}",
                source_indices=[idx],
                confidence=classification.confidence,
            )
            _attach(node, heading_weights.get(C.E_PARAGRAPH, 99))
        else:
            node = StructureNode(
                element_type=C.E_PARAGRAPH,
                path=f"paragraph-{idx}",
                source_indices=[idx],
            )
            _attach(node, heading_weights.get(C.E_PARAGRAPH, 99))

    return roots


def outline(model: DocumentModel, structure: StructureMap) -> list[dict]:
    """Flat, display-friendly outline: heading rows and paragraph counts."""
    out: list[dict] = []
    weights = heading_weights()

    def recurse(nodes: list[StructureNode], depth: int) -> None:
        for node in nodes:
            if node.element_type in weights:
                out.append(
                    {
                        "depth": depth,
                        "element_type": node.element_type,
                        "source_index": node.source_indices[0]
                        if node.source_indices
                        else None,
                        "text": _heading_text(model, structure, node),
                        "confidence": round(node.confidence, 4),
                        "children_paragraph_count": _paragraph_count(node),
                    }
                )
            recurse(node.children, depth + 1)

    recurse(build_hierarchy(model, structure), 0)
    return out


def heading_weights() -> dict[str, int]:
    return {
        C.E_TITLE: 0,
        C.E_CHAPTER: 1,
        C.E_SECTION: 2,
        C.E_SUBSECTION: 3,
        C.E_SUBSUBSECTION: 4,
    }


def _heading_text(model: DocumentModel, structure: StructureMap, node: StructureNode) -> str:
    idx = node.source_indices[0] if node.source_indices else -1
    for p in model.paragraphs:
        if p.index == idx:
            return p.text
    return ""


def _paragraph_count(node: StructureNode) -> int:
    """Count non-heading paragraph leaves reachable from this node."""
    count = 0
    stack = [node]
    while stack:
        current = stack.pop()
        for child in current.children:
            if child.element_type == C.E_PARAGRAPH:
                count += 1
            elif child.children:
                stack.append(child)
    return count