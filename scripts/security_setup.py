"""Create an isolated test database; apply additive security migrations safely."""

import argparse
import json
import os
import subprocess
import uuid
from urllib.parse import urlsplit, urlunsplit

import psycopg
from psycopg import sql

from eval.chunking_experiments import connect_experiment, experiment_url
from eval.corpus import ROOT
from scripts.common import database_url, load_environment
from scripts.native_db import DATA, owned_cluster, postgres_port


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--fresh-test", action="store_true")
    parser.add_argument("--apply-selected", action="store_true")
    parser.add_argument("--apply-configured", action="store_true")
    args = parser.parse_args()
    owned_cluster()
    selected = experiment_url("heading-1400-280")
    with psycopg.connect(selected) as target_check:
        target_check.read_only = True
        actual = target_check.execute("SHOW data_directory").fetchone()[0]
        if os.path.realpath(actual) != str(DATA.resolve()):
            raise ValueError("Native server ownership mismatch")
    if args.fresh_test:
        name = "docrag_security_test_" + uuid.uuid4().hex[:12]
        target = urlunsplit(urlsplit(selected)._replace(path="/" + name))
        with psycopg.connect(selected, autocommit=True) as conn:
            conn.execute(
                sql.SQL("CREATE DATABASE {} TEMPLATE template0").format(
                    sql.Identifier(name)
                )
            )
        with psycopg.connect(target, autocommit=True) as conn:
            conn.execute(
                (ROOT / "db/init.sql")
                .read_text()
                .replace("vector(1536)", "vector(768)")
            )
        with (
            connect_experiment("heading-1400-280") as source,
            psycopg.connect(target) as dest,
        ):
            source.read_only = True
            for table, columns in [
                (
                    "documents",
                    "id,title,filename,page_count,chunk_count,status,created_at",
                ),
                (
                    "chunks",
                    "id,document_id,chunk_index,page_number,content,embedding,created_at,metadata",
                ),
            ]:
                # Fixed identifiers; preserve content, IDs, vectors, timestamps.
                with source.cursor().copy(
                    f"COPY {table} ({columns}) TO STDOUT"
                ) as reader:
                    with dest.cursor().copy(
                        f"COPY {table} ({columns}) FROM STDIN"
                    ) as writer:
                        for block in reader:
                            writer.write(block)
                dest.execute(
                    f"SELECT setval(pg_get_serial_sequence('{table}','id'),"
                    f"COALESCE(MAX(id),1)) FROM {table}"
                )
            dest.commit()
        (ROOT / ".local/security-test.json").write_text(
            json.dumps({"database": name, "owner": str(ROOT)})
        )
        commands = [[], [], ["--test-accounts"]]
    elif args.apply_selected or args.apply_configured:
        receipt = json.loads((ROOT / ".local/security-migration-test.json").read_text())
        if receipt.get("status") != "PASS":
            raise ValueError("Isolated migration test must pass first")
        load_environment()
        target = database_url() if args.apply_configured else selected
        parsed = urlsplit(target)
        if (
            parsed.hostname != "127.0.0.1"
            or parsed.port != int(postgres_port())
            or parsed.path not in {"/docrag_dev", "/docrag_chunking_heading_1400_280"}
        ):
            raise ValueError("Only the owned native application database is supported")
        commands = [[]]
    else:
        raise ValueError("Select fresh-test or apply-selected")

    def legacy_snapshot():
        with psycopg.connect(target) as conn:
            conn.read_only = True
            return [
                conn.execute(f"SELECT * FROM {table} ORDER BY id").fetchall()
                for table in ["documents", "chunks", "evaluations"]
            ]

    before = legacy_snapshot()
    if not args.fresh_test:
        from scripts.observability_setup import snapshot

        security_before = snapshot(target)
    env = {**os.environ, "SECURITY_DATABASE_URL": target}
    for flags in commands:
        subprocess.run(
            ["node", "--import", "tsx", "scripts/security-migrate.ts", *flags],
            env=env,
            cwd=ROOT,
            check=True,
        )
    assert legacy_snapshot() == before, "Migration changed legacy application data"
    if not args.fresh_test:
        assert snapshot(target) == security_before, "Migration changed security data"
        label = "configured" if args.apply_configured else "selected"
        (ROOT / f".local/step8-migration-{label}.json").write_text(
            json.dumps({"status": "PASS", "preserved": security_before}, indent=2)
        )
    with psycopg.connect(target) as conn:
        conn.read_only = True
        public = conn.execute(
            "SELECT count(*) FROM document_access WHERE visibility='public'"
        ).fetchone()[0]
        if not args.apply_configured:
            assert public == 2
            assert conn.execute("SELECT count(*) FROM chunks").fetchone()[0] == 162
        assert conn.execute(
            "SELECT count(*) FROM drizzle.__drizzle_migrations"
        ).fetchone()[0] == len(
            json.loads(
                (ROOT / "db/security-migrations/meta/_journal.json").read_text()
            )["entries"]
        )
    if args.fresh_test:
        (ROOT / ".local/security-migration-test.json").write_text(
            json.dumps(
                {
                    "status": "PASS",
                    "database": name,
                    "public_documents": public,
                    "chunks": 162,
                    "repeat_migration": "idempotent",
                }
            )
        )
    print("PASS: migration, idempotency and explicit public classification")


if __name__ == "__main__":
    main()
