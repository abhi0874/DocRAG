"""Fail closed on incompatible results or a decrease greater than 0.02."""

import argparse
import json
import math
import re
from decimal import Decimal
from pathlib import Path

from eval.corpus import canonical, sha256


def check(baseline, current):
    for result in (baseline, current):
        if not isinstance(result, dict):
            raise ValueError("Result must be an object")
        for name in ("dataset_sha256", "corpus_hash"):
            if not isinstance(result.get(name), str) or not re.fullmatch(
                r"[0-9a-f]{64}", result[name]
            ):
                raise ValueError(f"Invalid provenance: {name}")
        if not isinstance(result.get("metric_definitions"), dict) or not result[
            "metric_definitions"
        ].get("version"):
            raise ValueError("Missing metric definitions")
        config = result.get("config")
        if (
            not isinstance(config, dict)
            or not config
            or result.get("config_sha256") != sha256(canonical(config))
        ):
            raise ValueError("Missing/invalid evaluation configuration")
        if (
            config.get("provider") == "ollama"
            and result.get("judge_calibration", {}).get("human_review") != "confirmed"
        ):
            raise ValueError("Local judge calibration is not human validated")
    for field in (
        "dataset_sha256",
        "corpus_hash",
        "metric_definitions",
        "config_sha256",
    ):
        if (
            field not in baseline
            or field not in current
            or baseline[field] != current[field]
        ):
            raise ValueError(f"Missing or incompatible {field}")
    for result in (baseline, current):
        if (
            result.get("status") != "complete"
            or result.get("human_review") != "confirmed"
        ):
            raise ValueError("Only complete, human-reviewed results can be compared")
        for metric in ("recall@5", "faithfulness"):
            value = result.get("metrics", {}).get(metric)
            if (
                type(value) not in (int, float)
                or not math.isfinite(value)
                or not 0 <= value <= 1
            ):
                raise ValueError(f"Missing/invalid metric: {metric}")
    changes = {}
    for metric in ("recall@5", "faithfulness"):
        # Compare the exact serialized decimal values, without rounding or epsilon.
        drop = Decimal(str(baseline["metrics"][metric])) - Decimal(
            str(current["metrics"][metric])
        )
        changes[metric] = str(drop)
        if drop > Decimal("0.02"):
            raise ValueError(f"Regression: {metric} decreased by {drop} (>0.02)")
    return changes


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--baseline", type=Path, required=True)
    parser.add_argument("--current", type=Path, required=True)
    args = parser.parse_args()
    try:
        changes = check(
            json.loads(args.baseline.read_text()), json.loads(args.current.read_text())
        )
        print(json.dumps({"regression_gate": "PASS", "decreases": changes}))
    except (ValueError, OSError, TypeError, KeyError) as exc:
        parser.exit(1, f"Regression gate failed: {exc}\n")


if __name__ == "__main__":
    main()
