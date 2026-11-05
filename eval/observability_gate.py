"""Explicit Step 8 provenance compatibility; unchanged .02 regression gates."""

import argparse
import copy
import json
from pathlib import Path

from eval.check_regression import check
from eval.security_gate import STEP6_REPAIRS
from eval.verify_results import verify

ADDED = {
    "lib/observability/context.ts",
    "lib/observability/http.ts",
    "lib/observability/persist.ts",
    "lib/observability/answer.ts",
    "lib/db/observability-schema.ts",
    "lib/security/http.ts",
}
CHANGED = {
    "app/api/chat/route.ts",
    "app/api/evaluations/route.ts",
    "lib/db/index.ts",
    "lib/provider-config.ts",
}


def gate(baseline, candidate):
    verify(baseline)
    verify(candidate)
    old, new = copy.deepcopy(baseline["config"]), copy.deepcopy(candidate["config"])
    ah, bh = old.pop("application_file_hashes"), new.pop("application_file_hashes")
    if old != new or set(bh) != set(ah) | ADDED:
        raise ValueError("Observability comparison changed benchmark configuration")
    changed = {path for path in ah if ah[path] != bh[path]}
    if not changed <= CHANGED:
        raise ValueError("Unrelated implementation changed")
    if any(bh.get(path) != digest for path, digest in STEP6_REPAIRS.items()):
        raise ValueError("Prior citation repairs must remain byte-identical")
    if len(baseline["questions"]) != 100 or len(candidate["questions"]) != 100:
        raise ValueError("Full 100-question evaluation required")
    for before, after in zip(
        baseline["questions"], candidate["questions"], strict=True
    ):
        if (
            before["id"] != after["id"]
            or before["ranked_chunks"] != after["ranked_chunks"]
        ):
            raise ValueError("Observability changed retrieved evidence")
    view = copy.deepcopy(candidate)
    view["config"] = copy.deepcopy(baseline["config"])
    view["config_sha256"] = baseline["config_sha256"]
    return {
        "status": "PASS",
        "decreases": check(baseline, view),
        "declared_implementation_changes": sorted(changed),
        "added_provenance": sorted(ADDED),
        "retrieved_evidence": "identical for all 100 questions",
        "thresholds": "unchanged .02 for recall@5 and faithfulness",
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
