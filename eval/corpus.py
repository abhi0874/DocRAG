"""Hash-verified public sources and a guarded, separate local evaluation database."""

import hashlib
import json
import os
from urllib.parse import urlsplit, urlunsplit

import psycopg
from psycopg import sql

from scripts.common import ROOT, database_url, load_environment
from scripts.native_db import DATA, owned_cluster

CORPUS = ROOT / "eval/corpus"
DB_NAME = "docrag_eval_v1"
OWNER_FILE = ROOT / ".local/evaluation-database-owner"


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode()


def load_corpus():
    manifest = json.loads((CORPUS / "manifest.json").read_text())
    if sha256(canonical(manifest["sources"])) != manifest["corpus_hash"]:
        raise ValueError("Corpus manifest hash mismatch")
    ids = set()
    for source in manifest["sources"]:
        if source["source_id"] in ids:
            raise ValueError("Duplicate corpus source ID")
        ids.add(source["source_id"])
        path = (CORPUS / source["text_file"]).resolve()
        if (
            path.parent != CORPUS
            or sha256(path.read_bytes()) != source["content_sha256"]
        ):
            raise ValueError("Corpus text path/hash mismatch")
    return manifest


def evaluation_url():
    """Derive a URL privately; accept ONLY the checkout's native local cluster."""
    load_environment()
    owned_cluster()
    parts = urlsplit(database_url())
    if (parts.hostname, parts.port, parts.username, parts.path, parts.query) != (
        "127.0.0.1",
        55432,
        "docrag",
        "/docrag_dev",
        "",
    ):
        raise ValueError("Evaluation requires this checkout's native development DB")
    return urlunsplit(parts._replace(path="/" + DB_NAME))


def connect_evaluation():
    if not OWNER_FILE.exists() or OWNER_FILE.read_text() != str(ROOT):
        raise ValueError("Evaluation database ownership marker is missing")
    return psycopg.connect(evaluation_url(), connect_timeout=5)


def initialize_database():
    url = evaluation_url()
    admin_url = urlunsplit(urlsplit(url)._replace(path="/postgres"))
    with psycopg.connect(admin_url, autocommit=True, connect_timeout=5) as admin:
        actual = admin.execute("SHOW data_directory").fetchone()[0]
        if os.path.realpath(actual) != str(DATA.resolve()):
            raise ValueError("Connected server is not the checkout-owned cluster")
        admin.execute("SELECT pg_advisory_lock(20261021, 2)")
        exists = admin.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s", (DB_NAME,)
        ).fetchone()
        if exists:
            if not OWNER_FILE.exists() or OWNER_FILE.read_text() != str(ROOT):
                raise ValueError("Existing evaluation database is not owned; preserved")
        else:
            admin.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(DB_NAME)))
            OWNER_FILE.write_text(str(ROOT))
            OWNER_FILE.chmod(0o600)
    with connect_evaluation() as conn:
        tables = conn.execute(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
        ).fetchall()
        if tables:
            if ("eval_corpus",) not in tables:
                raise ValueError("Unrecognized evaluation tables; refusing to modify")
            owner = conn.execute("SELECT owner FROM eval_corpus").fetchone()
            if owner != (str(ROOT),):
                raise ValueError("Evaluation database owner mismatch")
            return
        # Reuse the exact application schema, in this new database only.
        conn.execute(
            (ROOT / "db/init.sql")
            .read_text()
            .replace("BEGIN;", "")
            .replace("COMMIT;", "")
        )
        conn.execute("""
            CREATE TABLE eval_corpus (
                singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
                owner text NOT NULL, corpus_hash text, config_hash text
            );
            CREATE TABLE eval_sources (
                source_id text PRIMARY KEY, document_id integer NOT NULL,
                page_number integer NOT NULL, content_sha256 text NOT NULL
            );
        """)
        conn.execute("INSERT INTO eval_corpus (owner) VALUES (%s)", (str(ROOT),))
