"""Idempotently ingest pinned docs using the real TypeScript chunk/embed functions."""

import json
import math
import os
import subprocess
import sys
import time
from pathlib import Path

# Support the established `python scripts/ingest_corpus.py` command.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from eval.corpus import (  # noqa: E402
    CORPUS,
    canonical,
    connect_evaluation,
    evaluation_url,
    initialize_database,
    load_corpus,
    sha256,
)
from scripts.common import ROOT  # noqa: E402

CACHE = ROOT / ".local/eval-cache/ingestion"


def adapter(payload):
    env = os.environ.copy()
    env["DATABASE_URL"] = evaluation_url()
    result = subprocess.run(
        ["node", "--import", "tsx", "eval/ingest_adapter.ts"],
        cwd=ROOT,
        env=env,
        input=json.dumps(payload),
        text=True,
        capture_output=True,
        timeout=300,
    )
    if result.returncode:
        # Only the adapter's deliberately sanitized status line is safe to show.
        safe = [
            line
            for line in result.stderr.splitlines()
            if line.startswith("Ingestion adapter failed; HTTP status:")
        ]
        raise ValueError(safe[-1] if safe else "TypeScript ingestion adapter failed")
    return json.loads(result.stdout)


def validate_vectors(vectors, count, dimensions):
    if not isinstance(vectors, list) or len(vectors) != count:
        raise ValueError("Embedding count mismatch")
    if any(
        not isinstance(v, list)
        or len(v) != dimensions
        or any(type(x) not in (int, float) or not math.isfinite(x) for x in v)
        for v in vectors
    ):
        raise ValueError("Invalid embedding dimensions or numeric values")


def prepare_documents(manifest):
    documents = []
    for key in sorted({s["document_key"] for s in manifest["sources"]}):
        sources = sorted(
            (s for s in manifest["sources"] if s["document_key"] == key),
            key=lambda s: s["page_number"],
        )
        if [s["page_number"] for s in sources] != list(range(1, len(sources) + 1)):
            raise ValueError("Nonconsecutive page mapping")
        pages = [(CORPUS / s["text_file"]).read_text() for s in sources]
        chunks = adapter({"action": "chunk", "pages": pages})
        documents.append({"key": key, "sources": sources, "chunks": chunks})
    return documents


def verify_database(conn, documents, manifest, config_hash):
    meta = conn.execute("SELECT corpus_hash, config_hash FROM eval_corpus").fetchone()
    if meta != (manifest["corpus_hash"], config_hash):
        raise ValueError(
            "Ingested corpus/configuration mismatch; existing data preserved"
        )
    mappings = []
    for doc in documents:
        filename = f"eval:{manifest['corpus_id']}:{doc['key']}"
        rows = conn.execute(
            "SELECT id, page_count, chunk_count, status "
            "FROM documents WHERE filename=%s",
            (filename,),
        ).fetchall()
        if len(rows) != 1 or rows[0][1:] != (
            len(doc["sources"]),
            len(doc["chunks"]),
            "ready",
        ):
            raise ValueError("Evaluation document metadata mismatch")
        doc_id = rows[0][0]
        stored = conn.execute(
            "SELECT id, content, page_number, chunk_index, vector_dims(embedding) "
            "FROM chunks WHERE document_id=%s ORDER BY chunk_index",
            (doc_id,),
        ).fetchall()
        expected = [
            (c["content"], c["pageNumber"], c["chunkIndex"], 1536)
            for c in doc["chunks"]
        ]
        if [row[1:] for row in stored] != expected:
            raise ValueError("Stored chunks do not match the real chunker output")
        expected_sources = sorted(
            (s["source_id"], doc_id, s["page_number"], s["content_sha256"])
            for s in doc["sources"]
        )
        actual_sources = conn.execute(
            "SELECT source_id, document_id, page_number, content_sha256 "
            "FROM eval_sources WHERE document_id=%s ORDER BY source_id",
            (doc_id,),
        ).fetchall()
        if actual_sources != expected_sources:
            raise ValueError("Source mapping mismatch")
        for row in stored:
            source = doc["sources"][row[2] - 1]
            mappings.append(
                {
                    "document_key": doc["key"],
                    "document_id": doc_id,
                    "chunk_id": row[0],
                    "chunk_index": row[3],
                    "source_id": source["source_id"],
                    "page_number": row[2],
                    "content_sha256": sha256(row[1].encode()),
                }
            )
    totals = conn.execute(
        "SELECT (SELECT count(*) FROM documents), (SELECT count(*) FROM chunks), "
        "(SELECT count(*) FROM eval_sources)"
    ).fetchone()
    if totals != (len(documents), len(mappings), len(manifest["sources"])):
        raise ValueError("Unexpected records in the isolated evaluation database")
    return mappings


def main():
    manifest = load_corpus()
    initialize_database()
    model = json.loads((ROOT / "lib/model-config.json").read_text())
    config = {
        "model": model["embedding"],
        "dimensions": model["embeddingDimensions"],
        "task_type": "RETRIEVAL_DOCUMENT",
        "corpus_hash": manifest["corpus_hash"],
        "rag_sha256": sha256((ROOT / "lib/rag.ts").read_bytes()),
        "lock_sha256": sha256((ROOT / "pnpm-lock.yaml").read_bytes()),
    }
    config_hash = sha256(canonical(config))
    documents = prepare_documents(manifest)
    hits = misses = 0
    last_fresh_batch = None
    with connect_evaluation() as conn:
        conn.execute("SELECT pg_advisory_xact_lock(20261021, 2)")
        existing = conn.execute("SELECT corpus_hash FROM eval_corpus").fetchone()[0]
        if existing is None:
            CACHE.mkdir(parents=True, exist_ok=True)
            for doc in documents:
                texts = [chunk["content"] for chunk in doc["chunks"]]
                # Match the existing embedChunks batch size. Cache each completed batch.
                vectors = []
                for start in range(0, len(texts), 100):
                    batch = texts[start : start + 100]
                    cache_key = sha256(canonical({"config": config, "contents": batch}))
                    path = CACHE / f"{cache_key}.json"
                    if path.exists():
                        values = json.loads(path.read_text())
                        hits += 1
                    else:
                        # Each chunk counts toward the provider's request quota.
                        # Keep real batches <=100 and separate fresh calls by 61s.
                        # This evaluation-only pacing does not change lib/rag.ts.
                        if last_fresh_batch is not None:
                            delay = max(0, 61 - (time.monotonic() - last_fresh_batch))
                            if delay:
                                print(
                                    "Waiting for embedding request window", flush=True
                                )
                                time.sleep(delay)
                        last_fresh_batch = time.monotonic()
                        values = adapter({"action": "embed", "contents": batch})
                        validate_vectors(
                            values, len(batch), model["embeddingDimensions"]
                        )
                        temp = path.with_suffix(".tmp")
                        temp.write_text(json.dumps(values))
                        temp.replace(path)
                        misses += 1
                    validate_vectors(values, len(batch), model["embeddingDimensions"])
                    vectors.extend(values)
                doc_id = conn.execute(
                    "INSERT INTO documents (title, filename, page_count, chunk_count, "
                    "status) VALUES (%s,%s,%s,%s,'ready') RETURNING id",
                    (
                        f"Evaluation corpus: {doc['key']}",
                        f"eval:{manifest['corpus_id']}:{doc['key']}",
                        len(doc["sources"]),
                        len(doc["chunks"]),
                    ),
                ).fetchone()[0]
                with conn.cursor() as cur:
                    cur.executemany(
                        "INSERT INTO chunks (document_id, chunk_index, page_number, "
                        "content, embedding) VALUES (%s,%s,%s,%s,%s::vector)",
                        [
                            (
                                doc_id,
                                c["chunkIndex"],
                                c["pageNumber"],
                                c["content"],
                                json.dumps(v),
                            )
                            for c, v in zip(doc["chunks"], vectors, strict=True)
                        ],
                    )
                    cur.executemany(
                        "INSERT INTO eval_sources VALUES (%s,%s,%s,%s)",
                        [
                            (
                                s["source_id"],
                                doc_id,
                                s["page_number"],
                                s["content_sha256"],
                            )
                            for s in doc["sources"]
                        ],
                    )
            conn.execute(
                "UPDATE eval_corpus SET corpus_hash=%s, config_hash=%s",
                (manifest["corpus_hash"], config_hash),
            )
        mappings = verify_database(conn, documents, manifest, config_hash)
    local_map = {
        "corpus_hash": manifest["corpus_hash"],
        "config": config,
        "config_hash": config_hash,
        "chunks": mappings,
    }
    (ROOT / ".local/eval-corpus-map.json").write_text(
        json.dumps(local_map, indent=2) + "\n"
    )
    stable = [
        {k: v for k, v in m.items() if k not in {"document_id", "chunk_id"}}
        for m in mappings
    ]
    stable_path = CORPUS / "chunk_map.json"
    if stable_path.exists() and json.loads(stable_path.read_text()) != stable:
        raise ValueError("Committed chunk mapping differs; explicit review required")
    if not stable_path.exists():
        stable_path.write_text(json.dumps(stable, indent=2) + "\n")
    print(
        json.dumps(
            {
                "database": "isolated evaluation database",
                "documents": len(documents),
                "sources": len(manifest["sources"]),
                "chunks": len(mappings),
                "embedding_cache_hits": hits,
                "embedding_cache_misses": misses,
                "already_ingested": existing is not None,
            }
        )
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        detail = str(exc) if isinstance(exc, ValueError) else type(exc).__name__
        print(f"Corpus ingestion failed: {detail}", file=sys.stderr)
        sys.exit(1)
