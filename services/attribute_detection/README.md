# Attribute Detection Service

Answers four questions about a finished passport photo with one model:

| attribute       | what it looks for                               | app policy                         |
|-----------------|-------------------------------------------------|------------------------------------|
| `glasses`       | eyeglasses, sunglasses                          | blocks checkout                    |
| `hat`           | caps, beanies, brimmed hats, fashion headwear   | blocks checkout                    |
| `head_covering` | hijab, headscarf, turban, kippah                | **allowed**; full face must show   |
| `face_mask`     | surgical, cloth, N95                            | blocks checkout                    |

Every attribute resolves to one of three states: `present`, `absent`, or
`unsure`. The app blocks on `present`, clears on `absent`, and asks the
customer to confirm on `unsure`. **If this service is unreachable the app
treats every attribute as `unsure`** - a missing service can never read as
"nothing detected".

## Model and licence

`google/siglip-base-patch16-224`, Apache-2.0, used zero-shot: the image is
scored against text prompts, so no training data is involved and no dataset
licence is inherited. The prompts and thresholds live in `detector.py`.

## Run locally

```bash
py -3.14 -m venv .venv
.venv/Scripts/python -m pip install -r services/attribute_detection/requirements.txt
.venv/Scripts/python -m uvicorn services.attribute_detection.main:app --host 127.0.0.1 --port 8789
```

The first start downloads ~375 MB of weights from the Hugging Face Hub.

Then point the app at it. Locally that is `.env.local`:

```
ATTRIBUTE_SERVICE_URL=http://127.0.0.1:8789/detect
```

In production set the same variable in Vercel to the deployed service URL.
The browser never calls the service directly; `api/attributes.js` proxies to
it so the URL stays private.

## API

- `GET /health` - model id, device, active thresholds.
- `POST /detect` - body `{"dataUrl": "data:image/jpeg;base64,..."}`.
- `POST /detect/upload` - multipart field `image`.

Response:

```json
{
  "model": "google/siglip-base-patch16-224",
  "attributes": {
    "glasses": {"attribute": "glasses", "score": 0.91, "positive": 0.42, "negative": 0.04, "state": "present"},
    "hat": {"...": "..."},
    "head_covering": {"...": "..."},
    "face_mask": {"...": "..."}
  },
  "present": ["glasses"],
  "unsure": [],
  "absent": ["hat", "head_covering", "face_mask"]
}
```

## Deploy

`Dockerfile` builds a CPU-only image with the weights baked in, so cold
starts do not depend on the Hub. Any container host works (Railway, Render,
Fly.io). Give it at least 2 GB of memory. Health check: `GET /health`.

## Measure before trusting it

```bash
# the hand-labelled passport-style fixtures
.venv/Scripts/python -m services.attribute_detection.evaluate_fixtures

# a larger commercially-licensed set, cropped head-and-shoulders
.venv/Scripts/python -m services.attribute_detection.prepare_openimages_eval \
    --output-dir services/attribute_detection/data/openimages --per-group 120
.venv/Scripts/python -m services.attribute_detection.evaluate_fixtures \
    --ground-truth services/attribute_detection/data/openimages/ground-truth.json \
    --fixtures-root services/attribute_detection/data/openimages
```

The evaluator reports, per attribute, how many labelled positives were
caught, asked about, or **silently missed** (marked absent), and how many
compliant photos were falsely blocked. Silent misses must be zero; that is
the number that costs a customer a rejected application. False blocks cost a
sale, so they are reported with equal prominence.

Thresholds are tuned to those two numbers, not to a headline accuracy.
