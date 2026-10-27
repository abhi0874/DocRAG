"""Step 4 fixed-index retrieval ablations and component timing measurements."""

import argparse
import json
import statistics
import subprocess
import time
from datetime import datetime, timezone

from eval.chunking_experiments import DIRECTORY as CHUNK_DIRECTORY
from eval.chunking_experiments import config_for, connect_experiment
from eval.corpus import ROOT, sha256
from eval.metrics import percentile, recall_at_k, reciprocal_rank
from eval.runtime import call_adapter

DIRECTORY = ROOT / "eval/results/retrieval"
CONTROL = {
    "mode": "hybrid",
    "execution": "parallel",
    "vectorCandidates": 12,
    "keywordCandidates": 12,
    "rrfK": 60,
    "keywordMode": "and",
    "tieBreak": "legacy",
}
MATRIX = {
    "control": CONTROL,
    "vector": {**CONTROL, "mode": "vector", "tieBreak": "id"},
    "keyword": {**CONTROL, "mode": "keyword", "tieBreak": "id"},
    "combined": {**CONTROL, "execution": "combined", "tieBreak": "id"},
    "pool24": {
        **CONTROL,
        "execution": "combined",
        "tieBreak": "id",
        "vectorCandidates": 24,
        "keywordCandidates": 24,
    },
    "broad24": {
        **CONTROL,
        "execution": "combined",
        "tieBreak": "id",
        "vectorCandidates": 24,
        "keywordCandidates": 24,
        "keywordMode": "or",
    },
}
FILES = [
    "lib/retrieval.ts",
    "lib/retrieval-config.ts",
    "lib/rank-fusion.ts",
    "lib/retrieval-default.json",
]


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps(value, indent=2, allow_nan=False) + "\n")
    temp.replace(path)


def configuration(name):
    if name not in MATRIX:
        raise ValueError("Unknown retrieval experiment")
    config = config_for("heading-1400-280")
    config["retrieval_experiment"] = name
    config["retrieval"] = MATRIX[name]
    config["vector_candidates"] = (
        MATRIX[name]["vectorCandidates"] if MATRIX[name]["mode"] != "keyword" else 0
    )
    config["keyword_candidates"] = (
        MATRIX[name]["keywordCandidates"] if MATRIX[name]["mode"] != "vector" else 0
    )
    config["rrf_k"] = MATRIX[name]["rrfK"]
    config["application_file_hashes"].update(
        {p: sha256((ROOT / p).read_bytes()) for p in FILES}
    )
    return config


def inputs():
    records = [
        json.loads(line)
        for line in (ROOT / "eval/golden_set.jsonl").read_text().splitlines()
    ]
    split = json.loads((CHUNK_DIRECTORY / "split.json").read_text())
    mapping = json.loads(
        (CHUNK_DIRECTORY / "heading-1400-280-mapping.json").read_text()
    )
    return records, split, {c["chunk_id"]: c for c in mapping["chunks"]}


def summary(rows):
    first = [r for r in rows if r["repetition"] == 0]
    answerable = [r for r in first if r["type"] != "unanswerable"]
    metrics = {
        m: statistics.mean(r[m] for r in answerable)
        for m in ["recall@3", "recall@5", "recall@10", "mrr"]
    }
    metrics["multi_hop_recall@5"] = statistics.mean(
        r["recall@5"] for r in first if r["type"] == "multi_hop"
    )
    metrics["source_precision@6"] = statistics.mean(
        r["source_precision@6"] for r in answerable
    )
    timings = {}
    for field in [
        "embedding_ms",
        "vector_ms",
        "keyword_ms",
        "database_wall_ms",
        "fusion_ms",
        "total_ms",
        "combined_ms",
    ]:
        values = [r["timing"][field] for r in rows if r["timing"][field] is not None]
        timings[field] = (
            {"p50": percentile(values, 0.5), "p95": percentile(values, 0.95)}
            if values
            else None
        )
    return {
        "quality": metrics,
        "timing": timings,
        "questions": len(first),
        "observations": len(rows),
        "unanswerable_questions": sum(r["type"] == "unanswerable" for r in first),
    }


def measure(name, subset, repetitions=3):
    records, split, mapping = inputs()
    selected = [r for r in records if r["id"] in split[subset]]
    config = configuration(name)
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
            "uncachedRetrieval": True,
            "requests": requests,
            "repetitions": repetitions,
        }
    )
    refs = {r["id"]: r for r in selected}
    for row in result["rows"]:
        ref = refs[row["id"]]
        ids = []
        compact = []
        for hit in row.pop("ranked"):
            c = mapping[hit["id"]]
            if (
                c["document_key"] != ref["document_key"]
                or c["content_sha256"] != sha256(hit["content"].encode())
                or c["page_number"] != hit["pageNumber"]
            ):
                raise ValueError("Source isolation/mapping mismatch")
            ids.append(c["source_id"])
            compact.append(
                {
                    k: hit[k]
                    for k in [
                        "id",
                        "pageNumber",
                        "chunkIndex",
                        "vectorScore",
                        "keywordScore",
                        "rrfScore",
                    ]
                }
            )
        if len({c["id"] for c in compact}) != len(compact):
            raise ValueError("Duplicate chunks")
        row.update(type=ref["type"], retrieved_source_ids=ids, ranked_chunks=compact)
        row.update(
            {
                f"recall@{k}": recall_at_k(
                    ids, ref["relevant_source_ids"], k, ref["type"]
                )
                for k in (3, 5, 10)
            }
        )
        row["mrr"] = reciprocal_rank(ids, ref["relevant_source_ids"], ref["type"])
        row["source_precision@6"] = (
            sum(s in ref["relevant_source_ids"] for s in ids[:6]) / min(6, len(ids))
            if ids
            else 0
        )
    by_question = {}
    for row in result["rows"]:
        signature = [c["id"] for c in row["ranked_chunks"]]
        if row["id"] in by_question and by_question[row["id"]] != signature:
            raise ValueError("Rank sequence differed across repeated queries")
        by_question[row["id"]] = signature
    result.update(
        name=name,
        subset=subset,
        config=config,
        summary=summary(result["rows"]),
        repetitions=repetitions,
        recorded_at=datetime.now(timezone.utc).isoformat(),
        git_revision=subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True
        ).strip(),
        mapping_sha256=sha256(
            (CHUNK_DIRECTORY / "heading-1400-280-mapping.json").read_bytes()
        ),
        split_sha256=sha256((CHUNK_DIRECTORY / "split.json").read_bytes()),
    )
    path = DIRECTORY / f"{name}-{subset}.json"
    if path.exists():
        raise ValueError("Completed experiment already exists; preserve it")
    save(path, result)
    print(
        json.dumps({"name": name, "subset": subset, "summary": result["summary"]}),
        flush=True,
    )
    return result


def schema_audit():
    with connect_experiment("heading-1400-280") as conn:
        conn.read_only = True
        indexes = conn.execute(
            (
                "SELECT indexname,indexdef FROM pg_indexes WHERE "
                "tablename='chunks' ORDER BY indexname"
            )
        ).fetchall()
        valid = conn.execute(
            (
                "SELECT c.relname,i.indisvalid,i.indisready FROM pg_index i JOIN "
                "pg_class c ON c.oid=i.indexrelid JOIN pg_class t ON "
                "t.oid=i.indrelid WHERE t.relname='chunks'"
            )
        ).fetchall()
        column = conn.execute(
            (
                "SELECT data_type,is_generated,generation_expression FROM "
                "information_schema.columns WHERE table_name='chunks' AND "
                "column_name='content_tsv'"
            )
        ).fetchone()
        populated = conn.execute(
            (
                "SELECT count(*),count(content_tsv),count(*) FILTER(WHERE "
                "content_tsv <> to_tsvector('english',content)) FROM chunks"
            )
        ).fetchone()
    if populated != (162, 162, 0) or not all(v and ready for _, v, ready in valid):
        raise ValueError("Index/tsvector audit failed")
    # Isolated temporary fixture. No existing table, row or sequence is modified.
    with connect_experiment("heading-1400-280") as conn:
        conn.execute(
            (
                "CREATE TEMP TABLE retrieval_fts_probe(id integer, content text "
                "NOT NULL, content_tsv tsvector GENERATED ALWAYS AS "
                "(to_tsvector('english',content)) STORED) ON COMMIT DROP"
            )
        )
        conn.execute("CREATE INDEX ON retrieval_fts_probe USING gin(content_tsv)")
        conn.execute(
            "INSERT INTO retrieval_fts_probe VALUES (1, 'FastAPI PostgreSQL'), (2, '')"
        )
        assert conn.execute(
            (
                "SELECT content_tsv @@ plainto_tsquery('english','FastAPI') FROM "
                "retrieval_fts_probe WHERE id=1"
            )
        ).fetchone()[0]
        conn.execute(
            (
                "UPDATE retrieval_fts_probe SET content='pgvector HTTP GET "
                "/items' WHERE id=1"
            )
        )
        assert conn.execute(
            (
                "SELECT content_tsv @@ plainto_tsquery('english','pgvector') AND "
                "NOT content_tsv @@ plainto_tsquery('english','FastAPI') FROM "
                "retrieval_fts_probe WHERE id=1"
            )
        ).fetchone()[0]
        for query in ["!?", "'); DROP TABLE chunks; --", "HTTP GET", "pgvector", ""]:
            conn.execute(
                (
                    "SELECT id FROM retrieval_fts_probe WHERE content_tsv @@ "
                    "plainto_tsquery('english',%s)"
                ),
                (query,),
            ).fetchall()
        conn.rollback()
    result = {
        "status": "PASS",
        "indexes": indexes,
        "validity": valid,
        "column": column,
        "population": populated,
        "insert_update_empty_punctuation": (
            "PASS on isolated temporary fixture; rolled back"
        ),
        "schema_changes_required": False,
    }
    save(DIRECTORY / "schema-audit.json", result)
    return result


def plans():
    records, split, mapping = inputs()
    sample = [r for r in records if r["id"] in split["development"]][::8]
    results = []
    for name in ["control", "combined", "pool24", "broad24"]:
        for record in sample:
            for repetition in range(3):
                result = call_adapter(
                    {
                        "action": "plans",
                        "question": record["question"],
                        "documentId": next(
                            c["document_id"]
                            for c in mapping.values()
                            if c["document_key"] == record["document_key"]
                        ),
                        "config": configuration(name),
                        "uncachedRetrieval": True,
                    }
                )
                results.append(
                    {
                        "name": name,
                        "id": record["id"],
                        "repetition": repetition,
                        "plans": result,
                    }
                )
    save(
        DIRECTORY / "query-plans.json",
        {
            "queries": len(sample),
            "repetitions": 3,
            "observations": results,
            "condition": (
                "Read-only EXPLAIN ANALYZE BUFFERS SELECT; existing warm server; "
                "new client per observation; no OS/database cache flush."
            ),
        },
    )


def matrix():
    if (DIRECTORY / "selection.json").exists():
        raise ValueError("Selection frozen; holdout must not be retuned")
    results = []
    for name in MATRIX:
        try:
            path = DIRECTORY / f"{name}-development.json"
            if path.exists():
                result = json.loads(path.read_text())
                if result["config"] != configuration(name) or result[
                    "summary"
                ] != summary(result["rows"]):
                    raise ValueError("Existing measurements incompatible")
            else:
                result = measure(name, "development")
            results.append(result)
        except Exception as exc:
            save(
                DIRECTORY / f"failure-{name}-{time.time_ns()}.json",
                {
                    "name": name,
                    "error": str(exc)
                    if isinstance(exc, (ValueError, RuntimeError))
                    else type(exc).__name__,
                },
            )
            raise
    control = results[0]["summary"]["quality"]
    eligible = [
        r
        for r in results
        if MATRIX[r["name"]]["mode"] == "hybrid"
        and r["summary"]["quality"]["recall@5"] >= control["recall@5"]
        and r["summary"]["quality"]["mrr"] >= control["mrr"]
    ]
    best = max(
        eligible,
        key=lambda r: (
            r["summary"]["quality"]["recall@5"],
            r["summary"]["quality"]["mrr"],
            r["summary"]["quality"]["multi_hop_recall@5"],
            -r["summary"]["timing"]["total_ms"]["p50"],
        ),
    )
    selection = {
        "selected": best["name"],
        "rule": (
            "Hybrid candidates only; no Recall@5 or MRR loss versus control. "
            "Maximize Recall@5, MRR, multi-hop Recall@5; use measured median "
            "latency only to break quality ties. Vector/keyword ablations "
            "remain diagnostic."
        ),
        "development_hashes": {
            r["name"]: sha256(
                (DIRECTORY / f"{r['name']}-development.json").read_bytes()
            )
            for r in results
        },
        "frozen_at": datetime.now(timezone.utc).isoformat(),
        "split_sha256": sha256((CHUNK_DIRECTORY / "split.json").read_bytes()),
    }
    save(DIRECTORY / "selection.json", selection)
    for name in dict.fromkeys(["control", best["name"]]):
        measure(name, "holdout")
    print(json.dumps(selection), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["schema", "plans", "matrix"])
    args = parser.parse_args()
    try:
        {"schema": schema_audit, "plans": plans, "matrix": matrix}[args.action]()
    except Exception as exc:
        detail = (
            str(exc)
            if isinstance(exc, (ValueError, RuntimeError))
            else type(exc).__name__
        )
        parser.exit(1, f"Retrieval experiment failed: {detail}\n")
