"""Verify cache provenance and that invalid judgments never become passing scores."""

import json

import pytest

from eval.judge import judge


def reply():
    return {
        "text": json.dumps(
            {
                "faithfulness": 1,
                "correctness": 1,
                "rationale": "The excerpt supports the answer.",
                "substantive_claims": True,
                "citation_support": [
                    {
                        "occurrence": 0,
                        "supported": True,
                        "reason": "The stated fact is present.",
                    }
                ],
            }
        ),
        "usage": {"totalTokens": 50},
        "latency_ms": 123,
    }


def inputs():
    return (
        {"question": "What is X?", "reference_answer": "X is Y.", "type": "easy"},
        "X is Y. [1]",
        [{"content": "X is Y.", "source_id": "s", "pageNumber": 1}],
        [{"source_id": "s", "text": "X is Y."}],
        "test-model",
        {"corpus": "v1"},
    )


@pytest.mark.parametrize(
    "change", ["answer", "context", "model", "config", "reference"]
)
def test_cache_reuse_and_input_invalidation(tmp_path, monkeypatch, change):
    monkeypatch.setattr("eval.judge.ROOT", tmp_path)
    calls = []
    monkeypatch.setattr("eval.judge.call_adapter", lambda p: calls.append(p) or reply())
    args = list(inputs())
    assert judge(*args)[1] is False
    assert judge(*args)[1] is True
    assert len(calls) == 1
    if change == "answer":
        args[1] = "X is also Y. [1]"
    elif change == "context":
        args[2][0]["content"] += " Extra context."
    elif change == "model":
        args[4] = "different-model"
    elif change == "config":
        args[5] = {"corpus": "v2"}
    elif change == "reference":
        args[0]["reference_answer"] += " More required detail."
    assert judge(*args)[1] is False
    assert len(calls) == 2


def test_invalid_outputs_exhaust_retries_without_cache(tmp_path, monkeypatch):
    monkeypatch.setattr("eval.judge.ROOT", tmp_path)
    calls, delays = [], []
    monkeypatch.setattr("eval.judge.time.sleep", delays.append)
    monkeypatch.setattr(
        "eval.judge.call_adapter",
        lambda p: calls.append(p)
        or {"text": '{"faithfulness":1}', "usage": {"totalTokens": 1}},
    )
    with pytest.raises(ValueError, match="invalid after 3 attempts"):
        judge(*inputs())
    assert len(calls) == 3
    assert delays == [2, 4]
    assert not list(tmp_path.rglob("*.json"))
