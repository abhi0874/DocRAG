"""Manage only this checkout's isolated native PostgreSQL development cluster."""

import os
import secrets
import subprocess
import sys
from pathlib import Path
from urllib.parse import quote

from dotenv import set_key

try:
    from .common import ROOT
except ImportError:
    from common import ROOT

BIN = Path("/Applications/Postgres.app/Contents/Versions/16/bin")
STATE = ROOT / ".local"
DATA = STATE / "postgres"
SOCKET = STATE / "socket"
MARKER = STATE / "docrag-development-cluster"
PORT = "55432"


def run(name, *args, env=None, capture=False):
    return subprocess.run(
        [str(BIN / name), *map(str, args)],
        env=env,
        check=True,
        capture_output=capture,
        text=True,
    )


def owned_cluster():
    if not MARKER.exists() or MARKER.read_text().strip() != str(ROOT):
        raise ValueError("Cluster ownership marker missing; refusing to manage it")


def start():
    if not (BIN / "postgres").exists():
        raise ValueError("Install the approved Postgres.app PostgreSQL 16 first")
    STATE.mkdir(mode=0o700, exist_ok=True)
    STATE.chmod(0o700)
    SOCKET.mkdir(mode=0o700, exist_ok=True)
    password_file = STATE / "database-password"
    if not DATA.exists():
        if password_file.exists() or MARKER.exists():
            raise ValueError("Partial setup exists; inspect it before reinitializing")
        password_file.write_text(secrets.token_urlsafe(32))
        password_file.chmod(0o600)
        MARKER.write_text(str(ROOT))
        run(
            "initdb",
            "-D",
            DATA,
            "-U",
            "docrag",
            "--encoding=UTF8",
            "--locale=C",
            "--auth-host=scram-sha-256",
            "--auth-local=trust",
            f"--pwfile={password_file}",
        )
    owned_cluster()
    if not (DATA / "PG_VERSION").exists():
        raise ValueError("Incomplete cluster; manual inspection needed")
    status = subprocess.run(
        [str(BIN / "pg_ctl"), "-D", str(DATA), "status"], capture_output=True
    )
    if status.returncode != 0:
        run(
            "pg_ctl",
            "-D",
            DATA,
            "-l",
            STATE / "postgres.log",
            "-o",
            f"-h 127.0.0.1 -p {PORT} -k {SOCKET}",
            "-w",
            "start",
        )
    env = os.environ.copy()
    env.update(
        {
            "PGHOST": str(SOCKET),
            "PGPORT": PORT,
            "PGUSER": "docrag",
            "PGDATABASE": "postgres",
        }
    )
    found = run(
        "psql",
        "-X",
        "-At",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        "SELECT 1 FROM pg_database WHERE datname = 'docrag_dev'",
        env=env,
        capture=True,
    )
    if found.stdout.strip() != "1":
        run("createdb", "docrag_dev", env=env)
    env["PGDATABASE"] = "docrag_dev"
    run("psql", "-X", "-v", "ON_ERROR_STOP=1", "-f", ROOT / "db/init.sql", env=env)
    # Do not overwrite any existing real database configuration.
    from dotenv import dotenv_values

    env_path = ROOT / ".env"
    current = dotenv_values(env_path).get("DATABASE_URL", "")
    password = password_file.read_text().strip()
    url = f"postgresql://docrag:{quote(password, safe='')}@127.0.0.1:{PORT}/docrag_dev"
    if not current or "DEV_PASSWORD" in current or current == url:
        set_key(env_path, "DATABASE_URL", url)
        env_path.chmod(0o600)
        print("Native development database ready; private DATABASE_URL configured.")
    else:
        raise ValueError(
            "Existing DATABASE_URL preserved; select the local database privately"
        )


def main():
    try:
        action = sys.argv[1] if len(sys.argv) == 2 else ""
        if action == "up":
            start()
        elif action in ("stop", "status"):
            owned_cluster()
            if action == "stop":
                run("pg_ctl", "-D", DATA, "-m", "fast", "-w", "stop")
            else:
                run("pg_ctl", "-D", DATA, "status")
        else:
            raise ValueError("Usage: native_db.py up|stop|status")
        return 0
    except Exception as exc:
        # Never echo subprocess arguments that could contain private settings.
        detail = str(exc) if isinstance(exc, ValueError) else type(exc).__name__
        print(f"Native database action failed: {detail}.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
