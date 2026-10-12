"""Create or update the Hugging Face Space that hosts the attribute service.

    set HF_TOKEN=hf_...            (a WRITE token from huggingface.co/settings/tokens)
    .venv/Scripts/python services/attribute_detection/hf-space/deploy_space.py --space <user>/passportsnap-attributes

Builds nothing locally. It uploads the service source, thresholds, the Space
Dockerfile and README; Hugging Face builds the image on its own CPU Basic
hardware (2 vCPU, 16 GB, free). First build takes ~10 minutes (it downloads
PyTorch and the model weights); later ones are faster.

The Space is created PRIVATE by default. A private Space needs an HF token on
every request, so set ATTRIBUTE_SERVICE_TOKEN in Vercel to the same token (a
READ token is enough for that). Pass --public to skip the token requirement.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SERVICE = ROOT / "services" / "attribute_detection"
SPACE_DIR = SERVICE / "hf-space"

UPLOADS = [
    (SPACE_DIR / "Dockerfile", "Dockerfile"),
    (SPACE_DIR / "README.md", "README.md"),
    (SERVICE / "requirements.txt", "requirements.txt"),
    (ROOT / "services" / "__init__.py", "services/__init__.py"),
    (SERVICE / "__init__.py", "services/attribute_detection/__init__.py"),
    (SERVICE / "detector.py", "services/attribute_detection/detector.py"),
    (SERVICE / "main.py", "services/attribute_detection/main.py"),
    (SERVICE / "thresholds.json", "services/attribute_detection/thresholds.json"),
]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--space", required=True, help="owner/name of the Space, e.g. passportsnap/attributes")
    parser.add_argument("--public", action="store_true", help="make the Space public (no token needed to call it)")
    args = parser.parse_args()

    token = os.environ.get("HF_TOKEN", "").strip()
    if not token:
        print("HF_TOKEN is not set. Create a WRITE token at https://huggingface.co/settings/tokens", file=sys.stderr)
        return 2

    from huggingface_hub import HfApi

    api = HfApi(token=token)
    api.create_repo(repo_id=args.space, repo_type="space", space_sdk="docker", private=not args.public, exist_ok=True)

    for source, destination in UPLOADS:
        if not source.exists():
            print(f"missing {source}", file=sys.stderr)
            return 1
    operations = [(str(source), destination) for source, destination in UPLOADS]
    from huggingface_hub import CommitOperationAdd

    api.create_commit(
        repo_id=args.space,
        repo_type="space",
        operations=[CommitOperationAdd(path_in_repo=dest, path_or_fileobj=src) for src, dest in operations],
        commit_message="Deploy PassportSnap attribute detection service",
    )

    owner, name = args.space.split("/", 1)
    host = f"https://{owner}-{name}.hf.space".replace("_", "-").lower()
    print("uploaded. Hugging Face is building the image now (watch the Logs tab).")
    print(f"Space page:        https://huggingface.co/spaces/{args.space}")
    print(f"Service URL:       {host}/detect")
    print(f"Health check:      {host}/health")
    print("Then in Vercel set ATTRIBUTE_SERVICE_URL to the service URL" + ("" if args.public else " and ATTRIBUTE_SERVICE_TOKEN to an HF read token") + ", and redeploy.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
