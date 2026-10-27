"""Retrieval-only comparison must reject unrelated changes and quality losses."""

import copy
import json
import subprocess

import pytest

from eval.corpus import ROOT
from eval.retrieval_experiments import configuration
from eval.retrieval_gate import compatible, gate


def pair():
    baseline = json.loads((ROOT / "eval/results/chunking-selected.json").read_text())
    candidate = copy.deepcopy(baseline)
    candidate["config"].update(configuration("control"))
    candidate["git_revision"] = subprocess.check_output(
        ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True
    ).strip()
    return baseline, candidate


def test_retrieval_compatibility_preserves_frozen_models_and_chunking():
    baseline, candidate = pair()
    assert compatible(baseline, candidate)["intended_difference"] == "control"


@pytest.mark.parametrize(
    "field,value",
    [
        ("answer_model", "other"),
        ("chunk_overlap_code_units", 281),
        ("cache_policy", "unsafe"),
        ("embedding_dimensions", 1536),
    ],
)
def test_retrieval_gate_rejects_unrelated_config(field, value):
    baseline, candidate = pair()
    candidate["config"][field] = value
    with pytest.raises(ValueError, match="Unrelated"):
        compatible(baseline, candidate)


def test_retrieval_gate_rejects_undeclared_code_and_candidate_counts():
    baseline, candidate = pair()
    candidate["config"]["application_file_hashes"]["lib/rag-answer.ts"] = "0" * 64
    with pytest.raises(ValueError, match="Unrelated application"):
        compatible(baseline, candidate)
    baseline, candidate = pair()
    candidate["config"]["rrf_k"] = 61
    with pytest.raises(ValueError, match="counts/RRF"):
        compatible(baseline, candidate)


def test_retrieval_gate_rejects_prompt_edits_inside_extracted_file(monkeypatch):
    baseline, candidate = pair()
    original = subprocess.check_output

    def changed(args, **kwargs):
        value = original(args, **kwargs)
        if args[-1] == candidate["git_revision"] + ":lib/rag.ts":
            return value.replace(b"Be concise and direct.", b"Invent missing details.")
        return value

    monkeypatch.setattr(subprocess, "check_output", changed)
    with pytest.raises(ValueError, match="answer prompt"):
        compatible(baseline, candidate)


@pytest.mark.parametrize("metric", ["recall@5", "faithfulness"])
def test_retrieval_gate_keeps_strict_quality_boundary(monkeypatch, metric):
    baseline, candidate = pair()
    # Test the gate's threshold delegation independently of artifact validation.
    monkeypatch.setattr("eval.retrieval_gate.verify", lambda result: None)
    candidate["metrics"][metric] = baseline["metrics"][metric] - 0.020000001
    with pytest.raises(ValueError, match="Regression"):
        gate(baseline, candidate)
