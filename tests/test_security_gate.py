import copy
import json

import pytest

from eval.corpus import ROOT
from eval.security_gate import gate


def pair():
    baseline = json.loads((ROOT / "eval/results/prompting/step5-v1.json").read_text())
    return baseline, copy.deepcopy(baseline)


def test_unchanged_full_measurement_passes():
    assert gate(*pair())["status"] == "PASS"


@pytest.mark.parametrize("metric", ["recall@5", "faithfulness"])
@pytest.mark.parametrize("drop,passes", [(0.02, True), (0.020000001, False)])
def test_security_gate_keeps_exact_thresholds(monkeypatch, metric, drop, passes):
    a, b = pair()
    # Metric calculation is independently covered by verify_results; isolate
    # the unchanged numerical acceptance boundary here.
    monkeypatch.setattr("eval.security_gate.verify", lambda _: None)
    b["metrics"][metric] = a["metrics"][metric] - drop
    if passes:
        assert gate(a, b)["status"] == "PASS"
    else:
        with pytest.raises(ValueError, match="Regression"):
            gate(a, b)


@pytest.mark.parametrize("change", ["model", "evidence", "prompt", "partial"])
def test_security_declaration_rejects_unrelated_changes(monkeypatch, change):
    a, b = pair()
    monkeypatch.setattr("eval.security_gate.verify", lambda _: None)
    if change == "model":
        b["config"]["answer_model"] = "changed"
    elif change == "evidence":
        b["questions"][0]["ranked_chunks"][0]["content"] = "changed"
    elif change == "prompt":
        b["config"]["application_file_hashes"]["lib/rag-prompt.ts"] = "changed"
    else:
        b["questions"].pop()
    with pytest.raises(ValueError):
        gate(a, b)
