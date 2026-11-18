"""Test additive telemetry migration against an immutable copy of Step 7 data."""

import hashlib
import json
import os
import re
import subprocess
import uuid
from urllib.parse import urlsplit, urlunsplit

import psycopg
from psycopg import sql

from eval.chunking_experiments import experiment_url
from eval.corpus import ROOT
from scripts.native_db import DATA, owned_cluster

TABLES = [
    "documents",
    "chunks",
    "evaluations",
    "auth_user",
    "auth_session",
    "auth_account",
    "auth_verification",
    "document_access",
    "evaluation_access",
    "document_files",
    "request_limits",
]


def user_columns(target):
    with psycopg.connect(target) as conn:
        conn.read_only = True
        return [
            row[0]
            for row in conn.execute(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_schema='public' AND table_name='auth_user' "
                "ORDER BY ordinal_position"
            )
        ]


def snapshot(target, auth_columns=None):
    with psycopg.connect(target) as conn:
        conn.read_only = True
        assert os.path.realpath(
            conn.execute("SHOW data_directory").fetchone()[0]
        ) == str(DATA.resolve())
        result = {}
        for table in TABLES:
            columns = (
                sql.SQL(",").join(map(sql.Identifier, auth_columns))
                if table == "auth_user" and auth_columns
                else sql.SQL("*")
            )
            rows = conn.execute(
                sql.SQL(
                    "SELECT row_to_json(t)::text FROM (SELECT {} FROM {}) t "
                    "ORDER BY row_to_json(t)::text"
                ).format(columns, sql.Identifier(table))
            ).fetchall()
            result[table] = {
                "count": len(rows),
                "sha256": hashlib.sha256(json.dumps(rows).encode()).hexdigest(),
            }
        return result


def main():
    owned_cluster()
    selected = experiment_url("heading-1400-280")
    marker_path = ROOT / ".local/security-test.json"
    accounts_path = ROOT / ".local/security-test-accounts.json"
    seed_path = ROOT / ".local/step8-migration-seed.json"
    seed_accounts = ROOT / ".local/step8-migration-seed-accounts.json"
    if not seed_path.exists():
        marker = json.loads(marker_path.read_text())
        assert marker["owner"] == str(ROOT)
        assert re.fullmatch(r"docrag_security_test_[a-f0-9]{12}", marker["database"])
        source = urlunsplit(urlsplit(selected)._replace(path="/" + marker["database"]))
        before = snapshot(source)
        with psycopg.connect(source) as conn:
            conn.read_only = True
            assert (
                conn.execute(
                    "SELECT count(*) FROM drizzle.__drizzle_migrations"
                ).fetchone()[0]
                == 1
            )
        assert before["auth_user"]["count"] >= 2
        assert before["document_files"]["count"] > 0
        seed_path.write_text(json.dumps({**marker, "before": before}))
        seed_accounts.write_bytes(accounts_path.read_bytes())
        seed_accounts.chmod(0o600)
    seed = json.loads(seed_path.read_text())
    assert seed["owner"] == str(ROOT)
    assert re.fullmatch(r"docrag_security_test_[a-f0-9]{12}", seed["database"])
    source = urlunsplit(urlsplit(selected)._replace(path="/" + seed["database"]))
    assert snapshot(source) == seed["before"], "Step 7 seed changed"
    name = "docrag_security_test_" + uuid.uuid4().hex[:12]
    target = urlunsplit(urlsplit(selected)._replace(path="/" + name))
    with psycopg.connect(selected, autocommit=True) as conn:
        assert os.path.realpath(
            conn.execute("SHOW data_directory").fetchone()[0]
        ) == str(DATA.resolve())
        conn.execute(
            sql.SQL("CREATE DATABASE {} TEMPLATE {}").format(
                sql.Identifier(name), sql.Identifier(seed["database"])
            )
        )
    assert snapshot(target) == seed["before"]
    # Sign-out checks deliberately removed sessions from the old fixture. Add a
    # synthetic pre-upgrade session only to the disposable clone.
    with psycopg.connect(target) as conn:
        conn.execute(
            "INSERT INTO auth_session(id,token,user_id,expires_at) "
            "SELECT %s,%s,id,clock_timestamp()+interval '8 hours' "
            "FROM auth_user ORDER BY id LIMIT 1",
            (str(uuid.uuid4()), str(uuid.uuid4())),
        )
    existing_columns = user_columns(target)
    before_upgrade = snapshot(target, existing_columns)
    migration_count = len(
        json.loads((ROOT / "db/security-migrations/meta/_journal.json").read_text())[
            "entries"
        ]
    )
    for _ in range(2):
        subprocess.run(
            ["node", "--import", "tsx", "scripts/security-migrate.ts"],
            cwd=ROOT,
            env={**os.environ, "SECURITY_DATABASE_URL": target},
            check=True,
        )
        assert snapshot(target, existing_columns) == before_upgrade, (
            "Migration changed existing rows"
        )
    with psycopg.connect(target) as conn:
        conn.read_only = True
        assert (
            conn.execute(
                "SELECT count(*) FROM drizzle.__drizzle_migrations"
            ).fetchone()[0]
            == migration_count
        )
        for table in ["request_metrics", "answer_receipts", "answer_feedback"]:
            assert (
                conn.execute(
                    sql.SQL("SELECT count(*) FROM {}").format(sql.Identifier(table))
                ).fetchone()[0]
                == 0
            )
        assert (
            conn.execute(
                "SELECT count(*) FROM pg_indexes "
                "WHERE indexname='request_metrics_owner_time_idx'"
            ).fetchone()[0]
            == 1
        )
    marker_path.write_text(json.dumps({"database": name, "owner": str(ROOT)}))
    accounts_path.write_bytes(seed_accounts.read_bytes())
    accounts_path.chmod(0o600)
    receipt = {
        "status": "PASS",
        "database": name,
        "repeat_migration": "idempotent",
        "preserved": before_upgrade,
        "migration_count": migration_count,
    }
    (ROOT / ".local/step8-migration-test.json").write_text(
        json.dumps(receipt, indent=2)
    )
    (ROOT / ".local/security-migration-test.json").write_text(
        json.dumps(receipt, indent=2)
    )
    print(
        "PASS: additive migration twice; all 11 legacy tables, users, "
        "sessions, private files and embeddings unchanged"
    )


if __name__ == "__main__":
    main()
