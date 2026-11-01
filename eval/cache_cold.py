"""Measure generation-model cold residency separately from warm/no-cache HTTP."""

import json
import subprocess
import urllib.request

from eval.cache_http import SAMPLE, ask, server, timings
from eval.corpus import ROOT
from eval.retrieval_experiments import save


def resident():
    with urllib.request.urlopen(
        "http://localhost:11434/api/ps", timeout=10
    ) as response:
        data = json.load(response)
    return [
        {k: m.get(k) for k in ("name", "digest", "size", "size_vram")}
        for m in data.get("models", [])
    ]


def main():
    path = ROOT / "eval/results/prompting/cache-cold-warm.json"
    if path.exists():
        raise ValueError("Preserve cold/warm measurements")
    model = json.loads((ROOT / "lib/local-model-config.json").read_text())["chat"]
    records = {
        r["id"]: r
        for r in map(
            json.loads, (ROOT / "eval/golden_set.jsonl").read_text().splitlines()
        )
    }
    rows = []
    with server(False):
        for qid in SAMPLE:
            subprocess.run(
                [str(ROOT / ".local/ollama-runtime-0.40.9/ollama"), "stop", model],
                cwd=ROOT,
                check=True,
                capture_output=True,
            )
            before = resident()
            assert not any(m["name"] == model for m in before)
            cold = ask(records[qid])
            after = resident()
            warm = ask(records[qid])
            assert cold["cache"] == warm["cache"] == "BYPASS"
            rows += [
                {
                    **cold,
                    "condition": "model-cold",
                    "resident_before": before,
                    "resident_after": after,
                },
                {**warm, "condition": "model-warm"},
            ]
            print(
                qid,
                round(cold["latency_ms"], 2),
                round(warm["latency_ms"], 2),
                flush=True,
            )
    save(
        path,
        {
            "status": "PASS",
            "rows": rows,
            "timing": {
                c: timings([r for r in rows if r["condition"] == c])
                for c in ("model-cold", "model-warm")
            },
            "conditions": (
                "Six public questions, model unloaded before each cold call; "
                "paired warm call follows immediately. Production response "
                "cache off throughout. OS page cache is not flushed. Resident "
                "sizes are Ollama snapshots, not total-system peak memory."
            ),
            "paid_api_charges_inr": 0,
        },
    )


if __name__ == "__main__":
    main()
