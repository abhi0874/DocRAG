"""Read-only checks for fresh human review; never infer labels or run a judge."""

import argparse
import json

from eval.corpus import ROOT, sha256
from eval.judge import LOCAL_CLARIFICATION, RUBRIC
from eval.metrics import citations

DIRECTORY = ROOT / "eval/calibration/fresh-v1"


def verify():
    manifest = json.loads((DIRECTORY / "manifest.json").read_text())
    for filename, key in (
        ("packet.json", "packet_sha256"),
        ("acceptance.json", "acceptance_sha256"),
        ("judge-rubric.txt", "rubric_sha256"),
    ):
        if sha256((DIRECTORY / filename).read_bytes()) != manifest[key]:
            raise ValueError("Frozen packet/rubric/criteria changed")
    if (DIRECTORY / "judge-rubric.txt").read_text() != RUBRIC + LOCAL_CLARIFICATION:
        raise ValueError("Judge prompt differs from frozen review rubric")
    internal = ROOT / manifest["withheld_metadata_location"]
    if sha256(internal.read_bytes()) != manifest["withheld_metadata_sha256"]:
        raise ValueError("Withheld metadata changed; investigate without exposing it")
    cases = json.loads((DIRECTORY / "packet.json").read_text())["cases"]
    labels = json.loads((DIRECTORY / "human-labels.json").read_text())
    if labels["packet_sha256"] != manifest["packet_sha256"]:
        raise ValueError("Labels refer to another packet")
    ids = [c["id"] for c in cases]
    if ids != [f"N{i:02d}" for i in range(1, 15)] or ids != [
        r["id"] for r in labels["cases"]
    ]:
        raise ValueError("Expected the fixed 14 neutral case IDs")
    pending = []
    for case, row in zip(cases, labels["cases"], strict=True):
        if set(case) != {
            "id",
            "question",
            "answer",
            "answer_origin",
            "retrieved_evidence",
        }:
            raise ValueError("Unexpected public case fields")
        for evidence in case["retrieved_evidence"]:
            path = (ROOT / evidence["source_file"]).resolve()
            if not path.is_relative_to((ROOT / "eval/corpus").resolve()):
                raise ValueError("Evidence must come from saved public corpus")
            data = path.read_bytes()
            if (
                sha256(data) != evidence["source_sha256"]
                or data.decode()[evidence["start_offset"] : evidence["end_offset"]]
                != evidence["content"]
            ):
                raise ValueError("Source hash/exact excerpt mismatch")
        for key in ("faithfulness", "correctness"):
            value = row[key]
            if value is not None and (
                type(value) not in (int, float) or value not in (0, 0.5, 1)
            ):
                raise ValueError("Invalid human score")
        support = row["citation_support"]
        if support is not None and (
            not isinstance(support, list)
            or len(support) != len(citations(case["answer"]))
            or any(type(v) is not bool for v in support)
        ):
            raise ValueError("Human citation labels do not match occurrences")
        if (
            row["substantive_claims"] is not None
            and type(row["substantive_claims"]) is not bool
        ):
            raise ValueError("Invalid human substantive-claims label")
        if row["refusal_behavior"] not in (
            None,
            "appropriate",
            "inappropriate",
            "not_a_refusal",
        ):
            raise ValueError("Invalid human refusal label")
        if any(row[k] is None or row[k] == "" for k in row if k != "id"):
            pending.append(case["id"])
    return cases, {
        "evidence_check": "PASS",
        "case_count": len(cases),
        "completed_entries": len(cases) - len(pending),
        "pending_case_ids": pending,
        "baseline_approved": False,
        "note": "Format/evidence check only; "
        "human provenance and judge acceptance separate.",
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--show-next", action="store_true")
    args = parser.parse_args()
    try:
        cases, summary = verify()
        if args.show_next and summary["pending_case_ids"]:
            next_id = summary["pending_case_ids"][0]
            print(json.dumps(next(c for c in cases if c["id"] == next_id), indent=2))
        else:
            print(json.dumps(summary, indent=2))
    except (ValueError, KeyError, TypeError, OSError) as exc:
        parser.exit(1, f"Fresh review check failed: {exc}\n")


if __name__ == "__main__":
    main()
