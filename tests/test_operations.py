"""Failure boundaries for operator tools; all external effects are test doubles."""

import json
import subprocess
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from scripts import (
    check_env,
    create_account,
    db_query,
    ingest_corpus,
    native_db,
    security_invalidation,
    snapshot_corpus,
)


def test_snapshot_excludes_navigation_scripts_and_second_article():
    parser = snapshot_corpus.ArticleText("fastapi")
    parser.feed(
        "<nav>ignore</nav><article><h1>Title</h1><p>A &amp; B</p>"
        "<script>secret</script><pre> x = 1 </pre></article>"
        "<article>second</article>"
    )
    assert parser.text() == "Title\nA & B\nx = 1\n"
    pg = snapshot_corpus.ArticleText("postgresql")
    pg.feed('<div class="sect1"><p>BEGIN<br>COMMIT</p></div><footer>ignore</footer>')
    assert pg.text() == "BEGIN\nCOMMIT\n"


def test_existing_snapshot_never_downloads(monkeypatch, tmp_path):
    monkeypatch.setattr(snapshot_corpus, "CORPUS", tmp_path)
    (tmp_path / "manifest.json").write_text("preserved")
    fetch = MagicMock()
    monkeypatch.setattr(snapshot_corpus, "fetch", fetch)
    with pytest.raises(ValueError, match="already exists"):
        snapshot_corpus.main()
    fetch.assert_not_called()
    assert (tmp_path / "manifest.json").read_text() == "preserved"


@pytest.mark.parametrize("failure", ["vector", "table", "dimension", "index", None])
def test_database_preflight_detects_incompatible_schema(monkeypatch, failure):
    connection = MagicMock()
    cursor = connection.cursor.return_value.__enter__.return_value
    cursor.fetchone.side_effect = [
        None if failure == "vector" else ("vector",),
        (None,) if failure == "table" else ("documents",),
        ("chunks",),
        ("evaluations",),
        ("vector(3)",) if failure == "dimension" else ("vector(1536)",),
    ]
    cursor.fetchall.return_value = [
        (
            "using gin (content_tsv) vector_cosine_ops "
            + ("" if failure == "index" else "(document_id)"),
        )
    ]
    connect = MagicMock()
    connect.return_value.__enter__.return_value = connection
    monkeypatch.setattr(check_env.psycopg, "connect", connect)
    if failure:
        with pytest.raises(ValueError):
            check_env.check_database("synthetic")
    else:
        check_env.check_database("synthetic")
    assert connection.read_only is True
    assert cursor.execute.call_args_list[0].args == (
        "SET LOCAL statement_timeout = '5s'",
    )


def test_query_cli_sanitizes_database_errors(monkeypatch, capsys):
    monkeypatch.setattr(db_query, "load_environment", lambda: None)
    monkeypatch.setattr(db_query.sys, "argv", ["db_query", "SELECT 1"])
    monkeypatch.setattr(
        db_query, "run_query", MagicMock(side_effect=RuntimeError("private"))
    )
    assert db_query.main() == 1
    assert "private" not in capsys.readouterr().err
    monkeypatch.setattr(db_query, "run_query", lambda _: [(1, "hello")])
    assert db_query.main() == 0
    assert capsys.readouterr().out == "1\thello\n"
    monkeypatch.setattr(db_query.sys, "argv", ["db_query"])
    assert db_query.main() == 1


def test_account_creation_uses_stdin_and_propagates_failure(monkeypatch):
    monkeypatch.setattr(create_account, "load_environment", lambda: None)
    inputs = iter([" Test ", " a@example.test "])
    monkeypatch.setattr("builtins.input", lambda _: next(inputs))
    monkeypatch.setattr(
        create_account.getpass, "getpass", lambda _: "test-only-password"
    )
    run = MagicMock(return_value=SimpleNamespace(returncode=7))
    monkeypatch.setattr(create_account.subprocess, "run", run)
    with pytest.raises(SystemExit) as error:
        create_account.main()
    assert error.value.code == 7
    call = run.call_args
    assert "test-only-password" not in " ".join(call.args[0])
    assert json.loads(call.kwargs["input"])["email"] == "a@example.test"


def test_account_password_mismatch_has_no_external_effect(monkeypatch):
    monkeypatch.setattr(create_account, "load_environment", lambda: None)
    monkeypatch.setattr("builtins.input", lambda _: "test")
    passwords = iter(["one", "two"])
    monkeypatch.setattr(create_account.getpass, "getpass", lambda _: next(passwords))
    run = MagicMock()
    monkeypatch.setattr(create_account.subprocess, "run", run)
    with pytest.raises(ValueError, match="Passwords differ"):
        create_account.main()
    run.assert_not_called()


def test_ingestion_adapter_error_cannot_echo_credentials(monkeypatch):
    monkeypatch.setattr(ingest_corpus, "evaluation_url", lambda: "synthetic")
    run = MagicMock(return_value=SimpleNamespace(returncode=1, stderr="private-secret"))
    monkeypatch.setattr(ingest_corpus.subprocess, "run", run)
    with pytest.raises(ValueError, match="^TypeScript ingestion adapter failed$"):
        ingest_corpus.adapter({"action": "chunk"})
    run.return_value = SimpleNamespace(returncode=0, stdout='[{"content":"safe"}]')
    assert ingest_corpus.adapter({"action": "chunk"}) == [{"content": "safe"}]
    run.return_value = SimpleNamespace(
        returncode=1, stderr="Ingestion adapter failed; HTTP status: 429"
    )
    with pytest.raises(ValueError, match="HTTP status: 429"):
        ingest_corpus.adapter({"action": "chunk"})


def test_invalidation_requires_recovered_matching_fixture(monkeypatch, tmp_path):
    monkeypatch.setattr(security_invalidation, "ROOT", tmp_path)
    folder = tmp_path / ".local"
    folder.mkdir()
    receipt = folder / "step6-invalidation-step5-v1-backup.json"
    receipt.write_text(json.dumps({"restored": False}))
    run = MagicMock()
    monkeypatch.setattr(security_invalidation, "main", run)
    with pytest.raises(ValueError, match="requires recovery"):
        security_invalidation.run()
    run.assert_not_called()
    receipt.write_text(
        json.dumps({"restored": True, "id": 1, "content_sha256": "wrong"})
    )
    connect = MagicMock()
    conn = connect.return_value.__enter__.return_value
    conn.execute.return_value.fetchone.return_value = ("original",)
    monkeypatch.setattr(security_invalidation, "connect_experiment", connect)
    with pytest.raises(AssertionError):
        security_invalidation.run()
    assert receipt.exists()
    run.assert_not_called()
    data = json.loads(receipt.read_text())
    data["content_sha256"] = security_invalidation.hashlib.sha256(
        b"original"
    ).hexdigest()
    receipt.write_text(json.dumps(data))
    security_invalidation.run()
    run.assert_called_once()
    assert not receipt.exists()
    assert len(list(folder.glob("security-restored-*.json"))) == 1


def test_native_setup_preserves_existing_foreign_configuration(monkeypatch, tmp_path):
    state = tmp_path / ".local"
    state.mkdir()
    data = state / "postgres"
    data.mkdir()
    (data / "PG_VERSION").write_text("16")
    (state / "database-password").write_text("fixture")
    marker = state / "docrag-development-cluster"
    marker.write_text(str(tmp_path))
    binary = tmp_path / "bin"
    binary.mkdir()
    (binary / "postgres").touch()
    (tmp_path / ".env").write_text("DATABASE_URL=postgresql://foreign/database\n")
    for key, value in {
        "ROOT": tmp_path,
        "STATE": state,
        "DATA": data,
        "SOCKET": state / "socket",
        "MARKER": marker,
        "BIN": binary,
    }.items():
        monkeypatch.setattr(native_db, key, value)
    monkeypatch.setattr(
        native_db.subprocess,
        "run",
        MagicMock(return_value=SimpleNamespace(returncode=0)),
    )
    run = MagicMock(return_value=SimpleNamespace(stdout="1"))
    monkeypatch.setattr(native_db, "run", run)
    with pytest.raises(ValueError, match="Existing DATABASE_URL preserved"):
        native_db.start()
    assert "foreign/database" in (tmp_path / ".env").read_text()
    assert not any(
        c.args[0] in {"initdb", "createdb", "pg_ctl"} for c in run.call_args_list
    )


def test_native_setup_refuses_partial_state(monkeypatch, tmp_path):
    binary = tmp_path / "bin"
    binary.mkdir()
    (binary / "postgres").touch()
    state = tmp_path / "state"
    state.mkdir()
    (state / "database-password").write_text("existing")
    monkeypatch.setattr(native_db, "BIN", binary)
    monkeypatch.setattr(native_db, "STATE", state)
    monkeypatch.setattr(native_db, "DATA", state / "postgres")
    monkeypatch.setattr(native_db, "SOCKET", state / "socket")
    run = MagicMock()
    monkeypatch.setattr(native_db, "run", run)
    with pytest.raises(ValueError, match="Partial setup"):
        native_db.start()
    run.assert_not_called()


def test_native_command_fails_closed_without_private_arguments(monkeypatch, capsys):
    monkeypatch.setattr(native_db.sys, "argv", ["native_db", "stop"])
    monkeypatch.setattr(native_db, "owned_cluster", lambda: None)
    monkeypatch.setattr(
        native_db,
        "run",
        MagicMock(side_effect=subprocess.CalledProcessError(2, "private")),
    )
    assert native_db.main() == 1
    assert "private" not in capsys.readouterr().err
