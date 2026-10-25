import pytest

from eval.review_packet import check_entries, template, verify_packet


def sample(**overrides):
    values = {
        "F": "____",
        "C": "____",
        "Citation support": "____",
        "Substantive claims": "____",
        "Refusal behavior": "____",
        "Reason": "____",
        **overrides,
    }
    return "## R01\n\n" + "\n".join(f"{k}: {v}" for k, v in values.items())


CASE = [{"review_id": "R01", "citation_numbers": [1]}]


def test_partial_review_stays_pending():
    text = sample(F="1", C="unsure")
    assert check_entries(text, CASE) == {
        "fully_filled_case_ids": [],
        "pending_case_ids": ["R01"],
    }


def test_citation_existence_is_not_support_and_never_auto_approves():
    text = sample(
        F="0",
        C="0.5",
        **{
            "Citation support": "no",
            "Substantive claims": "yes",
            "Refusal behavior": "not_a_refusal",
            "Reason": "Synthetic test only; the cited source lacks the claim.",
        },
    )
    result = check_entries(text, CASE)
    assert result["fully_filled_case_ids"] == ["R01"]
    assert "confirmed" not in result
    assert "human_review" not in result
    assert template(text) == sample()


@pytest.mark.parametrize(
    "text",
    [sample(F="2"), sample(**{"Citation support": "yes,no"}), sample() + "\nF: 1"],
)
def test_malformed_labels_are_rejected(text):
    with pytest.raises(ValueError):
        check_entries(text, CASE)


def test_missing_citations_require_none_not_an_invented_occurrence():
    with pytest.raises(ValueError, match="citation entries mismatch"):
        check_entries(
            sample(**{"Citation support": "no"}),
            [{"review_id": "R01", "citation_numbers": []}],
        )


def test_all_packet_excerpts_are_exact_and_review_still_unconfirmed():
    result = verify_packet()
    assert result["exact_excerpts_checked"] == 28
    assert result["human_review"] == "NOT_CONFIRMED_BY_THIS_CHECK"
