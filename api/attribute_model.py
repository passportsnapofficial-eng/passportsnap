"""Attribute detection as a Vercel Python Function - no separate host needed.

Serves the same three-state verdicts as services/attribute_detection (glasses,
hat, religious head covering, face mask) from an int8 ONNX export of the
SigLIP vision tower with pre-computed text embeddings. ONNX Runtime plus the
99 MB model fit the Hobby plan's 500 MB Python bundle; PyTorch would not.

Routes:  GET  /api/attribute_model   -> health
         POST /api/attribute_model   -> {"dataUrl": "data:image/jpeg;base64,..."}

The scoring here mirrors detector.py exactly (paired prompts, fixed regions,
hat-versus-covering cap, calibrated thresholds from prompts.json), so the
verdicts match the PyTorch service to within int8 rounding.
"""

from __future__ import annotations

import base64
import io
import json
import math
import os
import re
import threading
from http.server import BaseHTTPRequestHandler
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ONNX_DIR = ROOT / "services" / "attribute_detection" / "onnx"
MODEL_FILE = os.getenv("ATTRIBUTE_ONNX_FILE", "vision-fp16.onnx")


MODEL_URL = os.getenv(
    "ATTRIBUTE_MODEL_URL",
    "https://huggingface.co/wusunanwa/passportsnap-attributes-onnx/resolve/main/vision-fp16.onnx",
)
CACHE_FILE = Path("/tmp") / MODEL_FILE


def _model_bytes() -> bytes:
    """Resolve the 187 MB fp16 model, in order of preference:
    1. a whole file next to prompts.json (local development after export);
    2. the committed .part files joined (GitHub's 100 MiB limit forced the split);
    3. a download from the public Hugging Face model repo, cached in /tmp for
       the life of the function instance (keeps the git repo small when the
       parts are not shipped)."""
    whole = ONNX_DIR / MODEL_FILE
    if whole.exists():
        return whole.read_bytes()
    parts = sorted(ONNX_DIR.glob(f"{MODEL_FILE}.part*"), key=lambda p: int(p.suffix[5:]))
    if parts:
        return b"".join(part.read_bytes() for part in parts)
    if CACHE_FILE.exists():
        return CACHE_FILE.read_bytes()
    import urllib.request

    with urllib.request.urlopen(MODEL_URL, timeout=120) as response:
        data = response.read()
    try:
        CACHE_FILE.write_bytes(data)
    except OSError:
        pass  # /tmp may be unavailable; serving from memory still works
    return data
MAX_IMAGE_BYTES = 8 * 1024 * 1024
DATA_URL_RE = re.compile(r"^data:(image/[a-zA-Z0-9.+-]+);base64,(.+)$", re.DOTALL)

_lock = threading.Lock()
_state: dict = {}


def _load():
    """Load the model and prompt manifest once per function instance."""
    with _lock:
        if "session" in _state:
            return _state
        import onnxruntime as ort

        manifest = json.loads((ONNX_DIR / "prompts.json").read_text(encoding="utf-8"))
        options = ort.SessionOptions()
        options.intra_op_num_threads = max(1, os.cpu_count() or 1)
        session = ort.InferenceSession(_model_bytes(), options, providers=["CPUExecutionProvider"])
        _state.update(
            {
                "session": session,
                "manifest": manifest,
                "text": np.asarray(manifest["textEmbeds"], dtype=np.float32),
                "mean": np.asarray(manifest["imageMean"], dtype=np.float32),
                "std": np.asarray(manifest["imageStd"], dtype=np.float32),
            }
        )
        return _state


def _preprocess(image: Image.Image, side: int, mean: np.ndarray, std: np.ndarray, rescale: float) -> np.ndarray:
    resized = image.resize((side, side), Image.BICUBIC)
    array = np.asarray(resized, dtype=np.float32) * rescale
    array = (array - mean) / std
    return np.ascontiguousarray(array.transpose(2, 0, 1)[None])


def _crop(image: Image.Image, region) -> Image.Image:
    width, height = image.size
    left, top, right, bottom = region
    return image.crop((int(left * width), int(top * height), int(right * width), int(bottom * height)))


def _state_for(score: float, thresholds: dict) -> str:
    if score >= thresholds["present"]:
        return "present"
    if score <= thresholds["absent"]:
        return "absent"
    return "unsure"


def detect(image: Image.Image) -> dict:
    state = _load()
    manifest = state["manifest"]
    side = int(manifest["inputSize"])
    temperature = float(manifest["contrastTemperature"])
    pairs = manifest["pairs"]
    text = state["text"]

    needed = sorted({name for names in manifest["attributeRegions"].values() for name in names})
    batch = np.concatenate(
        [_preprocess(_crop(image, manifest["regions"][name]), side, state["mean"], state["std"], float(manifest["rescale"])) for name in needed]
    )
    embeds = state["session"].run(None, {"pixel_values": batch})[0]
    embeds = embeds / np.linalg.norm(embeds, axis=-1, keepdims=True)
    sims = embeds @ text.T  # (regions, 2 * pairs)

    # Best paired contrast per attribute per region, exactly as detector.py.
    per_region: dict[str, dict[str, dict]] = {}
    for row, name in enumerate(needed):
        best: dict[str, dict] = {}
        for index, pair in enumerate(pairs):
            with_attr = float(sims[row, 2 * index])
            without = float(sims[row, 2 * index + 1])
            contrast = 1.0 / (1.0 + math.exp(-temperature * (with_attr - without)))
            current = best.get(pair["attribute"])
            if current is None or contrast > current["score"]:
                best[pair["attribute"]] = {"score": contrast, "positive": with_attr, "negative": without}
        per_region[name] = best

    chosen: dict[str, dict] = {}
    for attribute, region_names in manifest["attributeRegions"].items():
        best = {"score": -1.0, "positive": 0.0, "negative": 0.0, "region": ""}
        for name in region_names:
            sides = per_region[name][attribute]
            if sides["score"] > best["score"]:
                best = {**sides, "region": name}
        chosen[attribute] = best

    hat = chosen["hat"]
    cover_sim = per_region[hat["region"]]["head_covering"]["positive"]
    hat_vs_cover = 1.0 / (1.0 + math.exp(-temperature * (hat["positive"] - cover_sim)))
    hat["score"] = min(hat["score"], hat_vs_cover)

    attributes = {}
    for attribute, best in chosen.items():
        thresholds = manifest["thresholds"][attribute]
        attributes[attribute] = {
            "attribute": attribute,
            "score": round(float(best["score"]), 4),
            "positive": round(float(best["positive"]), 4),
            "negative": round(float(best["negative"]), 4),
            "state": _state_for(float(best["score"]), thresholds),
            "region": best["region"],
        }
    return {
        "model": f"{manifest['model']} ({MODEL_FILE})",
        "attributes": attributes,
        "present": [k for k, v in attributes.items() if v["state"] == "present"],
        "unsure": [k for k, v in attributes.items() if v["state"] == "unsure"],
        "absent": [k for k, v in attributes.items() if v["state"] == "absent"],
    }


class handler(BaseHTTPRequestHandler):  # noqa: N801 - name required by Vercel
    def _send(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):  # noqa: N802
        try:
            state = _load()
            self._send(200, {"ok": True, "model": state["manifest"]["model"], "file": MODEL_FILE, "thresholds": state["manifest"]["thresholds"]})
        except Exception as error:  # noqa: BLE001
            self._send(503, {"ok": False, "message": f"model unavailable: {error}"})

    def do_POST(self):  # noqa: N802
        try:
            length = int(self.headers.get("Content-Length") or 0)
            if length <= 0 or length > MAX_IMAGE_BYTES * 2:
                self._send(413 if length > 0 else 400, {"message": "A JSON body with dataUrl is required."})
                return
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            match = DATA_URL_RE.match(str(payload.get("dataUrl", "")).strip())
            if not match:
                self._send(400, {"message": "dataUrl must be a base64 image data URL."})
                return
            raw = base64.b64decode(match.group(2), validate=True)
            if len(raw) > MAX_IMAGE_BYTES:
                self._send(413, {"message": "Image is too large."})
                return
            image = Image.open(io.BytesIO(raw)).convert("RGB")
            self._send(200, detect(image))
        except Exception as error:  # noqa: BLE001
            # 503 is the signal the proxy fails closed on: every attribute
            # becomes "unsure" and the customer is asked.
            self._send(503, {"message": f"attribute detection failed: {error}"})
