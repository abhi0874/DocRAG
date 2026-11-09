"""STEP 11 declared local compatibility, preserving every historical gate."""

import argparse
import copy
import json

from eval.check_regression import check
from eval.corpus import ROOT, canonical, sha256
from eval.security_gate import STEP6_REPAIRS
from eval.verify_results import verify

ADDED = {
    "lib/demo-config.ts",
    "lib/demo-provider.ts",
    "lib/demo-policy.ts",
    "lib/demo-access.ts",
    "lib/security/limits.ts",
}
CHANGED = {
    "lib/rag.ts",
    "lib/rag-answer.ts",
    "lib/provider-config.ts",
    "lib/db/index.ts",
    "lib/observability/answer.ts",
    "app/api/chat/route.ts",
    "app/api/evaluations/route.ts",
}


def gate(baseline, candidate):
    verify(baseline)
    verify(candidate)
    old, new = copy.deepcopy(baseline["config"]), copy.deepcopy(candidate["config"])
    ah, bh = old.pop("application_file_hashes"), new.pop("application_file_hashes")
    if old != new or old.get("provider") != "ollama" or set(bh) != set(ah) | ADDED:
        raise ValueError("Deployment comparison changed local benchmark configuration")
    changed = {path for path in ah if ah[path] != bh[path]}
    if not changed <= CHANGED:
        raise ValueError("Undeclared implementation change")
    for path in CHANGED | ADDED:
        if bh.get(path) != sha256((ROOT / path).read_bytes()):
            raise ValueError("Candidate does not measure current declared source")
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
            raise ValueError("Deployment changed local retrieved evidence")
    view = copy.deepcopy(candidate)
    view["config"] = copy.deepcopy(baseline["config"])
    view["config_sha256"] = sha256(canonical(view["config"]))
    return {
        "status": "PASS",
        "decreases": check(baseline, view),
        "thresholds": ".02 unchanged",
        "scope": "Ollama only; not Gemini acceptance",
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--baseline", required=True)
    parser.add_argument("--candidate", required=True)
    args = parser.parse_args()
    print(
        json.dumps(
            gate(
                json.loads((ROOT / args.baseline).read_text()),
                json.loads((ROOT / args.candidate).read_text()),
            ),
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
