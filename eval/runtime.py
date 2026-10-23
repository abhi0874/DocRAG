"""Safe bridge to the actual TypeScript implementation."""

import json
import os
import subprocess

from eval.corpus import ROOT, evaluation_url


def call_adapter(payload):
    env = os.environ.copy()
    local = payload.get("config", {}).get("provider") == "ollama"
    env["AI_PROVIDER"] = "ollama" if local else "gemini"
    if local:
        from eval.local_corpus import local_url

        env["OLLAMA_DATABASE_URL"] = local_url()
        env.pop("GOOGLE_GENERATIVE_AI_API_KEY", None)
    else:
        env["DATABASE_URL"] = evaluation_url()
    result = subprocess.run(
        [
            "node",
            "--import",
            "tsx",
            "eval/local_adapter.ts" if local else "eval/runtime_adapter.ts",
        ],
        cwd=ROOT,
        input=json.dumps(payload),
        env=env,
        capture_output=True,
        text=True,
        timeout=240,
    )
    if result.returncode:
        safe = [
            line
            for line in result.stderr.splitlines()
            if line.startswith("Evaluation adapter failed:")
        ]
        raise RuntimeError(safe[-1] if safe else "Evaluation adapter failed")
    return json.loads(result.stdout)
