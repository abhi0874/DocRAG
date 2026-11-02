"""Refusal summaries must not invent retrieval or citation denominators."""

import json

from eval.corpus import ROOT
from eval.prompting_report import rates


def test_unanswerable_subset_needs_no_retrieval_population():
    baseline = json.loads((ROOT / "eval/results/reranking-selected.json").read_text())
    result = rates(baseline["questions"])
    assert result["appropriate_refusal"] == {
        "numerator": 20,
        "denominator": 20,
        "rate": 1,
    }
    assert result["incorrect_full_refusal"]["denominator"] == 80
    assert result["unsupported_answer"]["denominator"] == 100
    subset = result["unanswerable_quality"]
    assert subset["questions"] == 20
    assert subset["faithfulness"] == subset["correctness"] == 1
    assert subset["citation_denominator"] == 0
    assert subset["citation_accuracy"] is None
    assert set(result["partially_correct_ids"]) == {
        "postgresql-005",
        "postgresql-037",
    }
