"""Run the complete command-contract verification with immutable run receipts."""

import argparse
import hashlib
import json
import os
import shlex
import subprocess
from datetime import datetime, timezone

from eval.corpus import ROOT


def main():
    local_node = ROOT / ".local/node-v24.22.1-darwin-arm64/bin"
    if local_node.is_dir():
        os.environ["PATH"] = str(local_node) + os.pathsep + os.environ["PATH"]
    if subprocess.check_output(["node", "--version"], text=True).strip() != "v24.22.1":
        raise ValueError("Use pinned Node 24.22.1; see command contract")
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--run-id", default=datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    )
    args = parser.parse_args()
    if not args.run_id.replace("-", "").isalnum():
        raise ValueError("Invalid verification run name")
    directory = ROOT / ".local" / ("observability-verify-" + args.run_id)
    directory.mkdir()  # Never overwrite an earlier run.
    relative = str(directory.relative_to(ROOT))
    results = ROOT / "eval/results/observability" / args.run_id
    results.mkdir(parents=True)  # Saved measurements must live under eval/results.
    result_relative = str(results.relative_to(ROOT))
    py = ".venv/bin/python -m "
    baseline = "eval/results/prompting/step5-v1.json"
    commands = [
        "make lint",
        "make test",
        "pnpm exec vitest run tests/cache-api.test.ts "
        "tests/reranker-api.test.ts tests/observability.test.ts",
        "make build-fe",
        py + "scripts.observability_setup",
        py + "scripts.security_setup --apply-selected",
        py + "scripts.security_setup --apply-configured",
        py + "scripts.security_http",
        py + "scripts.observability_http",
        py + "scripts.feedback_to_eval",
        py + "eval.validate_dataset --require-review",
        py + "eval.prompting_gate --baseline eval/results/reranking-selected.json "
        "--candidate " + baseline,
        py + "eval.prompting_gate --baseline eval/results/reranking-selected.json "
        "--candidate eval/results/prompting/grounded-v1.json",
        py + "pytest -q tests/test_prompting_gate.py tests/test_prompting_report.py "
        "tests/test_security_gate.py tests/test_observability_gate.py",
        py + "eval.prompt_bytes",
        "node --import tsx eval/recheck_citations.ts",
        py + "eval.citation_cache_http",
        py + f"eval.cache_http --prompt-version step5-v1 "
        f"--out {relative}/cache-http.json",
        py + f"eval.reranking_smoke --out {relative}/streaming.json",
        py + f"scripts.security_invalidation --prompt-version step5-v1 "
        f"--out {relative}/invalidation.json",
        py + f"eval.run_eval --golden eval/golden_set.jsonl "
        "--prompting-experiment step5-v1 "
        f"--out {result_relative}/evaluation-raw.json",
        py + f"eval.promote_local --source {result_relative}/evaluation-raw.json "
        f"--out {result_relative}/evaluation.json",
        py + "eval.observability_gate --baseline "
        "eval/results/security/step7-final-b/evaluation.json "
        f"--candidate {result_relative}/evaluation.json",
        py + f"eval.reranking_integrity --out {relative}/preservation.json",
        py + f"eval.prompting_report --out {relative}/historical-report.json",
        py + "scripts.security_audit",
        "git diff --check",
    ]
    paths = (
        subprocess.check_output(
            ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
            cwd=ROOT,
        )
        .decode()
        .split("\0")
    )
    sources = [
        path
        for path in paths
        if path
        and (
            path.startswith(
                ("app/", "components/", "lib/", "scripts/", "db/", "tests/")
            )
            or (path.startswith("eval/") and path.endswith((".py", ".ts")))
            or path
            in {
                "package.json",
                "Makefile",
                ".node-version",
                ".nvmrc",
                "pnpm-lock.yaml",
                "requirements-dev.txt",
                "requirements-reranker.txt",
                "eval/golden_set.jsonl",
            }
        )
    ]

    def hashes():
        return {
            path: hashlib.sha256((ROOT / path).read_bytes()).hexdigest()
            for path in sources
        }

    before = hashes()
    (directory / "source-hashes.json").write_text(json.dumps(before, indent=2))
    rows = []
    for index, command in enumerate(commands):
        print("RUN", command, flush=True)
        env = os.environ.copy()
        if "eval.run_eval " in command:
            env["AI_PROVIDER"] = "ollama"
        with (directory / f"{index:02}.log").open("w") as log:
            result = subprocess.run(
                shlex.split(command),
                cwd=ROOT,
                env=env,
                stdout=log,
                stderr=subprocess.STDOUT,
            )
        rows.append(
            {
                "command": command,
                "exit_code": result.returncode,
                "log": f"{index:02}.log",
            }
        )
        (directory / "commands.json").write_text(json.dumps(rows, indent=2))
        print("EXIT", result.returncode, flush=True)
        if result.returncode:
            print(f"Verification stopped. Inspect {directory / f'{index:02}.log'}")
            raise SystemExit(result.returncode)
    assert hashes() == before, "Source changed during final verification; rerun"
    (directory / "complete.json").write_text(
        json.dumps({"status": "PASS", "groups": len(rows)})
    )
    print(
        f"PASS: {len(rows)} verification groups; "
        "browser evidence is recorded separately"
    )


if __name__ == "__main__":
    main()
