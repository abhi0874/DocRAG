"""Replay the public join case offline, preserving the meaning of repeated citations."""

import json
from pathlib import Path

import pytest

from eval.metrics import citation_counts, citations

RESULTS = Path(__file__).resolve().parents[1] / "eval/results/observability"


@pytest.mark.parametrize(
    ("artifact", "expected"),
    [
        (
            "prerelease-qa-a/evaluation-raw.json",
            [
                (158, True),
                (157, True),
                (160, False),
                (159, False),
                (158, False),
                (157, False),
            ],
        ),
        ("grounding-repair-a/evaluation.json", [(158, True), (157, True)]),
    ],
)
def test_each_join_citation_retains_its_own_support_judgment(artifact, expected):
    result = json.loads((RESULTS / artifact).read_text())
    row = next(q for q in result["questions"] if q["id"] == "postgresql-037")
    passages = row["ranked_chunks"][: row["answer_context_count"]]
    assert len(passages) == 6
    assert all(p["source_id"] == "postgresql.tutorial-join" for p in passages)
    assert row["ranked_chunks"][9]["source_id"] == "postgresql.ddl-constraints"

    numbers = citations(row["answer"])
    judgments = row["judge_detail"]["citation_support"]
    occurrences = []
    for index, (number, judgment) in enumerate(zip(numbers, judgments, strict=True)):
        assert judgment["occurrence"] == index
        assert 1 <= number <= len(passages)
        occurrences.append((passages[number - 1]["id"], judgment["supported"]))
    assert occurrences == expected

    counts = citation_counts(
        numbers,
        [supported for _, supported in expected],
        len(passages),
        row["type"],
        row["correctness"],
        row["judge_detail"]["substantive_claims"],
    )
    assert counts == (row["citation_supported"], row["citation_denominator"])
