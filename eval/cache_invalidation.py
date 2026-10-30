"""Reversible public-fixture content update; original row restored in finally."""

import json
import subprocess

from eval.cache_http import ask, server
from eval.chunking_experiments import connect_experiment
from eval.corpus import ROOT, sha256
from eval.retrieval_experiments import save


def main():
    output = ROOT / "eval/results/prompting/cache-invalidation.json"
    if output.exists():
        raise ValueError("Preserve cache invalidation receipt")
    record = json.loads((ROOT / "eval/golden_set.jsonl").read_text().splitlines()[0])
    with connect_experiment("heading-1400-280") as conn:
        original = conn.execute(
            "SELECT id, content FROM chunks WHERE document_id=3 ORDER BY id LIMIT 1"
        ).fetchone()
    backup = ROOT / ".local/step6-invalidation-backup.json"
    if backup.exists():
        raise ValueError("An earlier fixture backup requires inspection before testing")
    backup.write_text(
        json.dumps({"id": original[0], "content": original[1], "restored": False})
    )
    changed = False
    result = {}
    try:
        with server(True):
            first = ask(record)
            hit = ask(record)
            assert first["cache"] == "MISS" and hit["cache"] == "HIT"
            with connect_experiment("heading-1400-280") as conn:
                conn.execute(
                    "UPDATE chunks SET content=%s WHERE id=%s",
                    (
                        original[1] + "\nPublic test fixture: content version changed.",
                        original[0],
                    ),
                )
                conn.commit()
                changed = True
            replaced = ask(record)
            assert replaced["cache"] == "BYPASS", (
                "Changed document served a cached answer"
            )
            result = {"before": first, "repeat": hit, "after_content_update": replaced}
    finally:
        if changed:
            with connect_experiment("heading-1400-280") as conn:
                conn.execute(
                    "UPDATE chunks SET content=%s WHERE id=%s",
                    (original[1], original[0]),
                )
                conn.commit()
        with connect_experiment("heading-1400-280") as conn:
            restored = conn.execute(
                "SELECT content FROM chunks WHERE id=%s", (original[0],)
            ).fetchone()
        assert restored and restored[0] == original[1], (
            "Public fixture restoration failed"
        )
        backup.write_text(
            json.dumps(
                {
                    "id": original[0],
                    "content_sha256": sha256(original[1].encode()),
                    "restored": True,
                }
            )
        )
    save(
        output,
        {
            "status": "PASS",
            **result,
            "original_content_restored": True,
            "interpretation": (
                "Changed content is no longer allowlisted, so caching is "
                "bypassed; no stale HIT. No original row was deleted."
            ),
            "git_revision": subprocess.check_output(
                ["git", "rev-parse", "HEAD"], text=True
            ).strip(),
        },
    )


if __name__ == "__main__":
    main()
