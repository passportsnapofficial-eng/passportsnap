"""Add specific Open Images images (by ID) to the evaluation manifest.

    .venv-data/Scripts/python -m services.attribute_detection.prepare_openimages_ids \
        --ids-file ids.csv --output-dir services/attribute_detection/data/openimages \
        --group headCovering

ids.csv rows are "split,ImageID,LabelMID" - the verified-present rows pulled
from oidv7-{val,test}-annotations-human-imagelabels.csv. This exists because
FiftyOne's class filter also returns verified-ABSENT labels, and for rare
classes (hijab, turban, masks) those swamp the sample budget, so the normal
prepare script finds nothing. Here the positives are chosen first and the
images fetched by ID.

Faces are located the same way as in prepare_openimages_eval.py (Open Images
box first, YuNet fallback, exactly one face), crops are head-and-shoulders,
and the cases are merged into the existing manifest under --group.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path

from PIL import Image

from .prepare_openimages_eval import ATTRIBUTE_CLASSES, FaceFinder, crop_head_and_shoulders

MID_TO_FIELD = {
    "/m/0hw5w": "headCovering",  # Hijab
    "/m/056hj1": "headCovering",  # Headscarf
    "/m/01pbfj": "headCovering",  # Turban
    "/m/021q4q": "headCovering",  # Kippah
    # NOTE: Open Images' "Face mask" (/m/0hzqk8z) is the American-football
    # face guard, not a medical mask - every verified-present train image was
    # a football player or referee. It must not feed the medical-mask label;
    # masks are evaluated on the separate facemask set instead.
    "/m/04b_zc": "faceMask",  # Respirator (0 verified-present images found)
    "/m/0jyfg": "glasses",
    "/m/017ftj": "glasses",  # Sunglasses
    "/m/02dl1y": "hat",
}
SPLIT_NAMES = {"val": "validation", "validation": "validation", "test": "test", "train": "train"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ids-file", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--group", required=True)
    parser.add_argument("--limit", type=int, default=0)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    import fiftyone.zoo as foz

    by_split: dict[str, dict[str, set[str]]] = defaultdict(lambda: defaultdict(set))
    for line in args.ids_file.read_text(encoding="utf-8").splitlines():
        parts = line.strip().split(",")
        if len(parts) != 3:
            continue
        split, image_id, mid = parts
        if mid in MID_TO_FIELD:
            by_split[SPLIT_NAMES.get(split, split)][image_id].add(MID_TO_FIELD[mid])

    manifest_path = args.output_dir / "ground-truth.json"
    images_dir = args.output_dir / "images"
    images_dir.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {"cases": []}
    cases = [case for case in manifest["cases"] if case.get("group") != args.group]
    seen = {case.get("sourceId") for case in cases}

    finder = FaceFinder()
    counts: Counter[str] = Counter()
    rejected: Counter[str] = Counter()
    taken = 0
    for split, wanted in by_split.items():
        ids = sorted(wanted)
        print(f"{split}: fetching {len(ids)} images by id")
        # The train split's box file is over a gigabyte and these rare classes
        # mostly have no face boxes anyway; load labels only and let YuNet find
        # the face. The evaluation splits are small, so keep their boxes.
        label_types = ["classifications"] if split == "train" else ["classifications", "detections"]
        dataset = foz.load_zoo_dataset(
            "open-images-v7",
            split=split,
            label_types=label_types,
            image_ids=ids,
            dataset_name=f"oi-ids-{args.group}-{split}",
        )
        for sample in dataset:
            image_id = Path(sample.filepath).stem
            if image_id in seen or image_id not in wanted:
                continue
            if args.limit and taken >= args.limit:
                break
            try:
                image = Image.open(sample.filepath).convert("RGB")
            except Exception:  # noqa: BLE001
                rejected["unreadable"] += 1
                continue
            box, source = finder.single_face(sample, image)
            if box is None:
                rejected[source] += 1
                continue
            labels = {field: False for field in ATTRIBUTE_CLASSES}
            for field in wanted[image_id]:
                labels[field] = True
            name = f"{args.group}-{image_id}.jpg"
            crop_head_and_shoulders(image, box).save(images_dir / name, "JPEG", quality=92)
            cases.append(
                {
                    "file": f"images/{name}",
                    **labels,
                    "skinTone": "unknown",
                    "notes": f"Open Images {split} {image_id}; face via {source}; verified-present {sorted(wanted[image_id])}",
                    "group": args.group,
                    "sourceId": image_id,
                    "source": "open-images-v7",
                    "license": "annotations CC BY 4.0 (Google LLC); images CC BY 2.0",
                }
            )
            seen.add(image_id)
            counts[split] += 1
            taken += 1

    manifest["cases"] = cases
    manifest.setdefault("counts", {})[args.group] = taken
    manifest.setdefault("rejected", {})[args.group] = dict(rejected)
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"added {taken} {args.group} cases ({dict(counts)}); rejected {dict(rejected)}; manifest now {len(cases)} cases")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
