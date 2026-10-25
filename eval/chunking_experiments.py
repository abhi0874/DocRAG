"""Frozen chunking matrix using isolated native indexes and real TS retrieval."""

import argparse
import json
import random
import statistics
import subprocess
import time
from collections import defaultdict
from datetime import datetime, timezone
from urllib.parse import urlsplit, urlunsplit

import psycopg
from psycopg import sql
from psycopg.types.json import Jsonb

from eval.corpus import CORPUS, ROOT, canonical, evaluation_url, load_corpus, sha256
from eval.local_corpus import connect_local, snapshot_original
from eval.metrics import percentile, recall_at_k, reciprocal_rank
from eval.runtime import call_adapter
from eval.validate_dataset import validate
from scripts.native_db import DATA

DIRECTORY = ROOT / "eval/results/chunking"
MATRIX = {
    "control-1000-200": {"algorithm": "legacy-v1", "size": 1000, "overlap": 200},
    "heading-1000-200": {"algorithm": "heading-v1", "size": 1000, "overlap": 200},
    "heading-700-140": {"algorithm": "heading-v1", "size": 700, "overlap": 140},
    "heading-1400-280": {"algorithm": "heading-v1", "size": 1400, "overlap": 280},
    "heading-1000-100": {"algorithm": "heading-v1", "size": 1000, "overlap": 100},
}


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(
        json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + "\n"
    )
    temporary.replace(path)


def experiment_url(name):
    if name not in MATRIX:
        raise ValueError("Unknown chunking experiment")
    return urlunsplit(
        urlsplit(evaluation_url())._replace(
            path="/docrag_chunking_" + name.replace("-", "_")
        )
    )


def mapping_path(name):
    if name not in MATRIX:
        raise ValueError("Unknown chunking experiment")
    return DIRECTORY / f"{name}-mapping.json"


def connect_experiment(name):
    marker = ROOT / ".local" / f"chunking-{name}-owner"
    if not marker.exists() or marker.read_text() != str(ROOT):
        raise ValueError("Missing experiment ownership")
    return psycopg.connect(experiment_url(name), connect_timeout=5)


def config_for(name):
    from eval.local_calibration import verify_calibration
    from eval.run_eval import configuration

    if name not in MATRIX:
        raise ValueError("Unknown chunking experiment")
    config = configuration("ollama")
    config.update(
        chunking_experiment=name,
        chunking=MATRIX[name],
        chunk_size_code_units=MATRIX[name]["size"],
        chunk_overlap_code_units=MATRIX[name]["overlap"],
        corpus_hash=load_corpus()["corpus_hash"],
        dataset_sha256=validate(ROOT / "eval/golden_set.jsonl", require_review=True)[
            "dataset_sha256"
        ],
    )
    calibration = verify_calibration(require_human=False)
    config["calibration_cases_sha256"] = calibration["cases_sha256"]
    config["calibration_criteria_sha256"] = calibration["criteria_sha256"]
    return config


def expected_chunks(name):
    manifest = load_corpus()
    output = []
    for document_id, key in enumerate(("fastapi", "postgresql"), 1):
        sources = [s for s in manifest["sources"] if s["document_key"] == key]
        payload = {
            "pages": [(CORPUS / s["text_file"]).read_text() for s in sources],
            "sourceIds": [s["source_id"] for s in sources],
            "config": MATRIX[name],
        }
        proc = subprocess.run(
            ["node", "--import", "tsx", "eval/chunk_adapter.ts"],
            input=json.dumps(payload),
            text=True,
            capture_output=True,
            cwd=ROOT,
            check=True,
        )
        for chunk in json.loads(proc.stdout):
            source = sources[chunk["pageNumber"] - 1]
            output.append(
                {
                    "chunk_id": len(output) + 1,
                    "document_id": document_id,
                    "document_key": key,
                    "source_id": source["source_id"],
                    "page_number": chunk["pageNumber"],
                    "chunk_index": chunk["chunkIndex"],
                    "content": chunk["content"],
                    "content_sha256": sha256(chunk["content"].encode()),
                    "metadata": chunk.get("metadata"),
                }
            )
    return output


def prepare(name, config=None):
    config = config or config_for(name)
    chunks = expected_chunks(name)
    original, docs, _, original_map = snapshot_original()
    if name.startswith("control"):
        if [
            (c["document_id"], c["chunk_index"], c["page_number"], c["content"])
            for c in chunks
        ] != [r[1:5] for r in original]:
            raise ValueError("Control does not reproduce original chunks")
    identity = {
        "corpus_hash": load_corpus()["corpus_hash"],
        "chunking": MATRIX[name],
        "local_settings": config["local_settings"],
        "chunks_sha256": sha256(canonical(chunks)),
    }
    fingerprint = sha256(canonical(identity))
    path = mapping_path(name)
    if path.exists():
        result = json.loads(path.read_text())
        if result["identity"] != identity or result["chunks"] != chunks:
            raise ValueError("Experiment mapping changed; preserved")
        with connect_experiment(name) as conn:
            conn.read_only = True
            if conn.execute(
                "SELECT owner, config_hash FROM chunking_identity"
            ).fetchone() != (str(ROOT), fingerprint):
                raise ValueError("Index identity mismatch")
            stored = conn.execute(
                (
                    "SELECT id, document_id, chunk_index, page_number, content, "
                    "vector_dims(embedding), metadata FROM chunks ORDER BY id"
                )
            ).fetchall()
            if stored != [
                (
                    c["chunk_id"],
                    c["document_id"],
                    c["chunk_index"],
                    c["page_number"],
                    c["content"],
                    768,
                    c["metadata"],
                )
                for c in chunks
            ]:
                raise ValueError("Persisted experiment differs")
        return result
    started = time.perf_counter()
    url = experiment_url(name)
    marker = ROOT / ".local" / f"chunking-{name}-owner"
    with psycopg.connect(
        urlunsplit(urlsplit(url)._replace(path="/postgres")), autocommit=True
    ) as conn:
        if conn.execute("SHOW data_directory").fetchone()[0] != str(DATA.resolve()):
            raise ValueError("Wrong native server")
        conn.execute("SELECT pg_advisory_lock(20261026, 3)")
        dbname = urlsplit(url).path[1:]
        exists = conn.execute(
            "SELECT 1 FROM pg_database WHERE datname=%s", (dbname,)
        ).fetchone()
        if exists and (not marker.exists() or marker.read_text() != str(ROOT)):
            raise ValueError("Unowned experiment database preserved")
        if not exists:
            conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(dbname)))
            marker.write_text(str(ROOT))
            marker.chmod(0o600)
    embed_seconds = 0
    with connect_experiment(name) as conn:
        if conn.execute("SELECT 1 FROM pg_tables WHERE schemaname='public'").fetchone():
            raise ValueError("Existing experiment without mapping preserved")
        conn.execute(
            (ROOT / "db/init.sql")
            .read_text()
            .replace("BEGIN;", "")
            .replace("COMMIT;", "")
            .replace("vector(1536)", "vector(768)")
        )
        conn.execute(
            (
                "CREATE TABLE chunking_identity(owner text NOT NULL, config_hash "
                "text NOT NULL)"
            )
        )
        conn.execute(
            "INSERT INTO chunking_identity VALUES (%s,%s)", (str(ROOT), fingerprint)
        )
        for doc in docs:
            count = sum(c["document_id"] == doc[0] for c in chunks)
            conn.execute(
                (
                    "INSERT INTO "
                    "documents(id,title,filename,page_count,chunk_count,status) "
                    "VALUES (%s,%s,%s,%s,%s,%s)"
                ),
                (*doc[:4], count, doc[5]),
            )
        baseline_vectors = None
        if name.startswith("control"):
            with connect_local() as original_conn:
                original_conn.read_only = True
                baseline_vectors = [
                    json.loads(r[0])
                    for r in original_conn.execute(
                        "SELECT embedding::text FROM chunks ORDER BY id"
                    )
                ]
        for start in range(0, len(chunks), 16):
            batch = chunks[start : start + 16]
            tick = time.perf_counter()
            vectors = (
                baseline_vectors[start : start + 16]
                if baseline_vectors
                else call_adapter(
                    {
                        "action": "embed",
                        "contents": [c["content"] for c in batch],
                        "config": config,
                    }
                )["embeddings"]
            )
            embed_seconds += time.perf_counter() - tick
            from scripts.ingest_corpus import validate_vectors

            validate_vectors(vectors, len(batch), 768)
            for chunk, vector in zip(batch, vectors, strict=True):
                conn.execute(
                    (
                        "INSERT INTO "
                        "chunks(id,document_id,chunk_index,page_number,content,embedding,m"
                        "etadata) VALUES (%s,%s,%s,%s,%s,%s::vector,%s)"
                    ),
                    (
                        chunk["chunk_id"],
                        chunk["document_id"],
                        chunk["chunk_index"],
                        chunk["page_number"],
                        chunk["content"],
                        json.dumps(vector),
                        Jsonb(chunk["metadata"]) if chunk["metadata"] else None,
                    ),
                )
            print(
                f"{name}: indexed {min(start + 16, len(chunks))}/{len(chunks)}",
                flush=True,
            )
    lengths = [len(c["content"].encode("utf-16-le")) // 2 for c in chunks]
    result = {
        "identity": identity,
        "chunks": chunks,
        "chunk_count": len(chunks),
        "lengths": {
            "mean": statistics.mean(lengths),
            "min": min(lengths),
            "max": max(lengths),
            "p25": percentile(lengths, 0.25),
            "p50": percentile(lengths, 0.5),
            "p95": percentile(lengths, 0.95),
        },
        "ingestion_seconds": time.perf_counter() - started,
        "embedding_seconds": embed_seconds,
        "embedding_note": (
            "Control copies original local vectors; candidates use actual "
            "local embedding calls/cache; includes adapter startup."
        ),
    }
    save(path, result)
    return result


def split_questions():
    records = [
        json.loads(line)
        for line in (ROOT / "eval/golden_set.jsonl").read_text().splitlines()
    ]
    groups = defaultdict(list)
    for row in records:
        groups[(row["document_key"], row["type"])].append(row["id"])
    rng = random.Random(42)
    dev = []
    for key in sorted(groups):
        ids = sorted(groups[key])
        rng.shuffle(ids)
        dev.extend(ids[: int(len(ids) * 0.6)])
    split = {
        "seed": 42,
        "development": sorted(dev),
        "holdout": [r["id"] for r in records if r["id"] not in dev],
        "limitation": (
            "All 100 questions were previously used in Step 2; this is a "
            "parameter-selection holdout, not an unseen unbiased benchmark."
        ),
    }
    path = DIRECTORY / "split.json"
    if path.exists() and json.loads(path.read_text()) != split:
        raise ValueError("Frozen split changed")
    save(path, split)
    return records, split


def summarize(rows):
    answerable = [r for r in rows if r["type"] != "unanswerable"]
    metrics = {
        m: statistics.mean(r[m] for r in answerable)
        for m in ("recall@3", "recall@5", "recall@10", "mrr")
    }
    multihop = [r for r in rows if r["type"] == "multi_hop"]
    metrics["multi_hop_recall@5"] = statistics.mean(r["recall@5"] for r in multihop)
    timings = [r["retrieval_latency_ms"] for r in rows]
    metrics.update(
        retrieval_p50_ms=percentile(timings, 0.5),
        retrieval_p95_ms=percentile(timings, 0.95),
        count=len(rows),
        unanswerable_count=sum(r["type"] == "unanswerable" for r in rows),
    )
    return metrics


def retrieve(name, records, label):
    config = config_for(name)
    mapping = prepare(name, config)
    by_id = {c["chunk_id"]: c for c in mapping["chunks"]}
    rows = []
    for record in records:
        response = call_adapter(
            {
                "action": "retrieve",
                "question": record["question"],
                "documentId": 1 if record["document_key"] == "fastapi" else 2,
                "config": config,
            }
        )
        ranked = response["ranked"]
        for chunk in ranked:
            source = by_id[chunk["id"]]
            if (
                source["document_key"] != record["document_key"]
                or sha256(chunk["content"].encode()) != source["content_sha256"]
            ):
                raise ValueError("Retrieval source mismatch")
            chunk["source_id"] = source["source_id"]
        ids = [c["source_id"] for c in ranked]
        row = {
            "id": record["id"],
            "type": record["type"],
            "ranked_chunks": ranked,
            "retrieval_latency_ms": response["retrieval_latency_ms"],
            "cache": response["cache"],
        }
        row.update(
            {
                f"recall@{k}": recall_at_k(
                    ids, record["relevant_source_ids"], k, record["type"]
                )
                for k in (3, 5, 10)
            }
        )
        row["mrr"] = reciprocal_rank(ids, record["relevant_source_ids"], record["type"])
        rows.append(row)
        print(f"{name} {label} {len(rows)}/{len(records)}", flush=True)
    result = {
        "name": name,
        "subset": label,
        "config": config,
        "mapping_sha256": sha256(mapping_path(name).read_bytes()),
        "metrics": summarize(rows),
        "questions": rows,
        "measured_at": datetime.now(timezone.utc).isoformat(),
    }
    save(DIRECTORY / f"{name}-{label}.json", result)
    return result


def matrix():
    records, split = split_questions()
    selection_path = DIRECTORY / "selection.json"
    if selection_path.exists():
        raise ValueError(
            "Selection already frozen; use verification, do not retune holdout"
        )
    results = []
    for name in MATRIX:
        try:
            results.append(
                retrieve(
                    name,
                    [r for r in records if r["id"] in split["development"]],
                    "development",
                )
            )
        except Exception as exc:
            save(
                DIRECTORY / f"{name}-failure-{time.time_ns()}.json",
                {
                    "name": name,
                    "error_type": type(exc).__name__,
                    "stage": "development",
                },
            )
            raise
    # Freeze selection before holdout; prefer control in exact ties.
    best = max(
        results,
        key=lambda r: (
            r["metrics"]["recall@5"],
            r["metrics"]["mrr"],
            r["metrics"]["multi_hop_recall@5"],
            r["name"].startswith("control"),
            -json.loads(mapping_path(r["name"]).read_text())["chunk_count"],
        ),
    )
    selection = {
        "selected": best["name"],
        "rule": (
            "Development recall@5, MRR, multi-hop recall@5; control on "
            "equality, then fewer chunks. Source checks are mandatory. "
            "Unanswerable retrieval has no relevant labels and is not "
            "assigned recall."
        ),
        "development_artifact_hashes": {
            r["name"]: sha256(
                (DIRECTORY / f"{r['name']}-development.json").read_bytes()
            )
            for r in results
        },
        "split_sha256": sha256((DIRECTORY / "split.json").read_bytes()),
        "frozen_at": datetime.now(timezone.utc).isoformat(),
    }
    save(selection_path, selection)
    held = [r for r in records if r["id"] in split["holdout"]]
    for name in dict.fromkeys(("control-1000-200", best["name"])):
        retrieve(name, held, "holdout")
    print(json.dumps(selection), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--matrix", action="store_true")
    parser.add_argument("--prepare", choices=MATRIX)
    args = parser.parse_args()
    try:
        if args.matrix:
            matrix()
        elif args.prepare:
            prepare(args.prepare)
        else:
            parser.error("Select --matrix or --prepare")
    except Exception as exc:
        parser.exit(1, f"Chunking experiment failed: {type(exc).__name__}\n")
