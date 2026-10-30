import json
import subprocess

import pytest

from eval.corpus import ROOT
from eval.reranking_experiments import configuration
from eval.reranking_gate import compatible, gate


def pair():
    baseline = json.loads((ROOT / "eval/results/retrieval-selected.json").read_text())
    # The Step 5 gate must test Step 5 code, not later prompting changes.
    candidate = json.loads((ROOT / "eval/results/reranking-selected.json").read_text())
    candidate["config"]["reranking_experiment"] = "top10"
    candidate["config"]["reranking"] = configuration("top10")["reranking"]
    return baseline, candidate


def test_declared_reranking_only():
    assert compatible(*pair())["reranking"]["enabled"]


def test_reject_undeclared_chat_context_change(monkeypatch):
    baseline, candidate = pair()
    original = subprocess.check_output

    def changed(args, **kwargs):
        value = original(args, **kwargs)
        if args[-1] == candidate["git_revision"] + ":app/api/chat/route.ts":
            return value.replace(
                "selectContext(question, documentId, 6)",
                "selectContext(question, documentId, 3)",
            )
        return value

    monkeypatch.setattr(subprocess, "check_output", changed)
    with pytest.raises(ValueError, match="chat integration"):
        compatible(baseline, candidate)


@pytest.mark.parametrize(
    "field,value",
    [
        ("answer_model", "other"),
        ("embedding_dimensions", 1536),
        ("rrf_k", 61),
        ("chunk_overlap_code_units", 281),
    ],
)
def test_reject_unrelated_config(field, value):
    baseline, candidate = pair()
    candidate["config"][field] = value
    with pytest.raises(ValueError, match="Unrelated"):
        compatible(baseline, candidate)


def test_reject_prompt_or_unknown_revision():
    baseline, candidate = pair()
    candidate["config"]["application_file_hashes"]["lib/rag-answer.ts"] = "0" * 64
    with pytest.raises(ValueError, match="Unrelated"):
        compatible(baseline, candidate)
    baseline, candidate = pair()
    candidate["config"]["reranking"]["revision"] = "latest"
    with pytest.raises(ValueError, match="declaration"):
        compatible(baseline, candidate)


@pytest.mark.parametrize("metric", ["recall@5", "faithfulness"])
@pytest.mark.parametrize("drop,passes", [(0.02, True), (0.020000001, False)])
def test_exact_regression_boundary(monkeypatch, metric, drop, passes):
    baseline, candidate = pair()
    monkeypatch.setattr("eval.reranking_gate.verify", lambda _: None)
    candidate["metrics"][metric] = baseline["metrics"][metric] - drop
    if passes:
        assert gate(baseline, candidate)["status"] == "PASS"
    else:
        with pytest.raises(ValueError, match="Regression"):
            gate(baseline, candidate)


def test_step5_gate_rejects_current_prompt_changes():
    baseline, candidate = pair()
    candidate["config"].update(configuration("top10"))
    with pytest.raises(ValueError, match="Unrelated"):
        compatible(baseline, candidate)
