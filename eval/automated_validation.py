"""Explicit automated evaluation protocol, separate from independent human review."""

import argparse
import json
from datetime import datetime, timezone

from eval.corpus import ROOT, canonical, sha256
from eval.judge import LOCAL_CLARIFICATION, RUBRIC, judge, validate_judgment
from eval.metrics import citations
from eval.review_packet import verify_packet

DIRECTORY = ROOT / "eval/calibration"
REPORT = ROOT / "eval/results/automated-calibration.json"
METHOD = "automated-evaluation-v1"
FIELDS = ("faithfulness", "correctness", "citation_support", "substantive_claims")


def inputs():
    verify_packet()
    protocol = json.loads((DIRECTORY / "automated-protocol.json").read_text())
    for name, key in (
        ("review-packet.json", "packet_sha256"),
        ("submitted-review.json", "labels_sha256"),
        ("acceptance.json", "criteria_sha256"),
    ):
        if sha256((DIRECTORY / name).read_bytes()) != protocol[key]:
            raise ValueError("Automated protocol input changed")
    if (
        protocol["method"] != METHOD
        or protocol["independent_human_validation"] is not False
    ):
        raise ValueError("Invalid automated protocol or human-validation claim")
    packet = json.loads((DIRECTORY / "review-packet.json").read_text())["cases"]
    labels = json.loads((DIRECTORY / "submitted-review.json").read_text())["cases"]
    if [c["review_id"] for c in packet] != [r["review_id"] for r in labels]:
        raise ValueError("Reference label IDs do not match packet")
    historical = {
        c["id"]: c for c in json.loads((DIRECTORY / "cases.json").read_text())
    }
    mapping = {
        r["review_id"]: r["original_case_id"]
        for r in json.loads((DIRECTORY / "review-packet-map.json").read_text())[
            "mapping"
        ]
    }
    cases = []
    for case, label in zip(packet, labels, strict=True):
        original = historical[mapping[case["review_id"]]]
        expected = {key: label[key] for key in FIELDS}
        for key in ("faithfulness", "correctness"):
            if type(expected[key]) not in (int, float) or expected[key] not in (
                0,
                0.5,
                1,
            ):
                raise ValueError("Invalid submitted reference score")
        if type(expected["substantive_claims"]) is not bool or any(
            type(v) is not bool for v in expected["citation_support"]
        ):
            raise ValueError("Invalid reference Boolean labels")
        if len(expected["citation_support"]) != len(citations(case["answer"])):
            raise ValueError("Reference citation count mismatch")
        context = [
            {"content": e["content"], "source_id": e["source_id"], "pageNumber": 1}
            for e in case["retrieved_evidence"]
        ]
        cases.append(
            {
                **case,
                "id": case["review_id"],
                "type": original["type"],
                "category": original["category"],
                "expected": expected,
                "context": context,
                "supporting_docs": [
                    {"source_id": e["source_id"], "text": e["content"]}
                    for e in case["retrieved_evidence"]
                ],
            }
        )
    local = json.loads((ROOT / "lib/local-model-config.json").read_text())
    config = {
        "provider": "ollama",
        "purpose": METHOD,
        "local_settings": local,
        "judge_options": {
            **local["options"],
            "format": "json",
            "think": local["think"],
            "rubric": "v1",
        },
        "rubric_sha256": sha256((RUBRIC + LOCAL_CLARIFICATION).encode()),
        "protocol_sha256": sha256((DIRECTORY / "automated-protocol.json").read_bytes()),
        "packet_sha256": protocol["packet_sha256"],
        "labels_sha256": protocol["labels_sha256"],
        "criteria_sha256": protocol["criteria_sha256"],
    }
    criteria = json.loads((DIRECTORY / "acceptance.json").read_text())
    return protocol, cases, config, criteria


def acceptance(rows, cases, criteria):
    if len(rows) != len(cases) or len(cases) < criteria["minimum_cases"]:
        raise ValueError("Incomplete calibration")
    matches = []
    for row, case in zip(rows, cases, strict=True):
        if row["id"] != case["id"]:
            raise ValueError("Calibration case order/IDs mismatch")
        actual = validate_judgment(
            row["judgment"], citations(case["answer"]), len(case["context"])
        )
        values = {k: actual[k] for k in FIELDS if k != "citation_support"}
        values["citation_support"] = [
            v["supported"] for v in actual["citation_support"]
        ]
        matches.append({k: values[k] == case["expected"][k] for k in FIELDS})
    agreement = {k: sum(m[k] for m in matches) / len(matches) for k in FIELDS}
    critical = all(
        all(m.values())
        for m, c in zip(matches, cases, strict=True)
        if c["category"] in criteria["critical_categories"]
    )
    categories = {}
    for case, match in zip(cases, matches, strict=True):
        entry = categories.setdefault(
            case["category"], {"count": 0, "all_labels_match": 0}
        )
        entry["count"] += 1
        entry["all_labels_match"] += int(all(match.values()))
    disagreements = [
        {"id": c["id"], "dimensions": [k for k in FIELDS if not m[k]]}
        for c, m in zip(cases, matches, strict=True)
        if not all(m.values())
    ]
    return {
        "agreement": agreement,
        "critical_cases_pass": critical,
        "per_category": categories,
        "disagreements": disagreements,
        "status": "PASS"
        if critical
        and all(agreement[k] >= criteria[k + "_exact_agreement"] for k in FIELDS)
        else "FAIL",
    }


def measure():
    if REPORT.exists():
        result = verify_report()
        print(
            json.dumps(
                {
                    "status": "PASS",
                    "reused_verified_report": True,
                    "agreement": result["agreement"],
                }
            )
        )
        return
    protocol, cases, config, criteria = inputs()
    rows = []
    for case in cases:
        response, hit = judge(
            case,
            case["answer"],
            case["context"],
            case["supporting_docs"],
            config["local_settings"]["chat"],
            config,
        )
        rows.append(
            {
                "id": case["id"],
                "judgment": response["judgment"],
                "cache_key": response["cache_key"],
                "cache_hit": hit,
            }
        )
        print(
            f"Calibration {len(rows)}/{len(cases)} {case['id']}; cached={hit}",
            flush=True,
        )
    result = {
        "method": METHOD,
        "independent_human_validation": False,
        "label_provenance": protocol["label_provenance"],
        "limits": protocol["limits"],
        "config": config,
        "config_sha256": sha256(canonical(config)),
        "measured_at": datetime.now(timezone.utc).isoformat(),
        "case_count": len(cases),
        "cases": rows,
        **acceptance(rows, cases, criteria),
    }
    REPORT.write_text(json.dumps(result, indent=2) + "\n")
    if result["status"] != "PASS":
        raise ValueError("Automated calibration failed unchanged acceptance criteria")
    print(json.dumps({k: result[k] for k in ("status", "agreement", "disagreements")}))


def verify_report():
    protocol, cases, config, criteria = inputs()
    result = json.loads(REPORT.read_text())
    if (
        result["method"] != METHOD
        or result["independent_human_validation"] is not False
        or result["config"] != config
        or result["config_sha256"] != sha256(canonical(config))
        or result["case_count"] != len(cases)
        or result["label_provenance"] != protocol["label_provenance"]
        or result["limits"] != protocol["limits"]
    ):
        raise ValueError("Automated calibration provenance mismatch")
    computed = acceptance(result["cases"], cases, criteria)
    if computed["status"] != "PASS" or any(result[k] != v for k, v in computed.items()):
        raise ValueError("Automated calibration acceptance could not be verified")
    return result


def verify_method(result):
    report = verify_report()
    validation = result["evaluation_validation"]
    expected_judge_options = {
        **report["config"]["local_settings"]["options"],
        "format": "json",
        "think": report["config"]["local_settings"]["think"],
        "rubric": "v1-local-independent-dimensions",
        "rubric_sha256": report["config"]["rubric_sha256"],
    }
    if (
        validation["method"] != METHOD
        or validation["independent_human_validation"] is not False
        or validation["calibration_report_sha256"] != sha256(REPORT.read_bytes())
        or validation["protocol_sha256"] != report["config"]["protocol_sha256"]
        or result["config"].get("provider") != "ollama"
        or result["config"]["local_settings"] != report["config"]["local_settings"]
        or result["config"]["judge_model"] != report["config"]["local_settings"]["chat"]
        or result["config"]["judge_options"] != expected_judge_options
        or result["config"]["judge_options"]["rubric_sha256"]
        != report["config"]["rubric_sha256"]
    ):
        raise ValueError("Result does not match automated calibration protocol")
    return (
        validation["method"],
        validation["protocol_sha256"],
        validation["calibration_report_sha256"],
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--verify", action="store_true")
    args = parser.parse_args()
    try:
        if args.verify:
            result = verify_report()
            print(
                json.dumps(
                    {
                        "automated_calibration": "PASS",
                        "case_count": result["case_count"],
                        "independent_human_validation": False,
                    }
                )
            )
        else:
            measure()
    except (ValueError, KeyError, TypeError, OSError, RuntimeError) as exc:
        parser.exit(1, f"Automated validation failed: {exc}\n")
