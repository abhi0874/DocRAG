"""Explicit Step 3 compatibility: identical settings except declared chunking/code."""

import argparse
import copy
import json
import subprocess
from pathlib import Path

from eval.check_regression import check
from eval.corpus import ROOT, canonical, sha256
from eval.verify_results import verify

CHUNK_KEYS = {
    "chunk_size_code_units",
    "chunk_overlap_code_units",
    "chunking",
    "chunking_experiment",
}
CODE_PATHS = {"lib/rag.ts", "lib/provider-config.ts", "lib/db/schema.ts"}


def compatible(baseline, candidate):
    from eval.chunking_experiments import MATRIX

    old, new = baseline["config"], candidate["config"]
    name = new.get("chunking_experiment")
    if name not in MATRIX or new.get("chunking") != MATRIX[name]:
        raise ValueError("Unknown declared chunking configuration")
    if (
        new["chunk_size_code_units"] != MATRIX[name]["size"]
        or new["chunk_overlap_code_units"] != MATRIX[name]["overlap"]
    ):
        raise ValueError("Chunk settings disagree")
    if old["chunk_size_code_units"] != 1000 or old["chunk_overlap_code_units"] != 200:
        raise ValueError("Unexpected original control")
    a, b = copy.deepcopy(old), copy.deepcopy(new)
    for key in CHUNK_KEYS:
        a.pop(key, None)
        b.pop(key, None)
    old_hashes, new_hashes = (
        a.pop("application_file_hashes"),
        b.pop("application_file_hashes"),
    )
    if a != b or old_hashes.keys() != new_hashes.keys():
        raise ValueError("Unrelated model, prompt, ranking or runtime settings changed")
    changed = {p for p in old_hashes if old_hashes[p] != new_hashes[p]}
    if not changed.issubset(CODE_PATHS):
        raise ValueError("Undeclared application code changes")

    # Do not trust a broad file allowlist: retrieval, embedding and prompt code must
    # remain byte-identical in both recorded revisions.
    def at(result, path):
        return subprocess.check_output(
            ["git", "show", f"{result['git_revision']}:{path}"], cwd=ROOT
        ).decode()

    marker = "/** Batch-embed chunk contents. Order is preserved. */"
    if (
        at(baseline, "lib/rag.ts").split(marker, 1)[1]
        != at(candidate, "lib/rag.ts").split(marker, 1)[1]
    ):
        raise ValueError("Retrieval, embedding or answer instructions changed")
    old_rag = at(baseline, "lib/rag.ts")
    expected_rag = (
        old_rag[: old_rag.index("const CHUNK_SIZE =")]
        + "export { chunkPages } from './chunking'\n"
        + "export type { TextChunk } from './chunking'\n\n"
        + old_rag[
            old_rag.index("export interface RetrievedChunk") : old_rag.index(
                "/**\n * Split page texts"
            )
        ]
        + old_rag[old_rag.index(marker) :]
    )
    if at(candidate, "lib/rag.ts") != expected_rag:
        raise ValueError("Application changed beyond the declared chunker extraction")
    old_schema = at(baseline, "lib/db/schema.ts")
    new_schema = at(candidate, "lib/db/schema.ts")
    if new_schema.replace("  metadata: jsonb('metadata'),\n", "") != old_schema:
        raise ValueError("Schema changed beyond nullable metadata")
    old_provider = at(baseline, "lib/provider-config.ts")
    new_provider = at(candidate, "lib/provider-config.ts")
    addition = (
        "  const experiment = process.env.DOCRAG_CHUNKING_EXPERIMENT\n"
        "  const allowedPath = experiment && /^(control|heading)-(1000-200"
        "|700-140|1400-280|1000-100)$/.test(experiment)\n"
        "    ? `/docrag_chunking_${experiment.replaceAll('-', '_')}` : '/d"
        "ocrag_ollama_v1'\n"
    )
    expected_provider = old_provider.replace(
        "  const url = new URL(value)\n", "  const url = new URL(value)\n" + addition
    ).replace("url.pathname !== '/docrag_ollama_v1'", "url.pathname !== allowedPath")
    if new_provider != expected_provider:
        raise ValueError(
            "Provider changed beyond isolated experiment database selection"
        )
    return {
        "declared_chunking": name,
        "changed_application_files": sorted(changed),
        "baseline_config_sha256": sha256(canonical(old)),
        "candidate_config_sha256": sha256(canonical(new)),
    }


def gate(baseline, candidate):
    verify(baseline)
    verify(candidate)
    declaration = compatible(baseline, candidate)
    # Compatibility has been checked explicitly. Only normalize the comparison
    # view; neither saved artifact nor the globally strict checker is modified.
    view = copy.deepcopy(candidate)
    view["config"] = copy.deepcopy(baseline["config"])
    view["config_sha256"] = baseline["config_sha256"]
    drops = check(baseline, view)
    return {"status": "PASS", "compatibility": declaration, "decreases": drops}


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
        parser.exit(1, f"Chunking gate failed: {exc}\n")
