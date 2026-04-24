import asyncio
import io
import os
from functools import lru_cache

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from PIL import Image, ImageFilter, ImageOps
from rembg import new_session, remove


DEFAULT_MODEL = "u2net_human_seg"
ALLOWED_MODELS = {
    "u2net_human_seg",
    "isnet-general-use",
}
JPEG_QUALITY = 96
EDGE_FEATHER_RADIUS = float(os.getenv("BACKGROUND_REMOVAL_FEATHER_RADIUS", "1.15"))
QUALITY_THRESHOLD = float(os.getenv("BACKGROUND_REMOVAL_QUALITY_THRESHOLD", "0.55"))
MAX_UPLOAD_BYTES = int(os.getenv("BACKGROUND_REMOVAL_MAX_UPLOAD_BYTES", str(8 * 1024 * 1024)))
WHITE_BACKGROUND_THRESHOLD = float(os.getenv("BACKGROUND_REMOVAL_WHITE_THRESHOLD", "246"))

app = FastAPI(title="PassportSnap Background Removal Service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)


class LowConfidenceMaskError(RuntimeError):
    pass


@lru_cache(maxsize=len(ALLOWED_MODELS))
def get_session(model_name: str):
    return new_session(model_name)


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def compute_mask_quality(alpha_channel: Image.Image) -> dict[str, float]:
    width, height = alpha_channel.size
    pixels = list(alpha_channel.getdata())
    total_pixels = max(width * height, 1)
    transparent_pixels = sum(1 for value in pixels if value <= 8)
    foreground_pixels = sum(1 for value in pixels if value >= 247)
    feather_pixels = total_pixels - transparent_pixels - foreground_pixels

    border_size = max(2, min(width, height) // 40)
    alpha_values = alpha_channel.load()
    border_pixels = 0
    border_foreground = 0

    for y in range(height):
        for x in range(width):
            in_border = (
                x < border_size
                or y < border_size
                or x >= width - border_size
                or y >= height - border_size
            )
            if not in_border:
                continue
            border_pixels += 1
            if alpha_values[x, y] >= 48:
                border_foreground += 1

    transparent_ratio = transparent_pixels / total_pixels
    foreground_ratio = foreground_pixels / total_pixels
    feather_ratio = feather_pixels / total_pixels
    border_foreground_ratio = border_foreground / max(border_pixels, 1)

    quality = 1.0

    if transparent_ratio < 0.08 or transparent_ratio > 0.9:
        quality -= 0.42

    if foreground_ratio < 0.08 or foreground_ratio > 0.88:
        quality -= 0.3

    if border_foreground_ratio > 0.46:
        quality -= 0.22

    if feather_ratio > 0.28:
        quality -= 0.14

    return {
        "quality_score": clamp(quality, 0.0, 1.0),
        "transparent_ratio": transparent_ratio,
        "foreground_ratio": foreground_ratio,
        "feather_ratio": feather_ratio,
        "border_foreground_ratio": border_foreground_ratio,
    }


def verify_white_background(image: Image.Image, alpha_channel: Image.Image) -> dict[str, float]:
    rgb_image = image.convert("RGB")
    width, height = rgb_image.size
    sample_depth = max(2, min(width, height) // 40)
    pixels = rgb_image.load()
    alpha_values = alpha_channel.load()
    total = 0
    count = 0
    channel_spread_total = 0

    corner_regions = [
        (0, 0, sample_depth, sample_depth),
        (width - sample_depth, 0, width, sample_depth),
        (0, height - sample_depth, sample_depth, height),
        (width - sample_depth, height - sample_depth, width, height),
    ]

    for start_x, start_y, end_x, end_y in corner_regions:
        for y in range(start_y, end_y):
            for x in range(start_x, end_x):
                if alpha_values[x, y] > 64:
                    continue
                red, green, blue = pixels[x, y]
                total += (red + green + blue) / 3
                channel_spread_total += max(red, green, blue) - min(red, green, blue)
                count += 1

    if count == 0:
        return {
            "verified": 1.0,
            "mean_luminance": 255.0,
            "mean_channel_spread": 0.0,
        }

    mean_luminance = total / max(count, 1)
    mean_channel_spread = channel_spread_total / max(count, 1)
    verified = mean_luminance >= WHITE_BACKGROUND_THRESHOLD and mean_channel_spread <= 6

    return {
        "verified": 1.0 if verified else 0.0,
        "mean_luminance": mean_luminance,
        "mean_channel_spread": mean_channel_spread,
    }


def remove_background_locally(image_bytes: bytes, model_name: str) -> tuple[bytes, dict[str, float]]:
    session = get_session(model_name)
    removed_bytes = remove(
        image_bytes,
        session=session,
        force_return_bytes=True,
        post_process_mask=True,
    )

    with Image.open(io.BytesIO(removed_bytes)) as cutout:
        rgba_cutout = ImageOps.exif_transpose(cutout).convert("RGBA")
        alpha_channel = rgba_cutout.getchannel("A")
        if EDGE_FEATHER_RADIUS > 0:
            alpha_channel = alpha_channel.filter(ImageFilter.GaussianBlur(radius=EDGE_FEATHER_RADIUS))
            rgba_cutout.putalpha(alpha_channel)

        metrics = compute_mask_quality(alpha_channel)
        if metrics["quality_score"] < QUALITY_THRESHOLD:
            raise LowConfidenceMaskError("Background not clean, please retake photo")

        flattened = Image.new("RGBA", rgba_cutout.size, (255, 255, 255, 255))
        flattened.alpha_composite(rgba_cutout)
        rgb_image = flattened.convert("RGB")
        white_background = verify_white_background(rgb_image, alpha_channel)
        if not white_background["verified"]:
            raise LowConfidenceMaskError("Background not clean, please retake photo")

        output_buffer = io.BytesIO()
        rgb_image.save(output_buffer, format="JPEG", quality=JPEG_QUALITY, optimize=True, subsampling=0)
        return output_buffer.getvalue(), {
            **metrics,
            "white_background_verified": white_background["verified"],
            "white_background_luminance": white_background["mean_luminance"],
            "white_background_spread": white_background["mean_channel_spread"],
        }


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/remove-bg")
async def remove_bg(
    file: UploadFile = File(...),
    model: str = Form(DEFAULT_MODEL),
):
    normalized_model = (model or DEFAULT_MODEL).strip() or DEFAULT_MODEL
    if normalized_model not in ALLOWED_MODELS:
        return JSONResponse(
            status_code=400,
            content={
                "message": "Unsupported background removal model.",
                "allowedModels": sorted(ALLOWED_MODELS),
            },
        )

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Image file is required.")

    if len(image_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image file is too large.")

    try:
        output_bytes, metrics = await asyncio.to_thread(
            remove_background_locally,
            image_bytes,
            normalized_model,
        )
    except LowConfidenceMaskError as error:
        return JSONResponse(status_code=422, content={"message": str(error)})
    except Exception as error:
        return JSONResponse(
            status_code=500,
            content={"message": str(error) or "Background removal failed."},
        )

    return Response(
        content=output_bytes,
        media_type="image/jpeg",
        headers={
            "X-Background-Model": normalized_model,
            "X-Background-Mask-Quality": f"{metrics['quality_score']:.4f}",
            "X-Background-Transparent-Ratio": f"{metrics['transparent_ratio']:.4f}",
            "X-Background-Foreground-Ratio": f"{metrics['foreground_ratio']:.4f}",
            "X-Background-Feather-Ratio": f"{metrics['feather_ratio']:.4f}",
            "X-Background-White-Verified": f"{metrics['white_background_verified']:.4f}",
        },
    )
