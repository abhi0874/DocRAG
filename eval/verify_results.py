"""Check saved measurements, compare reruns, and exercise the real negative gate."""

import argparse
import copy
import json
import math
import subprocess
import tempfile
from pathlib import Path

from eval.check_regression import check
from eval.corpus import ROOT, canonical, load_corpus, sha256
from eval.judge import validate_judgment
from eval.metrics import (
    DEFINITIONS,
    aggregate,
    citation_counts,
    citations,
    recall_at_k,
    reciprocal_rank,
)
from eval.validate_dataset import validate


def verify(result):
    reviewed = validate(ROOT / "eval/golden_set.jsonl", require_review=True)
    if (
        result["status"] != "complete"
        or result["human_review"] != "confirmed"
        or result["dataset_sha256"] != reviewed["dataset_sha256"]
        or result["corpus_hash"] != load_corpus()["corpus_hash"]
        or result["metric_definitions"] != DEFINITIONS
        or result["config_sha256"] != sha256(canonical(result["config"]))
    ):
        raise ValueError("Result provenance/status mismatch")
    golden = [
        json.loads(line)
        for line in (ROOT / "eval/golden_set.jsonl").read_text().splitlines()
    ]
    rows = result["questions"]
    if [r["id"] for r in rows] != [r["id"] for r in golden]:
        raise ValueError("Result IDs/count do not match reviewed dataset")
    for row, reference in zip(rows, golden, strict=True):
        for key in (
            "type",
            "question",
            "reference_answer",
            "relevant_source_ids",
            "document_key",
        ):
            if row[key] != reference[key]:
                raise ValueError("Question labels changed")
        if not isinstance(row["answer"], str) or not row["answer"].strip():
            raise ValueError("Missing generated answer")
        numbers = citations(row["answer"])
        if row["citations"] != numbers:
            raise ValueError("Citation extraction mismatch")
        scores = validate_judgment(
            row["judge_detail"], numbers, row["answer_context_count"]
        )
        for metric in ("faithfulness", "correctness"):
            if scores[metric] != row[metric]:
                raise ValueError("Judge score mismatch")
        for k in (3, 5, 10):
            expected = recall_at_k(
                row["retrieved_source_ids"],
                reference["relevant_source_ids"],
                k,
                row["type"],
            )
            if row[f"recall@{k}"] != expected:
                raise ValueError("Per-question recall mismatch")
        if row["mrr"] != reciprocal_rank(
            row["retrieved_source_ids"], reference["relevant_source_ids"], row["type"]
        ):
            raise ValueError("Per-question MRR mismatch")
        counts = citation_counts(
            numbers,
            [c["supported"] for c in scores["citation_support"]],
            row["answer_context_count"],
            row["type"],
            row["correctness"],
            scores["substantive_claims"],
        )
        if counts != (row["citation_supported"], row["citation_denominator"]):
            raise ValueError("Citation counts mismatch")
        for name in (
            "retrieval_latency_ms",
            "generation_latency_ms",
            "total_latency_ms",
        ):
            if (
                type(row[name]) not in (int, float)
                or not math.isfinite(row[name])
                or row[name] < 0
            ):
                raise ValueError("Invalid measured latency")
    if result["metrics"] != aggregate(rows):
        raise ValueError("Aggregate metrics do not match per-question measurements")
    for metric in (
        "recall@3",
        "recall@5",
        "recall@10",
        "mrr",
        "citation_accuracy",
        "faithfulness",
        "correctness",
        "p50_latency_ms",
        "p95_latency_ms",
    ):
        value = result["metrics"][metric]
        if type(value) not in (int, float) or not math.isfinite(value):
            raise ValueError(f"Mandatory metric missing: {metric}")
    # Verify provenance against the recorded Git revision, not a later report commit.
    for path, expected in {
        **result["evaluator_file_hashes"],
        **result["config"]["application_file_hashes"],
    }.items():
        raw = subprocess.check_output(
            ["git", "show", f"{result['git_revision']}:{path}"], cwd=ROOT
        )
        if sha256(raw) != expected:
            raise ValueError(
                "Recorded implementation differs from recorded Git revision"
            )


def negative_gate(baseline):
    synthetic_base = copy.deepcopy(baseline)
    synthetic_base["metrics"]["recall@5"] = 0.9
    degraded = copy.deepcopy(synthetic_base)
    degraded["metrics"]["recall@5"] = 0.879999999999
    with tempfile.TemporaryDirectory(prefix="docrag-regression-") as directory:
        root = Path(directory)
        (root / "base.json").write_text(json.dumps(synthetic_base))
        (root / "bad.json").write_text(json.dumps(degraded))
        result = subprocess.run(
            [
                str(ROOT / ".venv/bin/python"),
                "-m",
                "eval.check_regression",
                "--baseline",
                str(root / "base.json"),
                "--current",
                str(root / "bad.json"),
            ],
            cwd=ROOT,
            capture_output=True,
            text=True,
        )
        if result.returncode != 1 or "Regression:" not in result.stderr:
            raise ValueError("Synthetic degraded result was not rejected")
        return {"exit_code": result.returncode, "message": result.stderr.strip()}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--baseline", type=Path, default=ROOT / "eval/results/baseline.json"
    )
    parser.add_argument(
        "--current", type=Path, default=ROOT / "eval/results/latest.json"
    )
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    try:
        baseline, current = [
            json.loads(p.read_text()) for p in (args.baseline, args.current)
        ]
        verify(baseline)
        verify(current)
        check(baseline, current)
        if baseline["config"] != current["config"]:
            raise ValueError("Rerun configuration differs")
        if baseline["metrics"]["recall@5"] != current["metrics"]["recall@5"]:
            raise ValueError("Full-precision recall@5 differs: investigate retrieval")
        result = {
            "status": "PASS",
            "dataset_sha256": baseline["dataset_sha256"],
            "corpus_hash": baseline["corpus_hash"],
            "first_recall@5": baseline["metrics"]["recall@5"],
            "second_recall@5": current["metrics"]["recall@5"],
            "baseline_sha256": sha256(args.baseline.read_bytes()),
            "current_sha256": sha256(args.current.read_bytes()),
            "first_cache_statistics": baseline["cache_statistics"],
            "second_cache_statistics": current["cache_statistics"],
            "negative_gate": negative_gate(baseline),
            "judge_variability": "Not measured across fresh calls; cached "
            "judgments do not demonstrate model determinism.",
        }
        if args.out:
            args.out.write_text(json.dumps(result, indent=2) + "\n")
        print(json.dumps(result, indent=2))
    except (
        ValueError,
        OSError,
        KeyError,
        TypeError,
        subprocess.CalledProcessError,
    ) as exc:
        parser.exit(1, f"Result verification failed: {exc}\n")


if __name__ == "__main__":
    main()
