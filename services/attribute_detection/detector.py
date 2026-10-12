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
import os
import threading
from dataclasses import dataclass
from typing import Any

import torch
from PIL import Image

MODEL_ID = os.getenv("ATTRIBUTE_MODEL_ID", "google/siglip-base-patch16-224")

# Positive prompts describe the attribute; negative prompts describe its
# absence. Several phrasings per side make the score robust to wording.
ATTRIBUTE_PROMPTS: dict[str, dict[str, list[str]]] = {
    "glasses": {
        "positive": [
            "a photo of a person wearing eyeglasses",
            "a close-up of a face wearing glasses",
            "a person wearing spectacles with a frame around the eyes",
            "a person wearing sunglasses",
        ],
        "negative": [
            "a photo of a person not wearing glasses",
            "a bare face with nothing over the eyes",
            "a close-up of a face with no eyewear",
        ],
    },
    "hat": {
        "positive": [
            "a person wearing a baseball cap",
            "a person wearing a hat",
            "a person wearing a knitted beanie",
            "a person wearing a flat cap",
            "a person wearing a fedora or brimmed hat",
        ],
        "negative": [
            "a person with uncovered hair and nothing on their head",
            "a bald person with nothing on their head",
            "a photo of a person with no hat",
        ],
    },
    "head_covering": {
        "positive": [
            "a woman wearing a hijab",
            "a person wearing a headscarf covering the hair",
            "a person wearing a turban",
            "a person wearing a religious head covering",
        ],
        "negative": [
            "a person with uncovered hair and nothing on their head",
            "a bald person with nothing on their head",
            "a photo of a person with no head covering",
        ],
    },
    "face_mask": {
        "positive": [
            "a person wearing a surgical face mask",
            "a person wearing a cloth face mask covering the nose and mouth",
            "a person wearing an N95 respirator mask",
        ],
        "negative": [
            "an uncovered face with the nose and mouth clearly visible",
            "a photo of a face with no mask",
        ],
    },
}

# Three-state operating points. "present" must be precise (a false block costs
# a sale); "absent" must be conservative (a false clear costs a rejected
# passport). Everything in between is a question for the customer.
DEFAULT_THRESHOLDS: dict[str, dict[str, float]] = {
    "glasses": {"present": 0.70, "absent": 0.35},
    "hat": {"present": 0.70, "absent": 0.35},
    "head_covering": {"present": 0.70, "absent": 0.35},
    "face_mask": {"present": 0.70, "absent": 0.35},
}


@dataclass(frozen=True)
class AttributeResult:
    attribute: str
    score: float
    positive: float
    negative: float
    state: str  # present | absent | unsure

    def to_dict(self) -> dict[str, Any]:
        return {
            "attribute": self.attribute,
            "score": round(self.score, 4),
            "positive": round(self.positive, 4),
            "negative": round(self.negative, 4),
            "state": self.state,
        }


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

        # Text embeddings never change, so compute them once.
        self._prompt_index: list[tuple[str, str]] = []
        prompts: list[str] = []
        for attribute, sides in ATTRIBUTE_PROMPTS.items():
            for side in ("positive", "negative"):
                for prompt in sides[side]:
                    self._prompt_index.append((attribute, side))
                    prompts.append(prompt)
        with torch.no_grad():
            text_inputs = self.processor(
                text=prompts,
                padding="max_length",
                max_length=64,
                return_tensors="pt",
            ).to(self.device)
            text_embeds = self.model.get_text_features(**text_inputs)
            self._text_embeds = text_embeds / text_embeds.norm(dim=-1, keepdim=True)
        self._logit_scale = self.model.logit_scale.exp().item()
        logit_bias = getattr(self.model, "logit_bias", None)
        self._logit_bias = float(logit_bias.item()) if logit_bias is not None else 0.0

    @staticmethod
    def load_image(data: bytes) -> Image.Image:
        return Image.open(io.BytesIO(data)).convert("RGB")

    def _probabilities(self, image: Image.Image) -> torch.Tensor:
        with torch.no_grad():
            pixel_inputs = self.processor(images=image, return_tensors="pt").to(self.device)
            image_embeds = self.model.get_image_features(**pixel_inputs)
            image_embeds = image_embeds / image_embeds.norm(dim=-1, keepdim=True)
            logits = image_embeds @ self._text_embeds.T * self._logit_scale + self._logit_bias
            # SigLIP is trained with a sigmoid loss, so each text is scored
            # independently rather than softmaxed against the others.
            return torch.sigmoid(logits)[0].cpu()

    def detect(self, image: Image.Image) -> dict[str, AttributeResult]:
        with self._lock:
            probabilities = self._probabilities(image)

        best: dict[str, dict[str, float]] = {}
        for (attribute, side), probability in zip(self._prompt_index, probabilities.tolist()):
            current = best.setdefault(attribute, {"positive": 0.0, "negative": 0.0})
            current[side] = max(current[side], probability)

        results: dict[str, AttributeResult] = {}
        for attribute, sides in best.items():
            positive = sides["positive"]
            negative = sides["negative"]
            # Absolute sigmoid values run low; the contrast between the best
            # positive and the best negative prompt is what separates classes.
            score = positive / (positive + negative + 1e-9)
            results[attribute] = AttributeResult(
                attribute=attribute,
                score=score,
                positive=positive,
                negative=negative,
                state=resolve_state(score, self.thresholds[attribute]),
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
