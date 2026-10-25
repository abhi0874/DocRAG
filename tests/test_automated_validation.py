import copy
import json

import pytest

from eval import automated_validation as automated
from eval import promote_local
from eval.corpus import ROOT, sha256


def synthetic_rows(cases):
    rows = []
    for case in cases:
        expected = case["expected"]
        rows.append(
            {
                "id": case["id"],
                "judgment": {
                    "faithfulness": expected["faithfulness"],
                    "correctness": expected["correctness"],
                    "substantive_claims": expected["substantive_claims"],
                    "rationale": "Synthetic test fixture, not a model measurement.",
                    "citation_support": [
                        {
                            "occurrence": i,
                            "supported": v,
                            "reason": "Synthetic fixture.",
                        }
                        for i, v in enumerate(expected["citation_support"])
                    ],
                },
            }
        )
    return rows


def test_user_labels_and_unchanged_criteria_are_used_without_human_claim():
    protocol, cases, _, criteria = automated.inputs()
    assert protocol["independent_human_validation"] is False
    assert len(cases) == 14
    old = json.loads((automated.DIRECTORY / "acceptance.json").read_text())
    assert criteria == old
    assert (
        automated.acceptance(synthetic_rows(cases), cases, criteria)["status"] == "PASS"
    )


def test_critical_failure_rejected_even_when_mean_exceeds_threshold():
    _, cases, _, criteria = automated.inputs()
    rows = synthetic_rows(cases)
    index = next(i for i, c in enumerate(cases) if c["category"] == "proper_refusal")
    rows[index]["judgment"]["faithfulness"] = 0
    result = automated.acceptance(rows, cases, criteria)
    assert result["agreement"]["faithfulness"] > 0.9
    assert result["status"] == "FAIL"
    assert result["critical_cases_pass"] is False


def test_missing_or_reordered_calibration_rows_rejected():
    _, cases, _, criteria = automated.inputs()
    rows = synthetic_rows(cases)
    with pytest.raises(ValueError, match="Incomplete"):
        automated.acceptance(rows[:-1], cases, criteria)
    with pytest.raises(ValueError, match="order"):
        automated.acceptance(list(reversed(rows)), cases, criteria)


@pytest.fixture
def method_result(tmp_path, monkeypatch):
    _, _, config, _ = automated.inputs()
    report = {"config": config}
    path = tmp_path / "report.json"
    path.write_text(json.dumps(report))
    monkeypatch.setattr(automated, "REPORT", path)
    monkeypatch.setattr(automated, "verify_report", lambda: report)
    result = json.loads(
        (ROOT / "eval/results/diagnostic-local-ollama-first.json").read_text()
    )
    result["evaluation_validation"] = {
        "method": automated.METHOD,
        "independent_human_validation": False,
        "calibration_report_sha256": sha256(path.read_bytes()),
        "protocol_sha256": config["protocol_sha256"],
    }
    return result


@pytest.mark.parametrize("change", ["human_claim", "report_hash", "judge_settings"])
def test_method_rejects_false_human_claim_or_incompatible_judging(
    method_result, change
):
    assert automated.verify_method(method_result)[0] == automated.METHOD
    bad = copy.deepcopy(method_result)
    if change == "human_claim":
        bad["evaluation_validation"]["independent_human_validation"] = True
    elif change == "report_hash":
        bad["evaluation_validation"]["calibration_report_sha256"] = "0" * 64
    else:
        bad["config"]["judge_options"]["temperature"] = 0.7
    with pytest.raises(ValueError, match="does not match"):
        automated.verify_method(bad)


def test_promoted_measurements_cannot_be_edited(method_result):
    source = ROOT / "eval/results/diagnostic-local-ollama-first.json"
    method_result["evaluation_validation"].update(
        {
            "source_result_path": str(source.relative_to(ROOT)),
            "source_result_sha256": sha256(source.read_bytes()),
        }
    )
    method_result["status"] = "complete"
    method_result["metrics"]["faithfulness"] = 0.1
    with pytest.raises(ValueError, match="differs from source"):
        promote_local.verify_derivation(method_result)
