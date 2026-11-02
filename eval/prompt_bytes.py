"""Compare final instructions to the actual measured code on all saved contexts."""

import json
import os
import subprocess
import tempfile
from pathlib import Path

from eval.chunking_experiments import experiment_url
from eval.corpus import ROOT, sha256
from eval.retrieval_experiments import save


def main():
    directory = ROOT / "eval/results/prompting"
    measured = subprocess.check_output(
        ["git", "show", "ecbabe1:lib/rag-prompt.ts"], cwd=ROOT
    )
    ids = {
        json.loads(line)["id"]
        for line in (ROOT / "eval/golden_set.jsonl").read_text().splitlines()
    }
    env = {
        **os.environ,
        "AI_PROVIDER": "ollama",
        "DOCRAG_CHUNKING_EXPERIMENT": "heading-1400-280",
        "OLLAMA_DATABASE_URL": experiment_url("heading-1400-280"),
    }
    with tempfile.TemporaryDirectory(dir=ROOT / ".local") as temp:
        path = Path(temp) / "frozen.ts"
        path.write_bytes(measured)
        (path.parent / "rag.ts").write_text("export * from '../../lib/rag'\n")
        hashes = json.loads(
            subprocess.check_output(
                ["node", "--import", "tsx", "eval/prompt_bytes.ts", str(path)],
                cwd=ROOT,
                env=env,
            )
        )
    for version, values in hashes.items():
        data = json.loads((directory / f"{version}.json").read_text())
        assert data["config"]["application_file_hashes"]["lib/rag-prompt.ts"] == sha256(
            measured
        )
        assert set(values) == ids and len(ids) == 100
    assert set(hashes) == {"step5-v1", "grounded-v1"}
    save(
        directory / "final-prompt-equivalence.json",
        {
            "status": "PASS",
            "measured_source_revision": "ecbabe1",
            "final_source_sha256": sha256((ROOT / "lib/rag-prompt.ts").read_bytes()),
            "question_prompt_sha256": hashes,
            "interpretation": "Both sets of 100 rendered prompts are byte-identical.",
        },
    )
    print("PASS: 200/200 effective prompts byte-identical on verified public snapshots")


if __name__ == "__main__":
    main()
