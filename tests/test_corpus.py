"""Guard corpus isolation, integrity, and the mandatory dataset review boundary."""

import copy
import json

import pytest

from eval.corpus import ROOT, evaluation_url, load_corpus
from eval.validate_dataset import validate, validate_records
from scripts.ingest_corpus import validate_vectors


@pytest.fixture
def candidates():
    records = [
        json.loads(line)
        for line in (ROOT / "eval/golden_set.jsonl").read_text().splitlines()
    ]
    sources = {s["source_id"]: s for s in load_corpus()["sources"]}
    return copy.deepcopy(records), sources


def test_candidate_structure(candidates):
    records, sources = candidates
    result = validate_records(records, sources)
    assert result["records"] == 100
    assert result["types"] == {"easy": 60, "multi_hop": 20, "unanswerable": 20}
    assert result["documents"] == {"fastapi": 50, "postgresql": 50}


@pytest.mark.parametrize(
    "case",
    [
        "duplicate_id",
        "duplicate_question",
        "unknown_source",
        "wrong_document",
        "missing_support",
        "wrong_support",
        "false_human_status",
        "bad_type",
        "missing_answer",
        "one_hop",
        "unsupported_with_source",
        "too_short",
    ],
)
def test_invalid_candidates_rejected(candidates, case):
    records, sources = candidates
    if case == "duplicate_id":
        records[1]["id"] = records[0]["id"]
    elif case == "duplicate_question":
        records[1]["question"] = records[0]["question"].upper() + "!"
    elif case == "unknown_source":
        records[0]["relevant_source_ids"] = ["nonexistent"]
    elif case == "wrong_document":
        records[0]["document_key"] = "postgresql"
    elif case == "missing_support":
        records[0].pop("support_locations")
    elif case == "wrong_support":
        records[0]["support_locations"] = {
            "fastapi.path-params": ["fabricated evidence"]
        }
    elif case == "false_human_status":
        records[0]["review_status"] = "human_verified"
    elif case == "bad_type":
        records[0]["type"] = "unknown"
    elif case == "missing_answer":
        records[0]["reference_answer"] = " "
    elif case == "one_hop":
        records[0]["type"] = "multi_hop"
    elif case == "unsupported_with_source":
        records[0]["type"] = "unanswerable"
    elif case == "too_short":
        records.pop()
    with pytest.raises(ValueError):
        validate_records(records, sources)


def test_review_required_without_receipt(monkeypatch):
    from pathlib import Path

    original = Path.exists
    monkeypatch.setattr(
        Path,
        "exists",
        lambda p: False if p.name == "human_review.json" else original(p),
    )
    with pytest.raises(ValueError, match="Human review pending"):
        validate(ROOT / "eval/golden_set.jsonl", require_review=True)


@pytest.mark.parametrize(
    "vectors,count,dimensions",
    [
        ([[0.1]], 2, 1),
        ([[0.1]], 1, 2),
        ([[float("nan")]], 1, 1),
        ([[True]], 1, 1),
        ([[float("inf")]], 1, 1),
    ],
)
def test_invalid_embeddings_rejected(vectors, count, dimensions):
    with pytest.raises(ValueError):
        validate_vectors(vectors, count, dimensions)


@pytest.mark.parametrize(
    "url",
    [
        "postgresql://docrag:placeholder@remote.example:55432/docrag_dev",
        "postgresql://docrag:placeholder@127.0.0.1:5432/docrag_dev",
        "postgresql://docrag:placeholder@127.0.0.1:55432/production",
    ],
)
def test_evaluation_rejects_nonlocal_development_target(monkeypatch, url):
    monkeypatch.setattr("eval.corpus.load_environment", lambda: None)
    monkeypatch.setattr("eval.corpus.owned_cluster", lambda: None)
    monkeypatch.setattr("eval.corpus.database_url", lambda: url)
    with pytest.raises(ValueError, match="native development DB"):
        evaluation_url()
