"""Copy verified public chunks into a separately owned local-vector database."""

import json
import os
from urllib.parse import urlsplit, urlunsplit

import psycopg
from psycopg import sql

from eval.corpus import (
    ROOT,
    canonical,
    connect_evaluation,
    evaluation_url,
    load_corpus,
    sha256,
)
from scripts.native_db import DATA

NAME = "docrag_ollama_v1"
OWNER = ROOT / ".local/ollama-database-owner"
MAPPING = ROOT / ".local/ollama-corpus-map.json"


def local_url():
    return urlunsplit(urlsplit(evaluation_url())._replace(path="/" + NAME))


def connect_local():
    if not OWNER.exists() or OWNER.read_text() != str(ROOT):
        raise ValueError("Local evaluation database ownership missing")
    return psycopg.connect(local_url(), connect_timeout=5)


def snapshot_original():
    with connect_evaluation() as conn:
        conn.read_only = True
        rows = conn.execute(
            "SELECT id, document_id, chunk_index, page_number, content, "
            "embedding::text FROM chunks ORDER BY id"
        ).fetchall()
        docs = conn.execute(
            "SELECT id, title, filename, page_count, chunk_count, status FROM "
            "documents ORDER BY id"
        ).fetchall()
        sources = conn.execute(
            "SELECT source_id, document_id, page_number, content_sha256 FROM "
            "eval_sources ORDER BY source_id"
        ).fetchall()
    mapping = json.loads((ROOT / ".local/eval-corpus-map.json").read_text())
    corpus = load_corpus()
    if (
        len(rows) != 151
        or len(docs) != 2
        or len(sources) != 12
        or mapping["corpus_hash"] != corpus["corpus_hash"]
    ):
        raise ValueError("Original corpus counts/hash mismatch")
    by_id = {m["chunk_id"]: m for m in mapping["chunks"]}
    for row in rows:
        m = by_id[row[0]]
        if (
            m["document_id"],
            m["chunk_index"],
            m["page_number"],
            m["content_sha256"],
        ) != (row[1], row[2], row[3], sha256(row[4].encode())):
            raise ValueError("Original source/chunk mapping mismatch")
    return rows, docs, sources, mapping


def prepare(config):
    from eval.runtime import call_adapter
    from scripts.ingest_corpus import validate_vectors

    rows, docs, sources, mapping = snapshot_original()
    dim = config["embedding_dimensions"]
    embedding_config = {
        k: config[k]
        for k in (
            "provider",
            "embedding_model",
            "embedding_dimensions",
            "local_settings",
            "corpus_hash",
        )
    }
    config_hash = sha256(canonical(embedding_config))
    admin_url = urlunsplit(urlsplit(local_url())._replace(path="/postgres"))
    with psycopg.connect(admin_url, autocommit=True, connect_timeout=5) as conn:
        if os.path.realpath(conn.execute("SHOW data_directory").fetchone()[0]) != str(
            DATA.resolve()
        ):
            raise ValueError("Native server ownership mismatch")
        conn.execute("SELECT pg_advisory_lock(20261023, 2)")
        exists = conn.execute(
            "SELECT 1 FROM pg_database WHERE datname=%s", (NAME,)
        ).fetchone()
        if exists and (not OWNER.exists() or OWNER.read_text() != str(ROOT)):
            raise ValueError("Existing database is unowned; preserved")
        if not exists:
            conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(NAME)))
            OWNER.write_text(str(ROOT))
            OWNER.chmod(0o600)
    with connect_local() as conn:
        tables = conn.execute(
            "SELECT tablename FROM pg_tables WHERE schemaname='public'"
        ).fetchall()
        if tables:
            if ("eval_corpus",) not in tables:
                raise ValueError("Unknown local tables; preserved")
            meta = conn.execute(
                "SELECT owner, corpus_hash, config_hash FROM eval_corpus"
            ).fetchone()
            if meta != (str(ROOT), mapping["corpus_hash"], config_hash):
                raise ValueError(
                    "Existing local corpus/model identity differs; preserved"
                )
        else:
            schema = (
                (ROOT / "db/init.sql")
                .read_text()
                .replace("BEGIN;", "")
                .replace("COMMIT;", "")
                .replace("vector(1536)", f"vector({dim})")
            )
            conn.execute(schema)
            conn.execute(
                "CREATE TABLE eval_corpus(owner text NOT NULL, corpus_hash text NOT "
                "NULL, config_hash text NOT NULL)"
            )
            conn.execute(
                "CREATE TABLE eval_sources(source_id text PRIMARY KEY, document_id "
                "integer NOT NULL, page_number integer NOT NULL, content_sha256 text "
                "NOT NULL)"
            )
            for doc in docs:
                conn.execute(
                    "INSERT INTO "
                    "documents(id,title,filename,page_count,chunk_count,status) "
                    "VALUES (%s,%s,%s,%s,%s,%s)",
                    doc,
                )
            for source in sources:
                conn.execute("INSERT INTO eval_sources VALUES (%s,%s,%s,%s)", source)
            for start in range(0, len(rows), 16):
                batch = rows[start : start + 16]
                result = call_adapter(
                    {
                        "action": "embed",
                        "contents": [r[4] for r in batch],
                        "config": config,
                    }
                )
                vectors = result["embeddings"]
                validate_vectors(vectors, len(batch), dim)
                for row, vector in zip(batch, vectors, strict=True):
                    conn.execute(
                        "INSERT INTO "
                        "chunks(id,document_id,chunk_index,page_number,content,embedd"
                        "ing) VALUES (%s,%s,%s,%s,%s,%s::vector)",
                        (*row[:5], json.dumps(vector)),
                    )
                print(
                    f"Local embeddings: {min(start + 16, len(rows))}/{len(rows)}",
                    flush=True,
                )
            conn.execute(
                "INSERT INTO eval_corpus VALUES (%s,%s,%s)",
                (str(ROOT), mapping["corpus_hash"], config_hash),
            )
            for table in ("documents", "chunks"):
                conn.execute(
                    sql.SQL(
                        "SELECT setval(pg_get_serial_sequence({}, 'id'), (SELECT "
                        "max(id) FROM {}))"
                    ).format(sql.Literal(table), sql.Identifier(table))
                )
        stored = conn.execute(
            "SELECT "
            "id,document_id,chunk_index,page_number,content,vector_dims(embedding) "
            "FROM chunks ORDER BY id"
        ).fetchall()
        if stored != [(*r[:5], dim) for r in rows]:
            raise ValueError("Local chunks/dimensions differ from original")
        if (
            conn.execute(
                "SELECT source_id,document_id,page_number,content_sha256 FROM "
                "eval_sources ORDER BY source_id"
            ).fetchall()
            != sources
        ):
            raise ValueError("Local source mappings differ")
        if (
            conn.execute(
                "SELECT id,title,filename,page_count,chunk_count,status FROM "
                "documents ORDER BY id"
            ).fetchall()
            != docs
        ):
            raise ValueError("Local document metadata differs")
    MAPPING.write_text(
        json.dumps(
            {
                **mapping,
                "embedding_config_hash": config_hash,
                "original_vectors_sha256": sha256(canonical(rows)),
            },
            indent=2,
        )
        + "\n"
    )
    print(
        json.dumps(
            {
                "database": "isolated Ollama database",
                "chunks": len(rows),
                "documents": len(docs),
                "sources": len(sources),
                "dimensions": dim,
            }
        )
    )
