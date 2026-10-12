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

Thresholds are tuned to those two numbers, not to a headline accuracy:

```bash
.venv/Scripts/python -m services.attribute_detection.calibrate_thresholds \
    --inputs fixtures.json openimages.json --max-false-block 0.03 \
    --out services/attribute_detection/thresholds.json
```

`detector.py` loads `thresholds.json` from its own directory at start-up
(`ATTRIBUTE_THRESHOLDS_PATH` overrides the location). Without the file it
falls back to conservative defaults that ask the customer far more often.

## How the score is built

Each attribute has prompt *pairs* - "a close-up of a face wearing glasses"
against "a close-up of a face" - with identical context words, so only the
attribute differs. The score is the sigmoid of the similarity difference, and
the strongest pair wins. Each attribute is also scored on fixed regions of the
passport frame (eyes, face, crown, lower face) as well as the whole image, and
the clearest region wins. Both choices came out of measurement: absolute
"match" scores let a black-and-white portrait outscore real glasses, and a
full-frame-only view missed thin frames.

The hat score is additionally capped by a hat-versus-head-covering contrast
on the same region: a turban or hijab matches "a person wearing a hat" well
enough that 4 in 10 head coverings were flagged as hats before this. Hats are
blocked and religious coverings are allowed, so when the covering description
fits the image better than the hat description, the hat score falls below
"present" and the customer is asked instead of blocked.

## What the labelled data taught us

- Open Images image-level labels only say an object is *somewhere* in the
  picture. Used naively, a third of the "hat" positives were bare heads. The
  prep script now requires the hat or glasses **box to sit on the cropped
  face**, and verifies clean negatives against human-verified-absent labels.
- Open Images' **"Face mask" class is the American-football face guard**, not
  a medical mask. Masks are evaluated on `data/facemask` instead.
- Open Images' "Hat" verified-absent label is class-specific: helmets,
  scarves and turbans pass it. The clean set excludes those classes.
- The 35 hand-labelled passport fixtures remain the authority on false
  blocks; the public sets are for recall and threshold placement.
