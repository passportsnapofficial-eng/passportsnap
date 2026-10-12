"""Build a labelled, passport-style evaluation set from Open Images V7.

    .venv-data/Scripts/python -m services.attribute_detection.prepare_openimages_eval \
        --output-dir services/attribute_detection/data/openimages \
        --per-group 120

    # regenerate only some groups and merge into the existing manifest
    .venv-data/Scripts/python -m services.attribute_detection.prepare_openimages_eval \
        --output-dir services/attribute_detection/data/openimages \
        --groups glasses hat clean --merge

Why Open Images: its annotations are CC BY 4.0 and the images are listed as
CC BY 2.0, so both are usable for a commercial product with attribution.

Label quality matters more than volume here, because these labels set the
thresholds that decide whether a customer is blocked, asked, or cleared.
Open Images' image-level labels only say an object is somewhere in the
picture - a "Hat" label with the hat on a shelf, or on the other person -
and a first pass with them put hatless faces among the "hats" and capped
faces among the "no hats". So:

  * glasses / hat positives require an Open Images BOX of that class that
    sits on the cropped face (box centre inside the expanded face box);
  * clean negatives require Open Images' human-VERIFIED-ABSENT label for
    Glasses, Sunglasses and Hat, not merely the absence of a positive label;
  * images are deduplicated by Open Images image id across groups.

Head coverings and masks have no boxes in Open Images and almost no verified
positives in its evaluation splits; see prepare_openimages_ids.py and
prepare_facemask_eval.py for those.

Each sample is cropped to one face with head-and-shoulders margin so the
evaluation images look like what customers upload. The face comes from Open
Images' "Human face" box when present, otherwise from OpenCV's YuNet
detector (Apache-2.0). Images with more than one face are dropped.
"""

from __future__ import annotations

import argparse
import json
import random
from collections import Counter
from pathlib import Path

import numpy as np
from PIL import Image

# Open Images display names -> our attribute fields.
ATTRIBUTE_CLASSES: dict[str, list[str]] = {
    "glasses": ["Glasses", "Sunglasses", "Goggles"],
    "hat": ["Hat", "Baseball cap", "Beanie", "Knit cap", "Cap", "Fedora", "Cowboy hat", "Sun hat", "Sombrero"],
    "headCovering": ["Hijab", "Headscarf", "Turban", "Kippah"],
    # Open Images' "Face mask" is the American-football face guard, not a
    # medical mask (every verified-present train image was a football player
    # or referee), so it is deliberately NOT listed. Masks are evaluated on
    # the separate facemask set; see prepare_facemask_eval.py.
    "faceMask": ["Respirator"],
}
# Classes that have bounding boxes in Open Images (the boxable 600).
BOXABLE: dict[str, list[str]] = {
    "glasses": ["Glasses", "Sunglasses", "Goggles"],
    "hat": ["Hat", "Fedora", "Cowboy hat", "Sun hat", "Sombrero"],
}
# A clean negative needs at least one of these human-verified absent ...
CLEAN_VERIFIED_ABSENT = ["Glasses", "Sunglasses", "Hat"]
# ... and none of these present. Open Images' "Hat" verified-absent label is
# class-specific: helmets, scarves and religious coverings still pass it, and
# a first clean set was a third helmets, headbands and turbans.
CLEAN_EXCLUDE_PRESENT = [
    "Helmet", "Bicycle helmet", "Football helmet", "Scarf", "Hijab", "Headscarf", "Turban", "Kippah",
    "Goggles", "Mask",
]
ALL_ATTRIBUTE_CLASSES = sorted({name for names in ATTRIBUTE_CLASSES.values() for name in names})
FACE_CLASS = "Human face"
CROP_SIZE = 600
YUNET_PATH = Path(__file__).with_name("data") / "models" / "face_detection_yunet_2023mar.onnx"
YUNET_MIN_SCORE = 0.8


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prepare an Open Images evaluation set for attribute detection.")
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--per-group", type=int, default=120, help="Target images per attribute group and for the clean group.")
    parser.add_argument("--split", default="validation", choices=["train", "validation", "test"])
    parser.add_argument("--seed", type=int, default=51)
    parser.add_argument("--groups", nargs="*", default=None, help="Subset of groups to build (attribute names and/or 'clean'). Default: all.")
    parser.add_argument("--merge", action="store_true", help="Keep existing cases from other groups in the manifest.")
    return parser.parse_args()


def attribute_labels(positive: set[str]) -> dict[str, bool]:
    return {field: any(name in positive for name in names) for field, names in ATTRIBUTE_CLASSES.items()}


class FaceFinder:
    """Single-face locator: Open Images box first, YuNet as the fallback."""

    def __init__(self) -> None:
        self._detector = None
        if YUNET_PATH.exists():
            import cv2

            self._cv2 = cv2
            self._detector = cv2.FaceDetectorYN.create(str(YUNET_PATH), "", (320, 320), YUNET_MIN_SCORE, 0.3, 5000)

    def from_open_images(self, sample) -> list[list[float]]:
        field = getattr(sample, "detections", None)
        detections = field.detections if field else []
        return [d.bounding_box for d in detections if d.label == FACE_CLASS]

    def from_yunet(self, image: Image.Image) -> list[list[float]]:
        if self._detector is None:
            return []
        width, height = image.size
        bgr = self._cv2.cvtColor(np.asarray(image), self._cv2.COLOR_RGB2BGR)
        self._detector.setInputSize((width, height))
        _, faces = self._detector.detect(bgr)
        if faces is None:
            return []
        boxes = []
        for face in faces:
            x, y, w, h = (float(v) for v in face[:4])
            if w <= 0 or h <= 0:
                continue
            boxes.append([x / width, y / height, w / width, h / height])
        return boxes

    def single_face(self, sample, image: Image.Image) -> tuple[list[float] | None, str]:
        boxes = self.from_open_images(sample)
        if boxes:
            return (boxes[0], "open-images") if len(boxes) == 1 else (None, "multi-face")
        boxes = self.from_yunet(image)
        if len(boxes) == 1:
            return boxes[0], "yunet"
        return None, "multi-face" if boxes else "no-face"


def _centre(box: list[float]) -> tuple[float, float]:
    return box[0] + box[2] / 2, box[1] + box[3] / 2


def glasses_box_on_face(box: list[float], face: list[float]) -> bool:
    """Glasses sit on the face itself: centre within the face box (small slack)."""
    x, y, w, h = face
    cx, cy = _centre(box)
    return (x - 0.25 * w) <= cx <= (x + 1.25 * w) and (y - 0.1 * h) <= cy <= (y + 0.8 * h)


def hat_box_on_head(box: list[float], face: list[float]) -> bool:
    """A worn hat's box overlaps the top of the face box: it covers at least
    half the face's width and its bottom edge reaches down to the forehead.
    Centre-based tests let hats held in hands, on neighbours and on display
    through as positives - a third of a first pass's "hats" were bare heads."""
    x, y, w, h = face
    bx, by, bw, bh = box
    overlap = min(x + w, bx + bw) - max(x, bx)
    if overlap < 0.5 * w:
        return False
    bottom = by + bh
    return (y - 0.2 * h) <= bottom <= (y + 0.6 * h) and by <= y + 0.1 * h


BOX_RULES = {"glasses": glasses_box_on_face, "hat": hat_box_on_head}


def crop_head_and_shoulders(image: Image.Image, box: list[float]) -> Image.Image:
    """box is [x, y, w, h] in relative coordinates (Open Images / FiftyOne style)."""
    width, height = image.size
    x, y, w, h = box
    # A full face-height of headroom: passport framing shows the whole crown,
    # and with less than this a hat on the head was often cut out of its own
    # crop.
    top = max(0.0, y - h * 1.0)
    bottom = min(1.0, y + h + h * 0.9)
    side = (bottom - top) * (width / height) / 2 if width else 0.5
    cx = x + w / 2
    left = max(0.0, cx - side / 2 * (height / width))
    right = min(1.0, cx + side / 2 * (height / width))
    crop = image.crop((int(left * width), int(top * height), int(right * width), int(bottom * height)))
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
    manifest_path = args.output_dir / "ground-truth.json"

    groups = args.groups or [*ATTRIBUTE_CLASSES.keys(), "clean"]
    cases: list[dict] = []
    if args.merge and manifest_path.exists():
        previous = json.loads(manifest_path.read_text(encoding="utf-8"))
        cases = [case for case in previous["cases"] if case.get("group") not in groups and case.get("group")]
        print(f"keeping {len(cases)} existing cases from other groups")

    finder = FaceFinder()
    if finder._detector is None:
        print(f"note: YuNet weights not found at {YUNET_PATH}; only Open Images face boxes will be used")

    seen: set[str] = {case.get("sourceId", "") for case in cases}
    counts: Counter[str] = Counter(case.get("group", "?") for case in cases)
    rejected: Counter[str] = Counter()

    def ingest(dataset, group: str, want_positive: str | None, limit: int) -> None:
        taken = 0
        samples = list(dataset)
        random.shuffle(samples)
        for sample in samples:
            if taken >= limit:
                break
            image_id = Path(sample.filepath).stem
            if image_id in seen:
                rejected["duplicate"] += 1
                continue
            positive = {c.label for c in (sample.positive_labels.classifications if sample.positive_labels else [])}
            negative = {c.label for c in (sample.negative_labels.classifications if sample.negative_labels else [])}
            detections = sample.detections.detections if sample.detections else []
            labels = attribute_labels(positive)

            if want_positive is None:
                # Clean: no attribute label of any kind, no glasses/hat box
                # anywhere in the picture, and at least one of the blocking
                # classes human-verified absent (so the image was reviewed for
                # them). Requiring all three verified absent at once rejected
                # every candidate - Open Images rarely verifies all of them.
                boxable_names = {name for names in BOXABLE.values() for name in names}
                if any(labels.values()) or any(name in positive for name in CLEAN_EXCLUDE_PRESENT):
                    rejected["clean-has-attribute-label"] += 1
                    continue
                if any(d.label in CLEAN_EXCLUDE_PRESENT for d in detections):
                    rejected["clean-has-headwear-box"] += 1
                    continue
                if any(d.label in boxable_names for d in detections):
                    rejected["clean-has-attribute-box"] += 1
                    continue
                if not any(name in negative for name in CLEAN_VERIFIED_ABSENT):
                    rejected["clean-not-reviewed"] += 1
                    continue
            elif not labels[want_positive]:
                rejected["not-positive"] += 1
                continue

            try:
                image = Image.open(sample.filepath).convert("RGB")
            except Exception:  # noqa: BLE001
                rejected["unreadable"] += 1
                continue
            face, source = finder.single_face(sample, image)
            if face is None:
                rejected[source] += 1
                continue

            # For attributes Open Images draws boxes for, the label in EVERY
            # group comes from a box on this face, not from the image-level
            # label - which only says the object is somewhere in the picture.
            for field, names in BOXABLE.items():
                boxes = [d.bounding_box for d in detections if d.label in names]
                labels[field] = any(BOX_RULES[field](box, face) for box in boxes)
                if want_positive == field and not labels[field]:
                    rejected["attribute-box-off-face" if boxes else "no-attribute-box"] += 1
                    break
            else:
                pass
            if want_positive in BOXABLE and not labels[want_positive]:
                continue

            crop = crop_head_and_shoulders(image, face)
            name = f"{group}-{image_id}.jpg"
            crop.save(images_dir / name, "JPEG", quality=92)
            cases.append(
                {
                    "file": f"images/{name}",
                    **labels,
                    "skinTone": "unknown",
                    "notes": f"Open Images {args.split} {image_id}; face via {source}; positive={sorted(positive & set(ALL_ATTRIBUTE_CLASSES))}; verified-negative={sorted(negative & set(ALL_ATTRIBUTE_CLASSES))}",
                    "group": group,
                    "sourceId": image_id,
                    "source": "open-images-v7",
                    "license": "annotations CC BY 4.0 (Google LLC); images CC BY 2.0",
                }
            )
            seen.add(image_id)
            counts[group] += 1
            taken += 1

    for field, class_names in ATTRIBUTE_CLASSES.items():
        if field not in groups:
            continue
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

    if "clean" in groups:
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
        "description": "Open Images V7 evaluation crops for attribute detection, head-and-shoulders framed. Glasses/hat positives have the attribute box on the cropped face; clean negatives are human-verified absent for Glasses, Sunglasses and Hat; single-face images only (Open Images box, else YuNet); deduplicated by image id.",
        "source": "https://storage.googleapis.com/openimages/web/factsfigures_v7.html",
        "license": "Annotations CC BY 4.0 (Google LLC). Images CC BY 2.0 (individual Flickr authors).",
        "fields": {
            "glasses": "true when a Glasses/Sunglasses/Goggles box sits on the cropped face",
            "hat": "true when a hat-family box sits on the cropped face",
            "headCovering": "true when Hijab, Headscarf, Turban or Kippah is verified present (image-level)",
            "faceMask": "true when Face mask or Respirator is verified present (image-level)",
        },
        "counts": dict(counts),
        "rejected": dict(rejected),
        "cases": cases,
    }
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"\nwrote {len(cases)} cases -> {manifest_path}")
    print("per group:", dict(counts))
    print("rejected:", dict(rejected))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
