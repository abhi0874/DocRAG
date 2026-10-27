"""Step 4 production HTTP smoke, preserving every Step 3 artifact."""

import json
import os
import re
import subprocess
import time
import urllib.request

from eval.chunking_experiments import DIRECTORY, experiment_url
from eval.corpus import ROOT, sha256
from eval.retrieval_experiments import MATRIX


def main():
    selection = json.loads((DIRECTORY / "selection.json").read_text())["selected"]
    retrieval = json.loads(
        (ROOT / "eval/results/retrieval/selection.json").read_text()
    )["selected"]
    if (
        json.loads((ROOT / "lib/retrieval-default.json").read_text())
        != MATRIX[retrieval]
    ):
        raise ValueError(
            "Application retrieval default differs from selected measurement"
        )
    env = os.environ.copy()
    env.update(
        AI_PROVIDER="ollama",
        DOCRAG_CHUNKING_EXPERIMENT=selection,
        OLLAMA_DATABASE_URL=experiment_url(selection),
    )
    env.pop("GOOGLE_GENERATIVE_AI_API_KEY", None)
    port = 8003
    origin = f"http://127.0.0.1:{port}"
    log_path = ROOT / ".local/retrieval-smoke-server.log"
    with log_path.open("w") as log:
        process = subprocess.Popen(
            [
                "node",
                "node_modules/next/dist/bin/next",
                "start",
                "--hostname",
                "127.0.0.1",
                "--port",
                str(port),
            ],
            cwd=ROOT,
            env=env,
            stdout=log,
            stderr=log,
        )
        try:
            documents = None
            for _ in range(30):
                if process.poll() is not None:
                    raise ValueError(
                        "Smoke server failed to start; inspect private server log"
                    )
                try:
                    with urllib.request.urlopen(
                        origin + "/api/documents", timeout=2
                    ) as response:
                        documents = json.load(response)
                    break
                except OSError:
                    time.sleep(1)
            if not documents:
                raise ValueError("Smoke server not ready")
            doc = next(
                d
                for d in documents
                if d["filename"].startswith("postgresql") or "postgresql" in d["title"]
            )
            request = urllib.request.Request(
                origin + "/api/chat",
                method="POST",
                headers={"Content-Type": "application/json"},
                data=json.dumps(
                    {
                        "documentId": doc["id"],
                        "messages": [
                            {
                                "id": "smoke",
                                "role": "user",
                                "parts": [
                                    {
                                        "type": "text",
                                        "text": (
                                            "Which SQL commands begin and "
                                            "commit a transaction?"
                                        ),
                                    }
                                ],
                            }
                        ],
                    }
                ).encode(),
            )
            with urllib.request.urlopen(request, timeout=180) as response:
                if response.status != 200:
                    raise ValueError("Chat route failed")
                body = response.read().decode()
            events = [
                json.loads(line[6:])
                for line in body.splitlines()
                if line.startswith("data: ") and line[6:] != "[DONE]"
            ]
            if any(e.get("type") == "error" for e in events):
                raise ValueError("Chat stream emitted an error")
            answer = "".join(
                e.get("delta", "") for e in events if e.get("type") == "text-delta"
            )
            sources = next(
                e["data"]["sources"] for e in events if e.get("type") == "data-sources"
            )
            if (
                not answer
                or "BEGIN" not in answer.upper()
                or "COMMIT" not in answer.upper()
                or "[" not in answer
            ):
                raise ValueError(
                    "Smoke answer missing expected supported commands/citation"
                )
            mapping = json.loads(
                (DIRECTORY / "heading-1400-280-mapping.json").read_text()
            )
            chunks = {c["chunk_id"]: c for c in mapping["chunks"]}
            if len({s["id"] for s in sources}) != len(sources):
                raise ValueError("Duplicate API sources")
            for source in sources:
                chunk = chunks[source["id"]]
                if (
                    chunk["document_id"] != doc["id"]
                    or chunk["content_sha256"] != sha256(source["content"].encode())
                    or chunk["page_number"] != source["pageNumber"]
                ):
                    raise ValueError("API source provenance mismatch")
            if any(
                not 1 <= int(n) <= len(sources)
                for n in re.findall(r"\[(\d+)\]", answer)
            ):
                raise ValueError("API citation outside source range")
            result = {
                "retrieval_experiment": retrieval,
                "source_provenance": "PASS",
                "status": "PASS",
                "provider": "ollama",
                "experiment": selection,
                "routes": ["GET /api/documents", "POST /api/chat"],
                "answer": answer,
                "source_count": len(sources),
                "document_id": doc["id"],
                "paid_api_charges_inr": 0,
            }
            (ROOT / "eval/results/retrieval-api-smoke.json").write_text(
                json.dumps(result, indent=2) + "\n"
            )
            print(json.dumps(result))
        finally:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()


if __name__ == "__main__":
    main()
