"""Explicit prompt/cache compatibility; preserve exact Step 5 quality thresholds."""

import argparse
import copy
import json
from pathlib import Path

from eval.check_regression import check
from eval.prompting_experiments import FILES
from eval.verify_results import verify

CHANGED = {
    "lib/rag.ts",
    "lib/rag-answer.ts",
    "app/api/chat/route.ts",
    "app/api/evaluations/route.ts",
}


def compatible(baseline, candidate):
    old, new = copy.deepcopy(baseline["config"]), copy.deepcopy(candidate["config"])
    version = new.pop("prompting_experiment", None)
    cache = new.pop("production_response_cache", None)
    if version not in ("step5-v1", "grounded-v1") or cache is not False:
        raise ValueError("Unknown prompting declaration or confounded response cache")
    ah, bh = old.pop("application_file_hashes"), new.pop("application_file_hashes")
    if old != new or set(bh) != set(ah) | set(FILES):
        raise ValueError(
            "Unrelated model, runtime, rubric, retrieval or configuration changed"
        )
    if any(ah[p] != bh[p] for p in ah if p not in CHANGED):
        raise ValueError("Unrelated implementation changed")
    # The exact same ranked passage content and IDs must reach the unchanged six slots.
    for before, after in zip(
        baseline["questions"], candidate["questions"], strict=True
    ):
        if (
            before["id"] != after["id"]
            or before["ranked_chunks"] != after["ranked_chunks"]
        ):
            raise ValueError("Prompting changed retrieved evidence")
    return {
        "prompt": version,
        "production_cache": False,
        "threshold": "strict decimal drop >0.02",
    }


def gate(baseline, candidate):
    verify(baseline)
    verify(candidate)
    declaration = compatible(baseline, candidate)
    view = copy.deepcopy(candidate)
    view["config"] = copy.deepcopy(baseline["config"])
    view["config_sha256"] = baseline["config_sha256"]
    return {
        "status": "PASS",
        "compatibility": declaration,
        "decreases": check(baseline, view),
    }


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--baseline", type=Path, required=True)
    p.add_argument("--candidate", type=Path, required=True)
    args = p.parse_args()
    try:
        print(
            json.dumps(
                gate(
                    json.loads(args.baseline.read_text()),
                    json.loads(args.candidate.read_text()),
                ),
                indent=2,
            )
        )
    except ValueError as error:
        p.exit(1, f"Prompting gate failed: {error}\n")
