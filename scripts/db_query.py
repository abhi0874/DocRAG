"""Run one SELECT inside a bounded read-only PostgreSQL transaction."""

import sys

import psycopg
import sqlparse

try:
    from .common import database_url, load_environment, redact
except ImportError:
    from common import database_url, load_environment, redact


def validate_select(query):
    statements = sqlparse.parse(query)
    if len(statements) != 1 or statements[0].get_type() != "SELECT":
        raise ValueError("Exactly one SELECT statement is required")
    # The database read-only transaction also rejects writes hidden in CTEs/functions.
    forbidden = {
        "INTO",
        "INSERT",
        "UPDATE",
        "DELETE",
        "CREATE",
        "DROP",
        "ALTER",
        "COPY",
    }
    if any(t.value.upper() in forbidden for t in statements[0].flatten()):
        raise ValueError("Write operations are not allowed")


def run_query(query):
    validate_select(query)
    with psycopg.connect(database_url(), connect_timeout=5) as conn:
        conn.read_only = True
        with conn.cursor() as cur:
            cur.execute("SET LOCAL statement_timeout = '5s'")
            cur.execute(query)
            return cur.fetchmany(1000)


def main():
    load_environment()
    if len(sys.argv) != 2:
        print('Usage: python scripts/db_query.py "SELECT ..."', file=sys.stderr)
        return 1
    try:
        rows = run_query(sys.argv[1])
        for row in rows:
            print("\t".join(redact(v) for v in row))
        return 0
    except Exception as exc:
        # Database exceptions may contain connection credentials or query values.
        print(f"Database query failed ({type(exc).__name__}).", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
