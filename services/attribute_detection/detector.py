"""Zero-shot attribute detection for passport photos.

One SigLIP model (Apache-2.0, google/siglip-base-patch16-224) answers every
"is the person wearing X?" question by scoring the image against text prompts.
No training data is involved, so there is no dataset licence to inherit.

Every attribute resolves to one of three states, never two:

  present  - confident the attribute is there -> the app blocks checkout
  absent   - confident it is not               -> the app may clear the check
  unsure   - anything in between               -> the app asks the customer

The thresholds below were calibrated against the labelled fixtures with
evaluate_fixtures.py. A photo the model cannot decide is never allowed to pass
on its own; "unsure" is the safe default, not "absent".
"""

from __future__ import annotations

import io
import math
import os
import threading
from dataclasses import dataclass
from typing import Any

import torch
from PIL import Image

MODEL_ID = os.getenv("ATTRIBUTE_MODEL_ID", "google/siglip-base-patch16-224")

# Each attribute is a list of (with-attribute, same-context-without) prompt
# pairs. Vision-language models are poor at negation ("no glasses") and keen
# on context words ("close-up of a face"), so the neutral half of every pair
# repeats the positive half's context exactly, leaving only the attribute to
# differ. The score is the paired contrast, not an absolute match.
ATTRIBUTE_PROMPTS: dict[str, list[tuple[str, str]]] = {
    "glasses": [
        ("a photo of a person wearing eyeglasses", "a photo of a person"),
        ("a close-up of a face wearing glasses", "a close-up of a face"),
        ("a passport photo of someone wearing spectacles", "a passport photo of someone"),
        ("eyes seen through the lenses of glasses", "eyes"),
        ("a person wearing sunglasses", "a person"),
    ],
    "hat": [
        ("a person wearing a baseball cap", "a person"),
        ("a photo of a person wearing a hat", "a photo of a person"),
        ("a head with a knitted beanie on it", "a head with hair on it"),
        ("a person wearing a flat cap", "a person"),
        ("a person wearing a brimmed hat", "a person"),
    ],
    "head_covering": [
        ("a woman wearing a hijab", "a woman"),
        ("a person wearing a headscarf covering the hair", "a person"),
        ("a person wearing a turban", "a person"),
        ("a photo of someone in a religious head covering", "a photo of someone"),
    ],
    "face_mask": [
        ("a person wearing a surgical face mask", "a person"),
        ("a face with a cloth mask covering the nose and mouth", "a face"),
        ("a person wearing an N95 respirator", "a person"),
        ("a passport photo of someone wearing a face mask", "a passport photo of someone"),
    ],
}

# Temperature for the paired contrast. SigLIP's own logit scale (~100) would
# saturate every verdict to 0 or 1 and erase the "unsure" band; this keeps
# the scores spread so calibration has something to work with.
CONTRAST_TEMPERATURE = float(os.getenv("ATTRIBUTE_CONTRAST_TEMPERATURE", "20"))

# The app sends the finished passport export, so the face sits in a known
# place: head roughly the middle 50-70% of the height, eyes just above centre.
# Scoring a few fixed regions as well as the whole frame gives the model a
# close look at the eyes for glasses, the crown for headwear, and the nose and
# mouth for masks - without needing a face detector in this service.
REGIONS: dict[str, tuple[float, float, float, float]] = {
    "full": (0.0, 0.0, 1.0, 1.0),
    "head": (0.05, 0.0, 0.95, 0.62),
    "face": (0.12, 0.08, 0.88, 0.80),
    "eyes": (0.18, 0.22, 0.82, 0.58),
    "lower_face": (0.15, 0.36, 0.85, 0.92),
}
ATTRIBUTE_REGIONS: dict[str, list[str]] = {
    "glasses": ["full", "face", "eyes"],
    "hat": ["full", "head"],
    "head_covering": ["full", "head"],
    "face_mask": ["full", "face", "lower_face"],
}

# Three-state operating points. "present" must be precise (a false block costs
# a sale); "absent" must be conservative (a false clear costs a rejected
# passport). Everything in between is a question for the customer.
_FALLBACK_THRESHOLDS: dict[str, dict[str, float]] = {
    "glasses": {"present": 0.70, "absent": 0.35},
    "hat": {"present": 0.70, "absent": 0.35},
    "head_covering": {"present": 0.70, "absent": 0.35},
    "face_mask": {"present": 0.70, "absent": 0.35},
}


def _load_thresholds() -> dict[str, dict[str, float]]:
    """Calibrated values live in thresholds.json next to this file (written by
    calibrate_thresholds.py). ATTRIBUTE_THRESHOLDS_PATH overrides the location.
    Missing file -> the conservative fallbacks above, which ask a lot."""
    import json
    from pathlib import Path

    path = Path(os.getenv("ATTRIBUTE_THRESHOLDS_PATH") or Path(__file__).with_name("thresholds.json"))
    merged = {key: dict(value) for key, value in _FALLBACK_THRESHOLDS.items()}
    if path.exists():
        try:
            for attribute, values in json.loads(path.read_text(encoding="utf-8")).items():
                merged.setdefault(attribute, {}).update({k: float(v) for k, v in values.items()})
        except (OSError, ValueError):
            pass
    return merged


DEFAULT_THRESHOLDS: dict[str, dict[str, float]] = _load_thresholds()


@dataclass(frozen=True)
class AttributeResult:
    attribute: str
    score: float
    positive: float
    negative: float
    state: str  # present | absent | unsure
    region: str = "full"

    def to_dict(self) -> dict[str, Any]:
        return {
            "attribute": self.attribute,
            "score": round(self.score, 4),
            "positive": round(self.positive, 4),
            "negative": round(self.negative, 4),
            "state": self.state,
            "region": self.region,
        }


def _as_tensor(output: Any) -> torch.Tensor:
    """get_*_features returns a bare tensor on some Transformers versions and
    an output object on others; accept both."""
    if torch.is_tensor(output):
        return output
    for name in ("pooler_output", "image_embeds", "text_embeds", "last_hidden_state"):
        value = getattr(output, name, None)
        if torch.is_tensor(value):
            return value
    if isinstance(output, (tuple, list)) and output and torch.is_tensor(output[0]):
        return output[0]
    raise TypeError(f"Unexpected feature output type: {type(output).__name__}")


def resolve_state(score: float, thresholds: dict[str, float]) -> str:
    if score >= thresholds["present"]:
        return "present"
    if score <= thresholds["absent"]:
        return "absent"
    return "unsure"


class AttributeDetector:
    """Thread-safe wrapper around one loaded SigLIP model."""

    def __init__(
        self,
        model_id: str = MODEL_ID,
        thresholds: dict[str, dict[str, float]] | None = None,
    ):
        from transformers import AutoModel, AutoProcessor

        self.model_id = model_id
        self.thresholds = thresholds or DEFAULT_THRESHOLDS
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.processor = AutoProcessor.from_pretrained(model_id)
        self.model = AutoModel.from_pretrained(model_id).to(self.device).eval()
        self._lock = threading.Lock()

        # Text embeddings never change, so compute them once. Pairs are laid
        # out as consecutive rows: 2k = with attribute, 2k+1 = same context
        # without it.
        self._pair_index: list[tuple[str, int]] = []
        prompts: list[str] = []
        for attribute, pairs in ATTRIBUTE_PROMPTS.items():
            for pair_number, (positive, neutral) in enumerate(pairs):
                self._pair_index.append((attribute, pair_number))
                prompts.extend([positive, neutral])
        with torch.no_grad():
            text_inputs = self.processor(
                text=prompts,
                padding="max_length",
                max_length=64,
                return_tensors="pt",
            ).to(self.device)
            text_embeds = _as_tensor(self.model.get_text_features(**text_inputs))
            self._text_embeds = text_embeds / text_embeds.norm(dim=-1, keepdim=True)

    @staticmethod
    def load_image(data: bytes) -> Image.Image:
        return Image.open(io.BytesIO(data)).convert("RGB")

    def _probabilities(self, image: Image.Image) -> torch.Tensor:
        """Cosine similarity of the image to every prompt, in pair order."""
        with torch.no_grad():
            pixel_inputs = self.processor(images=image, return_tensors="pt").to(self.device)
            image_embeds = _as_tensor(self.model.get_image_features(**pixel_inputs))
            image_embeds = image_embeds / image_embeds.norm(dim=-1, keepdim=True)
            return (image_embeds @ self._text_embeds.T)[0].cpu()

    @staticmethod
    def _crop(image: Image.Image, region: tuple[float, float, float, float]) -> Image.Image:
        width, height = image.size
        left, top, right, bottom = region
        return image.crop((int(left * width), int(top * height), int(right * width), int(bottom * height)))

    def _scores_for_region(self, similarities: torch.Tensor) -> dict[str, dict[str, float]]:
        """Best paired contrast per attribute for one region.

        For each pair the score is sigmoid(T * (sim_with - sim_without)):
        0.5 means the attribute words added nothing, above means the image
        matches better with them, below means worse. The strongest pair wins
        so a cap scored by the "beanie" pair is not dragged down by "fedora".
        """
        values = similarities.tolist()
        best: dict[str, dict[str, float]] = {}
        for row, (attribute, _pair_number) in enumerate(self._pair_index):
            with_attribute = values[2 * row]
            without = values[2 * row + 1]
            contrast = 1.0 / (1.0 + math.exp(-CONTRAST_TEMPERATURE * (with_attribute - without)))
            current = best.get(attribute)
            if current is None or contrast > current["score"]:
                best[attribute] = {"score": contrast, "positive": with_attribute, "negative": without}
        return best

    def detect(self, image: Image.Image) -> dict[str, AttributeResult]:
        needed = sorted({name for names in ATTRIBUTE_REGIONS.values() for name in names})
        with self._lock:
            per_region = {
                name: self._scores_for_region(self._probabilities(self._crop(image, REGIONS[name])))
                for name in needed
            }

        chosen: dict[str, dict[str, float | str]] = {}
        for attribute, region_names in ATTRIBUTE_REGIONS.items():
            best = {"score": -1.0, "positive": 0.0, "negative": 0.0, "region": ""}
            for name in region_names:
                sides = per_region[name][attribute]
                # The region that sees the attribute most clearly wins, so a
                # miss on the full frame cannot hide a hit on the eyes.
                if sides["score"] > best["score"]:
                    best = {**sides, "region": name}
            chosen[attribute] = best

        # A turban or hijab matches "a person wearing a hat" well enough to be
        # called one: 4 in 10 head coverings were flagged as hats before this.
        # Hats are blocked and religious coverings are allowed, so the hat
        # verdict must also beat the head-covering description of the same
        # region. If the covering description fits better, it is not a hat.
        hat = chosen["hat"]
        cover_sim = per_region[hat["region"]]["head_covering"]["positive"]
        hat_vs_cover = 1.0 / (1.0 + math.exp(-CONTRAST_TEMPERATURE * (hat["positive"] - cover_sim)))
        hat["score"] = min(hat["score"], hat_vs_cover)

        results: dict[str, AttributeResult] = {}
        for attribute, best in chosen.items():
            results[attribute] = AttributeResult(
                attribute=attribute,
                score=float(best["score"]),
                positive=float(best["positive"]),
                negative=float(best["negative"]),
                state=resolve_state(float(best["score"]), self.thresholds[attribute]),
                region=str(best["region"]),
            )
        return results


_shared: AttributeDetector | None = None
_shared_lock = threading.Lock()


def get_detector() -> AttributeDetector:
    global _shared
    if _shared is None:
        with _shared_lock:
            if _shared is None:
                _shared = AttributeDetector()
    return _shared
