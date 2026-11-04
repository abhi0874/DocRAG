"""Run real audits; retain raw nonzero codes and the explicit tooling risk review."""

import json
import subprocess

from eval.corpus import ROOT


def main():
    directory = ROOT / ".local/security-audit-final"
    directory.mkdir(exist_ok=True)
    receipts = []
    commands = [
        ("javascript", ["pnpm", "audit", "--json"]),
        ("python", [".venv/bin/python", "-m", "pip_audit", "--format", "json"]),
        (
            "reranker",
            [
                ".venv/bin/python",
                "-m",
                "pip_audit",
                "--path",
                ".local/reranker-minilm/env/lib/python3.14/site-packages",
                "--format",
                "json",
            ],
        ),
    ]
    for name, command in commands:
        result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
        (directory / f"{name}.json").write_text(result.stdout)
        (directory / f"{name}.stderr").write_text(result.stderr)
        receipt = {"name": name, "command": command, "exit_code": result.returncode}
        receipts.append(receipt)
        (directory / "commands.json").write_text(json.dumps(receipts, indent=2))
        report = json.loads(result.stdout)  # Network/invalid/empty reports fail closed.
        if name == "javascript":
            assert result.returncode == 1, "Re-review changed JavaScript findings"
            advisories = report["advisories"].values()
            assert {a["url"] for a in advisories} == {
                "https://github.com/advisories/GHSA-67mh-4wv8-2f99",
                "https://github.com/advisories/GHSA-g3hv-75wg-m249",
            }, "Unreviewed dependency findings"
            assert all(a["severity"] == "moderate" for a in advisories)
            for advisory in advisories:
                if advisory["module_name"] == "minimatch":
                    assert all(f["dev"] for f in advisory["findings"])
                else:
                    # Better Auth declares drizzle-kit as an optional peer, so
                    # pnpm marks this path non-dev. Check actual build reachability.
                    assert advisory["module_name"] == "esbuild"
                    assert all(f["version"] == "0.18.20" for f in advisory["findings"])
                    assert all(
                        "drizzle-kit>" in path
                        for f in advisory["findings"]
                        for path in f["paths"]
                    )
                    traces = list((ROOT / ".next/server").rglob("*.nft.json"))
                    assert traces, "Build required for runtime reachability evidence"
                    assert not any(
                        "esbuild" in path or "drizzle-kit" in path
                        for trace in traces
                        for path in json.loads(trace.read_text())["files"]
                    )
            receipt["esbuild_peer_classification"] = (
                "Non-dev graph through Better Auth optional Drizzle CLI peer; "
                "absent from all production server dependency traces"
            )
            receipt["assessment"] = (
                "Two disclosed moderate tooling findings; "
                "see docs/SECURITY.md. Raw audit exit remains 1."
            )
        else:
            assert result.returncode == 0, "Python dependency audit has findings/errors"
            assert len(report["dependencies"]) >= 30, "Empty/wrong environment audit"
            assert all(not d["vulns"] for d in report["dependencies"])
            receipt["assessment"] = "No known vulnerabilities in installed environment"
        print(f"{name}: raw exit {result.returncode}; {receipt['assessment']}")
    (directory / "commands.json").write_text(json.dumps(receipts, indent=2))
    print("PASS: audits obtained and risk policy checked; not a zero-findings JS audit")


if __name__ == "__main__":
    main()
