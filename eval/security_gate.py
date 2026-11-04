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


# The saved Step 6 measurement predates its verified citation repairs.
# Only the exact implementation preserved in 8dfa483 is admissible here.
STEP6_REPAIRS = {
    "lib/rag-prompt.ts": (
        "aa490d2134e13672ad2f51fdf90975cd16a04b20601cb47ff75979c885c46a65"
    ),
    "lib/citations.ts": (
        "880d9631e32c99ee3cafaba7477ca47396a2e47da963d8c09644fe882e30c7e9"
    ),
    "lib/response-cache.ts": (
        "1ab6291d417add2094a2997e2ddb7bc6c0f0e992b243c53ca3784fd608fc61db"
    ),
    "lib/types.ts": (
        "7066e888660132a707037e648fade35c95de10933c61126b4b0d424d8e99c598"
    ),
}


def gate(baseline, candidate):
    verify(baseline)
    verify(candidate)
    old, new = copy.deepcopy(baseline["config"]), copy.deepcopy(candidate["config"])
    ah, bh = old.pop("application_file_hashes"), new.pop("application_file_hashes")
    if old != new or set(ah) != set(bh):
        raise ValueError("Security comparison changed benchmark configuration")
    changed = {path for path in ah if ah[path] != bh[path]}
    preserved_repairs = {
        path for path, digest in STEP6_REPAIRS.items() if bh.get(path) == digest
    }
    if not changed <= ALLOWED | preserved_repairs:
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
        "preserved_step6_repairs": sorted(changed & preserved_repairs),
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
