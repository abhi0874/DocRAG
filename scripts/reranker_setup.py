"""Install the approved optional reranker wholly inside one removable directory."""

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / ".local/reranker-minilm"


def environment():
    env = os.environ.copy()
    for key, relative in {
        "HF_HOME": "cache/huggingface",
        "TORCH_HOME": "cache/torch",
        "SENTENCE_TRANSFORMERS_HOME": "cache/sentence-transformers",
        "XDG_CACHE_HOME": "cache",
        "PIP_CACHE_DIR": "cache/pip",
        "TMPDIR": "tmp",
        "PYTHONPYCACHEPREFIX": "cache/pycache",
    }.items():
        path = TARGET / relative
        path.mkdir(parents=True, exist_ok=True)
        env[key] = str(path)
    env.update(HF_HUB_DISABLE_TELEMETRY="1", DO_NOT_TRACK="1", PYTHONNOUSERSITE="1")
    return env


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--remove", action="store_true")
    args = parser.parse_args()
    if TARGET.is_symlink():
        raise ValueError("Refusing a symlinked reranker directory")
    marker = TARGET / "owner.json"
    identity = {"project": str(ROOT), "directory": str(TARGET)}
    if args.remove:
        if not marker.exists() or json.loads(marker.read_text()) != identity:
            raise ValueError("Removal requires this project's exact ownership marker")
        # The operator must first stop Next.js / the worker, as documented.
        shutil.rmtree(TARGET)
        if TARGET.exists():
            raise ValueError("Reranker directory still exists")
        print("Project-local reranker environment, weights and caches removed.")
        return
    if TARGET.exists() and (
        not marker.exists() or json.loads(marker.read_text()) != identity
    ):
        raise ValueError("Existing reranker directory is not owned by this setup")
    TARGET.mkdir(parents=True, exist_ok=True)
    marker.write_text(json.dumps(identity, indent=2) + "\n")
    env = environment()
    python = TARGET / "env/bin/python"
    if not python.exists():
        subprocess.run(
            [sys.executable, "-m", "venv", str(TARGET / "env")], env=env, check=True
        )
    subprocess.run(
        [
            str(python),
            "-m",
            "pip",
            "install",
            "--no-cache-dir",
            "--only-binary=:all:",
            "-r",
            str(ROOT / "requirements-reranker.txt"),
        ],
        env=env,
        check=True,
    )
    config = json.loads((ROOT / "lib/reranker-model.json").read_text())
    model = TARGET / "model"
    model.mkdir(exist_ok=True)
    hashes = {}
    for name in (
        "config.json",
        "model.safetensors",
        "tokenizer.json",
        "tokenizer_config.json",
        "special_tokens_map.json",
        "vocab.txt",
        "README.md",
    ):
        destination = model / name
        if not destination.exists():
            temporary = destination.with_suffix(destination.suffix + ".download")
            url = f"https://huggingface.co/{config['model']}/resolve/{config['revision']}/{name}"
            subprocess.run(
                [
                    "curl",
                    "--fail",
                    "--silent",
                    "--show-error",
                    "--location",
                    "--max-time",
                    "180",
                    url,
                    "--output",
                    str(temporary),
                ],
                env=env,
                check=True,
            )
            temporary.replace(destination)
        hashes[name] = hashlib.sha256(destination.read_bytes()).hexdigest()
    if hashes["model.safetensors"] != config["weight_sha256"]:
        raise ValueError("Pinned model weight checksum mismatch")
    versions = subprocess.check_output(
        [str(python), "-m", "pip", "freeze"], env=env, text=True
    )
    (TARGET / "installed-requirements.txt").write_text(versions)
    (TARGET / "manifest.json").write_text(
        json.dumps(
            {
                "config": config,
                "files_sha256": hashes,
                "installed_requirements": versions,
                "isolation": (
                    "env/model/cache/tmp inside this directory; no global install"
                ),
            },
            indent=2,
        )
        + "\n"
    )
    print("Approved reranker installed in", TARGET)
    print("Model weight SHA-256 verified; no inference endpoint used.")


if __name__ == "__main__":
    main()
