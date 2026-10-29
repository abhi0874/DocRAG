"""Explicit Step 5 compatibility declaration; unchanged >0.02 safety limits."""

import argparse
import copy
import json
import subprocess
from pathlib import Path

from eval.check_regression import check
from eval.corpus import ROOT
from eval.reranking_experiments import FILES, MATRIX, configuration
from eval.verify_results import verify


def compatible(baseline, candidate):
    old, new = copy.deepcopy(baseline["config"]), copy.deepcopy(candidate["config"])
    name = new.pop("reranking_experiment", None)
    declared = new.pop("reranking", None)
    if name not in MATRIX or declared != configuration(name)["reranking"]:
        raise ValueError("Unknown reranking declaration")
    ah, bh = old.pop("application_file_hashes"), new.pop("application_file_hashes")
    if old != new or set(bh) != set(ah) | set(FILES):
        raise ValueError("Unrelated configuration or file coverage changed")
    if any(ah[p] != bh[p] for p in ah if p != "app/api/chat/route.ts"):
        raise ValueError("Unrelated model, prompt, chunking or retrieval changed")

    def route(result):
        return subprocess.check_output(
            ["git", "show", f"{result['git_revision']}:app/api/chat/route.ts"],
            cwd=ROOT,
            text=True,
        )

    # Permit exactly the declared selection call and observable status headers.
    expected = (
        route(baseline)
        .replace(
            "import { hybridSearch } from '@/lib/rag'",
            "import { selectContext } from '@/lib/select-context'",
        )
        .replace(
            "  const retrieved = await hybridSearch(question, documentId, 6)",
            "  const selection = await selectContext(question, documentId, 6)\n"
            "  const retrieved = selection.ranked",
        )
        .replace(
            "  return createUIMessageStreamResponse({ stream })",
            "  return createUIMessageStreamResponse({ stream, headers: {\n"
            "    'X-DocRAG-Reranker-Status': selection.trace.status,\n"
            "    ...(selection.trace.reason ? "
            "{'X-DocRAG-Reranker-Reason': selection.trace.reason} : {}),\n"
            "  } })",
        )
    )
    if route(candidate) != expected:
        raise ValueError("Unrelated chat integration change")
    # verify() independently binds every file hash to the measured Git revision.
    # The only old application file allowed to differ is the explicit integration.
    return {"reranking": declared, "threshold": "strict decimal drop >0.02"}


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
    print(
        json.dumps(
            gate(
                json.loads(args.baseline.read_text()),
                json.loads(args.candidate.read_text()),
            ),
            indent=2,
        )
    )
