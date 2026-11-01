"""Recompute fixed prompt comparisons and preserve all previous evidence."""

import argparse
import copy
import json
import subprocess

from eval.check_regression import check
from eval.corpus import ROOT, sha256
from eval.metrics import aggregate
from eval.prompting_gate import gate
from eval.retrieval_experiments import save
from eval.verify_results import verify

DIRECTORY = ROOT / "eval/results/prompting"


def rates(rows):
    answerable = [r for r in rows if r["type"] != "unanswerable"]
    absent = [r for r in rows if r["type"] == "unanswerable"]
    appropriate = sum(
        r["correctness"] == 1
        and r["faithfulness"] == 1
        and not r["judge_detail"]["substantive_claims"]
        for r in absent
    )
    wrong_refusal = sum(
        not r["judge_detail"]["substantive_claims"] and r["correctness"] == 0
        for r in answerable
    )
    unsupported = sum(
        r["judge_detail"]["substantive_claims"] and r["faithfulness"] < 1 for r in rows
    )
    return {
        "answerable_count": len(answerable),
        "unanswerable_count": len(absent),
        "appropriate_refusal": {
            "numerator": appropriate,
            "denominator": len(absent),
            "rate": appropriate / len(absent),
        },
        "incorrect_full_refusal": {
            "numerator": wrong_refusal,
            "denominator": len(answerable),
            "rate": wrong_refusal / len(answerable),
        },
        "unsupported_answer": {
            "numerator": unsupported,
            "denominator": len(rows),
            "rate": unsupported / len(rows),
        },
        "answerable_quality": aggregate(answerable),
        "unanswerable_quality": aggregate(absent),
        "partially_correct_ids": [r["id"] for r in rows if r["correctness"] == 0.5],
        "interpretation": (
            "Derived from unchanged automated substantive_claims/F/C labels. "
            "Partial refusals with factual content are not full refusals. "
            "Scores are not independent human validation."
        ),
    }


def preservation():
    paths = subprocess.check_output(
        [
            "git",
            "ls-tree",
            "-r",
            "--name-only",
            "8172c03",
            "eval/results",
            "eval/corpus",
            "eval/golden_set.jsonl",
            "eval/calibration",
            "eval/human_review.json",
        ],
        cwd=ROOT,
        text=True,
    ).splitlines()
    for path in paths:
        original = subprocess.check_output(["git", "show", f"8172c03:{path}"], cwd=ROOT)
        if (ROOT / path).read_bytes() != original:
            raise ValueError("Historical artifact changed: " + path)
    return {"status": "PASS", "historical_files": len(paths), "ancestor": "8172c03"}


def select(control, candidate, ids):
    a = [r for r in control["questions"] if r["id"] in ids]
    b = [r for r in candidate["questions"] if r["id"] in ids]
    am, bm = aggregate(a), aggregate(b)
    ar, br = rates(a), rates(b)
    regressions = [
        name
        for name in ("faithfulness", "correctness", "citation_accuracy")
        if bm[name] < am[name]
    ]
    regressions += [
        name
        for name in ("incorrect_full_refusal", "unsupported_answer")
        if br[name]["rate"] > ar[name]["rate"]
    ]
    return {
        "selected": "step5-v1" if regressions else "grounded-v1",
        "regressions": regressions,
        "control": am,
        "candidate": bm,
        "control_rates": ar,
        "candidate_rates": br,
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--out", default="eval/results/prompting/verified-report.json")
    args = p.parse_args()
    baseline = json.loads((ROOT / "eval/results/reranking-selected.json").read_text())
    control = json.loads((DIRECTORY / "step5-v1.json").read_text())
    candidate = json.loads((DIRECTORY / "grounded-v1.json").read_text())
    for result in (baseline, control, candidate):
        verify(result)
    split = json.loads((ROOT / "eval/results/chunking/split.json").read_text())
    development = select(control, candidate, split["development"])
    # Holdout is a final audit, not a new prompt-tuning cycle.
    holdout = select(control, candidate, split["holdout"])
    selected = development["selected"]
    if selected == "grounded-v1" and holdout["regressions"]:
        selected = "step5-v1"
    chosen = candidate if selected == "grounded-v1" else control
    checks = {"control": gate(baseline, control), "selected": gate(baseline, chosen)}
    negative = {}
    for name in ("recall@5", "faithfulness"):
        bad = copy.deepcopy(baseline)
        bad["metrics"][name] = baseline["metrics"][name] - 0.020000000001
        try:
            check(baseline, bad)
        except ValueError as error:
            if "Regression" not in str(error):
                raise
            negative[name] = str(error)
        else:
            raise ValueError("Negative gate accepted excessive regression")
    paired = []
    for a, b in zip(control["questions"], candidate["questions"], strict=True):
        if a["id"] != b["id"]:
            raise ValueError("Paired question mismatch")
        if any(
            a[k] != b[k] for k in ("faithfulness", "correctness", "citation_accuracy")
        ):
            paired.append(
                {
                    "id": a["id"],
                    "before": {
                        k: a[k]
                        for k in ("faithfulness", "correctness", "citation_accuracy")
                    },
                    "after": {
                        k: b[k]
                        for k in ("faithfulness", "correctness", "citation_accuracy")
                    },
                    "before_answer": a["answer"],
                    "after_answer": b["answer"],
                    "before_judge": a["judge_detail"],
                    "after_judge": b["judge_detail"],
                }
            )
    report = {
        "status": "PASS",
        "selected": selected,
        "development": development,
        "holdout": holdout,
        "baseline_metrics": baseline["metrics"],
        "control_metrics": control["metrics"],
        "candidate_metrics": candidate["metrics"],
        "control_rates": rates(control["questions"]),
        "candidate_rates": rates(candidate["questions"]),
        "gates": checks,
        "negative_gates": negative,
        "quality_changes": paired,
        "preservation": preservation(),
        "cache_conditions": {
            "control": control["cache_statistics"],
            "candidate": candidate["cache_statistics"],
        },
        "artifact_hashes": {
            p.name: sha256(p.read_bytes())
            for p in [DIRECTORY / "step5-v1.json", DIRECTORY / "grounded-v1.json"]
        },
        "known_cases": {
            name: [
                {
                    "version": version,
                    "answer": next(r for r in data["questions"] if r["id"] == name)[
                        "answer"
                    ],
                    "judgment": next(r for r in data["questions"] if r["id"] == name)[
                        "judge_detail"
                    ],
                }
                for version, data in [("step5-v1", control), ("grounded-v1", candidate)]
            ]
            for name in ["postgresql-005", "postgresql-037"]
        },
        "selection_note": (
            "Frozen one-candidate comparison on reused 60/40 split; no prompt "
            "retuning. Reject clear aggregate regressions in either subset. "
            "Inspect individual changed answers as well."
        ),
    }
    save(ROOT / args.out, report)
    print(
        json.dumps(
            {
                "status": "PASS",
                "selected": selected,
                "control": control["metrics"],
                "candidate": candidate["metrics"],
                "changes": len(paired),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
