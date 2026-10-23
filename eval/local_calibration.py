"""Calibrate the judge without silently treating AI labels as human labels."""

import argparse
import json
from datetime import datetime, timezone

from eval.corpus import ROOT, canonical, sha256
from eval.judge import LOCAL_CLARIFICATION, RUBRIC, judge

DIRECTORY = ROOT / "eval/calibration"
RESULT = ROOT / "eval/results/local-calibration.json"


def calibration_config():
    local = json.loads((ROOT / "lib/local-model-config.json").read_text())
    return {
        "provider": "ollama",
        "local_settings": local,
        "judge_options": {
            **local["options"],
            "format": "json",
            "think": local["think"],
            "rubric": "v1",
        },
        "purpose": "fixed calibration v1",
        "cases_sha256": sha256((DIRECTORY / "cases.json").read_bytes()),
        "rubric_sha256": sha256((RUBRIC + LOCAL_CLARIFICATION).encode()),
    }


def review_status():
    path = DIRECTORY / "human_review.json"
    if not path.exists():
        return "pending"
    receipt = json.loads(path.read_text())
    if receipt.get("confirmed") is not True or receipt.get("cases_sha256") != sha256(
        (DIRECTORY / "cases.json").read_bytes()
    ):
        raise ValueError("Calibration review receipt invalid/stale")
    return "confirmed"


def measure():
    cases = json.loads((DIRECTORY / "cases.json").read_text())
    criteria = json.loads((DIRECTORY / "acceptance.json").read_text())
    if len(cases) < criteria["minimum_cases"]:
        raise ValueError("Insufficient calibration cases")
    config = calibration_config()
    results = []
    for case in cases:
        judgment, hit = judge(
            case,
            case["answer"],
            case["context"],
            case["supporting_docs"],
            config["local_settings"]["chat"],
            config,
        )
        actual = {
            k: judgment["judgment"][k]
            for k in ("faithfulness", "correctness", "substantive_claims")
        }
        actual["citation_support"] = [
            c["supported"] for c in judgment["judgment"]["citation_support"]
        ]
        expected = case["proposed_labels"]
        matches = {k: actual[k] == expected[k] for k in expected}
        results.append(
            {
                "id": case["id"],
                "category": case["category"],
                "expected": expected,
                "actual": actual,
                "matches": matches,
                "rationale": judgment["judgment"]["rationale"],
                "cache_hit": hit,
            }
        )
        print(
            f"Calibration {len(results)}/{len(cases)} {case['id']}: {matches}",
            flush=True,
        )
    agreement = {
        k: sum(r["matches"][k] for r in results) / len(results)
        for k in cases[0]["proposed_labels"]
    }
    critical = all(
        all(r["matches"].values())
        for r in results
        if r["category"] in criteria["critical_categories"]
    )
    passed = critical and all(
        agreement[k] >= criteria[k + "_exact_agreement"] for k in agreement
    )
    result = {
        "status": "PASS" if passed else "FAIL",
        "human_review": review_status(),
        "label_origin": "AI-proposed; human confirmation required for verified metrics",
        "cases_sha256": config["cases_sha256"],
        "criteria_sha256": sha256((DIRECTORY / "acceptance.json").read_bytes()),
        "config": config,
        "config_sha256": sha256(canonical(config)),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "case_count": len(results),
        "agreement": agreement,
        "critical_cases_pass": critical,
        "cases": results,
    }
    RESULT.parent.mkdir(exist_ok=True)
    RESULT.write_text(json.dumps(result, indent=2) + "\n")
    print(
        json.dumps(
            {
                "status": result["status"],
                "human_review": result["human_review"],
                "agreement": agreement,
            },
            indent=2,
        )
    )
    if not passed:
        raise ValueError("Judge failed predefined calibration criteria")
    return result


def verify_calibration(require_human=True):
    result = json.loads(RESULT.read_text())
    if (
        result["status"] != "PASS"
        or result["config"] != calibration_config()
        or result["criteria_sha256"]
        != sha256((DIRECTORY / "acceptance.json").read_bytes())
    ):
        raise ValueError("Missing/passing compatible judge calibration required")
    cases = json.loads((DIRECTORY / "cases.json").read_text())
    criteria = json.loads((DIRECTORY / "acceptance.json").read_text())
    rows = result["cases"]
    if len(rows) != len(cases) or len(rows) < criteria["minimum_cases"]:
        raise ValueError("Calibration case count mismatch")
    for row, case in zip(rows, cases, strict=True):
        expected = case["proposed_labels"]
        matches = {k: row["actual"][k] == expected[k] for k in expected}
        if (
            row["id"] != case["id"]
            or row["expected"] != expected
            or row["matches"] != matches
        ):
            raise ValueError("Calibration labels/results mismatch")
    agreement = {
        k: sum(r["matches"][k] for r in rows) / len(rows)
        for k in cases[0]["proposed_labels"]
    }
    critical = all(
        all(r["matches"].values())
        for r in rows
        if r["category"] in criteria["critical_categories"]
    )
    if (
        agreement != result["agreement"]
        or not critical
        or not all(agreement[k] >= criteria[k + "_exact_agreement"] for k in agreement)
    ):
        raise ValueError("Calibration acceptance could not be recomputed")
    if result["config_sha256"] != sha256(canonical(result["config"])):
        raise ValueError("Calibration configuration hash mismatch")
    result["human_review"] = review_status()
    if require_human and result["human_review"] != "confirmed":
        raise ValueError(
            "Human calibration labels still unconfirmed; quality metrics provisional"
        )
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--verify", action="store_true")
    args = parser.parse_args()
    try:
        verify_calibration() if args.verify else measure()
    except (ValueError, OSError, RuntimeError) as exc:
        parser.exit(1, f"Local calibration failed: {exc}\n")
