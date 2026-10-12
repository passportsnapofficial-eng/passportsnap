---
title: PassportSnap Attribute Detection
emoji: 🛂
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# PassportSnap attribute detection

Answers whether a finished passport photo shows glasses, a hat, a religious
head covering, or a face mask, with three-state verdicts (`present`, `absent`,
`unsure`). The PassportSnap app blocks on `present`, clears on `absent`, and
asks the customer to confirm on `unsure`. If this service is unreachable the
app treats every attribute as `unsure`.

- `GET /health`
- `POST /detect` with `{"dataUrl": "data:image/jpeg;base64,..."}`

Model: `google/siglip-base-patch16-224` (Apache-2.0), zero-shot. Thresholds
calibrated on 744 labelled images. Source and evaluation tooling live in the
PassportSnap repository under `services/attribute_detection`.
