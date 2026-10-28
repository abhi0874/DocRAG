"""Offline JSON-lines inference worker, owned by the Next.js server process."""

import hashlib
import json
import math
import os
import resource
import sys
import time

from scripts.reranker_setup import ROOT, TARGET, environment


def main():
    os.environ.update(environment())
    os.environ.update(HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1")
    started = time.perf_counter()
    config = json.loads((ROOT / "lib/reranker-model.json").read_text())
    manifest = json.loads((TARGET / "manifest.json").read_text())
    if manifest["config"] != config:
        raise ValueError("Model manifest mismatch")
    for name, expected in manifest["files_sha256"].items():
        if (
            hashlib.sha256((TARGET / "model" / name).read_bytes()).hexdigest()
            != expected
        ):
            raise ValueError("Model file checksum mismatch")
    import torch
    from transformers import AutoModelForSequenceClassification, AutoTokenizer

    device = sys.argv[1] if len(sys.argv) == 2 else "cpu"
    if device not in ("cpu", "mps"):
        raise ValueError("Invalid device")
    if device == "mps" and not torch.backends.mps.is_available():
        raise ValueError("MPS unavailable")
    torch.set_num_threads(config["cpu_threads"])
    torch.manual_seed(42)
    tokenizer = AutoTokenizer.from_pretrained(
        TARGET / "model", local_files_only=True, trust_remote_code=False
    )
    model = (
        AutoModelForSequenceClassification.from_pretrained(
            TARGET / "model",
            local_files_only=True,
            trust_remote_code=False,
            use_safetensors=True,
        )
        .to(device)
        .eval()
    )
    init_ms = (time.perf_counter() - started) * 1000
    for line in sys.stdin:
        request = json.loads(line)
        try:
            query, passages = request["query"], request["passages"]
            if not isinstance(query, str) or not 0 < len(query) <= 8000:
                raise ValueError("Invalid query")
            if not isinstance(passages, list) or not 0 < len(passages) <= 24:
                raise ValueError("Invalid pool")
            if any(
                not isinstance(p, str) or not p.strip() or len(p) > 20000
                for p in passages
            ):
                raise ValueError("Invalid passage")
            start = time.perf_counter()
            scores, truncated = [], 0
            for offset in range(0, len(passages), config["batch_size"]):
                batch = passages[offset : offset + config["batch_size"]]
                pairs = [[query, p] for p in batch]
                lengths = tokenizer(pairs, truncation=False)["input_ids"]
                truncated += sum(len(ids) > config["max_length"] for ids in lengths)
                tokens = tokenizer(
                    pairs,
                    padding=True,
                    truncation=True,
                    max_length=config["max_length"],
                    return_tensors="pt",
                )
                tokens = {k: v.to(device) for k, v in tokens.items()}
                with torch.inference_mode():
                    values = model(**tokens).logits.flatten().cpu().tolist()
                scores.extend(values)
            if len(scores) != len(passages) or not all(
                math.isfinite(s) for s in scores
            ):
                raise ValueError("Invalid scores")
            result = {
                "id": request["id"],
                "scores": scores,
                "device": device,
                "inference_ms": (time.perf_counter() - start) * 1000,
                "initialization_ms": init_ms,
                "truncated": truncated,
                "peak_rss_bytes": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
                "mps_allocated_bytes": torch.mps.current_allocated_memory()
                if device == "mps"
                else None,
            }
            init_ms = 0
        except Exception:
            result = {"id": request.get("id"), "error": "inference_failed"}
        print(json.dumps(result, allow_nan=False), flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        # Never expose source text, inherited credentials, or exception URLs.
        print(f"Reranker initialization failed: {type(exc).__name__}", file=sys.stderr)
        sys.exit(1)
