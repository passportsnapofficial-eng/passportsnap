"""HTTP front for the zero-shot attribute detector.

Run from the repository root:

    uvicorn services.attribute_detection.main:app --host 127.0.0.1 --port 8789

The app never calls this directly from the browser. The Vercel function at
api/attributes.js proxies to ATTRIBUTE_SERVICE_URL so the service stays private
and the model can live on a host with enough memory for it.
"""

from __future__ import annotations

import base64
import os
import re
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel

from .detector import DEFAULT_THRESHOLDS, MODEL_ID, get_detector

APP = FastAPI(title="PassportSnap Attribute Detection")
app = APP

MAX_IMAGE_BYTES = int(os.getenv("ATTRIBUTE_MAX_IMAGE_BYTES", str(8 * 1024 * 1024)))
DATA_URL_RE = re.compile(r"^data:(image/[a-zA-Z0-9.+-]+);base64,(.+)$", re.DOTALL)


class DetectRequest(BaseModel):
    dataUrl: str


def _decode_data_url(value: str) -> bytes:
    match = DATA_URL_RE.match(value.strip())
    if not match:
        raise HTTPException(status_code=400, detail="dataUrl must be a base64 image data URL.")
    try:
        raw = base64.b64decode(match.group(2), validate=True)
    except Exception as error:  # noqa: BLE001 - any decode failure is a client error
        raise HTTPException(status_code=400, detail="dataUrl is not valid base64.") from error
    if len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image is too large.")
    return raw


def _run(image_bytes: bytes) -> dict[str, Any]:
    detector = get_detector()
    try:
        image = detector.load_image(image_bytes)
    except Exception as error:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Could not decode the image.") from error

    results = detector.detect(image)
    return {
        "model": detector.model_id,
        "attributes": {name: result.to_dict() for name, result in results.items()},
        "present": [name for name, result in results.items() if result.state == "present"],
        "unsure": [name for name, result in results.items() if result.state == "unsure"],
        "absent": [name for name, result in results.items() if result.state == "absent"],
    }


@APP.get("/health")
def health() -> dict[str, Any]:
    detector = get_detector()
    return {
        "ok": True,
        "model": MODEL_ID,
        "device": str(detector.device),
        "thresholds": DEFAULT_THRESHOLDS,
    }


@APP.post("/detect")
def detect(request: DetectRequest) -> dict[str, Any]:
    return _run(_decode_data_url(request.dataUrl))


@APP.post("/detect/upload")
async def detect_upload(image: UploadFile = File(...)) -> dict[str, Any]:
    raw = await image.read()
    if len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image is too large.")
    return _run(raw)
