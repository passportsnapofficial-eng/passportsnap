"""Pick three-state thresholds from one or more evaluation runs.

    .venv/Scripts/python -m services.attribute_detection.calibrate_thresholds \
        --inputs fixtures.json openimages.json \
        --max-false-block 0.03 \
        --out services/attribute_detection/thresholds.json

Inputs are the --json files written by evaluate_fixtures.py. Per attribute:

  absent   = lowest score any labelled positive received, minus a margin.
             Below this the model may clear a photo. On the calibration data
             that means zero silent misses by construction.
  present  = lowest score at which the share of labelled negatives scoring
             at or above it stays within --max-false-block. At or above this
             the model may block a photo on its own.

Everything between the two is "unsure" and goes to the customer. The gap is
reported so a wide one (lots of asking) is visible rather than hidden.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

ATTRIBUTES = ["glasses", "hat", "head_covering", "face_mask"]
MARGIN = 0.02
MIN_GAP = 0.05


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Calibrate attribute thresholds from evaluation runs.")
    parser.add_argument("--inputs", nargs="+", required=True, help="evaluate_fixtures --json outputs; append :attr1,attr2 to restrict a file to those attributes")
    parser.add_argument("--max-false-block", type=float, default=0.03)
    parser.add_argument("--out", type=Path, required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    # An input may be restricted to some attributes with "path:attr1,attr2".
    # The mask set, for example, is 128px face crops with the head often cut
    # off: authoritative for masks, misleading for hats and glasses.
    cases: list[dict] = []
    for spec in args.inputs:
        text = str(spec)
        # Split on the LAST colon, and only if what follows looks like an
        # attribute list rather than a path (Windows drive letters have colons).
        head, sep, tail = text.rpartition(":")
        if sep and tail and not any(ch in tail for ch in "\\/.") and head:
            path_text, only = head, tail
        else:
            path_text, only = text, ""
        path = Path(path_text)
        allowed = {name.strip() for name in only.split(",") if name.strip()} if only else None
        data = json.loads(path.read_text(encoding="utf-8"))
        for row in data["cases"]:
            if allowed:
                row = {**row, "labels": {k: v for k, v in row["labels"].items() if k in allowed}, "scores": {k: v for k, v in row["scores"].items() if k in allowed}}
            cases.append({**row, "_source": path.name})

    thresholds: dict[str, dict[str, float]] = {}
    print(f"calibrating on {len(cases)} cases from {len(args.inputs)} run(s); max false block {args.max_false_block:.1%}\n")
    for attribute in ATTRIBUTES:
        relevant = [row for row in cases if attribute in row["scores"]]
        positives = sorted(row["scores"][attribute] for row in relevant if row["labels"].get(attribute))
        negatives = sorted((row["scores"][attribute] for row in relevant if not row["labels"].get(attribute)), reverse=True)

        if positives:
            absent = max(0.05, round(positives[0] - MARGIN, 3))
        else:
            # No positives to protect: stay conservative and keep asking.
            absent = 0.30

        if negatives:
            allowed = int(len(negatives) * args.max_false_block)
            # The (allowed+1)-th highest negative must sit below the threshold.
            present = round(negatives[allowed] + 0.001, 3) if allowed < len(negatives) else 0.99
        else:
            present = 0.70
        present = max(present, absent + MIN_GAP)
        present = min(present, 0.99)

        caught = sum(1 for s in positives if s >= present)
        asked_pos = sum(1 for s in positives if absent < s < present)
        cleared = sum(1 for s in negatives if s <= absent)
        asked_neg = sum(1 for s in negatives if absent < s < present)
        false_block = sum(1 for s in negatives if s >= present)

        thresholds[attribute] = {"present": present, "absent": absent}
        print(f"{attribute.upper()}  positives={len(positives)} negatives={len(negatives)}")
        print(f"  absent <= {absent:.3f}   present >= {present:.3f}   (unsure band width {present - absent:.3f})")
        if positives:
            print(f"  positives: blocked {caught}/{len(positives)}  asked {asked_pos}/{len(positives)}  silent miss {len(positives) - caught - asked_pos}/{len(positives)}")
        if negatives:
            print(f"  negatives: cleared {cleared}/{len(negatives)}  asked {asked_neg}/{len(negatives)}  false block {false_block}/{len(negatives)}")
        print()

    args.out.write_text(json.dumps(thresholds, indent=2), encoding="utf-8")
    print(f"wrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
