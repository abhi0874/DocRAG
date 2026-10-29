"""Exercise removal only on pytest-owned temporary fixtures, never real weights."""

import json
import sys

import pytest

from scripts import reranker_setup


def fixture_target(monkeypatch, tmp_path):
    target = tmp_path / "reranker"
    target.mkdir()
    monkeypatch.setattr(reranker_setup, "TARGET", target)
    monkeypatch.setattr(reranker_setup, "ROOT", tmp_path)
    monkeypatch.setattr(sys, "argv", ["reranker_setup", "--remove"])
    return target


def test_remove_owned_temporary_install_and_residuals(monkeypatch, tmp_path):
    target = fixture_target(monkeypatch, tmp_path)
    (target / "owner.json").write_text(
        json.dumps({"project": str(tmp_path), "directory": str(target)})
    )
    for directory in ("env", "model", "cache", "tmp"):
        (target / directory).mkdir()
        (target / directory / "fixture").write_text("temporary fixture")
    sibling = tmp_path / "database-placeholder"
    sibling.write_text("preserve")
    reranker_setup.main()
    assert not target.exists()
    assert sibling.read_text() == "preserve"


def test_refuse_unowned_directory(monkeypatch, tmp_path):
    target = fixture_target(monkeypatch, tmp_path)
    with pytest.raises(ValueError, match="ownership marker"):
        reranker_setup.main()
    assert target.exists()


def test_refuse_symlinked_install(monkeypatch, tmp_path):
    target = fixture_target(monkeypatch, tmp_path)
    link = tmp_path / "link"
    link.symlink_to(target, target_is_directory=True)
    monkeypatch.setattr(reranker_setup, "TARGET", link)
    with pytest.raises(ValueError, match="symlinked"):
        reranker_setup.main()
    assert target.exists()
