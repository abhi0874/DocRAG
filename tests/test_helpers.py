from unittest.mock import MagicMock, patch

import pytest

from scripts.common import database_url, redact, required
from scripts.db_query import run_query, validate_select


@pytest.mark.parametrize(
    "query",
    [
        "DELETE FROM chunks",
        "SELECT 1; DROP TABLE documents",
        "SELECT 1 INTO new_table",
        "WITH removed AS (DELETE FROM chunks RETURNING *) SELECT * FROM removed",
        "",
    ],
)
def test_reject_writes_and_multiple_statements(query):
    with pytest.raises(ValueError):
        validate_select(query)


@pytest.mark.parametrize("query", ["SELECT 1", "-- comment\nSELECT 'DELETE'"])
def test_allow_select(query):
    validate_select(query)


def test_transaction_is_read_only(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://localhost/docrag_dev")
    connection = MagicMock()
    cursor = connection.cursor.return_value.__enter__.return_value
    cursor.fetchmany.return_value = [(1,)]
    with patch("scripts.db_query.psycopg.connect") as connect:
        connect.return_value.__enter__.return_value = connection
        assert run_query("SELECT 1") == [(1,)]
    assert connection.read_only is True
    assert cursor.execute.call_args_list[0].args == (
        "SET LOCAL statement_timeout = '5s'",
    )


def test_query_validation_precedes_connection():
    with patch("scripts.db_query.psycopg.connect") as connect:
        with pytest.raises(ValueError):
            run_query("DROP TABLE documents")
        connect.assert_not_called()


def test_production_url_is_refused(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://localhost/prod")
    monkeypatch.setenv("DATABASE_URL_PROD", "postgresql://localhost/prod")
    with pytest.raises(ValueError):
        database_url()


def test_placeholder_is_not_a_credential(monkeypatch):
    monkeypatch.setenv("GOOGLE_GENERATIVE_AI_API_KEY", "replace-with-your-private-key")
    with pytest.raises(ValueError):
        required("GOOGLE_GENERATIVE_AI_API_KEY")


def test_secrets_are_redacted(monkeypatch):
    monkeypatch.setenv("GOOGLE_GENERATIVE_AI_API_KEY", "fake-test-key")
    assert redact("response: fake-test-key") == "response: [REDACTED]"


def test_native_database_refuses_unowned_cluster(tmp_path, monkeypatch):
    from scripts import native_db

    monkeypatch.setattr(native_db, "MARKER", tmp_path / "missing")
    with pytest.raises(ValueError):
        native_db.owned_cluster()


def test_native_database_checks_checkout_ownership(tmp_path, monkeypatch):
    from scripts import native_db

    marker = tmp_path / "marker"
    marker.write_text("/some/other/repository")
    monkeypatch.setattr(native_db, "MARKER", marker)
    with pytest.raises(ValueError):
        native_db.owned_cluster()
    marker.write_text(str(native_db.ROOT))
    native_db.owned_cluster()
