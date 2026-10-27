"""Read-only final preservation checks without exposing private values."""

import json
import subprocess
from urllib.parse import urlsplit, urlunsplit

import psycopg
from dotenv import dotenv_values

from eval.chunking_experiments import connect_experiment
from eval.chunking_report import BASELINE_HASH
from eval.corpus import ROOT, canonical, evaluation_url, sha256
from eval.local_corpus import connect_local
from eval.preservation import verify
from eval.validate_dataset import validate


def main():
    verify()
    review = validate(ROOT / "eval/golden_set.jsonl", require_review=True)
    if review["dataset_sha256"] != (
        "1867147d2667a2745d6cf0b2139225395f2599a1b68803fb37356964febab78b"
    ):
        raise ValueError("Original dataset changed")
    if (
        sha256((ROOT / "eval/results/baseline-local-ollama.json").read_bytes())
        != BASELINE_HASH
    ):
        raise ValueError("Original baseline changed")
    query = (
        "SELECT document_id, chunk_index, page_number, content, "
        "embedding::text FROM chunks ORDER BY id"
    )
    with connect_local() as conn:
        conn.read_only = True
        baseline = conn.execute(query).fetchall()
    with connect_experiment("control-1000-200") as conn:
        conn.read_only = True
        control = conn.execute(query).fetchall()
    if (
        baseline != control
        or sha256(canonical(baseline))
        != "f96116a57bdd8aaf3b12f0d2554dbbe08a6a68985e8f8ee2dbdd24684ffdee3f"
    ):
        raise ValueError("Original local vectors changed")
    application_url = urlunsplit(
        urlsplit(evaluation_url())._replace(path="/docrag_dev")
    )
    with psycopg.connect(application_url) as conn:
        conn.read_only = True
        counts = {
            table: conn.execute("SELECT count(*) FROM " + table).fetchone()[0]
            for table in ("documents", "chunks")
        }
    paths = (
        subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT)
        .decode()
        .split("\0")
    )
    if ".env" in paths:
        raise ValueError("Private environment file is tracked")
    # Read only private values, compare in memory, never print them or matching text.
    private_values = [
        value.encode()
        for key, value in dotenv_values(ROOT / ".env").items()
        if value
        and ("KEY" in key or "DATABASE_URL" in key)
        and len(value) > 12
        and "replace-" not in value
    ]
    for relative in paths:
        if relative and (ROOT / relative).is_file():
            content = (ROOT / relative).read_bytes()
            if any(value in content for value in private_values):
                raise ValueError("Private value found in tracked content")
    result = {
        "status": "PASS",
        "baseline_sha256": BASELINE_HASH,
        "dataset_sha256": review["dataset_sha256"],
        "local_baseline_chunks": len(baseline),
        "local_vectors_equal_control": True,
        "gemini_pairs_preserved": 20,
        "application_counts": counts,
        "tracked_secret_scan": "PASS",
    }
    (ROOT / "eval/results/chunking-preservation.json").write_text(
        json.dumps(result, indent=2) + "\n"
    )
    print(json.dumps(result))


if __name__ == "__main__":
    main()
