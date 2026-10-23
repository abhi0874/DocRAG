"""Independent hand-computed metric and regression boundary examples."""

import copy

import pytest

from eval.check_regression import check
from eval.corpus import canonical, sha256
from eval.judge import validate_judgment
from eval.metrics import (
    citation_counts,
    citations,
    percentile,
    recall_at_k,
    reciprocal_rank,
)


@pytest.mark.parametrize("k,expected", [(3, 1 / 3), (5, 2 / 3), (10, 1)])
def test_recall_multiple_sources_at_actual_chunk_ranks(k, expected):
    ranked = ["x", "a", "a", "b", "b", "x", "x", "x", "x", "c"]
    assert recall_at_k(ranked, ["a", "b", "c"], k) == expected


def test_mrr_rank_two_is_one_half():
    assert reciprocal_rank(["wrong", "right", "other"], ["right"]) == 0.5


def test_duplicates_do_not_increase_recall_or_compress_ranks():
    assert recall_at_k(["x", "x", "a", "b"], ["a", "a", "b"], 3) == 0.5
    assert reciprocal_rank(["x", "x", "a"], ["a", "b"]) == 1 / 3


def test_empty_results_and_no_relevant_hit():
    assert recall_at_k([], ["a"], 5) == 0
    assert reciprocal_rank([], ["a"]) == 0
    assert reciprocal_rank(["b"], ["a"]) == 0


def test_unanswerable_is_excluded_not_a_zero_score():
    assert recall_at_k(["x"], [], 5, "unanswerable") is None
    assert reciprocal_rank(["x"], [], "unanswerable") is None
    with pytest.raises(ValueError):
        recall_at_k([], [], 5)
    with pytest.raises(ValueError):
        reciprocal_rank([], [])


def test_citations_require_semantic_support_and_valid_bounds():
    # Two of four occurrences support their claim; [9] cannot be valid in 2 excerpts.
    assert citations("A [1]. B [2][2]. Invented [9].") == [1, 2, 2, 9]
    assert citation_counts(
        [1, 2, 2, 9], [True, False, True, True], 2, "multi_hop", 0.5, True
    ) == (2, 4)


def test_missing_citations_and_correct_uncited_refusal():
    assert citation_counts([], [], 6, "easy", 1, True) == (0, 1)
    assert citation_counts([], [], 6, "easy", 0, False) == (0, 1)
    assert citation_counts([], [], 6, "unanswerable", 1, False) == (0, 0)
    assert citation_counts([], [], 6, "unanswerable", 0, True) == (0, 1)


def test_incomplete_citation_judgments_are_errors():
    with pytest.raises(ValueError):
        citation_counts([1], [], 2, "easy", 1, True)


def test_percentiles_are_linear_interpolation():
    assert percentile([10, 20, 30, 40, 50], 0.5) == 30
    assert percentile([10, 20, 30, 40, 50], 0.95) == 48


@pytest.fixture
def result():
    return {
        "config": {"provider": "test", "model": "fixed"},
        "config_sha256": sha256(canonical({"provider": "test", "model": "fixed"})),
        "status": "complete",
        "human_review": "confirmed",
        "dataset_sha256": "a" * 64,
        "corpus_hash": "b" * 64,
        "metric_definitions": {"version": "test-v1"},
        "metrics": {"recall@5": 0.8, "faithfulness": 0.9},
    }


@pytest.mark.parametrize("metric", ["recall@5", "faithfulness"])
def test_exact_threshold_passes_and_larger_drop_fails(result, metric):
    current = copy.deepcopy(result)
    current["metrics"][metric] = 0.78 if metric == "recall@5" else 0.88
    assert check(result, current)[metric] == "0.02"
    current["metrics"][metric] -= 0.000000000001
    with pytest.raises(ValueError, match="Regression"):
        check(result, current)


@pytest.mark.parametrize(
    "value", [None, "0.9", True, float("nan"), float("inf"), -1, 2]
)
def test_invalid_metrics_fail_closed(result, value):
    current = copy.deepcopy(result)
    current["metrics"]["faithfulness"] = value
    with pytest.raises(ValueError):
        check(result, current)


def test_missing_metric_is_not_a_pass(result):
    current = copy.deepcopy(result)
    del current["metrics"]["recall@5"]
    with pytest.raises(ValueError):
        check(result, current)


@pytest.mark.parametrize(
    "field", ["dataset_sha256", "corpus_hash", "metric_definitions"]
)
def test_incompatible_provenance_rejected(result, field):
    current = copy.deepcopy(result)
    current[field] = (
        {"version": "different"} if field == "metric_definitions" else "c" * 64
    )
    with pytest.raises(ValueError):
        check(result, current)


def test_missing_provenance_and_provisional_results_rejected(result):
    current = copy.deepcopy(result)
    current["human_review"] = "pending"
    with pytest.raises(ValueError):
        check(result, current)
    del current["corpus_hash"]
    with pytest.raises(ValueError):
        check(result, current)


def test_judge_rejects_bool_score_missing_judgments_and_out_of_range():
    good = {
        "faithfulness": 1,
        "correctness": 0.5,
        "rationale": "Evidence is incomplete.",
        "substantive_claims": True,
        "citation_support": [
            {"occurrence": 0, "supported": True, "reason": "Supported."}
        ],
    }
    assert validate_judgment(good, [1], 1) == good
    bad = copy.deepcopy(good)
    bad["faithfulness"] = True
    with pytest.raises(ValueError):
        validate_judgment(bad, [1], 1)
    with pytest.raises(ValueError):
        validate_judgment(good, [2], 1)
    with pytest.raises(ValueError):
        validate_judgment(good, [1, 2], 2)


@pytest.mark.parametrize(
    "mutation", ["missing", "changed", "invalid_hash", "unreviewed_judge"]
)
def test_config_and_judge_compatibility_fail_closed(result, mutation):
    current = copy.deepcopy(result)
    if mutation == "missing":
        del current["config"]
    elif mutation == "changed":
        current["config"]["model"] = "another"
        current["config_sha256"] = sha256(canonical(current["config"]))
    elif mutation == "invalid_hash":
        current["config_sha256"] = "0" * 64
    else:
        current["config"]["provider"] = "ollama"
        current["config_sha256"] = sha256(canonical(current["config"]))
        current["judge_calibration"] = {"human_review": "pending"}
    with pytest.raises(ValueError):
        check(result, current)
