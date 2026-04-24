import argparse
import shutil
from pathlib import Path


SPLIT_NAMES = {
    "0": "train",
    "1": "validation",
    "2": "test",
}


def parse_args():
    parser = argparse.ArgumentParser(
        description="Prepare a CelebA eyeglasses dataset split for classifier training.",
    )
    parser.add_argument("--images-dir", required=True, type=Path)
    parser.add_argument("--attributes-file", required=True, type=Path)
    parser.add_argument("--partition-file", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument(
        "--limit-per-class",
        type=int,
        default=0,
        help="Optional cap for each split/class. 0 keeps all images.",
    )
    return parser.parse_args()


def load_partitions(path: Path) -> dict[str, str]:
    partitions: dict[str, str] = {}
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            parts = line.strip().split()
            if len(parts) != 2:
                continue
            filename, partition_id = parts
            split_name = SPLIT_NAMES.get(partition_id)
            if split_name:
                partitions[filename] = split_name
    return partitions


def iter_attributes(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        total_images = int(handle.readline().strip())
        header = handle.readline().split()
        attribute_indexes = {name: index for index, name in enumerate(header)}
        eyeglasses_index = attribute_indexes.get("Eyeglasses")
        if eyeglasses_index is None:
            raise RuntimeError("CelebA attributes file did not contain the Eyeglasses column.")

        for _ in range(total_images):
            line = handle.readline()
            if not line:
                break
            parts = line.split()
            if len(parts) < len(header) + 1:
                continue
            filename = parts[0]
            eyeglasses_value = parts[1 + eyeglasses_index]
            yield filename, eyeglasses_value == "1"


def ensure_output_dirs(root: Path):
    for split in SPLIT_NAMES.values():
        for label in ("with_glasses", "without_glasses"):
            (root / split / label).mkdir(parents=True, exist_ok=True)


def main():
    args = parse_args()
    ensure_output_dirs(args.output_dir)
    partitions = load_partitions(args.partition_file)
    counters: dict[tuple[str, str], int] = {}

    for filename, with_glasses in iter_attributes(args.attributes_file):
        split = partitions.get(filename)
        if not split:
            continue

        label = "with_glasses" if with_glasses else "without_glasses"
        key = (split, label)
        count = counters.get(key, 0)
        if args.limit_per_class > 0 and count >= args.limit_per_class:
            continue

        source_path = args.images_dir / filename
        if not source_path.exists():
            continue

        destination_path = args.output_dir / split / label / filename
        shutil.copy2(source_path, destination_path)
        counters[key] = count + 1

    for split in SPLIT_NAMES.values():
        for label in ("with_glasses", "without_glasses"):
            total = counters.get((split, label), 0)
            print(f"{split}/{label}: {total}")


if __name__ == "__main__":
    main()
