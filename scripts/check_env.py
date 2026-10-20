"""Verify private configuration, read-only database access, and real Gemini access."""

import json
import subprocess
import sys

import psycopg

try:
    from .common import ROOT, database_url, load_environment, required
except ImportError:
    from common import ROOT, database_url, load_environment, required


def check_database(url):
    with psycopg.connect(url, connect_timeout=5) as conn:
        conn.read_only = True
        with conn.cursor() as cur:
            cur.execute("SET LOCAL statement_timeout = '5s'")
            cur.execute("SELECT extname FROM pg_extension WHERE extname = 'vector'")
            if not cur.fetchone():
                raise ValueError("pgvector is missing")
            for table in ("documents", "chunks", "evaluations"):
                cur.execute("SELECT to_regclass(%s)", (f"public.{table}",))
                if cur.fetchone()[0] is None:
                    raise ValueError("Required application table is missing")
            cur.execute(
                "SELECT format_type(atttypid, atttypmod) FROM pg_attribute "
                "WHERE attrelid = 'public.chunks'::regclass "
                "AND attname = 'embedding' AND NOT attisdropped"
            )
            config = json.loads((ROOT / "lib/model-config.json").read_text())
            if cur.fetchone() != (f"vector({config['embeddingDimensions']})",):
                raise ValueError("Embedding dimension does not match the application")
            cur.execute("SELECT content_tsv FROM public.chunks LIMIT 0")
            cur.execute(
                "SELECT indexdef FROM pg_indexes "
                "WHERE schemaname = 'public' AND tablename = 'chunks'"
            )
            definitions = "\n".join(row[0] for row in cur.fetchall()).lower()
            for expected in (
                "using gin (content_tsv)",
                "vector_cosine_ops",
                "(document_id)",
            ):
                if expected not in definitions:
                    raise ValueError("Required retrieval index is missing")


def main():
    load_environment()
    failed = False
    for name in ("DATABASE_URL", "GOOGLE_GENERATIVE_AI_API_KEY"):
        try:
            required(name)
            print(f"{name}: configured (value hidden)")
        except ValueError:
            print(f"{name}: missing or placeholder", file=sys.stderr)
            failed = True
    try:
        check_database(database_url())
        print("Database, tables, pgvector, dimensions, search column and indexes: PASS")
    except Exception as exc:
        print(f"Database/configuration: FAIL ({type(exc).__name__})", file=sys.stderr)
        failed = True
    try:
        required("GOOGLE_GENERATIVE_AI_API_KEY")
        result = subprocess.run(
            ["node", "scripts/check_gemini.mjs"], cwd=ROOT, timeout=40, check=False
        )
        failed = failed or result.returncode != 0
    except Exception as exc:
        print(f"Gemini: NOT VERIFIED ({type(exc).__name__})", file=sys.stderr)
        failed = True
    return int(failed)


if __name__ == "__main__":
    sys.exit(main())
