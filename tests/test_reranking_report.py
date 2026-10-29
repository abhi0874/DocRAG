import json

import pytest

from eval.reranking_experiments import DIRECTORY
from eval.reranking_report import profiles, verify_profile


def test_frozen_profile_evidence_and_selection():
    result = profiles()
    assert result["selected"] == "control"
    assert result["development"]["top20"]["actual_candidate_counts"] == [12]


@pytest.mark.parametrize("corruption", ["source", "order", "score", "coverage", "code"])
def test_profile_rejects_corruption(corruption):
    data = json.loads((DIRECTORY / "top10-development.json").read_text())
    row = data["rows"][0]
    if corruption == "source":
        row["ranked"][0]["content"] = "Invented source text"
    elif corruption == "order":
        row["ranked"].reverse()
    elif corruption == "score":
        row["ranked"][0]["rerankerScore"] = float("nan")
    elif corruption == "coverage":
        data["rows"].pop()
    else:
        data["config"]["application_file_hashes"]["lib/rerank.ts"] = "0" * 64
    with pytest.raises(ValueError):
        verify_profile(data)
