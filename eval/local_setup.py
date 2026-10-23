"""Reproducible local-only hardware/model/index checks."""

import argparse
import json
import subprocess
from datetime import datetime, timezone

from eval.corpus import ROOT, load_corpus, sha256
from eval.local_corpus import prepare, snapshot_original
from eval.run_eval import configuration
from eval.runtime import call_adapter
from eval.validate_dataset import validate


def main(ingest=False):
    config = configuration("ollama")
    config["corpus_hash"] = load_corpus()["corpus_hash"]
    metadata = call_adapter({"action": "metadata", "config": config})
    if metadata["settings"] != config["local_settings"]:
        raise ValueError("Environment differs from recorded benchmark settings")
    reviewed = validate(ROOT / "eval/golden_set.jsonl", require_review=True)
    original, _, _, _ = snapshot_original()
    if ingest:
        prepare(config)
    else:
        smoke = call_adapter(
            {
                "action": "judge",
                "prompt": 'Return JSON: {"status":"LOCAL_OK"}.',
                "config": config,
            }
        )
        if json.loads(smoke["text"]) != {"status": "LOCAL_OK"}:
            raise ValueError("Local chat smoke response invalid")
        vector = call_adapter(
            {
                "action": "embed",
                "contents": ["PostgreSQL supports transactions."],
                "config": config,
            }
        )
        if len(vector["embeddings"][0]) != config["embedding_dimensions"]:
            raise ValueError("Local dimension mismatch")
        result = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "models": metadata,
            "chat_smoke": smoke,
            "embedding_dimensions": len(vector["embeddings"][0]),
            "embedding_prompt_tokens": vector.get("prompt_eval_count"),
            "hardware": subprocess.check_output(
                ["sysctl", "-n", "hw.memsize", "hw.model", "machdep.cpu.brand_string"],
                text=True,
            ).splitlines(),
            "loaded_models": subprocess.check_output(["ollama", "ps"], text=True),
            "dataset": reviewed,
            "original_chunks_sha256": sha256(json.dumps(original).encode()),
        }
        path = ROOT / "eval/results/local-environment.json"
        path.parent.mkdir(exist_ok=True)
        path.write_text(json.dumps(result, indent=2) + "\n")
        print(
            json.dumps(
                {
                    "local_inference": "PASS",
                    "dimensions": result["embedding_dimensions"],
                    "ollama": metadata["version"],
                    "loaded_models": result["loaded_models"],
                },
                indent=2,
            )
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--check", action="store_true")
    group.add_argument("--ingest", action="store_true")
    args = parser.parse_args()
    try:
        main(args.ingest)
    except (ValueError, RuntimeError, OSError) as exc:
        parser.exit(1, f"Local setup failed: {exc}\n")
