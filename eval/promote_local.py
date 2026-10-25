"""Attach verified automated methodology to immutable existing measurements."""

import argparse
import copy
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from eval.automated_validation import METHOD, REPORT, verify_method, verify_report
from eval.corpus import ROOT, sha256

VALIDATORS = (
    "eval/automated_validation.py",
    "eval/promote_local.py",
    "eval/verify_results.py",
    "eval/check_regression.py",
    "eval/review_packet.py",
)


def verify_derivation(result):
    verify_method(result)
    record = result["evaluation_validation"]
    path = (ROOT / record["source_result_path"]).resolve()
    if not path.is_relative_to((ROOT / "eval/results").resolve()):
        raise ValueError("Measurement source must be a saved result")
    raw = path.read_bytes()
    if sha256(raw) != record["source_result_sha256"]:
        raise ValueError("Original measurement artifact changed")
    source = json.loads(raw)
    if (
        source.get("evaluation_validation") is not None
        or source["status"] != "provisional"
    ):
        raise ValueError("Expected original provisional measurements")
    expected = {**source, "status": "complete", "evaluation_validation": record}
    if result != expected:
        raise ValueError("Validated result differs from source measurements")
    if set(record["validator_file_hashes"]) != set(VALIDATORS):
        raise ValueError("Missing validator provenance")
    for file, digest in record["validator_file_hashes"].items():
        raw = subprocess.check_output(
            ["git", "show", f"{record['validator_git_revision']}:{file}"], cwd=ROOT
        )
        if sha256(raw) != digest:
            raise ValueError("Validator code does not match recorded revision")


def promote(source_path, output):
    from eval.verify_results import verify

    report = verify_report()
    raw = source_path.read_bytes()
    source = json.loads(raw)
    if source.get("evaluation_validation") is not None:
        verify(source)
        if source_path.resolve() == output.resolve():
            print("Existing validated output unchanged.")
            return
        raise ValueError("Use an original diagnostic run as input")
    verify(source, allow_provisional=True)
    if source["config"].get("provider") != "ollama":
        raise ValueError("Only local results can use this protocol")
    source_path = source_path.resolve()
    if source_path == output.resolve():
        snapshot = ROOT / "eval/results" / f"validation-source-{sha256(raw)}.json"
        if snapshot.exists():
            if snapshot.read_bytes() != raw:
                raise ValueError("Measurement snapshot collision")
        else:
            snapshot.write_bytes(raw)
        source_path = snapshot
    revision = subprocess.check_output(
        ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True
    ).strip()
    result = copy.deepcopy(source)
    result["status"] = "complete"
    result["evaluation_validation"] = {
        "method": METHOD,
        "independent_human_validation": False,
        "calibration_report_sha256": sha256(REPORT.read_bytes()),
        "protocol_sha256": report["config"]["protocol_sha256"],
        "source_result_path": str(source_path.relative_to(ROOT)),
        "source_result_sha256": sha256(raw),
        "validated_at": datetime.now(timezone.utc).isoformat(),
        "validator_git_revision": revision,
        "validator_file_hashes": {
            p: sha256((ROOT / p).read_bytes()) for p in VALIDATORS
        },
        "interpretation": "Complete under the authorized automated protocol; "
        "not independent human validation or a guarantee of correctness.",
    }
    verify(result)
    if (
        output.exists()
        and output.resolve() != source_path
        and output.name.startswith("baseline")
    ):
        existing = json.loads(output.read_text())
        verify(existing)
        if existing["evaluation_validation"]["source_result_sha256"] != sha256(raw):
            raise ValueError("Existing baseline cannot be overwritten")
        print("Existing verified baseline preserved.")
        return
    temporary = output.with_suffix(".tmp")
    temporary.write_text(
        json.dumps(result, indent=2, ensure_ascii=False, allow_nan=False) + "\n"
    )
    temporary.replace(output)
    print(
        json.dumps(
            {
                "saved": str(output.relative_to(ROOT)),
                "questions": len(result["questions"]),
                "method": METHOD,
                "independent_human_validation": False,
            }
        )
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    try:
        promote(args.source.resolve(), args.out.resolve())
    except (
        ValueError,
        KeyError,
        TypeError,
        OSError,
        subprocess.CalledProcessError,
    ) as exc:
        parser.exit(1, f"Local promotion failed: {exc}\n")
