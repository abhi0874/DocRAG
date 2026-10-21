"""Run reviewed questions against DocRAG and save actual measurements atomically."""

import argparse
import json
import subprocess
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from eval.corpus import CORPUS, ROOT, canonical, connect_evaluation, load_corpus, sha256
from eval.judge import JUDGE_CONFIG, judge
from eval.metrics import (
    DEFINITIONS,
    aggregate,
    citation_counts,
    citations,
    recall_at_k,
    reciprocal_rank,
)
from eval.runtime import call_adapter
from eval.validate_dataset import validate


def configuration():
    model = json.loads((ROOT / "lib/model-config.json").read_text())
    files = [
        "lib/rag.ts",
        "lib/rag-answer.ts",
        "app/api/chat/route.ts",
        "lib/model-config.json",
        "pnpm-lock.yaml",
    ]
    config = {
        "query_mode": "single-turn chat, selected document",
        "chunk_size_code_units": 1000,
        "chunk_overlap_code_units": 200,
        "embedding_model": model["embedding"],
        "embedding_dimensions": model["embeddingDimensions"],
        "answer_model": model["chat"],
        "judge_model": model["chat"],
        "vector_candidates": 12,
        "keyword_candidates": 12,
        "rrf_k": 60,
        "diagnostic_retrieval_top_k": 10,
        "answer_top_k": 6,
        "answer_options": "unchanged SDK defaults from startRagAnswer",
        "judge_options": JUDGE_CONFIG,
        "minimum_model_interval_ms": 7000,
        "cache_policy": "v1; query embeddings and generated answers/judgments cached; "
        "SQL retrieval rerun; current observed latency reported",
        "application_file_hashes": {p: sha256((ROOT / p).read_bytes()) for p in files},
    }
    return config


def run(golden, output):
    reviewed = validate(golden, require_review=True)
    corpus = load_corpus()
    # Recheck the full persisted source/chunk mapping without writing user data.
    from scripts.ingest_corpus import main as verify_ingestion

    verify_ingestion()
    local = json.loads((ROOT / ".local/eval-corpus-map.json").read_text())
    if local["corpus_hash"] != corpus["corpus_hash"]:
        raise ValueError("Ingestion map/corpus mismatch")
    source_map = {s["source_id"]: s for s in corpus["sources"]}
    chunk_map = {m["chunk_id"]: m for m in local["chunks"]}
    documents = {}
    for chunk in local["chunks"]:
        documents[chunk["document_key"]] = chunk["document_id"]
    config = configuration()
    config["corpus_hash"] = corpus["corpus_hash"]
    with connect_evaluation() as conn:
        conn.read_only = True
        config["postgresql_version"] = conn.execute("SHOW server_version").fetchone()[0]
        config["pgvector_version"] = conn.execute(
            "SELECT extversion FROM pg_extension WHERE extname='vector'"
        ).fetchone()[0]
    records = [json.loads(line) for line in golden.read_text().splitlines()]
    run_started = datetime.now(timezone.utc).isoformat()
    revision = subprocess.check_output(
        ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True
    ).strip()
    dirty = bool(
        subprocess.check_output(["git", "status", "--porcelain"], cwd=ROOT, text=True)
    )
    evaluator_files = [
        "eval/runtime_adapter.ts",
        "eval/runtime.py",
        "eval/run_eval.py",
        "eval/metrics.py",
        "eval/judge.py",
        "eval/corpus.py",
    ]
    fingerprints = {p: sha256((ROOT / p).read_bytes()) for p in evaluator_files}
    rows = []
    cache_stats = Counter()
    wall_start = time.perf_counter()
    for index, record in enumerate(records, 1):
        response = call_adapter(
            {
                "action": "answer",
                "question": record["question"],
                "documentId": documents[record["document_key"]],
                "config": config,
                "modelIntervalMs": 7000,
            }
        )
        ranked = response["ranked"]
        for chunk in ranked:
            mapping = chunk_map[chunk["id"]]
            if (
                mapping["document_key"] != record["document_key"]
                or mapping["content_sha256"] != sha256(chunk["content"].encode())
                or mapping["page_number"] != chunk["pageNumber"]
            ):
                raise ValueError("Retrieved chunk provenance mismatch")
            chunk["source_id"] = mapping["source_id"]
            chunk["stable_chunk_id"] = f"{mapping['source_id']}:{chunk['chunkIndex']}"
        context = ranked[:6]
        answer = response["answer"]["text"]
        supporting = [
            {
                "source_id": sid,
                "text": (CORPUS / source_map[sid]["text_file"]).read_text(),
            }
            for sid in record["relevant_source_ids"]
        ]
        judge_start = time.perf_counter()
        judgment, judge_hit = judge(
            record, answer, context, supporting, config["judge_model"], config
        )
        judge_ms = (time.perf_counter() - judge_start) * 1000
        scores = judgment["judgment"]
        numbers = citations(answer)
        supported, denominator = citation_counts(
            numbers,
            [item["supported"] for item in scores["citation_support"]],
            len(context),
            record["type"],
            scores["correctness"],
            scores["substantive_claims"],
        )
        retrieved_ids = [chunk["source_id"] for chunk in ranked]
        row = {
            "id": record["id"],
            "type": record["type"],
            "document_key": record["document_key"],
            "question": record["question"],
            "reference_answer": record["reference_answer"],
            "relevant_source_ids": record["relevant_source_ids"],
            "retrieved_source_ids": retrieved_ids,
            "ranked_chunks": ranked,
            "answer_context_count": len(context),
            "answer": answer,
            "citations": numbers,
            "retrieval_latency_ms": response["retrieval_latency_ms"],
            "generation_latency_ms": response["generation_latency_ms"],
            "total_latency_ms": response["total_latency_ms"],
            "model_pacing_ms": response["pacing_ms"],
            "judge_latency_ms": judge_ms,
            "original_generation_latency_ms": response["answer"][
                "original_generation_latency_ms"
            ],
            "answer_generated_at": response["answer"]["generated_at"],
            "answer_finish_reason": response["answer"]["finish_reason"],
            "answer_usage": response["answer"]["usage"],
            "judge_usage": judgment["usage"],
            "judge_attempt_usage": judgment["attempt_usage"],
            "embedding_usage": None,
            "estimated_api_cost_usd": None,
            "faithfulness": scores["faithfulness"],
            "correctness": scores["correctness"],
            "judge_detail": scores,
            "judge_validation_retries": judgment["validation_retries"],
            "citation_supported": supported,
            "citation_denominator": denominator,
            "citation_accuracy": supported / denominator if denominator else None,
            "mrr": reciprocal_rank(
                retrieved_ids, record["relevant_source_ids"], record["type"]
            ),
            "cache": {
                **response["cache"],
                "judge_hits": int(judge_hit),
                "judge_misses": int(not judge_hit),
            },
        }
        row.update(
            {
                f"recall@{k}": recall_at_k(
                    retrieved_ids, record["relevant_source_ids"], k, record["type"]
                )
                for k in (3, 5, 10)
            }
        )
        rows.append(row)
        cache_stats.update(row["cache"])
        print(
            f"{index}/{len(records)} {record['id']}: "
            f"answer_cache={row['cache']['answer_hits']} judge_cache={int(judge_hit)}",
            flush=True,
        )
    result = {
        "schema_version": 1,
        "status": "complete",
        "human_review": reviewed["human_review"],
        "human_review_receipt_sha256": sha256(
            (ROOT / "eval/human_review.json").read_bytes()
        ),
        "dataset_sha256": reviewed["dataset_sha256"],
        "corpus_hash": corpus["corpus_hash"],
        "corpus_id": corpus["corpus_id"],
        "git_revision": revision,
        "working_tree_dirty_at_start": dirty,
        "evaluator_file_hashes": fingerprints,
        "config": config,
        "config_sha256": sha256(canonical(config)),
        "metric_definitions": DEFINITIONS,
        "started_at": run_started,
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "run_wall_seconds": time.perf_counter() - wall_start,
        "cache_statistics": dict(cache_stats),
        "metrics": aggregate(rows),
        "questions": rows,
        "latency_caveat": "Current-run latency; cached operations are not fresh API "
        "latency. Judge, pacing and process startup are excluded from pipeline "
        "latency. Cached original generation latency is recorded separately.",
        "token_caveat": "Cached usage is the original provider usage, not newly billed "
        "tokens. Embedding usage unavailable in the installed Google SDK.",
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(".tmp")
    temporary.write_text(
        json.dumps(result, indent=2, ensure_ascii=False, allow_nan=False) + "\n"
    )
    temporary.replace(output)
    print(
        json.dumps(
            {
                "output": str(output),
                "metrics": result["metrics"],
                "cache": result["cache_statistics"],
            },
            indent=2,
        )
    )
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--golden", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    try:
        run(args.golden.resolve(), args.out.resolve())
    except Exception as exc:
        # Known adapter failures are already sanitized; arbitrary DB errors are not.
        detail = (
            str(exc)
            if isinstance(exc, (ValueError, RuntimeError))
            else type(exc).__name__
        )
        parser.exit(1, f"Evaluation failed: {detail}\n")


if __name__ == "__main__":
    main()
