"""Step 5 fixed-pool experiments; selection freezes before holdout inspection."""

import argparse
import json
import statistics
import subprocess
from datetime import datetime, timezone

from eval.corpus import ROOT, sha256
from eval.metrics import percentile, recall_at_k, reciprocal_rank
from eval.retrieval_experiments import configuration as control_configuration
from eval.retrieval_experiments import inputs, save
from eval.runtime import call_adapter

DIRECTORY = ROOT / "eval/results/reranking-final"
FILES = [
    "lib/reranker-config.ts",
    "lib/reranker-client.ts",
    "lib/rerank.ts",
    "lib/select-context.ts",
    "lib/reranker-model.json",
    "scripts/reranker_worker.py",
    "scripts/reranker_setup.py",
    "requirements-reranker.txt",
    "app/api/evaluations/route.ts",
]
MATRIX = {"control": (False, 10), "top10": (True, 10), "top20": (True, 20)}


def configuration(name):
    enabled, size = MATRIX[name]
    config = control_configuration("control")
    model = json.loads((ROOT / "lib/reranker-model.json").read_text())
    config["reranking_experiment"] = name
    config["reranking"] = {
        "enabled": enabled,
        "candidates": size,
        "device": "cpu",
        "timeoutMs": 15000,
        "model": model["model"],
        "revision": model["revision"],
    }
    config["application_file_hashes"].update(
        {p: sha256((ROOT / p).read_bytes()) for p in FILES}
    )
    return config


def summarize(rows):
    first = [r for r in rows if r["repetition"] == 0]
    answerable = [r for r in first if r["type"] != "unanswerable"]
    quality = {
        k: statistics.mean(r[k] for r in answerable)
        for k in ["recall@3", "recall@5", "recall@10", "mrr", "coverage"]
    }
    quality["multi_hop_recall@5"] = statistics.mean(
        r["recall@5"] for r in first if r["type"] == "multi_hop"
    )
    latency = {}
    for field in ["hybrid_ms", "selection_ms"]:
        values = [r["selection"][field] for r in rows]
        latency[field] = {
            "p50": percentile(values, 0.5),
            "p95": percentile(values, 0.95),
        }
    values = [r["selection"]["trace"]["elapsed_ms"] for r in rows]
    latency["reranking_ms"] = {
        "p50": percentile(values, 0.5),
        "p95": percentile(values, 0.95),
    }
    return {
        "quality": quality,
        "latency": latency,
        "observations": len(rows),
        "questions": len(first),
        "unanswerable_questions": len(first) - len(answerable),
        "actual_candidate_counts": sorted(
            set(len(r["selection"]["candidates"]) for r in rows)
        ),
        "fallback_count": sum(
            r["selection"]["trace"]["status"] == "fallback" for r in rows
        ),
    }


def measure(name, subset):
    output = DIRECTORY / f"{name}-{subset}.json"
    if output.exists():
        raise ValueError("Preserve completed experiment")
    records, split, mapping = inputs()
    selected = [r for r in records if r["id"] in split[subset]]
    config = configuration(name)
    revision = subprocess.check_output(
        ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True
    ).strip()
    for path, digest in config["application_file_hashes"].items():
        committed = subprocess.check_output(
            ["git", "show", f"{revision}:{path}"], cwd=ROOT
        )
        if sha256(committed) != digest:
            raise ValueError("Commit measured application code before profiling")
    requests = [
        {
            "id": r["id"],
            "question": r["question"],
            "documentId": next(
                c["document_id"]
                for c in mapping.values()
                if c["document_key"] == r["document_key"]
            ),
        }
        for r in selected
    ]
    result = call_adapter(
        {
            "action": "profile",
            "config": config,
            "requests": requests,
            "repetitions": 3,
            "uncachedRetrieval": True,
        }
    )
    if config != configuration(name):
        raise ValueError("Implementation changed during measurement")
    refs = {r["id"]: r for r in selected}
    signatures = {}
    for row in result["rows"]:
        ref = refs[row["id"]]
        for c in row["selection"]["candidates"] + row["ranked"]:
            m = mapping[c["id"]]
            if m["document_key"] != ref["document_key"] or m[
                "content_sha256"
            ] != sha256(c["content"].encode()):
                raise ValueError("Candidate document isolation/content mismatch")
        ids = [mapping[c["id"]]["source_id"] for c in row["ranked"]]
        pool = [mapping[c["id"]]["source_id"] for c in row["selection"]["candidates"]]
        signature = [c["id"] for c in row["ranked"]]
        if row["id"] in signatures and signatures[row["id"]] != signature:
            raise ValueError("Unstable repeated ordering")
        signatures[row["id"]] = signature
        row.update(
            type=ref["type"],
            retrieved_source_ids=ids,
            coverage=recall_at_k(
                pool, ref["relevant_source_ids"], len(pool), ref["type"]
            ),
        )
        row.update(
            {
                f"recall@{k}": recall_at_k(
                    ids, ref["relevant_source_ids"], k, ref["type"]
                )
                for k in (3, 5, 10)
            }
        )
        row["mrr"] = reciprocal_rank(ids, ref["relevant_source_ids"], ref["type"])
    result.update(
        name=name,
        subset=subset,
        config=config,
        summary=summarize(result["rows"]),
        recorded_at=datetime.now(timezone.utc).isoformat(),
        git_revision=subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True
        ).strip(),
    )
    if result["summary"]["fallback_count"]:
        raise ValueError("Reranker fallback occurred; not a valid reranked measurement")
    save(output, result)
    print(
        json.dumps({"name": name, "subset": subset, "summary": result["summary"]}),
        flush=True,
    )
    return result


def matrix():
    if (DIRECTORY / "selection.json").exists():
        raise ValueError("Selection already frozen")
    results = [measure(name, "development") for name in MATRIX]
    control = results[0]["summary"]["quality"]
    eligible = [
        r
        for r in results
        if r["summary"]["quality"]["recall@5"] >= control["recall@5"]
        and r["summary"]["quality"]["mrr"] >= control["mrr"]
    ]
    winner = max(
        eligible,
        key=lambda r: (
            r["summary"]["quality"]["recall@5"],
            r["summary"]["quality"]["mrr"],
            r["summary"]["quality"]["multi_hop_recall@5"],
            -r["summary"]["latency"]["selection_ms"]["p50"],
        ),
    )
    selection = {
        "selected": winner["name"],
        "frozen_at": datetime.now(timezone.utc).isoformat(),
        "rule": (
            "No development Recall@5 or MRR loss; maximize Recall@5, MRR, "
            "multi-hop Recall@5; latency breaks ties. Full answer regression "
            "still required."
        ),
        "development_hashes": {
            r["name"]: sha256(
                (DIRECTORY / f"{r['name']}-development.json").read_bytes()
            )
            for r in results
        },
    }
    save(DIRECTORY / "selection.json", selection)
    for name in dict.fromkeys(["control", winner["name"]]):
        measure(name, "holdout")
    print(json.dumps(selection), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["matrix"])
    parser.parse_args()
    matrix()
