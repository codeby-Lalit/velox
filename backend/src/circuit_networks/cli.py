"""Command-line interface for the offline pipeline.

Usage:
    python -m circuit_networks.cli <input.docx> --profile profiles/default.json [--out out/] [--review <action>,<index>,<type>]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .core.config import ProfileConfig
from .core.paths import profiles_dir
from .core.pipeline import run_pipeline, version_string
from .review.queue import ReviewDecision


def _parse_reviews(specs: list[str]) -> list[ReviewDecision]:
    decisions: list[ReviewDecision] = []
    for spec in specs or []:
        parts = spec.split(",")
        action = parts[0]
        index = int(parts[1])
        new_type = parts[2] if len(parts) > 2 else None
        decisions.append(
            ReviewDecision(
                source_index=index, action=action, new_element_type=new_type
            )
        )
    return decisions


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="circuit-networks")
    parser.add_argument("input", help="Input .docx manuscript")
    parser.add_argument(
        "--profile",
        default=str(profiles_dir() / "default.json"),
        help="Publisher profile JSON path",
    )
    parser.add_argument("--out", default="out", help="Output directory")
    parser.add_argument(
        "--review", action="append", help="accept,<index> | change,<index>,<type> | reject_to_paragraph,<index>"
    )
    parser.add_argument("--version", action="version", version=version_string())
    args = parser.parse_args(argv)

    profile_path = Path(args.profile)
    if not profile_path.exists():
        print(f"Profile not found: {profile_path}", file=sys.stderr)
        return 2
    profile = ProfileConfig.from_file(profile_path)

    decisions = _parse_reviews(args.review)
    result = run_pipeline(args.input, profile, output_dir=args.out, decisions=decisions)

    if result.error:
        print(f"FAILED at stage '{result.stage}': {result.error}", file=sys.stderr)
        return 1

    print("Pipeline complete:")
    print(f"  Output DOCX : {result.output_docx}")
    print(f"  Audit JSON  : {result.audit_json}")
    print(f"  Audit HTML  : {result.audit_html}")
    print(f"  Integrity   : {result.integrity_status}")
    return 0


if __name__ == "__main__":
    sys.exit(main())