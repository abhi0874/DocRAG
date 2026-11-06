import json
import shutil

import pytest

from eval import fresh_review


@pytest.fixture
def packet_copy(tmp_path, monkeypatch):
    directory = tmp_path / "fresh"
    shutil.copytree(fresh_review.DIRECTORY, directory)
    # Unit tests must not require or publish the operator's withheld metadata.
    # Keep the real public packet/corpus; isolate only the private hash fixture.
    shutil.copytree(fresh_review.ROOT / "eval/corpus", tmp_path / "eval/corpus")
    metadata = tmp_path / ".local/fresh-calibration-internal.json"
    metadata.parent.mkdir()
    metadata.write_text('{"fixture": "synthetic; no review labels"}')
    manifest_path = directory / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    manifest["withheld_metadata_sha256"] = fresh_review.sha256(metadata.read_bytes())
    manifest_path.write_text(json.dumps(manifest))
    monkeypatch.setattr(fresh_review, "ROOT", tmp_path)
    monkeypatch.setattr(fresh_review, "DIRECTORY", directory)
    return directory


def test_saved_packet_evidence_and_no_automatic_approval(packet_copy):
    cases, result = fresh_review.verify()
    assert len(cases) == 14
    assert result["evidence_check"] == "PASS"
    assert result["baseline_approved"] is False


def test_partial_entries_stay_pending(packet_copy):
    path = packet_copy / "human-labels.json"
    data = json.loads(path.read_text())
    row = data["cases"][0]
    for key in row:
        if key != "id":
            row[key] = None
    row["faithfulness"] = 0.5
    path.write_text(json.dumps(data))
    _, result = fresh_review.verify()
    assert row["id"] in result["pending_case_ids"]
    assert result["baseline_approved"] is False


@pytest.mark.parametrize("bad_score", [True, 2, "1"])
def test_invalid_scores_fail(packet_copy, bad_score):
    path = packet_copy / "human-labels.json"
    data = json.loads(path.read_text())
    data["cases"][0]["faithfulness"] = bad_score
    path.write_text(json.dumps(data))
    with pytest.raises(ValueError, match="Invalid human score"):
        fresh_review.verify()


def test_frozen_evidence_cannot_change_silently(packet_copy):
    path = packet_copy / "packet.json"
    data = json.loads(path.read_text())
    data["cases"][0]["retrieved_evidence"][0]["content"] = "Altered evidence"
    path.write_text(json.dumps(data))
    with pytest.raises(ValueError, match="Frozen packet/rubric/criteria changed"):
        fresh_review.verify()


def test_withheld_metadata_tampering_is_rejected(packet_copy):
    manifest = json.loads((packet_copy / "manifest.json").read_text())
    metadata = fresh_review.ROOT / manifest["withheld_metadata_location"]
    metadata.write_text("changed private fixture")
    with pytest.raises(ValueError, match="Withheld metadata changed"):
        fresh_review.verify()
