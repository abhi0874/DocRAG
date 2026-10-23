"""Human calibration approval is never inferred from AI-generated proposals."""

import json

import pytest

from eval.corpus import sha256
from eval.local_calibration import review_status


def test_missing_human_receipt_stays_pending(tmp_path, monkeypatch):
    monkeypatch.setattr("eval.local_calibration.DIRECTORY", tmp_path)
    assert review_status() == "pending"


def test_stale_human_receipt_fails(tmp_path, monkeypatch):
    monkeypatch.setattr("eval.local_calibration.DIRECTORY", tmp_path)
    (tmp_path / "cases.json").write_text("[]")
    (tmp_path / "human_review.json").write_text(
        json.dumps({"confirmed": True, "cases_sha256": "0" * 64})
    )
    with pytest.raises(ValueError, match="stale"):
        review_status()


def test_only_explicit_hash_bound_receipt_confirms(tmp_path, monkeypatch):
    monkeypatch.setattr("eval.local_calibration.DIRECTORY", tmp_path)
    (tmp_path / "cases.json").write_text("[]")
    (tmp_path / "human_review.json").write_text(
        json.dumps({"confirmed": True, "cases_sha256": sha256(b"[]")})
    )
    assert review_status() == "confirmed"
