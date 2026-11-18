"""Fail-closed controls for comparing frozen releases measured with local Ollama."""

import copy
import json
from pathlib import Path

import pytest

from eval import cross_version as comparison


def result(run="grounding-repair-a"):
    path = Path("eval/results/observability") / run / "evaluation.json"
    return json.loads(path.read_text())


@pytest.fixture(scope="module")
def current():
    return result()


@pytest.mark.parametrize("metric", ["recall@5", "faithfulness"])
def test_threshold_is_inclusive_and_uses_exact_decimals(metric):
    scores = {k: {"decrease": "0"} for k in ("recall@5", "faithfulness")}
    scores[metric]["decrease"] = "0.020000000000"
    assert comparison.numerical_pass(scores)
    scores[metric]["decrease"] = "0.020000000001"
    assert not comparison.numerical_pass(scores)


def test_verified_historical_instrumentation_is_narrow(current):
    older = result("step9-prerequisite-b")
    changes = comparison.comparable(older, current)
    assert {k for k, (old, _) in changes.items() if old is None} == (
        comparison.REGISTERED_FILES
    )
    del older["config"]["application_file_hashes"]["lib/rag.ts"]
    with pytest.raises(ValueError, match="Different evaluator"):
        comparison.comparable(older, current)


@pytest.mark.parametrize(
    "keys",
    [
        ("config", "answer_model"),
        ("config", "answer_options"),
        ("evaluator_file_hashes", "eval/metrics.py"),
        ("evaluation_validation", "validator_file_hashes"),
        ("metric_definitions", "version"),
        ("dataset_sha256",),
    ],
)
def test_incompatible_measurement_rejected(current, keys):
    changed = copy.deepcopy(current)
    section = changed
    for key in keys[:-1]:
        section = section[key]
    section[keys[-1]] = "different"
    with pytest.raises(ValueError):
        comparison.comparable(current, changed)


def test_measurement_blob_must_match_git_bytes(tmp_path, monkeypatch):
    monkeypatch.setattr(comparison, "ROOT", tmp_path)
    path = tmp_path / "eval/results/record.json"
    path.parent.mkdir(parents=True)
    path.write_bytes(b"edited")
    monkeypatch.setattr(
        comparison.subprocess, "check_output", lambda *a, **kw: b"saved"
    )
    with pytest.raises(ValueError, match="Uncommitted"):
        comparison.immutable_bytes(path)
    with pytest.raises(ValueError, match="under eval/results"):
        comparison.immutable_bytes(tmp_path / "record.json")


def test_cache_disclosure_checked_per_question_and_in_total(current):
    receipt = copy.deepcopy(current)
    assert comparison.verified_cache(receipt)["judge_misses"] == 100
    receipt["cache_statistics"]["judge_misses"] = 99
    with pytest.raises(ValueError, match="aggregate"):
        comparison.verified_cache(receipt)
    receipt["questions"][0]["cache"]["judge_hits"] = 1
    with pytest.raises(ValueError, match="per-question"):
        comparison.verified_cache(receipt)
    receipt["questions"][0]["cache"]["unknown"] = 0
    with pytest.raises(ValueError, match="inventory"):
        comparison.verified_cache(receipt)
