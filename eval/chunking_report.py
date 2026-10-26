"""Recompute the frozen experiment evidence and selected-candidate comparison."""

import json

from eval.chunking_experiments import DIRECTORY, MATRIX, expected_chunks, summarize
from eval.chunking_gate import gate
from eval.corpus import ROOT, load_corpus, sha256
from eval.metrics import recall_at_k, reciprocal_rank
from eval.verify_results import verify

BASELINE_HASH = "c1f7b2fd7709c8b86ca725d95490e765e081bb1ec5a99eb10cd9577bbd9bf894"


def read(path):
    return json.loads(path.read_text())


def verify_retrieval(name, subset, ids, golden):
    path = DIRECTORY / f"{name}-{subset}.json"
    result = read(path)
    mapping_path = DIRECTORY / f"{name}-mapping.json"
    mapping = read(mapping_path)
    if mapping["chunks"] != expected_chunks(name):
        raise ValueError("Chunk mapping does not reproduce")
    if result["mapping_sha256"] != sha256(mapping_path.read_bytes()):
        raise ValueError("Mapping artifact changed")
    chunks = {c["chunk_id"]: c for c in mapping["chunks"]}
    rows = result["questions"]
    if [r["id"] for r in rows] != [r for r in golden if r in ids]:
        raise ValueError("Retrieval subset changed")
    for row in rows:
        ref = golden[row["id"]]
        for hit in row["ranked_chunks"]:
            source = chunks[hit["id"]]
            if (
                hit["source_id"],
                hit["pageNumber"],
                hit["chunkIndex"],
                sha256(hit["content"].encode()),
            ) != (
                source["source_id"],
                source["page_number"],
                source["chunk_index"],
                source["content_sha256"],
            ) or source["document_key"] != ref["document_key"]:
                raise ValueError("Retrieval evidence provenance mismatch")
        retrieved = [c["source_id"] for c in row["ranked_chunks"]]
        for k in (3, 5, 10):
            if row[f"recall@{k}"] != recall_at_k(
                retrieved, ref["relevant_source_ids"], k, ref["type"]
            ):
                raise ValueError("Recall mismatch")
        if row["mrr"] != reciprocal_rank(
            retrieved, ref["relevant_source_ids"], ref["type"]
        ):
            raise ValueError("MRR mismatch")
    if result["metrics"] != summarize(rows):
        raise ValueError("Retrieval aggregate mismatch")
    return result


def report():
    baseline_path = ROOT / "eval/results/baseline-local-ollama.json"
    if sha256(baseline_path.read_bytes()) != BASELINE_HASH:
        raise ValueError("Original baseline changed")
    baseline = read(baseline_path)
    verify(baseline)
    selection = read(DIRECTORY / "selection.json")
    split = read(DIRECTORY / "split.json")
    if selection["split_sha256"] != sha256((DIRECTORY / "split.json").read_bytes()):
        raise ValueError("Frozen split changed")
    golden = {
        r["id"]: r
        for r in [
            json.loads(line)
            for line in (ROOT / "eval/golden_set.jsonl").read_text().splitlines()
        ]
    }
    experiments = []
    for name in MATRIX:
        dev = verify_retrieval(name, "development", split["development"], golden)
        if selection["development_artifact_hashes"][name] != sha256(
            (DIRECTORY / f"{name}-development.json").read_bytes()
        ):
            raise ValueError("Development selection evidence changed")
        mapping = read(DIRECTORY / f"{name}-mapping.json")
        experiments.append(
            {
                "name": name,
                "configuration": MATRIX[name],
                "chunk_count": mapping["chunk_count"],
                "lengths": mapping["lengths"],
                "ingestion_seconds": mapping["ingestion_seconds"],
                "embedding_seconds": mapping["embedding_seconds"],
                "development": dev["metrics"],
            }
        )
    best = max(
        experiments,
        key=lambda x: (
            x["development"]["recall@5"],
            x["development"]["mrr"],
            x["development"]["multi_hop_recall@5"],
            x["name"].startswith("control"),
            -x["chunk_count"],
        ),
    )
    if best["name"] != selection["selected"]:
        raise ValueError("Selection does not follow frozen rule")
    held = {}
    for name in dict.fromkeys(("control-1000-200", selection["selected"])):
        held[name] = verify_retrieval(name, "holdout", split["holdout"], golden)[
            "metrics"
        ]
    candidate = read(ROOT / "eval/results/chunking-selected.json")
    if candidate["config"]["chunking_experiment"] != selection["selected"]:
        raise ValueError("Full evaluation did not use selected candidate")
    gate_result = gate(baseline, candidate)
    differences = {
        k: {
            "baseline": baseline["metrics"][k],
            "candidate": value,
            "absolute": value - baseline["metrics"][k],
            "relative_percent": (value - baseline["metrics"][k])
            / baseline["metrics"][k]
            * 100
            if baseline["metrics"][k]
            else None,
        }
        for k, value in candidate["metrics"].items()
        if type(value) in (int, float)
        and type(baseline["metrics"].get(k)) in (int, float)
    }
    return {
        "status": "PASS",
        "original_baseline_sha256": BASELINE_HASH,
        "candidate_sha256": sha256(
            (ROOT / "eval/results/chunking-selected.json").read_bytes()
        ),
        "dataset_sha256": baseline["dataset_sha256"],
        "corpus_hash": load_corpus()["corpus_hash"],
        "models": candidate["config"]["local_settings"],
        "experiments": experiments,
        "selection": selection,
        "split": split,
        "holdout": held,
        "baseline": baseline["metrics"],
        "candidate": candidate["metrics"],
        "differences": differences,
        "gate": gate_result,
        "failures": [read(p) for p in sorted(DIRECTORY.glob("*failure*.json"))],
        "limitations": [
            (
                "Automated scores; reference labels AI-suggested and personally "
                "checked, not independent blind human validation."
            ),
            (
                "All questions previously used in Step 2. Selection holdout is "
                "not a fresh unbiased benchmark."
            ),
            "Source-page recall does not guarantee answer-bearing evidence.",
            (
                "Baseline timings mix 16 cached and 84 fresh answers. Candidate "
                "cache counts must be interpreted separately."
            ),
            "Timing excludes judging/startup and is not browser or deployed latency.",
            (
                "Interrupted first larger-chunk retrieval attempt recorded "
                "RuntimeError without retaining its underlying message; precise "
                "historical cause is unavailable."
            ),
        ],
    }


if __name__ == "__main__":
    result = report()
    output = ROOT / "eval/results/chunking_comparison.json"
    output.write_text(json.dumps(result, indent=2, allow_nan=False) + "\n")
    print(
        json.dumps(
            {
                "status": result["status"],
                "selected": result["selection"]["selected"],
                "gate": result["gate"],
                "metrics": result["candidate"],
            },
            indent=2,
        )
    )
