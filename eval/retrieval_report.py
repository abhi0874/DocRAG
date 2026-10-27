"""Recompute Step 4 measurements and verify frozen selection and source evidence."""

import argparse
import json
import math
import statistics
import subprocess
from collections import Counter

from eval.corpus import ROOT, sha256
from eval.metrics import percentile, recall_at_k, reciprocal_rank
from eval.retrieval_experiments import (
    CHUNK_DIRECTORY,
    DIRECTORY,
    MATRIX,
    configuration,
    inputs,
    save,
    summary,
)
from eval.retrieval_gate import gate
from eval.verify_results import negative_gate


def verify_profile(result):
    records, split, mapping = inputs()
    refs = {r["id"]: r for r in records}
    name, subset = result["name"], result["subset"]
    if result["config"] != configuration(name) or result["repetitions"] != 3:
        raise ValueError("Profile configuration/repetition mismatch")
    for key, path in [
        ("mapping_sha256", CHUNK_DIRECTORY / "heading-1400-280-mapping.json"),
        ("split_sha256", CHUNK_DIRECTORY / "split.json"),
    ]:
        if result[key] != sha256(path.read_bytes()):
            raise ValueError("Frozen mapping/split changed")
    for path, expected in result["config"]["application_file_hashes"].items():
        raw = subprocess.check_output(
            ["git", "show", f"{result['git_revision']}:{path}"], cwd=ROOT
        )
        if sha256(raw) != expected:
            raise ValueError("Profile application provenance mismatch")
    expected_pairs = {(qid, repeat) for qid in split[subset] for repeat in range(3)}
    pairs = [(r["id"], r["repetition"]) for r in result["rows"]]
    if len(pairs) != len(expected_pairs) or set(pairs) != expected_pairs:
        raise ValueError("Profile question/repetition coverage mismatch")
    signatures = {}
    for row in result["rows"]:
        ref = refs[row["id"]]
        chunks = row["ranked_chunks"]
        ids = [c["id"] for c in chunks]
        if len(set(ids)) != len(ids) or row["type"] != ref["type"]:
            raise ValueError("Duplicate chunks or wrong question type")
        if [c["rrfScore"] for c in chunks] != sorted(
            (c["rrfScore"] for c in chunks), reverse=True
        ):
            raise ValueError("Fused rank ordering mismatch")
        if name == "vector" and [c["vectorScore"] for c in chunks] != sorted(
            (c["vectorScore"] for c in chunks), reverse=True
        ):
            raise ValueError("Vector similarity ordering mismatch")
        if row["id"] in signatures and signatures[row["id"]] != ids:
            raise ValueError("Repeated rank order changed")
        signatures[row["id"]] = ids
        if row["retrieved_source_ids"] != [mapping[c]["source_id"] for c in ids]:
            raise ValueError("Source identifier mismatch")
        for c in chunks:
            m = mapping[c["id"]]
            if (m["document_key"], m["page_number"], m["chunk_index"]) != (
                ref["document_key"],
                c["pageNumber"],
                c["chunkIndex"],
            ):
                raise ValueError("Document isolation or source metadata mismatch")
        for k in (3, 5, 10):
            if row[f"recall@{k}"] != recall_at_k(
                row["retrieved_source_ids"], ref["relevant_source_ids"], k, ref["type"]
            ):
                raise ValueError("Profile recall mismatch")
        if row["mrr"] != reciprocal_rank(
            row["retrieved_source_ids"], ref["relevant_source_ids"], ref["type"]
        ):
            raise ValueError("Profile MRR mismatch")
        precision = (
            sum(
                s in ref["relevant_source_ids"] for s in row["retrieved_source_ids"][:6]
            )
            / min(6, len(ids))
            if ids
            else 0
        )
        if row["source_precision@6"] != precision:
            raise ValueError("Profile source precision mismatch")
        for value in row["timing"].values():
            if value is not None and (not math.isfinite(value) or value < 0):
                raise ValueError("Invalid component measurement")
    if result["summary"] != summary(result["rows"]):
        raise ValueError("Profile summary mismatch")
    return result["summary"]


def profile_report():
    selection = json.loads((DIRECTORY / "selection.json").read_text())
    profiles = {}
    for name in MATRIX:
        path = DIRECTORY / f"{name}-development.json"
        if selection["development_hashes"][name] != sha256(path.read_bytes()):
            raise ValueError("Selection's frozen development artifact changed")
        data = json.loads(path.read_text())
        if data["recorded_at"] > selection["frozen_at"]:
            raise ValueError("Development measurement happened after selection")
        profiles[name] = verify_profile(data)
    control = profiles["control"]["quality"]
    eligible = [
        n
        for n in MATRIX
        if MATRIX[n]["mode"] == "hybrid"
        and profiles[n]["quality"]["recall@5"] >= control["recall@5"]
        and profiles[n]["quality"]["mrr"] >= control["mrr"]
    ]
    winner = max(
        eligible,
        key=lambda n: (
            profiles[n]["quality"]["recall@5"],
            profiles[n]["quality"]["mrr"],
            profiles[n]["quality"]["multi_hop_recall@5"],
            -profiles[n]["timing"]["total_ms"]["p50"],
        ),
    )
    if winner != selection["selected"]:
        raise ValueError("Selection disagrees with predefined rule")
    holdout = {}
    for name in dict.fromkeys(["control", winner]):
        data = json.loads((DIRECTORY / f"{name}-holdout.json").read_text())
        if data["recorded_at"] < selection["frozen_at"]:
            raise ValueError("Holdout measured before selection was frozen")
        holdout[name] = verify_profile(data)
    # The immediate control must reproduce the historical per-question ranking.
    baseline = json.loads((ROOT / "eval/results/chunking-selected.json").read_text())
    old = {r["id"]: r for r in baseline["questions"]}
    for subset in ("development", "holdout"):
        data = json.loads((DIRECTORY / f"control-{subset}.json").read_text())
        for row in data["rows"]:
            if [c["id"] for c in row["ranked_chunks"]] != [
                c["id"] for c in old[row["id"]]["ranked_chunks"]
            ]:
                raise ValueError("Control differs from Step 3 chunk ranking")
    plans = json.loads((DIRECTORY / "query-plans.json").read_text())
    plan_summary = {}
    for name in ("control", "combined", "pool24", "broad24"):
        plan_summary[name] = {}
        for branch in ("vectorSql", "keywordSql", "combined"):
            observations = [
                r["plans"][branch][0]
                for r in plans["observations"]
                if r["name"] == name
            ]
            if len(observations) != 24:
                raise ValueError("Plan observation count mismatch")
            nodes, indexes = Counter(), Counter()

            def walk(node):
                nodes[node["Node Type"]] += 1
                if "Index Name" in node:
                    indexes[node["Index Name"]] += 1
                for child in node.get("Plans", []):
                    walk(child)

            for obs in observations:
                walk(obs["Plan"])
            values = [o["Execution Time"] for o in observations]
            plan_summary[name][branch] = {
                "observations": len(observations),
                "execution_p50_ms": statistics.median(values),
                "execution_p95_ms": percentile(values, 0.95),
                "nodes": dict(nodes),
                "indexes": dict(indexes),
                "shared_read_blocks": sum(
                    o["Plan"]["Shared Read Blocks"] for o in observations
                ),
            }
    return {
        "status": "PASS",
        "selected": winner,
        "development": profiles,
        "holdout": holdout,
        "plans": plan_summary,
        "historical_control_ranks": "100/100 identical, all three repetitions",
    }


def report(profiles_only=False):
    result = profile_report()
    if not profiles_only:
        baseline = json.loads(
            (ROOT / "eval/results/chunking-selected.json").read_text()
        )
        candidate = json.loads(
            (ROOT / "eval/results/retrieval-selected.json").read_text()
        )
        result["regression_gate"] = gate(baseline, candidate)
        result["negative_gates"] = {
            m: negative_gate(baseline, m) for m in ("recall@5", "faithfulness")
        }
        result["baseline_metrics"] = baseline["metrics"]
        result["selected_metrics"] = candidate["metrics"]
        result["cache_statistics"] = candidate["cache_statistics"]
        result["component_timing"] = {
            field: {
                "p50": percentile(
                    [r["retrieval_timing"][field] for r in candidate["questions"]], 0.5
                ),
                "p95": percentile(
                    [r["retrieval_timing"][field] for r in candidate["questions"]], 0.95
                ),
            }
            for field in (
                "embedding_ms",
                "vector_ms",
                "keyword_ms",
                "database_wall_ms",
                "fusion_ms",
                "total_ms",
            )
        }
        result["previously_incomplete"] = {}
        for qid in ("postgresql-005", "postgresql-037"):
            old = next(r for r in baseline["questions"] if r["id"] == qid)
            new = next(r for r in candidate["questions"] if r["id"] == qid)
            result["previously_incomplete"][qid] = {
                "same_context": old["ranked_chunks"] == new["ranked_chunks"],
                "same_answer": old["answer"] == new["answer"],
                "before_correctness": old["correctness"],
                "after_correctness": new["correctness"],
                "answer": new["answer"],
                "judge": new["judge_detail"],
            }
        unknowns = [r for r in candidate["questions"] if r["type"] == "unanswerable"]
        result["unanswerable"] = {
            "questions": len(unknowns),
            "automated_faithfulness": statistics.mean(
                r["faithfulness"] for r in unknowns
            ),
            "automated_correctness": statistics.mean(
                r["correctness"] for r in unknowns
            ),
        }
        result["baseline_sha256"] = sha256(
            (ROOT / "eval/results/chunking-selected.json").read_bytes()
        )
        result["selected_sha256"] = sha256(
            (ROOT / "eval/results/retrieval-selected.json").read_bytes()
        )
    save(
        DIRECTORY
        / ("profile-verification.json" if profiles_only else "comparison.json"),
        result,
    )
    print(
        json.dumps(
            {
                "status": result["status"],
                "selected": result["selected"],
                "profiles_only": profiles_only,
            }
        )
    )
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--profiles-only", action="store_true")
    args = parser.parse_args()
    report(args.profiles_only)
