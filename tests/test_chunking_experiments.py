"""Selection and compatibility regressions independent of model quality."""

import copy
import json

import pytest

from eval.chunking_experiments import MATRIX, expected_chunks, split_questions
from eval.chunking_gate import compatible
from eval.corpus import ROOT


def test_split_is_complete_stratified_and_disjoint():
    rows, split = split_questions()
    assert len(split["development"]) == 60
    assert len(split["holdout"]) == 40
    assert set(split["development"]).isdisjoint(split["holdout"])
    for key in ("fastapi", "postgresql"):
        for kind, count in [("easy", 18), ("multi_hop", 6), ("unanswerable", 6)]:
            assert (
                sum(
                    r["document_key"] == key
                    and r["type"] == kind
                    and r["id"] in split["development"]
                    for r in rows
                )
                == count
            )


def test_control_reproduces_saved_source_hashes():
    actual = expected_chunks("control-1000-200")
    saved = json.loads((ROOT / ".local/ollama-corpus-map.json").read_text())["chunks"]
    assert len(actual) == len(saved) == 151
    fields = [
        "document_id",
        "source_id",
        "chunk_index",
        "page_number",
        "content_sha256",
    ]
    assert [[r[k] for k in fields] for r in actual] == [
        [r[k] for k in fields] for r in saved
    ]


@pytest.mark.parametrize(
    "field,value",
    [
        ("rrf_k", 50),
        ("answer_model", "different"),
        ("embedding_dimensions", 1536),
        ("cache_policy", "unsafe"),
    ],
)
def test_gate_rejects_unrelated_configuration(field, value):
    baseline = json.loads(
        (ROOT / "eval/results/baseline-local-ollama.json").read_text()
    )
    candidate = copy.deepcopy(baseline)
    candidate["config"].update(
        chunking_experiment="heading-1400-280",
        chunking=MATRIX["heading-1400-280"],
        chunk_size_code_units=1400,
        chunk_overlap_code_units=280,
    )
    candidate["config"][field] = value
    with pytest.raises(ValueError, match="Unrelated"):
        compatible(baseline, candidate)


def test_gate_rejects_undeclared_file_change():
    baseline = json.loads(
        (ROOT / "eval/results/baseline-local-ollama.json").read_text()
    )
    candidate = copy.deepcopy(baseline)
    candidate["config"].update(
        chunking_experiment="heading-1400-280",
        chunking=MATRIX["heading-1400-280"],
        chunk_size_code_units=1400,
        chunk_overlap_code_units=280,
    )
    candidate["config"]["application_file_hashes"]["lib/rag-answer.ts"] = "0" * 64
    with pytest.raises(ValueError, match="Undeclared"):
        compatible(baseline, candidate)


def test_declared_chunking_compatibility_preserves_retrieval_code(monkeypatch):
    import subprocess

    baseline = json.loads(
        (ROOT / "eval/results/baseline-local-ollama.json").read_text()
    )
    # This contract tests the frozen Step 3 change, not arbitrary later HEADs.
    candidate = json.loads((ROOT / "eval/results/chunking-selected.json").read_text())
    assert compatible(baseline, candidate)["declared_chunking"] == "heading-1400-280"
    original = subprocess.check_output

    def changed(args, **kwargs):
        value = original(args, **kwargs)
        if args[-1] == candidate["git_revision"] + ":lib/rag.ts":
            return value.replace(b"const K = 60", b"const K = 61")
        return value

    monkeypatch.setattr(subprocess, "check_output", changed)
    with pytest.raises(ValueError, match="Retrieval"):
        compatible(baseline, candidate)
