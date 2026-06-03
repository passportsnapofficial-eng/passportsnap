# PassportSnap

PassportSnap now supports an optional final-stage enhancement pass using [xinntao/Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN). The enhancer runs after the passport export is already framed and normalized, so the same polished image is used for the review preview, the downloadable JPG, and the order payload saved for checkout.

If the enhancer is unavailable, the app silently keeps the current export instead of failing the photo flow.

## Real-ESRGAN setup

1. Create a Python environment on a PyTorch-supported Python version.
2. Install the enhancer service dependencies:

```bash
pip install -r services/image_enhancement/requirements.txt
```

3. Start the enhancer:

```bash
npm run dev:image-enhancer
```

4. Run the app with the enhancer enabled:

```bash
npm run dev:full
```

The proxy expects the enhancer at `http://127.0.0.1:8788/enhance` by default. Override it with `REAL_ESRGAN_SERVICE_URL` if you host the model elsewhere.

## Tuning

- `VITE_IMAGE_ENHANCEMENT_MODEL` defaults to `realesr-general-x4v3`
- `VITE_IMAGE_ENHANCEMENT_SCALE` defaults to `2`
- `VITE_IMAGE_ENHANCEMENT_DENOISE` defaults to `0.5`
- `VITE_IMAGE_ENHANCEMENT_ENABLED=false` disables the enhancement pass without removing the integration
