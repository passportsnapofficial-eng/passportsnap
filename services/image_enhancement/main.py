from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import torch
from basicsr.archs.rrdbnet_arch import RRDBNet
from basicsr.utils.download_util import load_file_from_url
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from realesrgan import RealESRGANer
from realesrgan.archs.srvgg_arch import SRVGGNetCompact

APP = FastAPI(title="PassportSnap Real-ESRGAN Service")
ROOT_DIR = Path(__file__).resolve().parent
WEIGHTS_DIR = ROOT_DIR / "weights"
WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)
DEFAULT_MODEL = os.getenv("REAL_ESRGAN_MODEL", "realesr-general-x4v3")
DEFAULT_OUTSCALE = float(os.getenv("REAL_ESRGAN_DEFAULT_OUTSCALE", "2"))
DEFAULT_DENOISE_STRENGTH = float(os.getenv("REAL_ESRGAN_DEFAULT_DENOISE", "0.5"))
MAX_UPLOAD_BYTES = int(os.getenv("REAL_ESRGAN_MAX_UPLOAD_BYTES", str(8 * 1024 * 1024)))
USE_FP32 = os.getenv("REAL_ESRGAN_USE_FP32", "").strip().lower() in {"1", "true", "yes"}


def _build_model_config(model_name: str) -> dict[str, Any]:
    normalized = model_name.split(".")[0].strip()

    if normalized == "RealESRGAN_x4plus":
        return {
            "model_name": normalized,
            "model": RRDBNet(
                num_in_ch=3,
                num_out_ch=3,
                num_feat=64,
                num_block=23,
                num_grow_ch=32,
                scale=4,
            ),
            "netscale": 4,
            "file_urls": [
                "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth",
            ],
        }

    if normalized == "RealESRGAN_x2plus":
        return {
            "model_name": normalized,
            "model": RRDBNet(
                num_in_ch=3,
                num_out_ch=3,
                num_feat=64,
                num_block=23,
                num_grow_ch=32,
                scale=2,
            ),
            "netscale": 2,
            "file_urls": [
                "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth",
            ],
        }

    if normalized == "realesr-general-x4v3":
        return {
            "model_name": normalized,
            "model": SRVGGNetCompact(
                num_in_ch=3,
                num_out_ch=3,
                num_feat=64,
                num_conv=32,
                upscale=4,
                act_type="prelu",
            ),
            "netscale": 4,
            "file_urls": [
                "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-general-wdn-x4v3.pth",
                "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-general-x4v3.pth",
            ],
        }

    raise HTTPException(status_code=400, detail=f"Unsupported Real-ESRGAN model: {model_name}")


def _download_weights(config: dict[str, Any]) -> tuple[Any, Any]:
    file_urls = config["file_urls"]
    model_name = config["model_name"]

    primary_model_path: str | list[str] | None = None
    for url in file_urls:
        primary_model_path = load_file_from_url(
            url=url,
            model_dir=str(WEIGHTS_DIR),
            progress=True,
            file_name=None,
        )

    dni_weight = None
    if model_name == "realesr-general-x4v3":
        primary_model_path = os.path.join(str(WEIGHTS_DIR), f"{model_name}.pth")
        if not os.path.isfile(primary_model_path):
            primary_model_path = load_file_from_url(
                url=file_urls[-1],
                model_dir=str(WEIGHTS_DIR),
                progress=True,
                file_name=None,
            )

        wdn_model_path = primary_model_path.replace(
            "realesr-general-x4v3",
            "realesr-general-wdn-x4v3",
        )
        if not os.path.isfile(wdn_model_path):
            load_file_from_url(
                url=file_urls[0],
                model_dir=str(WEIGHTS_DIR),
                progress=True,
                file_name=None,
            )
        primary_model_path = [primary_model_path, wdn_model_path]
        dni_weight = "dynamic"

    return primary_model_path, dni_weight


@lru_cache(maxsize=8)
def _get_upsampler(model_name: str, rounded_denoise_strength: int) -> RealESRGANer:
    config = _build_model_config(model_name)
    model_path, dni_weight = _download_weights(config)
    denoise_strength = rounded_denoise_strength / 1000

    resolved_dni_weight = None
    if config["model_name"] == "realesr-general-x4v3" and dni_weight == "dynamic":
        resolved_dni_weight = [denoise_strength, 1 - denoise_strength]

    return RealESRGANer(
        scale=config["netscale"],
        model_path=model_path,
        dni_weight=resolved_dni_weight,
        model=config["model"],
        tile=0,
        tile_pad=10,
        pre_pad=0,
        half=torch.cuda.is_available() and not USE_FP32,
        gpu_id=0 if torch.cuda.is_available() else None,
    )


def _resize_to_target(image: np.ndarray, target_width: int, target_height: int) -> np.ndarray:
    if target_width <= 0 or target_height <= 0:
        return image

    if image.shape[1] == target_width and image.shape[0] == target_height:
        return image

    return cv2.resize(image, (target_width, target_height), interpolation=cv2.INTER_LANCZOS4)


@APP.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@APP.post("/enhance")
async def enhance(
    file: UploadFile = File(...),
    model: str = Form(DEFAULT_MODEL),
    outscale: float = Form(DEFAULT_OUTSCALE),
    denoise_strength: float = Form(DEFAULT_DENOISE_STRENGTH),
    target_width: int = Form(600),
    target_height: int = Form(600),
) -> Response:
    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="Image file is required.")

    if len(payload) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image file is too large.")

    source = cv2.imdecode(np.frombuffer(payload, np.uint8), cv2.IMREAD_COLOR)
    if source is None:
        raise HTTPException(status_code=415, detail="The uploaded file is not a valid image.")

    normalized_denoise = min(1.0, max(0.0, float(denoise_strength)))
    normalized_outscale = max(1.0, float(outscale))
    normalized_target_width = max(1, int(target_width))
    normalized_target_height = max(1, int(target_height))

    try:
        upsampler = _get_upsampler(model, round(normalized_denoise * 1000))
        output, _ = upsampler.enhance(source, outscale=normalized_outscale)
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - defensive wrapper for runtime issues
        raise HTTPException(status_code=500, detail=f"Real-ESRGAN enhancement failed: {exc}") from exc

    output = _resize_to_target(output, normalized_target_width, normalized_target_height)
    encoded, result = cv2.imencode(
        ".jpg",
        output,
        [int(cv2.IMWRITE_JPEG_QUALITY), 96],
    )
    if not encoded:
        raise HTTPException(status_code=500, detail="Could not encode the enhanced image.")

    return Response(
        content=result.tobytes(),
        media_type="image/jpeg",
        headers={
            "X-Enhancement-Model": model,
            "X-Enhancement-Scale": str(normalized_outscale),
            "X-Enhancement-Target-Width": str(normalized_target_width),
            "X-Enhancement-Target-Height": str(normalized_target_height),
        },
    )


app = APP
