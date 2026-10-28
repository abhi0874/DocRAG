import copy
import json

import pytest

from eval.corpus import ROOT
from eval.reranking_experiments import configuration
from eval.reranking_gate import compatible, gate


def pair():
    baseline = json.loads((ROOT / "eval/results/retrieval-selected.json").read_text())
    candidate = copy.deepcopy(baseline)
    candidate["config"].update(configuration("top10"))
    return baseline, candidate


def test_declared_reranking_only():
    assert compatible(*pair())["reranking"]["enabled"]


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
