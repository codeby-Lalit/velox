"""Preflight + review + structure builder tests."""

from circuit_networks.core import constants as C
from circuit_networks.classifier.heading import classify_document
from circuit_networks.parser.docx_parser import parse_docx
from circuit_networks.preflight.engine import run_preflight
from circuit_networks.review.queue import ReviewDecision, apply_decisions
from circuit_networks.structure.builder import build_hierarchy, outline


def test_preflight_runs_clean_on_manuscript(manuscript):
    model = parse_docx(str(manuscript))
    structure = classify_document(model)
    issues = run_preflight(model, structure)
    codes = {i.code for i in issues}
    # no hierarchy jumps expected in the clean manuscript
    assert "hierarchy_jump" not in codes
    assert "no_headings" not in codes


def test_preflight_detects_hierarchy_jump(flat_document):
    from circuit_networks.structure.model import Classification, StructureMap

    model = parse_docx(str(flat_document))
    # simulate a heading hierarchy with a level skip: section -> subsubsection
    structure = StructureMap()
    structure.add(
        ("paragraph", 0),
        Classification(
            element_type=C.E_SECTION,
            confidence=0.95,
            source_index=0,
        ),
    )
    structure.add(
        ("paragraph", 1),
        Classification(
            element_type=C.E_SUBSUBSECTION,
            confidence=0.95,
            source_index=1,
        ),
    )
    issues = run_preflight(model, structure)
    assert any(i.code == "hierarchy_jump" for i in issues)


def test_preflight_no_headings_detected(flat_document):
    model = parse_docx(str(flat_document))
    structure = classify_document(model)
    issues = run_preflight(model, structure)
    assert any(i.code == "no_headings" for i in issues)


def test_review_apply_accept_raises_confidence(manuscript):
    model = parse_docx(str(manuscript))
    structure = classify_document(model)
    reviewed = []
    for (kind, idx), c in structure.classifications.items():
        if c.is_heading and c.confidence < 0.9:
            reviewed.append(
                ReviewDecision(source_index=idx, action="accept")
            )
            break
    if reviewed:
        applied = apply_decisions(structure, reviewed)
        assert applied.get(reviewed[0].source_index).confidence >= 0.9


def test_review_reject_to_paragraph(manuscript):
    model = parse_docx(str(manuscript))
    structure = classify_document(model)
    target = None
    for (kind, idx), c in structure.classifications.items():
        if c.is_heading and c.confidence < 0.9:
            target = idx
            break
    if target is not None:
        applied = apply_decisions(
            structure, [ReviewDecision(source_index=target, action="reject_to_paragraph")]
        )
        assert applied.get(target).element_type == C.E_PARAGRAPH
        assert "human_review_rejected" in applied.get(target).reason_codes


def test_pipeline_records_review_decisions_in_audit(manuscript, tmp_path):
    """R16: review decisions must be recorded in the audit payload and clear
    the decided item from the review queue after a re-run."""
    from circuit_networks.core.config import ProfileConfig
    from circuit_networks.core.pipeline import run_pipeline

    profile = ProfileConfig()
    first = run_pipeline(str(manuscript), profile, output_dir=str(tmp_path / "out"))
    assert first.error is None, first.error

    target = None
    for it in first.payload()["review"]["items"]:
        if it["confidence"] < C.REVIEW_THRESHOLD:
            target = it["source_index"]
            break

    decision = (
        ReviewDecision(source_index=target, action="accept")
        if target is not None
        else ReviewDecision(source_index=0, action="accept")
    )
    reviewed = run_pipeline(
        str(manuscript),
        profile,
        output_dir=str(tmp_path / "out2"),
        decisions=[decision],
    )
    assert reviewed.error is None, reviewed.error

    payload = reviewed.payload()
    items = payload["review"]["decisions"]["items"]
    assert any(
        d["source_index"] == decision.source_index and d["action"] == "accept"
        for d in items
    )
    if target is not None:
        assert not any(
            it["source_index"] == target for it in payload["review"]["items"]
        )


def test_builder_hierarchy(manuscript):
    model = parse_docx(str(manuscript))
    structure = classify_document(model)
    roots = build_hierarchy(model, structure)
    assert len(roots) >= 1

    def find(node, target):
        if node.element_type == target:
            return node
        for child in node.children:
            found = find(child, target)
            if found:
                return found
        return None

    intro = None
    for root in roots:
        intro = find(root, C.E_SECTION)
        if intro:
            break
    assert intro is not None
    # the intro section should contain a subsection child
    assert any(c.element_type == C.E_SUBSECTION for c in intro.children)


def test_outline_depths(manuscript):
    model = parse_docx(str(manuscript))
    structure = classify_document(model)
    rows = outline(model, structure)
    assert rows[0]["depth"] == 0
    for row in rows[1:]:
        assert row["depth"] >= 0
