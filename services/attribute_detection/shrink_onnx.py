"""Shrink vision.onnx to fit a Vercel Python function and measure the cost.

    .venv/Scripts/python -m services.attribute_detection.shrink_onnx \
        --onnx-dir services/attribute_detection/onnx

Produces vision-fp16.onnx (half-precision weights) and vision-int8.onnx
(dynamically quantised MatMuls), then compares each against the fp32 export
on the labelled passport fixtures: embedding agreement, attribute-score drift,
and CPU latency per image. The variant that keeps every fixture's verdict and
stays small enough wins.
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
from PIL import Image


def preprocess(image: Image.Image, side: int, mean, std, rescale) -> np.ndarray:
    resized = image.convert("RGB").resize((side, side), Image.BICUBIC)
    array = np.asarray(resized, dtype=np.float32) * rescale
    array = (array - np.asarray(mean, dtype=np.float32)) / np.asarray(std, dtype=np.float32)
    return np.ascontiguousarray(array.transpose(2, 0, 1)[None])


def embed(session: ort.InferenceSession, pixels: np.ndarray) -> np.ndarray:
    out = session.run(None, {"pixel_values": pixels})[0]
    return out / np.linalg.norm(out, axis=-1, keepdims=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--onnx-dir", type=Path, required=True)
    parser.add_argument("--fixtures-root", type=Path, default=Path("public/test-fixtures"))
    parser.add_argument("--ground-truth", type=Path, default=Path("public/test-fixtures/ground-truth.json"))
    args = parser.parse_args()

    manifest = json.loads((args.onnx_dir / "prompts.json").read_text(encoding="utf-8"))
    text = np.asarray(manifest["textEmbeds"], dtype=np.float32)
    side, mean, std, rescale = manifest["inputSize"], manifest["imageMean"], manifest["imageStd"], manifest["rescale"]
    temperature = manifest["contrastTemperature"]

    fp32_path = args.onnx_dir / "vision.onnx"
    fp16_path = args.onnx_dir / "vision-fp16.onnx"
    int8_path = args.onnx_dir / "vision-int8.onnx"

    from onnxconverter_common import float16

    # The first conversion attempt failed to load: the converter left the
    # patch-embedding Conv with a float input and float16 weights. Blocking
    # Conv keeps it in fp32 and the converter inserts the casts around it.
    model = onnx.load(str(fp32_path))
    block = list(float16.DEFAULT_OP_BLOCK_LIST) + ["Conv"]
    onnx.save(
        float16.convert_float_to_float16(model, keep_io_types=True, op_block_list=block),
        str(fp16_path),
    )

    from onnxruntime.quantization import QuantType, quantize_dynamic

    # Per-tensor int8 drifted the attribute scores by up to 0.16 (cosine to
    # fp32 only 0.949). Per-channel weight scales are the usual fix for ViTs.
    quantize_dynamic(str(fp32_path), str(int8_path), weight_type=QuantType.QInt8, per_channel=True, reduce_range=False)

    cases = json.loads(args.ground_truth.read_text(encoding="utf-8"))["cases"]
    images = []
    for case in cases:
        path = args.fixtures_root / case["file"]
        if path.exists():
            images.append(preprocess(Image.open(path), side, mean, std, rescale))
    print(f"{len(images)} fixture images; text embeddings {text.shape}")

    def scores_for(embeds: np.ndarray) -> np.ndarray:
        sims = embeds @ text.T  # (n, 2*pairs)
        with_attr = sims[:, 0::2]
        without = sims[:, 1::2]
        return 1.0 / (1.0 + np.exp(-temperature * (with_attr - without)))

    results = {}
    reference = None
    for label, path in [("fp32", fp32_path), ("fp16", fp16_path), ("int8", int8_path)]:
        try:
            session = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
        except Exception as error:  # noqa: BLE001 - a variant that will not load is simply out
            print(f"{label}: cannot load ({str(error).splitlines()[0][:110]}) - skipped")
            continue
        started = time.perf_counter()
        embeds = np.concatenate([embed(session, pixels) for pixels in images])
        latency = (time.perf_counter() - started) / len(images)
        pair_scores = scores_for(embeds)
        size_mb = path.stat().st_size / 1e6
        if reference is None:
            reference = (embeds, pair_scores)
            print(f"{label}: {size_mb:6.1f} MB  {latency*1000:6.0f} ms/image  (reference)")
        else:
            cos = float(np.mean(np.sum(embeds * reference[0], axis=-1)))
            drift = float(np.max(np.abs(pair_scores - reference[1])))
            print(f"{label}: {size_mb:6.1f} MB  {latency*1000:6.0f} ms/image  cosine-to-fp32 {cos:.5f}  max score drift {drift:.4f}")
        results[label] = {"sizeMb": round(size_mb, 1), "msPerImage": round(latency * 1000)}
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
