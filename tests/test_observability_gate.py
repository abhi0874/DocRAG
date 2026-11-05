import copy
import json

import pytest

from eval.corpus import ROOT, canonical, sha256
from eval.observability_gate import ADDED, gate


def pair():
    baseline = json.loads(
        (ROOT / "eval/results/security/step7-final-b/evaluation.json").read_text()
    )
    candidate = copy.deepcopy(baseline)
    candidate["config"]["application_file_hashes"].update(
        {path: sha256((ROOT / path).read_bytes()) for path in ADDED}
    )
    candidate["config_sha256"] = sha256(canonical(candidate["config"]))
    return baseline, candidate


def test_declared_compatibility(monkeypatch):
    # Synthetic configuration tests isolate compatibility. Full saved-result
    # derivation is independently exercised below and by the real final run.
    monkeypatch.setattr("eval.observability_gate.verify", lambda _: None)
    assert gate(*pair())["status"] == "PASS"


def test_modified_saved_measurement_is_not_accepted():
    with pytest.raises(ValueError, match="differs from source"):
        gate(*pair())


@pytest.mark.parametrize("metric", ["recall@5", "faithfulness"])
@pytest.mark.parametrize("drop,passes", [(0.02, True), (0.020000001, False)])
def test_exact_threshold(monkeypatch, metric, drop, passes):
    a, b = pair()
    monkeypatch.setattr("eval.observability_gate.verify", lambda _: None)
    b["metrics"][metric] = a["metrics"][metric] - drop
    if passes:
        assert gate(a, b)["status"] == "PASS"
    else:
        with pytest.raises(ValueError, match="Regression"):
            gate(a, b)


@pytest.mark.parametrize(
    "change", ["model", "prompt", "evidence", "partial", "missing", "unknown"]
)
def test_rejects_unrelated_changes(monkeypatch, change):
    a, b = pair()
    monkeypatch.setattr("eval.observability_gate.verify", lambda _: None)
    if change == "model":
        b["config"]["answer_model"] = "changed"
    elif change == "prompt":
        b["config"]["application_file_hashes"]["lib/rag-prompt.ts"] = "changed"
    elif change == "evidence":
        b["questions"][0]["ranked_chunks"][0]["content"] = "changed"
    elif change == "partial":
        b["questions"].pop()
    elif change == "missing":
        del b["config"]["application_file_hashes"][next(iter(ADDED))]
    else:
        b["config"]["application_file_hashes"]["unknown.ts"] = "changed"
    with pytest.raises(ValueError):
        gate(a, b)
