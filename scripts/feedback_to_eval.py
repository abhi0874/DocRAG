"""Export only hash-verified public feedback into separate review candidates."""

import argparse
import hashlib
import os
import subprocess
import uuid
from pathlib import Path
from urllib.parse import urlsplit

import psycopg

from eval.corpus import ROOT
from scripts.native_db import DATA, owned_cluster, postgres_port
from scripts.security_http import configuration


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    owned_cluster()
    target, _ = configuration()
    parsed = urlsplit(target)
    assert parsed.hostname == "127.0.0.1" and parsed.port == int(postgres_port())
    with psycopg.connect(target) as conn:
        conn.read_only = True
        assert os.path.realpath(
            conn.execute("SHOW data_directory").fetchone()[0]
        ) == str(DATA.resolve())
    root = (ROOT / ".local/feedback-review").resolve()
    root.mkdir(mode=0o700, exist_ok=True)
    output = (args.out or root / f"candidates-{uuid.uuid4().hex}.jsonl").resolve()
    if output.parent != root or output.suffix != ".jsonl" or output.exists():
        raise ValueError("Use a new .jsonl file directly inside .local/feedback-review")
    golden = ROOT / "eval/golden_set.jsonl"
    before = hashlib.sha256(golden.read_bytes()).hexdigest()
    subprocess.run(
        ["node", "--import", "tsx", "scripts/feedback-export.ts", str(output)],
        cwd=ROOT,
        env={**os.environ, "SECURITY_DATABASE_URL": target},
        check=True,
    )
    assert hashlib.sha256(golden.read_bytes()).hexdigest() == before
    print("Review candidates:", output.relative_to(ROOT))


if __name__ == "__main__":
    main()
