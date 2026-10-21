"""Run the existing read-only query helper against the owned evaluation database."""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from eval.corpus import connect_evaluation, evaluation_url  # noqa: E402
from scripts.common import ROOT  # noqa: E402
from scripts.db_query import main  # noqa: E402

if __name__ == "__main__":
    try:
        url = evaluation_url()
        with connect_evaluation() as conn:
            conn.read_only = True
            if conn.execute("SELECT owner FROM eval_corpus").fetchone() != (str(ROOT),):
                raise ValueError("Evaluation database owner mismatch")
        os.environ["DATABASE_URL"] = url
        sys.exit(main())
    except Exception as exc:
        print(f"Evaluation query failed ({type(exc).__name__}).", file=sys.stderr)
        sys.exit(1)
