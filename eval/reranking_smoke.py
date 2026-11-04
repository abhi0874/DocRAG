"""Real production HTTP checks; no Gemini calls or model-file mutations."""

import argparse
import json
import os
import re
import subprocess
import time
import urllib.request

from eval.chunking_experiments import experiment_url
from eval.corpus import ROOT, sha256
from eval.retrieval_experiments import save


def workers():
    lines = subprocess.check_output(["ps", "-axo", "pid,command"], text=True)
    return {
        int(line.strip().split()[0])
        for line in lines.splitlines()
        if "-m scripts.reranker_worker" in line
    }


def run_mode(mode):
    env = os.environ.copy()
    env.update(
        AI_PROVIDER="ollama",
        DOCRAG_APP_ORIGIN="http://127.0.0.1:8003",
        DOCRAG_LOCAL_HTTP="true",
        DOCRAG_CHUNKING_EXPERIMENT="heading-1400-280",
        OLLAMA_DATABASE_URL=experiment_url("heading-1400-280"),
        RERANKER_ENABLED="false" if mode == "disabled" else "true",
        RERANKER_CANDIDATES="10",
        RERANKER_DEVICE="cpu",
        RERANKER_TIMEOUT_MS="100" if mode == "timeout" else "15000",
        DOCRAG_RERANKER_HOME=str(ROOT / ".local/reranker-minilm"),
    )
    if mode == "missing":
        env.pop("DOCRAG_RERANKER_HOME")
    env.pop("GOOGLE_GENERATIVE_AI_API_KEY", None)
    origin = "http://127.0.0.1:8003"
    before = workers()
    result = {}
    with (ROOT / f".local/reranking-smoke-{mode}.log").open("w") as log:
        process = subprocess.Popen(
            [
                "node",
                "node_modules/next/dist/bin/next",
                "start",
                "--hostname",
                "127.0.0.1",
                "--port",
                "8003",
            ],
            cwd=ROOT,
            env=env,
            stdout=log,
            stderr=log,
        )
        try:
            for _ in range(30):
                if process.poll() is not None:
                    raise ValueError("Production smoke server exited")
                try:
                    with urllib.request.urlopen(origin, timeout=2) as response:
                        assert response.status == 200
                    break
                except OSError:
                    time.sleep(1)
            else:
                raise ValueError("Production home page unavailable")
            with urllib.request.urlopen(
                origin + "/api/documents", timeout=5
            ) as response:
                documents = json.load(response)
            doc = next(
                d
                for d in documents
                if "postgresql" in d["title"].lower()
                or "postgresql" in d["filename"].lower()
            )
            question = "Which SQL commands begin and commit a transaction?"
            request = urllib.request.Request(
                origin + "/api/chat",
                method="POST",
                headers={"Content-Type": "application/json", "Origin": origin},
                data=json.dumps(
                    {
                        "documentId": doc["id"],
                        "messages": [
                            {
                                "id": "smoke",
                                "role": "user",
                                "parts": [{"type": "text", "text": question}],
                            }
                        ],
                    }
                ).encode(),
            )
            with urllib.request.urlopen(request, timeout=180) as response:
                status = response.headers["X-DocRAG-Reranker-Status"]
                reason = response.headers.get("X-DocRAG-Reranker-Reason")
                body = response.read().decode()
            events = [
                json.loads(line[6:])
                for line in body.splitlines()
                if line.startswith("data: ") and line[6:] != "[DONE]"
            ]
            assert not any(e.get("type") == "error" for e in events)
            answer = "".join(
                e.get("delta", "") for e in events if e.get("type") == "text-delta"
            )
            sources = next(
                e["data"]["sources"] for e in events if e.get("type") == "data-sources"
            )
            expected = {
                "enabled": "reranked",
                "disabled": "disabled",
                "missing": "fallback",
                "timeout": "fallback",
            }[mode]
            assert status == expected, (mode, status, reason)
            if mode in ("missing", "timeout"):
                assert reason == ("model_missing" if mode == "missing" else "timeout")
            assert "BEGIN" in answer.upper() and "COMMIT" in answer.upper()
            citations = re.findall(r"\[(\d+)\]", answer)
            assert citations and all(1 <= int(n) <= len(sources) for n in citations)
            mapping = json.loads(
                (
                    ROOT / "eval/results/chunking/heading-1400-280-mapping.json"
                ).read_text()
            )
            chunks = {c["chunk_id"]: c for c in mapping["chunks"]}
            assert len(set(c["id"] for c in sources)) == len(sources)
            for source in sources:
                chunk = chunks[source["id"]]
                assert chunk["document_id"] == doc["id"]
                assert chunk["content_sha256"] == sha256(source["content"].encode())
                assert chunk["page_number"] == source["pageNumber"]
            if mode == "enabled":
                assert all("rerankerScore" in s for s in sources)
                assert [s["rerankerScore"] for s in sources] == sorted(
                    [s["rerankerScore"] for s in sources], reverse=True
                )
            else:
                assert all("rerankerScore" not in s for s in sources)
            result = {
                "mode": mode,
                "status": "PASS",
                "reranker_status": status,
                "fallback_reason": reason,
                "source_ids": [s["id"] for s in sources],
                "answer": answer,
                "source_provenance": "PASS",
            }
        finally:
            owned_workers = workers() - before
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
            for _ in range(30):
                if not (workers() & owned_workers):
                    break
                time.sleep(0.1)
            if workers() & owned_workers:
                raise ValueError("Managed worker remained after server shutdown")
    return {**result, "worker_shutdown": "PASS"}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="eval/results/reranking-final/api-smoke.json")
    args = parser.parse_args()
    rows = [run_mode(mode) for mode in ("disabled", "enabled", "missing", "timeout")]
    baseline = rows[0]["source_ids"]
    assert all(r["source_ids"] == baseline for r in rows if r["mode"] != "enabled")
    result = {"status": "PASS", "rows": rows, "paid_api_charges_inr": 0}
    save(ROOT / args.out, result)
    print(json.dumps(result), flush=True)


if __name__ == "__main__":
    main()
