"""Build a face-mask evaluation manifest from the MIT-licensed poolrf2001/FaceMask set.

    .venv-data/Scripts/python -m services.attribute_detection.prepare_facemask_eval \
        --zips services/attribute_detection/data/facemask/validation.zip \
               services/attribute_detection/data/facemask/test.zip \
        --output-dir services/attribute_detection/data/facemask

Open Images has no verified face-mask positives in its validation or test
splits, so masks are evaluated on this set instead. It is declared MIT on the
Hub; its upstream provenance is not documented, so it is used for EVALUATION
ONLY, never for training a shipped model.

Classes: with_mask and mask_weared_incorrect both count as faceMask=true - a
passport photo is rejected for any mask, worn properly or not. without_mask
is the negative. Images are already face crops; they are re-framed to the
same head-and-shoulders square as the other sets when YuNet finds the face,
and kept as-is when it does not.
"""

from __future__ import annotations

import argparse
import json
import zipfile
from collections import Counter
from io import BytesIO
from pathlib import Path

from PIL import Image

from .prepare_openimages_eval import ATTRIBUTE_CLASSES, CROP_SIZE, FaceFinder, crop_head_and_shoulders

CLASS_TO_MASK = {"with_mask": True, "mask_weared_incorrect": True, "without_mask": False}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--zips", type=Path, nargs="+", required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    return parser.parse_args()


class _NoSample:
    detections = None


def main() -> int:
    args = parse_args()
    images_dir = args.output_dir / "images"
    images_dir.mkdir(parents=True, exist_ok=True)
    finder = FaceFinder()
    cases: list[dict] = []
    counts: Counter[str] = Counter()
    faces: Counter[str] = Counter()

    for zip_path in args.zips:
        with zipfile.ZipFile(zip_path) as archive:
            for entry in archive.namelist():
                parts = entry.split("/")
                if len(parts) < 3 or not parts[-1]:
                    continue
                class_name = parts[1]
                if class_name not in CLASS_TO_MASK:
                    continue
                try:
                    image = Image.open(BytesIO(archive.read(entry))).convert("RGB")
                except Exception:  # noqa: BLE001
                    continue
                # These images are already tight, low-resolution face crops.
                # Re-detecting a face inside one and taking head-and-shoulders
                # margin around it zoomed into noses and mouths, so the whole
                # image is kept and padded to a passport-style white square.
                width, height = image.size
                edge = max(width, height)
                padded = Image.new("RGB", (edge, edge), "white")
                padded.paste(image, ((edge - width) // 2, (edge - height) // 2))
                crop = padded.resize((CROP_SIZE, CROP_SIZE), Image.LANCZOS)
                source = f"as-is {width}x{height}"
                faces[source] += 1
                name = f"{zip_path.stem}-{class_name}-{Path(parts[-1]).stem}.jpg"
                crop.save(images_dir / name, "JPEG", quality=92)
                labels = {field: False for field in ATTRIBUTE_CLASSES}
                labels["faceMask"] = CLASS_TO_MASK[class_name]
                cases.append(
                    {
                        "file": f"images/{name}",
                        **labels,
                        "skinTone": "unknown",
                        "notes": f"poolrf2001/FaceMask {zip_path.stem}/{class_name}; face via {source}",
                        "group": "faceMask",
                        "source": "poolrf2001/FaceMask (Hugging Face)",
                        "license": "MIT as declared on the Hub; provenance undocumented - evaluation only",
                    }
                )
                counts[class_name] += 1

    manifest = {
        "description": "Face-mask evaluation crops from poolrf2001/FaceMask. with_mask and mask_weared_incorrect are faceMask=true; without_mask is false. Evaluation only.",
        "source": "https://huggingface.co/datasets/poolrf2001/FaceMask",
        "license": "MIT as declared on the Hub; upstream provenance undocumented",
        "fields": {"faceMask": "true when a mask covers any part of the nose or mouth"},
        "counts": dict(counts),
        "faceSource": dict(faces),
        "cases": cases,
    }
    (args.output_dir / "ground-truth.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"wrote {len(cases)} cases; classes {dict(counts)}; face source {dict(faces)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
