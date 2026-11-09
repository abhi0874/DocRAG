import copy
import json

import pytest

from eval.corpus import ROOT, canonical, sha256
from eval.deployment_gate import ADDED, CHANGED, gate


def pair():
    a = json.loads(
        (ROOT / "eval/results/observability/step10-final-c/evaluation.json").read_text()
    )
    b = copy.deepcopy(a)
    b["config"]["application_file_hashes"].update(
        {p: sha256((ROOT / p).read_bytes()) for p in ADDED | CHANGED}
    )
    b["config_sha256"] = sha256(canonical(b["config"]))
    return a, b


def test_declaration(monkeypatch):
    monkeypatch.setattr("eval.deployment_gate.verify", lambda _: None)
    assert gate(*pair())["status"] == "PASS"


def test_saved_provenance_cannot_be_forged():
    with pytest.raises(ValueError):
        gate(*pair())


@pytest.mark.parametrize(
    "change",
    [
        "model",
        "prompt",
        "evidence",
        "partial",
        "missing",
        "unknown",
        "recall",
        "faithfulness",
    ],
)
def test_negative_controls(monkeypatch, change):
    monkeypatch.setattr("eval.deployment_gate.verify", lambda _: None)
    a, b = pair()
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
    elif change == "unknown":
        b["config"]["application_file_hashes"]["unknown.ts"] = "changed"
    else:
        metric = "recall@5" if change == "recall" else "faithfulness"
        b["metrics"][metric] -= 0.020000001
    with pytest.raises(ValueError):
        gate(a, b)
