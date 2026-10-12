"""Build a labelled, passport-style evaluation set from Open Images V7.

    .venv/Scripts/python -m services.attribute_detection.prepare_openimages_eval \
        --output-dir services/attribute_detection/data/openimages \
        --per-group 120

Why Open Images: its annotations are CC BY 4.0 and the images are listed as
CC BY 2.0, so both are usable for a commercial product with attribution. Its
image-level labels include every attribute this product must catch - glasses,
sunglasses, the whole hat family, hijab, headscarf, turban, kippah, face mask
and respirator - which CelebA (non-commercial) cannot legally provide.

Each sample is cropped to its single "Human face" box with head-and-shoulders
margin so the evaluation images look like what customers actually upload, not
like street scenes. Images with more than one face are dropped: an image-level
label only says the attribute appears somewhere in the picture, and with two
people we could not tell whose head it is on.

The output is a ground-truth.json in the same shape as
public/test-fixtures/ground-truth.json so evaluate_fixtures.py runs on it
unchanged.
"""

from __future__ import annotations

import argparse
import json
import random
from collections import Counter
from pathlib import Path

from PIL import Image

# Open Images display names -> our attribute fields.
ATTRIBUTE_CLASSES: dict[str, list[str]] = {
    "glasses": ["Glasses", "Sunglasses", "Goggles"],
    "hat": ["Hat", "Baseball cap", "Beanie", "Knit cap", "Cap", "Fedora", "Cowboy hat", "Sun hat", "Sombrero"],
    "headCovering": ["Hijab", "Headscarf", "Turban", "Kippah"],
    "faceMask": ["Face mask", "Respirator"],
}
ALL_ATTRIBUTE_CLASSES = sorted({name for names in ATTRIBUTE_CLASSES.values() for name in names})
FACE_CLASS = "Human face"
CROP_SIZE = 600


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prepare an Open Images evaluation set for attribute detection.")
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--per-group", type=int, default=120, help="Target images per attribute group and for the clean group.")
    parser.add_argument("--split", default="validation", choices=["train", "validation", "test"])
    parser.add_argument("--seed", type=int, default=51)
    return parser.parse_args()


def attribute_labels(positive: set[str]) -> dict[str, bool]:
    return {field: any(name in positive for name in names) for field, names in ATTRIBUTE_CLASSES.items()}


def crop_head_and_shoulders(image: Image.Image, box: list[float]) -> Image.Image:
    """box is [x, y, w, h] in relative coordinates (Open Images / FiftyOne style)."""
    width, height = image.size
    x, y, w, h = box
    # Headroom above the crown, shoulders below the chin, and width to match a
    # square passport frame around the face.
    top = max(0.0, y - h * 0.75)
    bottom = min(1.0, y + h + h * 0.9)
    side = (bottom - top) * (width / height) / 2 if width else 0.5
    cx = x + w / 2
    left = max(0.0, cx - side / 2 * (height / width))
    right = min(1.0, cx + side / 2 * (height / width))
    crop = image.crop((int(left * width), int(top * height), int(right * width), int(bottom * height)))
    # Square it the same way the app does: fill, centred.
    cw, ch = crop.size
    edge = min(cw, ch)
    crop = crop.crop(((cw - edge) // 2, (ch - edge) // 2, (cw - edge) // 2 + edge, (ch - edge) // 2 + edge))
    return crop.resize((CROP_SIZE, CROP_SIZE), Image.LANCZOS)


def main() -> int:
    args = parse_args()
    random.seed(args.seed)

    import fiftyone as fo  # noqa: F401 - imported for its side effects (db startup)
    import fiftyone.zoo as foz

    images_dir = args.output_dir / "images"
    images_dir.mkdir(parents=True, exist_ok=True)

    cases: list[dict] = []
    seen: set[str] = set()
    counts: Counter[str] = Counter()

    def ingest(dataset, group: str, want_positive: str | None, limit: int) -> None:
        taken = 0
        samples = list(dataset)
        random.shuffle(samples)
        for sample in samples:
            if taken >= limit:
                break
            if sample.id in seen:
                continue
            detections = sample.detections.detections if sample.detections else []
            faces = [d for d in detections if d.label == FACE_CLASS]
            if len(faces) != 1:
                continue
            positive = {c.label for c in (sample.positive_labels.classifications if sample.positive_labels else [])}
            negative = {c.label for c in (sample.negative_labels.classifications if sample.negative_labels else [])}
            labels = attribute_labels(positive)
            if want_positive and not labels[want_positive]:
                continue
            if want_positive is None:
                # Clean group: must carry no attribute at all, and where Open
                # Images has a verified negative for a class we prefer those.
                if any(labels.values()):
                    continue
            try:
                image = Image.open(sample.filepath).convert("RGB")
            except Exception:  # noqa: BLE001
                continue
            crop = crop_head_and_shoulders(image, faces[0].bounding_box)
            name = f"{group}-{sample.id}.jpg"
            crop.save(images_dir / name, "JPEG", quality=92)
            cases.append(
                {
                    "file": f"images/{name}",
                    **labels,
                    "skinTone": "unknown",
                    "notes": f"Open Images {args.split} {sample.id}; positive={sorted(positive & set(ALL_ATTRIBUTE_CLASSES))}; verified-negative={sorted(negative & set(ALL_ATTRIBUTE_CLASSES))}",
                    "source": "open-images-v7",
                    "license": "annotations CC BY 4.0 (Google LLC); images CC BY 2.0",
                }
            )
            seen.add(sample.id)
            counts[group] += 1
            taken += 1

    for field, class_names in ATTRIBUTE_CLASSES.items():
        print(f"loading {field}: {class_names}")
        dataset = foz.load_zoo_dataset(
            "open-images-v7",
            split=args.split,
            label_types=["classifications", "detections"],
            classes=class_names,
            max_samples=args.per_group * 4,
            shuffle=True,
            seed=args.seed,
            dataset_name=f"oi-attr-{field}-{args.split}",
        )
        ingest(dataset, field, field, args.per_group)

    print("loading clean faces")
    dataset = foz.load_zoo_dataset(
        "open-images-v7",
        split=args.split,
        label_types=["classifications", "detections"],
        classes=[FACE_CLASS],
        max_samples=args.per_group * 6,
        shuffle=True,
        seed=args.seed + 1,
        dataset_name=f"oi-attr-clean-{args.split}",
    )
    ingest(dataset, "clean", None, args.per_group)

    manifest = {
        "description": "Open Images V7 evaluation crops for attribute detection, head-and-shoulders framed. Labels come from Open Images image-level annotations; single-face images only.",
        "source": "https://storage.googleapis.com/openimages/web/factsfigures_v7.html",
        "license": "Annotations CC BY 4.0 (Google LLC). Images CC BY 2.0 (individual Flickr authors).",
        "fields": {
            "glasses": "true when Open Images labels Glasses, Sunglasses or Goggles present",
            "hat": "true when a hat/cap/beanie family label is present",
            "headCovering": "true when Hijab, Headscarf, Turban or Kippah is present",
            "faceMask": "true when Face mask or Respirator is present",
        },
        "counts": dict(counts),
        "cases": cases,
    }
    (args.output_dir / "ground-truth.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"\nwrote {len(cases)} cases -> {args.output_dir / 'ground-truth.json'}")
    print("per group:", dict(counts))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
