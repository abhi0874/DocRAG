"""Exercise package entrypoints without starting or stopping any database."""

import os
import subprocess
import sys

import pytest

from scripts.common import ROOT


@pytest.mark.parametrize(
    "target,action",
    [("up", "up"), ("down", "stop"), ("stop", "stop"), ("db-status", "status")],
)
def test_make_uses_module(target, action):
    result = subprocess.run(
        ["make", "-n", target], cwd=ROOT, capture_output=True, text=True, check=True
    )
    assert result.stdout.strip() == f".venv/bin/python -m scripts.native_db {action}"


def test_real_module_import_and_exit():
    result = subprocess.run(
        [sys.executable, "-m", "scripts.native_db", "invalid"],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 1
    assert "Usage:" in result.stderr
    assert "ModuleNotFoundError" not in result.stderr


def test_invalid_port_fails_before_database_access():
    result = subprocess.run(
        [sys.executable, "-m", "scripts.native_db", "status"],
        cwd=ROOT,
        env={**os.environ, "DOCRAG_POSTGRES_PORT": "invalid-private-sentinel"},
        capture_output=True,
        text=True,
    )
    assert result.returncode != 0
    assert "Invalid DocRAG PostgreSQL port" in result.stderr
    assert "invalid-private-sentinel" not in result.stdout + result.stderr


def test_status_failure_propagates_without_private_arguments(monkeypatch, capsys):
    from scripts import native_db

    monkeypatch.setattr(sys, "argv", ["native_db", "status"])
    monkeypatch.setattr(native_db, "owned_cluster", lambda: None)

    def unavailable(*args):
        raise subprocess.CalledProcessError(3, ["private-sentinel"])

    monkeypatch.setattr(native_db, "run", unavailable)
    assert native_db.main() == 1
    output = capsys.readouterr()
    assert "CalledProcessError" in output.err
    assert "private-sentinel" not in output.err
