"""Score the zero-shot detector against human-labelled fixtures.

    .venv/Scripts/python -m services.attribute_detection.evaluate_fixtures \
        --ground-truth public/test-fixtures/ground-truth.json \
        --fixtures-root public/test-fixtures \
        --json out.json

Ground-truth fields map to detector attributes as:

    glasses       -> glasses
    hat           -> hat
    headCovering  -> head_covering
    faceMask      -> face_mask   (absent from older label files; treated as
                                  all-negative when the field is missing)

Three numbers matter per attribute, and they are reported separately because
one aggregate would hide the failure that actually costs money:

    caught        positives the model marked present   (true blocks)
    asked         positives it marked unsure           (customer is asked)
    silent miss   positives it marked absent           (a sale with a violation)
    false block   negatives it marked present          (a lost compliant sale)

A silent miss is the one number that must be zero.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from collections import defaultdict
from pathlib import Path

from .detector import DEFAULT_THRESHOLDS, AttributeDetector, resolve_state

FIELD_TO_ATTRIBUTE = {
    "glasses": "glasses",
    "hat": "hat",
    "headCovering": "head_covering",
    "faceMask": "face_mask",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate attribute detection against labelled fixtures.")
    parser.add_argument("--ground-truth", type=Path, default=Path("public/test-fixtures/ground-truth.json"))
    parser.add_argument("--fixtures-root", type=Path, default=Path("public/test-fixtures"))
    parser.add_argument("--json", type=Path, default=None, help="Write per-case scores here.")
    parser.add_argument(
        "--thresholds",
        type=Path,
        default=None,
        help="JSON file of {attribute: {present, absent}} to evaluate instead of the defaults.",
    )
    return parser.parse_args()


def load_thresholds(path: Path | None) -> dict[str, dict[str, float]]:
    if not path:
        return DEFAULT_THRESHOLDS
    data = json.loads(path.read_text(encoding="utf-8"))
    merged = {key: dict(value) for key, value in DEFAULT_THRESHOLDS.items()}
    for attribute, values in data.items():
        merged.setdefault(attribute, {}).update(values)
    return merged


def percent(numerator: int, denominator: int) -> str:
    if not denominator:
        return "  n/a"
    return f"{100 * numerator / denominator:5.1f}%"


def main() -> int:
    args = parse_args()
    ground_truth = json.loads(args.ground_truth.read_text(encoding="utf-8"))
    cases = ground_truth["cases"]
    thresholds = load_thresholds(args.thresholds)

    started = time.time()
    detector = AttributeDetector(thresholds=thresholds)
    print(f"model {detector.model_id} on {detector.device}, loaded in {time.time() - started:.1f}s")

    rows: list[dict] = []
    for case in cases:
        image_path = args.fixtures_root / case["file"]
        if not image_path.exists():
            print(f"  skip (missing): {case['file']}", file=sys.stderr)
            continue
        with image_path.open("rb") as handle:
            image = detector.load_image(handle.read())
        results = detector.detect(image)
        rows.append(
            {
                "file": case["file"],
                "skinTone": case.get("skinTone", "unknown"),
                "labels": {attr: bool(case.get(field, False)) for field, attr in FIELD_TO_ATTRIBUTE.items()},
                "scores": {attr: results[attr].score for attr in FIELD_TO_ATTRIBUTE.values()},
            }
        )

    print(f"\nAttribute detection - {len(rows)} labelled cases\n")
    summary: dict[str, dict] = {}
    for field, attribute in FIELD_TO_ATTRIBUTE.items():
        labelled = field in cases[0] if cases else False
        positives = [row for row in rows if row["labels"][attribute]]
        negatives = [row for row in rows if not row["labels"][attribute]]
        state_of = lambda row: resolve_state(row["scores"][attribute], thresholds[attribute])  # noqa: E731

        caught = sum(1 for row in positives if state_of(row) == "present")
        asked = sum(1 for row in positives if state_of(row) == "unsure")
        silent_miss = sum(1 for row in positives if state_of(row) == "absent")
        false_block = sum(1 for row in negatives if state_of(row) == "present")
        neg_asked = sum(1 for row in negatives if state_of(row) == "unsure")

        tag = "" if labelled else "   (no labels in ground truth: all cases treated as negative)"
        print(f"{attribute.upper()}{tag}")
        print(f"  thresholds   present>={thresholds[attribute]['present']:.2f}  absent<={thresholds[attribute]['absent']:.2f}")
        print(f"  positives    {len(positives):3d}   caught {percent(caught, len(positives))}   asked {percent(asked, len(positives))}   SILENT MISS {percent(silent_miss, len(positives))}")
        print(f"  negatives    {len(negatives):3d}   cleared {percent(len(negatives) - false_block - neg_asked, len(negatives))}   asked {percent(neg_asked, len(negatives))}   FALSE BLOCK {percent(false_block, len(negatives))}")

        if positives:
            pos_scores = sorted(row["scores"][attribute] for row in positives)
            neg_scores = sorted((row["scores"][attribute] for row in negatives), reverse=True)
            print(f"  positive scores  min {pos_scores[0]:.3f}  median {pos_scores[len(pos_scores) // 2]:.3f}  max {pos_scores[-1]:.3f}")
            print(f"  negative scores  max {neg_scores[0]:.3f}  top3 {[round(s, 3) for s in neg_scores[:3]]}")
            # Where the thresholds would have to sit for zero misses / zero false blocks on THIS set.
            print(f"  zero-silent-miss needs absent <= {pos_scores[0]:.3f}; zero-false-block needs present >= {neg_scores[0] + 0.001:.3f}")

        by_tone: dict[str, dict[str, int]] = defaultdict(lambda: {"pos": 0, "caught": 0, "asked": 0, "miss": 0, "neg": 0, "fb": 0})
        for row in rows:
            tone = row["skinTone"]
            state = state_of(row)
            if row["labels"][attribute]:
                by_tone[tone]["pos"] += 1
                by_tone[tone]["caught" if state == "present" else "asked" if state == "unsure" else "miss"] += 1
            else:
                by_tone[tone]["neg"] += 1
                by_tone[tone]["fb"] += state == "present"
        if positives:
            print("  by skin tone:")
            for tone in sorted(by_tone):
                t = by_tone[tone]
                print(f"    {tone:<8} positives {t['pos']:2d}  caught {t['caught']}  asked {t['asked']}  miss {t['miss']}   negatives {t['neg']:2d}  false block {t['fb']}")
        print()

        summary[attribute] = {
            "positives": len(positives),
            "negatives": len(negatives),
            "caught": caught,
            "asked": asked,
            "silentMiss": silent_miss,
            "falseBlock": false_block,
            "negativesAsked": neg_asked,
        }

    misses = [
        (attr, row["file"], round(row["scores"][attr], 3))
        for attr in FIELD_TO_ATTRIBUTE.values()
        for row in rows
        if row["labels"][attr] and resolve_state(row["scores"][attr], thresholds[attr]) == "absent"
    ]
    if misses:
        print("SILENT MISSES (positive labelled, model said absent):")
        for attr, file, score in misses:
            print(f"  {attr:<14} {score:.3f}  {file}")
    else:
        print("No silent misses.")

    if args.json:
        args.json.write_text(json.dumps({"thresholds": thresholds, "summary": summary, "cases": rows}, indent=2), encoding="utf-8")
        print(f"\nwrote {args.json}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
