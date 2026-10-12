"""Split vision-fp16.onnx into parts under GitHub's 100 MiB file limit.

    .venv/Scripts/python -m services.attribute_detection.split_model \
        --onnx-dir services/attribute_detection/onnx

Writes vision-fp16.onnx.part0, .part1, ... (90 MiB each) next to the model.
api/attribute_model.py reads the parts back in order at start-up and hands
ONNX Runtime the joined bytes, so nothing else has to know the model was
split. The whole-file variants stay gitignored.
"""

from __future__ import annotations

import argparse
import hashlib
from pathlib import Path

PART_BYTES = 90 * 1024 * 1024


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--onnx-dir", type=Path, required=True)
    parser.add_argument("--name", default="vision-fp16.onnx")
    args = parser.parse_args()

    source = args.onnx_dir / args.name
    data = source.read_bytes()
    for old in args.onnx_dir.glob(f"{args.name}.part*"):
        old.unlink()
    count = 0
    for offset in range(0, len(data), PART_BYTES):
        (args.onnx_dir / f"{args.name}.part{count}").write_bytes(data[offset : offset + PART_BYTES])
        count += 1
    digest = hashlib.sha256(data).hexdigest()
    (args.onnx_dir / f"{args.name}.sha256").write_text(digest + "\n", encoding="utf-8")
    print(f"{args.name}: {len(data)} bytes -> {count} parts, sha256 {digest[:16]}...")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
