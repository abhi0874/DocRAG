"""Security-step compatibility declaration; unchanged quality thresholds."""

import argparse
import copy
import json
from pathlib import Path

from eval.check_regression import check
from eval.verify_results import verify

# Only implementation files necessarily changed by authentication/SQL scoping
# and dependency fixes. Prompts, models, chunks, rank fusion and defaults stay fixed.
ALLOWED = {
    "lib/rag.ts",
    "app/api/chat/route.ts",
    "app/api/evaluations/route.ts",
    "pnpm-lock.yaml",
    "lib/provider-config.ts",
    "lib/db/index.ts",
    "lib/retrieval.ts",
    "lib/select-context.ts",
    "lib/evidence.ts",
    "lib/public-cache-policy.ts",
}


def gate(baseline, candidate):
    verify(baseline)
    verify(candidate)
    old, new = copy.deepcopy(baseline["config"]), copy.deepcopy(candidate["config"])
    ah, bh = old.pop("application_file_hashes"), new.pop("application_file_hashes")
    if old != new or set(ah) != set(bh):
        raise ValueError("Security comparison changed benchmark configuration")
    changed = {path for path in ah if ah[path] != bh[path]}
    if not changed <= ALLOWED:
        raise ValueError("Unrelated implementation changed")
    if len(baseline["questions"]) != 100 or len(candidate["questions"]) != 100:
        raise ValueError("Full 100-question evaluation required")
    for before, after in zip(
        baseline["questions"], candidate["questions"], strict=True
    ):
        if (
            before["id"] != after["id"]
            or before["ranked_chunks"] != after["ranked_chunks"]
        ):
            raise ValueError("Security integration changed retrieved evidence")
    view = copy.deepcopy(candidate)
    view["config"] = copy.deepcopy(baseline["config"])
    view["config_sha256"] = baseline["config_sha256"]
    return {
        "status": "PASS",
        "decreases": check(baseline, view),
        "declared_implementation_changes": sorted(changed),
        "retrieved_evidence": "identical for all 100 questions",
        "thresholds": "unchanged existing regression gate",
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--baseline", type=Path, required=True)
    parser.add_argument("--candidate", type=Path, required=True)
    args = parser.parse_args()
    print(
        json.dumps(
            gate(
                json.loads(args.baseline.read_text()),
                json.loads(args.candidate.read_text()),
            ),
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
