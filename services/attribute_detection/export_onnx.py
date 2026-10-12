"""Package the detector for a Vercel Python Function.

    .venv/Scripts/python -m services.attribute_detection.export_onnx \
        --out services/attribute_detection/onnx

Writes:
  vision.onnx         SigLIP vision tower (fp32, dynamic batch, 224x224 input)
  prompts.json        the paired prompts, their pre-computed normalised text
                      embeddings, regions, thresholds and the contrast temperature

With the text side pre-computed, the runtime only needs the vision tower and
ONNX Runtime (~50 MB) instead of PyTorch (~200 MB) - small enough for the
500 MB Python function bundle - and the scores are numerically the same as
the PyTorch service, so thresholds.json carries over unchanged.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import torch

from .detector import (
    ATTRIBUTE_PROMPTS,
    ATTRIBUTE_REGIONS,
    CONTRAST_TEMPERATURE,
    DEFAULT_THRESHOLDS,
    MODEL_ID,
    REGIONS,
    AttributeDetector,
)


class VisionWrapper(torch.nn.Module):
    def __init__(self, model):
        super().__init__()
        self.model = model

    def forward(self, pixel_values):
        output = self.model.get_image_features(pixel_values=pixel_values)
        if torch.is_tensor(output):
            return output
        for name in ("pooler_output", "image_embeds", "last_hidden_state"):
            value = getattr(output, name, None)
            if torch.is_tensor(value):
                return value
        return output[0]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)

    detector = AttributeDetector()
    processor = detector.processor

    # Text side: already computed and normalised inside the detector, in pair
    # order (2k = with attribute, 2k+1 = without).
    text_embeds = detector._text_embeds.cpu().numpy().astype(np.float32)
    pairs = [
        {"attribute": attribute, "with": positive, "without": neutral}
        for attribute, items in ATTRIBUTE_PROMPTS.items()
        for positive, neutral in items
    ]
    assert text_embeds.shape[0] == 2 * len(pairs)

    image_processor = getattr(processor, "image_processor", processor)
    size = image_processor.size
    side = int(size.get("height") or size.get("shortest_edge") or 224)
    manifest = {
        "model": MODEL_ID,
        "inputSize": side,
        "imageMean": list(map(float, image_processor.image_mean)),
        "imageStd": list(map(float, image_processor.image_std)),
        "rescale": float(getattr(image_processor, "rescale_factor", 1 / 255)),
        "contrastTemperature": CONTRAST_TEMPERATURE,
        "regions": REGIONS,
        "attributeRegions": ATTRIBUTE_REGIONS,
        "thresholds": DEFAULT_THRESHOLDS,
        "pairs": pairs,
        "textEmbeds": text_embeds.tolist(),
    }
    (args.out / "prompts.json").write_text(json.dumps(manifest), encoding="utf-8")

    wrapper = VisionWrapper(detector.model).eval()
    dummy = torch.zeros(1, 3, side, side, dtype=torch.float32)
    torch.onnx.export(
        wrapper,
        dummy,
        str(args.out / "vision.onnx"),
        input_names=["pixel_values"],
        output_names=["image_embeds"],
        dynamic_axes={"pixel_values": {0: "batch"}, "image_embeds": {0: "batch"}},
        opset_version=17,
        dynamo=False,
    )

    # Prove the export matches PyTorch on a real forward pass.
    import onnxruntime as ort
    from PIL import Image

    session = ort.InferenceSession(str(args.out / "vision.onnx"), providers=["CPUExecutionProvider"])
    probe = Image.new("RGB", (600, 600), (120, 90, 70))
    pixel = processor(images=probe, return_tensors="pt")["pixel_values"]
    with torch.no_grad():
        reference = wrapper(pixel).numpy()
    exported = session.run(None, {"pixel_values": pixel.numpy()})[0]
    diff = float(np.abs(reference - exported).max())
    print(f"vision.onnx: {(args.out / 'vision.onnx').stat().st_size / 1e6:.1f} MB, max |torch - onnx| = {diff:.2e}")
    print(f"prompts.json: {len(pairs)} pairs, {text_embeds.shape[1]}-d embeddings, input {side}px")
    return 0 if diff < 1e-3 else 1


if __name__ == "__main__":
    raise SystemExit(main())
