import copy
import json

import pytest

from eval.corpus import ROOT
from eval.prompting_gate import compatible, gate


def pair():
    a = json.loads((ROOT / "eval/results/reranking-selected.json").read_text())
    b = copy.deepcopy(a)
    # This gate covers the frozen Step 6 prompt-only change. Security changes
    # have a separate declaration and negative controls in test_security_gate.
    b["config"] = json.loads(
        (ROOT / "eval/results/prompting/grounded-v1.json").read_text()
    )["config"]
    return a, b


def test_declared_prompting_only():
    assert compatible(*pair())["prompt"] == "grounded-v1"


@pytest.mark.parametrize(
    "field",
    [
        "local_settings",
        "answer_model",
        "answer_top_k",
        "rrf_k",
        "judge_options",
        "ollama_version",
    ],
)
def test_rejects_unrelated_changes(field):
    a, b = pair()
    b["config"][field] = "changed"
    with pytest.raises(ValueError, match="Unrelated"):
        compatible(a, b)


def test_rejects_retrieved_context_and_cache_changes():
    a, b = pair()
    b["questions"][0]["ranked_chunks"][0]["content"] = "wrong"
    with pytest.raises(ValueError, match="evidence"):
        compatible(a, b)
    a, b = pair()
    b["config"]["production_response_cache"] = True
    with pytest.raises(ValueError, match="cache"):
        compatible(a, b)


@pytest.mark.parametrize("metric", ["recall@5", "faithfulness"])
@pytest.mark.parametrize("drop,passes", [(0.02, True), (0.020000001, False)])
def test_exact_thresholds(monkeypatch, metric, drop, passes):
    a, b = pair()
    monkeypatch.setattr("eval.prompting_gate.verify", lambda _: None)
    b["metrics"][metric] = a["metrics"][metric] - drop
    if passes:
        assert gate(a, b)["status"] == "PASS"
    else:
        with pytest.raises(ValueError, match="Regression"):
            gate(a, b)
