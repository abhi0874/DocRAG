"""Explicit Step 4 gate; preserve all unrelated Step 3 configuration/provenance."""

import argparse
import copy
import json
import subprocess
from pathlib import Path

from eval.check_regression import check
from eval.corpus import ROOT, canonical, sha256
from eval.retrieval_experiments import FILES, MATRIX
from eval.verify_results import verify

ALLOWED = {
    "retrieval_experiment",
    "retrieval",
    "vector_candidates",
    "keyword_candidates",
    "rrf_k",
}


def compatible(baseline, candidate):
    old, new = baseline["config"], candidate["config"]
    name = new.get("retrieval_experiment")
    if name not in MATRIX or new.get("retrieval") != MATRIX[name]:
        raise ValueError("Unknown declared retrieval configuration")
    c = MATRIX[name]
    if (new["vector_candidates"], new["keyword_candidates"], new["rrf_k"]) != (
        c["vectorCandidates"] if c["mode"] != "keyword" else 0,
        c["keywordCandidates"] if c["mode"] != "vector" else 0,
        c["rrfK"],
    ):
        raise ValueError("Declared candidate counts/RRF disagree")
    a, b = copy.deepcopy(old), copy.deepcopy(new)
    for key in ALLOWED:
        a.pop(key, None)
        b.pop(key, None)
    ah, bh = a.pop("application_file_hashes"), b.pop("application_file_hashes")
    if a != b or set(bh) != set(ah) | set(FILES):
        raise ValueError(
            "Unrelated model, chunking, prompt or metric configuration changed"
        )
    if any(ah[p] != bh[p] for p in ah if p != "lib/rag.ts"):
        raise ValueError("Unrelated application implementation changed")

    def at(result, path):
        return subprocess.check_output(
            ["git", "show", f"{result['git_revision']}:{path}"], cwd=ROOT
        ).decode()

    old_rag, new_rag = at(baseline, "lib/rag.ts"), at(candidate, "lib/rag.ts")
    start, end = "export async function hybridSearch(", "/** Build the numbered context"
    prefix = (
        old_rag[: old_rag.index(start)]
        .replace("import { sql } from 'drizzle-orm'\n", "")
        .replace("import { db } from '@/lib/db'\n", "")
    )
    prefix = prefix.replace(
        "import modelConfig",
        "import { retrieve } from './retrieval'\n"
        "import { retrievalDefault, type RetrievalConfig, type RetrievalTiming } "
        "from './retrieval-config'\nimport modelConfig",
    )
    if (
        not new_rag.startswith(prefix)
        or new_rag[new_rag.index(end) :] != old_rag[old_rag.index(end) :]
    ):
        raise ValueError("Embedding/model selection or answer prompt changed")
    original_embedding = old_rag[
        old_rag.index("  const { embedding }") : old_rag.index("  const embStr")
    ]
    if original_embedding.strip() not in new_rag:
        raise ValueError("Query embedding request changed")
    # Also preserve the exact chunker/default files recorded in both measured runs.
    for path in ["lib/chunking.ts", "lib/chunking-default.json"]:
        if at(baseline, path) != at(candidate, path):
            # Step 3's measurement predates default adoption; explicit measured
            # chunking settings are identical, and neither algorithm may change.
            if (
                path != "lib/chunking-default.json"
                or json.loads(at(candidate, path)) != new["chunking"]
            ):
                raise ValueError("Frozen chunking implementation changed")
    return {
        "intended_difference": name,
        "baseline_config_sha256": sha256(canonical(old)),
        "candidate_config_sha256": sha256(canonical(new)),
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
    parser = argparse.ArgumentParser()
    parser.add_argument("--baseline", type=Path, required=True)
    parser.add_argument("--candidate", type=Path, required=True)
    args = parser.parse_args()
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
    except (ValueError, KeyError, TypeError, OSError) as exc:
        parser.exit(1, f"Retrieval gate failed: {exc}\n")
