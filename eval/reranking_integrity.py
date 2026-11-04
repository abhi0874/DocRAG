"""Read-only preservation checks for Step 5; never rewrite older receipts."""

import argparse
import json
import subprocess

from dotenv import dotenv_values

from eval.chunking_experiments import connect_experiment, prepare
from eval.corpus import ROOT, canonical, sha256
from eval.local_corpus import connect_local
from eval.preservation import verify
from eval.reranking_experiments import DIRECTORY
from eval.retrieval_experiments import save
from eval.validate_dataset import validate


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=str)
    args = parser.parse_args()
    verify()
    validate(ROOT / "eval/golden_set.jsonl", require_review=True)
    # Preserve every historical artifact, frozen corpus and reference label.
    paths = subprocess.check_output(
        [
            "git",
            "ls-tree",
            "-r",
            "--name-only",
            "4ba666c",
            "eval/results",
            "eval/corpus",
            "eval/golden_set.jsonl",
            "eval/human_review.json",
            "eval/calibration",
            "lib/chunking.ts",
            "lib/chunking-default.json",
        ],
        cwd=ROOT,
        text=True,
    ).splitlines()
    hashes = {}
    for path in paths:
        original = subprocess.check_output(["git", "show", f"4ba666c:{path}"], cwd=ROOT)
        if (ROOT / path).read_bytes() != original:
            raise ValueError("Previously completed artifact changed: " + path)
        hashes[path] = sha256(original)
    query = (
        "SELECT document_id, chunk_index, page_number, content, "
        "embedding::text FROM chunks ORDER BY id"
    )
    with connect_local() as conn:
        conn.read_only = True
        original = conn.execute(query).fetchall()
    with connect_experiment("control-1000-200") as conn:
        conn.read_only = True
        control = conn.execute(query).fetchall()
    if (
        original != control
        or sha256(canonical(original))
        != "f96116a57bdd8aaf3b12f0d2554dbbe08a6a68985e8f8ee2dbdd24684ffdee3f"
    ):
        raise ValueError("Original local vectors changed")
    selected = prepare("heading-1400-280")  # Existing index: verifies, never rewrites.
    tracked = (
        subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT)
        .decode()
        .split("\0")
    )
    if ".env" in tracked:
        raise ValueError("Private environment file tracked")
    untracked = (
        subprocess.check_output(
            ["git", "ls-files", "--others", "--exclude-standard", "-z"], cwd=ROOT
        )
        .decode()
        .split("\0")
    )
    secrets = [
        v.encode()
        for k, v in dotenv_values(ROOT / ".env").items()
        if v
        and ("KEY" in k or "SECRET" in k or "DATABASE_URL" in k)
        and len(v) > 12
        and "replace-" not in v
    ]
    for relative in set(tracked + untracked):
        path = ROOT / relative
        if relative and path.is_file() and any(v in path.read_bytes() for v in secrets):
            raise ValueError("Private value found in repository content")
    result = {
        "status": "PASS",
        "historical_file_hashes": hashes,
        "gemini_cache_pairs": 20,
        "gemini_vectors": 151,
        "original_local_vectors": len(original),
        "selected_chunks": len(selected["chunks"]),
        "secret_scan": "PASS; tracked and nonignored untracked files",
        "schema_changes": "none",
    }
    if args.out:
        result["schema_changes"] = (
            "Legacy data unchanged; Step 7 additive ownership/auth tables are separate"
        )
    save(ROOT / args.out if args.out else DIRECTORY / "preservation.json", result)
    print(
        json.dumps({k: v for k, v in result.items() if k != "historical_file_hashes"})
    )


if __name__ == "__main__":
    main()
