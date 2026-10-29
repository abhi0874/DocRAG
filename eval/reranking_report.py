"""Independently recompute Step 5 ranks, source identities, selection and metrics."""

import argparse
import json
import math
import subprocess

from eval.corpus import ROOT, sha256
from eval.metrics import percentile, recall_at_k, reciprocal_rank
from eval.reranking_experiments import DIRECTORY, MATRIX, configuration, summarize
from eval.reranking_gate import gate
from eval.retrieval_experiments import inputs, save
from eval.verify_results import negative_gate


def verify_profile(data):
    records, split, mapping = inputs()
    refs = {r["id"]: r for r in records}
    config = configuration(data["name"])
    hashes = data["config"]["application_file_hashes"]
    if set(hashes) != set(config["application_file_hashes"]):
        raise ValueError("Missing application provenance")
    config["application_file_hashes"] = hashes
    if config != data["config"]:
        raise ValueError("Profile configuration mismatch")
    for path, expected in hashes.items():
        raw = subprocess.check_output(
            ["git", "show", f"{data['git_revision']}:{path}"], cwd=ROOT
        )
        if sha256(raw) != expected:
            raise ValueError("Profile code provenance mismatch")
    expected = {
        (qid, repetition) for qid in split[data["subset"]] for repetition in range(3)
    }
    pairs = [(r["id"], r["repetition"]) for r in data["rows"]]
    if len(pairs) != len(expected) or set(pairs) != expected:
        raise ValueError("Profile question coverage mismatch")
    signatures = {}
    for row in data["rows"]:
        ref = refs[row["id"]]
        candidates = row["selection"]["candidates"]
        ranked = row["ranked"]
        trace = row["selection"]["trace"]
        enabled = config["reranking"]["enabled"]
        if trace["status"] != ("reranked" if enabled else "disabled"):
            raise ValueError("Unexpected fallback or mislabeled ranking")
        if len(candidates) > config["reranking"]["candidates"]:
            raise ValueError("Candidate pool exceeded configuration")
        originals = {c["id"]: c for c in candidates}
        if len(originals) != len(candidates) or len({c["id"] for c in ranked}) != len(
            ranked
        ):
            raise ValueError("Duplicate candidate identity")
        for c in candidates + ranked:
            source = mapping[c["id"]]
            if (
                source["document_key"],
                source["page_number"],
                source["chunk_index"],
                source["content_sha256"],
            ) != (
                ref["document_key"],
                c["pageNumber"],
                c["chunkIndex"],
                sha256(c["content"].encode()),
            ):
                raise ValueError("Source content/metadata mismatch")
        for c in ranked:
            if c["id"] not in originals or any(
                c[k] != v for k, v in originals[c["id"]].items()
            ):
                raise ValueError("Reranking changed original passage metadata")
            if enabled:
                if not math.isfinite(c["rerankerScore"]):
                    raise ValueError("Invalid reranking score")
                if c["originalRank"] != next(
                    i + 1 for i, p in enumerate(candidates) if p["id"] == c["id"]
                ):
                    raise ValueError("Incorrect original rank")
        if enabled:
            if ranked != sorted(
                ranked, key=lambda c: (-c["rerankerScore"], c["originalRank"], c["id"])
            ):
                raise ValueError("Incorrect reranked ordering")
        elif ranked != candidates[:10]:
            raise ValueError("Disabled mode changed hybrid order")
        ids = [mapping[c["id"]]["source_id"] for c in ranked]
        if ids != row["retrieved_source_ids"] or row["type"] != ref["type"]:
            raise ValueError("Source labels mismatch")
        for k in (3, 5, 10):
            if row[f"recall@{k}"] != recall_at_k(
                ids, ref["relevant_source_ids"], k, ref["type"]
            ):
                raise ValueError("Recall mismatch")
        if row["mrr"] != reciprocal_rank(ids, ref["relevant_source_ids"], ref["type"]):
            raise ValueError("MRR mismatch")
        pool_ids = [mapping[c["id"]]["source_id"] for c in candidates]
        if row["coverage"] != recall_at_k(
            pool_ids, ref["relevant_source_ids"], len(pool_ids), ref["type"]
        ):
            raise ValueError("Candidate coverage mismatch")
        signature = [c["id"] for c in ranked]
        if row["id"] in signatures and signatures[row["id"]] != signature:
            raise ValueError("Repeated order changed")
        signatures[row["id"]] = signature
        for value in [
            row["selection"]["hybrid_ms"],
            row["selection"]["selection_ms"],
            trace["elapsed_ms"],
        ]:
            if not math.isfinite(value) or value < 0:
                raise ValueError("Invalid timing")
    if summarize(data["rows"]) != data["summary"]:
        raise ValueError("Summary mismatch")
    return data["summary"]


def profiles():
    selection = json.loads((DIRECTORY / "selection.json").read_text())
    results = {}
    for name in MATRIX:
        path = DIRECTORY / f"{name}-development.json"
        data = json.loads(path.read_text())
        if (
            sha256(path.read_bytes()) != selection["development_hashes"][name]
            or data["recorded_at"] > selection["frozen_at"]
        ):
            raise ValueError("Development/selection chronology mismatch")
        results[name] = verify_profile(data)
    control = results["control"]["quality"]
    eligible = [
        n
        for n in MATRIX
        if results[n]["quality"]["recall@5"] >= control["recall@5"]
        and results[n]["quality"]["mrr"] >= control["mrr"]
    ]
    winner = max(
        eligible,
        key=lambda n: (
            results[n]["quality"]["recall@5"],
            results[n]["quality"]["mrr"],
            results[n]["quality"]["multi_hop_recall@5"],
            -results[n]["latency"]["selection_ms"]["p50"],
        ),
    )
    if winner != selection["selected"]:
        raise ValueError("Frozen selection mismatch")
    holdout = json.loads((DIRECTORY / f"{winner}-holdout.json").read_text())
    if holdout["recorded_at"] < selection["frozen_at"]:
        raise ValueError("Holdout preceded selection")
    verify_profile(holdout)
    return {"development": results, "holdout": holdout["summary"], "selected": winner}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--profiles-only", action="store_true")
    args = parser.parse_args()
    result = {"status": "PASS", "profiles": profiles()}
    if not args.profiles_only:
        baseline = json.loads(
            (ROOT / "eval/results/retrieval-selected.json").read_text()
        )
        current = json.loads(
            (ROOT / "eval/results/reranking-selected.json").read_text()
        )
        result["gate"] = gate(baseline, current)
        if current["config"]["reranking_experiment"] != result["profiles"]["selected"]:
            raise ValueError("Full run is not the selected configuration")
        original = {r["id"]: r for r in baseline["questions"]}
        for row in current["questions"]:
            selection = row["reranking_selection"]
            if selection["trace"]["status"] != "disabled":
                raise ValueError("Unexpected selected execution mode")
            if row["ranked_chunks"] != original[row["id"]]["ranked_chunks"]:
                raise ValueError(
                    "Disabled pipeline differs from Step 4 ranked evidence"
                )
        result["disabled_exact_matches"] = len(current["questions"])
        result["quality"] = current["metrics"]
        result["negative_gates"] = {
            m: negative_gate(current, m) for m in ("recall@5", "faithfulness")
        }
        result["latency"] = {}
        for field in (
            "retrieval_latency_ms",
            "generation_latency_ms",
            "total_latency_ms",
        ):
            values = [r[field] for r in current["questions"]]
            result["latency"][field] = {
                "p50": percentile(values, 0.5),
                "p95": percentile(values, 0.95),
            }
        result["cache_statistics"] = current["cache_statistics"]
        save(DIRECTORY / "verified-report.json", result)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
