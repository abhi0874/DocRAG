"""Real production cache measurements on allowlisted public questions only."""

import argparse
import json
import os
import subprocess
import time
import urllib.request
from contextlib import contextmanager

from eval.chunking_experiments import experiment_url
from eval.corpus import ROOT
from eval.metrics import percentile
from eval.retrieval_experiments import save

ORIGIN = "http://127.0.0.1:8004"
SAMPLE = [
    "fastapi-001",
    "fastapi-006",
    "fastapi-041",
    "postgresql-001",
    "postgresql-005",
    "postgresql-041",
]


@contextmanager
def server(enabled, version="grounded-v1"):
    env = os.environ.copy()
    env.update(
        AI_PROVIDER="ollama",
        DOCRAG_CHUNKING_EXPERIMENT="heading-1400-280",
        OLLAMA_DATABASE_URL=experiment_url("heading-1400-280"),
        RERANKER_ENABLED="false",
        RESPONSE_CACHE_ENABLED="true" if enabled else "false",
        RAG_PROMPT_VERSION=version,
    )
    env.pop("GOOGLE_GENERATIVE_AI_API_KEY", None)
    with (ROOT / ".local/step6-cache-api.log").open("a") as log:
        p = subprocess.Popen(
            [
                "node",
                "node_modules/next/dist/bin/next",
                "start",
                "--hostname",
                "127.0.0.1",
                "--port",
                "8004",
            ],
            cwd=ROOT,
            env=env,
            stdout=log,
            stderr=log,
        )
        try:
            for _ in range(30):
                if p.poll() is not None:
                    raise ValueError("Production cache server exited")
                try:
                    with urllib.request.urlopen(ORIGIN, timeout=2) as response:
                        assert response.status == 200
                    break
                except OSError:
                    time.sleep(1)
            else:
                raise ValueError("Production cache server unavailable")
            yield
        finally:
            p.terminate()
            try:
                p.wait(timeout=10)
            except subprocess.TimeoutExpired:
                p.kill()
                p.wait()


def ask(record, question=None):
    payload = {
        "documentId": 3 if record["document_key"] == "fastapi" else 4,
        "messages": [
            {
                "id": "public-benchmark",
                "role": "user",
                "parts": [{"type": "text", "text": question or record["question"]}],
            }
        ],
    }
    started = time.perf_counter()
    request = urllib.request.Request(
        ORIGIN + "/api/chat",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=180) as response:
        status = response.headers["X-DocRAG-Cache"]
        prompt = response.headers["X-DocRAG-Prompt"]
        body = response.read().decode()
    events = [
        json.loads(line[6:])
        for line in body.splitlines()
        if line.startswith("data: ") and line[6:] != "[DONE]"
    ]
    assert not any(e["type"] == "error" for e in events), "Chat stream failed"
    assert any(e["type"] == "finish" for e in events), "Stream did not finish"
    answer = "".join(e["delta"] for e in events if e["type"] == "text-delta")
    sources = next(e["data"]["sources"] for e in events if e["type"] == "data-sources")
    cache = next(e["data"] for e in events if e["type"] == "data-cache")
    validation = next(e["data"] for e in events if e["type"] == "data-validation")
    assert all(s["documentId"] == payload["documentId"] and s["title"] for s in sources)
    return {
        "id": record["id"],
        "cache": status,
        "prompt": prompt,
        "latency_ms": (time.perf_counter() - started) * 1000,
        "answer": answer,
        "source_ids": [s["id"] for s in sources],
        "validation": validation,
        "tokens_avoided": cache["tokensAvoided"],
    }


def timings(rows):
    return {
        "n": len(rows),
        "p50_ms": percentile([r["latency_ms"] for r in rows], 0.5),
        "p95_ms": percentile([r["latency_ms"] for r in rows], 0.95),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="eval/results/prompting/cache-http.json")
    parser.add_argument("--smoke", action="store_true")
    args = parser.parse_args()
    output = ROOT / args.out
    if output.exists():
        raise ValueError("Preserve completed cache measurement")
    records = {
        r["id"]: r
        for r in map(
            json.loads, (ROOT / "eval/golden_set.jsonl").read_text().splitlines()
        )
    }
    sample = [records[q] for q in (SAMPLE[:1] if args.smoke else SAMPLE)]
    rows = []
    with server(True):
        for condition in ("first-miss", "repeat-hit", "repeat-hit-2"):
            for record in sample:
                row = {**ask(record), "condition": condition}
                expected = "MISS" if condition == "first-miss" else "HIT"
                assert row["cache"] == expected, (
                    record["id"],
                    condition,
                    row["cache"],
                    row["validation"],
                )
                if expected == "HIT":
                    first = next(r for r in rows if r["id"] == record["id"])
                    assert (row["answer"], row["source_ids"]) == (
                        first["answer"],
                        first["source_ids"],
                    )
                rows.append(row)
                print(
                    record["id"],
                    condition,
                    row["cache"],
                    round(row["latency_ms"], 2),
                    flush=True,
                )
        bypass = ask(
            sample[0], "What can these excerpts establish about an unspecified secret?"
        )
        assert bypass["cache"] == "BYPASS"
    if not args.smoke:
        with server(False):
            for condition in ("uncached-first", "uncached-warm"):
                for record in sample:
                    row = {**ask(record), "condition": condition}
                    assert row["cache"] == "BYPASS"
                    rows.append(row)
                    print(
                        record["id"], condition, round(row["latency_ms"], 2), flush=True
                    )
        with server(True, "step5-v1"):
            changed_prompt = ask(sample[0])
            assert (
                changed_prompt["cache"] == "MISS"
                and changed_prompt["prompt"] == "step5-v1"
            )
    else:
        changed_prompt = None
    hits = [r for r in rows if r["cache"] == "HIT"]
    misses = [r for r in rows if r["cache"] == "MISS"]
    save(
        output,
        {
            "status": "PASS",
            "rows": rows,
            "arbitrary_question": bypass,
            "changed_prompt": changed_prompt,
            "hits": len(hits),
            "misses": len(misses),
            "eligible_hit_rate": len(hits) / (len(hits) + len(misses)),
            "model_generations_avoided": len(hits),
            "tokens_avoided": sum(r["tokens_avoided"] for r in hits),
            "timing": {
                c: timings([r for r in rows if r["condition"] == c])
                for c in sorted({r["condition"] for r in rows})
            },
            "conditions": (
                "Sequential matched public questions. First-miss means empty "
                "application cache, not cold OS/GPU. Uncached-first starts a new "
                "Node process; model may already be warm. Includes fresh query "
                "embeddings, SQL and HTTP transfer. Prompt-version server restart "
                "also clears memory; separate unit tests isolate key invalidation."
            ),
            "paid_api_charges_inr": 0,
        },
    )


if __name__ == "__main__":
    main()
