"""Real offline CPU/MPS smoke test; no quality claim from this toy example."""

import argparse
import json
import subprocess
import time

from scripts.reranker_setup import ROOT, TARGET, environment


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="eval/results/reranking/device-probe.json")
    args = parser.parse_args()
    output = ROOT / args.out
    if output.exists():
        raise ValueError("Preserve existing probe")
    rows = []
    for device in ("cpu", "mps"):
        started = time.perf_counter()
        request = {
            "query": "What is the capital of France?",
            "passages": [
                "Paris is the capital of France.",
                "A database transaction can be rolled back.",
            ],
        }
        process = subprocess.run(
            [str(TARGET / "env/bin/python"), "-m", "scripts.reranker_worker", device],
            input="".join(json.dumps({**request, "id": i}) + "\n" for i in range(6)),
            capture_output=True,
            text=True,
            timeout=120,
            cwd=ROOT,
            env=environment(),
        )
        if process.returncode:
            raise RuntimeError(f"{device} inference failed: {process.stderr[-1500:]}")
        results = [json.loads(line) for line in process.stdout.splitlines()]
        if len(results) != 6 or any(
            "error" in r or r["scores"][0] <= r["scores"][1] for r in results
        ):
            raise ValueError("Simple relevance test failed")
        rows.append(
            {
                "device": device,
                "observations": results,
                "process_wall_ms": (time.perf_counter() - started) * 1000,
            }
        )
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(
            {
                "rows": rows,
                "conditions": "One worker per device; first inference cold, five warm; "
                "offline local files, no inference network, two short passages.",
            },
            indent=2,
        )
        + "\n"
    )
    print(output.read_text())


if __name__ == "__main__":
    main()
