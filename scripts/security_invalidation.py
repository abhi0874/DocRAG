"""Rerun the reversible public-cache probe without discarding old receipts."""

import hashlib
import json
import time

from eval.cache_invalidation import main
from eval.chunking_experiments import connect_experiment
from eval.corpus import ROOT


def run():
    receipt = ROOT / ".local/step6-invalidation-step5-v1-backup.json"
    if receipt.exists():
        old = json.loads(receipt.read_text())
        if old.get("restored") is not True:
            raise ValueError("Previous public fixture requires recovery")
        with connect_experiment("heading-1400-280") as conn:
            conn.read_only = True
            row = conn.execute(
                "SELECT content FROM chunks WHERE id=%s", (old["id"],)
            ).fetchone()
        assert hashlib.sha256(row[0].encode()).hexdigest() == old["content_sha256"]
        receipt.rename(receipt.with_name(f"security-restored-{time.time_ns()}.json"))
    main()


if __name__ == "__main__":
    run()
