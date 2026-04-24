import argparse
import json
from pathlib import Path

from mediapipe_model_maker import image_classifier


def parse_args():
    parser = argparse.ArgumentParser(
        description="Train a binary eyewear classifier for PassportSnap.",
    )
    parser.add_argument("--dataset-dir", required=True, type=Path)
    parser.add_argument("--export-dir", required=True, type=Path)
    parser.add_argument("--epochs", type=int, default=12)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--learning-rate", type=float, default=0.001)
    parser.add_argument(
        "--model",
        choices=["mobilenet_v2", "efficientnet_lite0", "efficientnet_lite2"],
        default="efficientnet_lite0",
    )
    return parser.parse_args()


def resolve_model_spec(name: str):
    if name == "mobilenet_v2":
        return image_classifier.SupportedModels.MOBILENET_V2
    if name == "efficientnet_lite2":
        return image_classifier.SupportedModels.EFFICIENTNET_LITE2
    return image_classifier.SupportedModels.EFFICIENTNET_LITE0


def main():
    args = parse_args()
    args.export_dir.mkdir(parents=True, exist_ok=True)
    train_dir = args.dataset_dir / "train"
    validation_dir = args.dataset_dir / "validation"
    test_dir = args.dataset_dir / "test"

    train_data = image_classifier.Dataset.from_folder(str(train_dir))
    validation_data = image_classifier.Dataset.from_folder(str(validation_dir))
    test_data = image_classifier.Dataset.from_folder(str(test_dir))

    hparams = image_classifier.HParams(
        export_dir=str(args.export_dir),
        epochs=args.epochs,
        batch_size=args.batch_size,
        learning_rate=args.learning_rate,
        do_data_augmentation=True,
        do_fine_tuning=True,
    )
    options = image_classifier.ImageClassifierOptions(
        supported_model=resolve_model_spec(args.model),
        hparams=hparams,
    )

    model = image_classifier.ImageClassifier.create(
        train_data=train_data,
        validation_data=validation_data,
        options=options,
    )
    loss, accuracy = model.evaluate(test_data)
    model.export_model()

    metrics_path = args.export_dir / "metrics.json"
    metrics_path.write_text(
        json.dumps(
            {
                "model": args.model,
                "epochs": args.epochs,
                "batchSize": args.batch_size,
                "learningRate": args.learning_rate,
                "testLoss": loss,
                "testAccuracy": accuracy,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(metrics_path)


if __name__ == "__main__":
    main()
