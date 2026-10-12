# Eyewear Detection Training

> **Commercial-use warning.** PassportSnap is a paid product, so any model that
> ships must be trainable on commercially-licensed data. CelebA, CelebAMask-HQ
> and WIDER FACE are **not** usable here: CelebA's agreement bars commercial
> exploitation of the images *and of derived data*, which covers a trained
> model, and WIDER FACE is CC BY-NC-ND. `prepare_celeba_eyewear_dataset.py` is
> kept only for non-commercial research comparison. **Do not ship a model
> trained with it.** Use a commercially-licensed source instead - see
> "Commercially-licensed sources" below.

This repo currently ships a browser-side passport validator. The existing glasses check was originally heuristic. The runtime supports an optional learned classifier configured with `VITE_EYEWEAR_CLASSIFIER_MODEL_PATH`. The conventional public path is:

`public/models/eyewear_classifier.tflite`

If that model is absent, the app falls back to the heuristic detector.

## Official dataset sources

These are the primary-source datasets and papers I selected for improving the face and eyewear stack:

- CelebA: https://mmlab.ie.cuhk.edu.hk/projects/CelebA.html
  Uses 202,599 face images with 40 binary attributes, including `Eyeglasses`.
- CelebAMask-HQ: https://mmlab.ie.cuhk.edu.hk/projects/CelebA/CelebAMask_HQ.html
  Adds high-resolution face parsing masks, including an `eyeglass` class.
- WIDER FACE: https://shuoyang1213.me/WIDERFACE/index.html
  Standard face detection benchmark with strong pose, scale, and occlusion variation.
- UFDD: https://ufdd.info/
  Useful evaluation set for unconstrained face detection under blur, weather, and lighting degradation.

## Licensing and usage constraints

Read the upstream licenses before training or shipping any model derived from these datasets.

- CelebA and CelebAMask-HQ are listed for non-commercial research purposes only.
- WIDER FACE is listed under CC BY-NC-ND on the dataset site.
- Do not scrape arbitrary face websites. Use curated datasets with explicit terms.

## Recommended split of responsibilities

- Face detection and landmarks:
  Keep MediaPipe for now, but evaluate it on WIDER FACE and UFDD before deciding whether to replace it with a custom detector such as RetinaFace.
- Eyewear detection:
  Train a dedicated binary classifier on a commercially-licensed source (see
  below), then calibrate it against passport-style images and hard negatives.
  Do not train the shipped model on CelebA; see the warning at the top.
- Background / blur / lighting:
  These are application-specific quality checks. They need a passport-photo-specific validation set, not only generic face datasets.

## Commercially-licensed sources

Use these for anything that ships:

- Open Images V7: https://storage.googleapis.com/openimages/web/factsfigures_v7.html
  Annotations are CC BY 4.0 and the images are listed as CC BY 2.0, so both are
  usable commercially with attribution. Carries hat- and glasses-family classes.
- Roboflow Universe projects published under CC BY 4.0. Check each project
  individually; a dataset licence does not always cover trained weights.

`train_eyewear_classifier.py` is dataset-agnostic - it calls
`image_classifier.Dataset.from_folder`. Any prep script only has to emit this
layout, which is also what the runtime's label matching expects:

- `train/with_glasses`, `train/without_glasses`
- `validation/with_glasses`, `validation/without_glasses`
- `test/with_glasses`, `test/without_glasses`

So swapping data sources means writing a new `prepare_*` script with the same
output contract. The trainer and the browser runtime stay unchanged.

## Prepare CelebA for training (non-commercial research only)

1. Download CelebA images and annotation files from the official site.
2. Run:

```bash
python services/eyewear_detection/prepare_celeba_eyewear_dataset.py ^
  --images-dir C:\path\to\img_align_celeba ^
  --attributes-file C:\path\to\list_attr_celeba.txt ^
  --partition-file C:\path\to\list_eval_partition.txt ^
  --output-dir C:\path\to\celeba_eyewear_split
```

This creates:

- `train/with_glasses`
- `train/without_glasses`
- `validation/with_glasses`
- `validation/without_glasses`
- `test/with_glasses`
- `test/without_glasses`

## Train the classifier

Install the training dependencies:

```bash
pip install -r services/eyewear_detection/requirements.txt
```

Then run:

```bash
python services/eyewear_detection/train_eyewear_classifier.py ^
  --dataset-dir C:\path\to\celeba_eyewear_split ^
  --export-dir C:\path\to\eyewear_model_export
```

The exported TFLite model is expected at:

- `C:\path\to\eyewear_model_export\model.tflite`

Copy it into:

- `public/models/eyewear_classifier.tflite`

Then set `VITE_EYEWEAR_CLASSIFIER_MODEL_PATH=/models/eyewear_classifier.tflite`
for the environments that ship the model. When it is unset, the app uses the
high-precision browser heuristic without issuing a missing-model request.

## Accuracy target

Do not optimize for a single headline number. Track at least:

- Precision on `with_glasses`
- Recall on `with_glasses`
- False positive rate on `without_glasses`
- Passport-style holdout accuracy on your own validation images

For this product, false positives are especially painful because they wrongly block checkout.
