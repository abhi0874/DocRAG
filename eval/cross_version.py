"""Compare immutable local benchmark releases without changing either result or gate."""

import argparse
import json
import re
import subprocess
from collections import Counter
from decimal import Decimal
from pathlib import Path

from eval.automated_validation import verify_method
from eval.corpus import ROOT, sha256
from eval.verify_results import verify

# This historical change registers five more application files for hashing.
# Compare only these exact instrumentation revisions; edits to scoring never qualify.
REGISTRATION_FILE = "eval/prompting_experiments.py"
REGISTRATION_REVISIONS = (
    "6bc653e9a214925a05f6305570e9f99f3794b5d832a85aa928f184390c4c7708",
    "e33b47c31679cd4f5576286a61e26cd86bfd39922b64dd7ad0b07b3c4f4ca010",
)
REGISTERED_FILES = {
    "lib/demo-policy.ts",
    "lib/demo-provider.ts",
    "lib/security/limits.ts",
    "lib/demo-config.ts",
    "lib/demo-access.ts",
}
CACHE_FIELDS = {
    f"{kind}_{stat}"
    for kind in ("answer", "embedding", "judge")
    for stat in ("hits", "misses")
}
THRESHOLDS = {"recall@5": Decimal("0.02"), "faithfulness": Decimal("0.02")}


def immutable_bytes(path):
    path = path.resolve()
    if not path.is_relative_to((ROOT / "eval/results").resolve()):
        raise ValueError("Expected an artifact under eval/results")
    blob = subprocess.check_output(
        ["git", "show", f"HEAD:{path.relative_to(ROOT)}"], cwd=ROOT
    )
    if blob != path.read_bytes():
        raise ValueError("Uncommitted changes to a measurement artifact")
    return blob


def load_verified(path):
    blob = immutable_bytes(path)
    result = json.loads(blob)
    if not re.fullmatch(r"[0-9a-f]{40}", result["git_revision"]):
        raise ValueError("A full evaluated source revision is required")
    if type(result["working_tree_dirty_at_start"]) is not bool:
        raise ValueError("Missing source cleanliness disclosure")
    record = result["evaluation_validation"]
    raw = immutable_bytes(ROOT / record["source_result_path"])
    if sha256(raw) != record["source_result_sha256"]:
        raise ValueError("Measurement digest mismatch")
    verify(result)
    return result, sha256(blob)


def comparable(before, after):
    for key in (
        "dataset_sha256",
        "corpus_hash",
        "human_review_receipt_sha256",
        "metric_definitions",
        "judge_calibration",
    ):
        if before[key] != after[key]:
            raise ValueError(f"Comparison changed {key}")
    if verify_method(before) != verify_method(after):
        raise ValueError("Different evaluation protocols")
    if (
        before["evaluation_validation"]["validator_file_hashes"]
        != after["evaluation_validation"]["validator_file_hashes"]
    ):
        raise ValueError("Changed provenance validation implementation")
    configs = [
        {k: v for k, v in r["config"].items() if k != "application_file_hashes"}
        for r in (before, after)
    ]
    if configs[0] != configs[1] or configs[0]["provider"] != "ollama":
        raise ValueError("Different model, retrieval or evaluation configuration")

    old, new = [r["evaluator_file_hashes"] for r in (before, after)]
    a, b = [r["config"]["application_file_hashes"] for r in (before, after)]
    if old != new:
        differences = {k for k in old.keys() | new.keys() if old.get(k) != new.get(k)}
        if (
            differences != {REGISTRATION_FILE}
            or (old.get(REGISTRATION_FILE), new.get(REGISTRATION_FILE))
            != REGISTRATION_REVISIONS
            or b.keys() - a.keys() != REGISTERED_FILES
            or a.keys() - b.keys()
        ):
            raise ValueError("Different evaluator implementation")
    elif a.keys() != b.keys():
        raise ValueError("Different measured application inventory")
    return {
        k: [a.get(k), b.get(k)]
        for k in sorted(a.keys() | b.keys())
        if a.get(k) != b.get(k)
    }


def verified_cache(result):
    counts = Counter()
    for question in result["questions"]:
        cache = question["cache"]
        if set(cache) != CACHE_FIELDS:
            raise ValueError("Unexpected cache receipt inventory")
        for name in ("embedding", "answer", "judge"):
            pair = [cache[f"{name}_{key}"] for key in ("hits", "misses")]
            if (
                any(type(v) is not int or v not in (0, 1) for v in pair)
                or sum(pair) != 1
            ):
                raise ValueError("Invalid per-question cache receipt")
        counts.update(cache)
    totals = result["cache_statistics"]
    if any(type(v) is not int for v in totals.values()) or dict(counts) != totals:
        raise ValueError("Inconsistent aggregate cache counts")
    return dict(counts)


def numerical_pass(scores):
    return all(
        Decimal(scores[metric]["decrease"]) <= limit
        for metric, limit in THRESHOLDS.items()
    )


def compare(baseline, candidate):
    before, baseline_digest = load_verified(baseline)
    after, candidate_digest = load_verified(candidate)
    changes = comparable(before, after)
    rows = [r["questions"] for r in (before, after)]
    if len(rows[0]) != 100 or [r["id"] for r in rows[0]] != [r["id"] for r in rows[1]]:
        raise ValueError("Expected the same 100 reviewed questions")
    scores = {}
    for k in (
        "recall@3",
        "recall@5",
        "recall@10",
        "mrr",
        "correctness",
        "faithfulness",
        "citation_accuracy",
    ):
        left, right = [Decimal(str(r["metrics"][k])) for r in (before, after)]
        scores[k] = {
            "baseline": str(left),
            "candidate": str(right),
            "decrease": str(left - right),
        }
    return {
        "scope": "Cross-version numerical comparison of verified measurements only",
        "numerical_thresholds": "PASS" if numerical_pass(scores) else "FAIL",
        "thresholds": {k: str(v) for k, v in THRESHOLDS.items()},
        "sources": [
            {
                "artifact": str(path.resolve().relative_to(ROOT)),
                "sha256": digest,
                "measured_revision": r["git_revision"],
                "dirty_at_start": r["working_tree_dirty_at_start"],
                "configuration_sha256": r["config_sha256"],
                "raw_measurement_sha256": r["evaluation_validation"][
                    "source_result_sha256"
                ],
                "cache": verified_cache(r),
                "citation_counts": [
                    r["metrics"]["citation_supported"],
                    r["metrics"]["citation_denominator"],
                ],
            }
            for path, digest, r in (
                (baseline, baseline_digest, before),
                (candidate, candidate_digest, after),
            )
        ],
        "dataset_sha256": before["dataset_sha256"],
        "corpus_hash": before["corpus_hash"],
        "protocol_sha256": before["evaluation_validation"]["protocol_sha256"],
        "rubric_sha256": before["config"]["judge_options"]["rubric_sha256"],
        "local_models": before["config"]["local_settings"],
        "changed_application_hashes": changes,
        "evaluator_inventory_change": before["evaluator_file_hashes"]
        != after["evaluator_file_hashes"],
        "identical_ranked_evidence_rows": sum(
            x["ranked_chunks"] == y["ranked_chunks"] for x, y in zip(*rows, strict=True)
        ),
        "scores": scores,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline", type=Path, required=True)
    parser.add_argument("--candidate", type=Path, required=True)
    args = parser.parse_args()
    try:
        receipt = compare(args.baseline, args.candidate)
    except (
        ValueError,
        KeyError,
        TypeError,
        OSError,
        subprocess.CalledProcessError,
    ) as exc:
        parser.exit(1, f"Incomparable artifacts: {exc}\n")
    print(json.dumps(receipt, indent=2))
    return int(receipt["numerical_thresholds"] != "PASS")


if __name__ == "__main__":
    raise SystemExit(main())
