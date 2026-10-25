"""Check review evidence and partial entries without granting human approval."""

import json
import re

from eval.corpus import ROOT, sha256

DIRECTORY = ROOT / "eval/calibration"
FIELDS = (
    "F",
    "C",
    "Citation support",
    "Substantive claims",
    "Refusal behavior",
    "Reason",
)
METADATA = ("Reviewer name", "Previously saw proposed labels", "Review date")


def template(text):
    names = "|".join(re.escape(s) for s in (*FIELDS, *METADATA))
    return re.sub(rf"^({names}): .*?$", r"\1: ____", text, flags=re.MULTILINE)


def check_entries(text, cases):
    blocks = re.split(r"^## (R\d{2})\s*$", text, flags=re.MULTILINE)
    if blocks[1::2] != [c["review_id"] for c in cases]:
        raise ValueError("Review IDs/order changed")
    complete, pending = [], []
    for case, block in zip(cases, blocks[2::2], strict=True):
        values = {}
        for field in FIELDS:
            matches = re.findall(rf"^{re.escape(field)}: (.*)$", block, re.MULTILINE)
            if len(matches) != 1:
                raise ValueError(f"{case['review_id']}: missing/duplicate {field}")
            values[field] = matches[0].strip()
        for field, value in values.items():
            if value in ("", "____", "unsure"):
                continue
            choices = {
                "F": {"0", "0.5", "1"},
                "C": {"0", "0.5", "1"},
                "Substantive claims": {"yes", "no"},
                "Refusal behavior": {"appropriate", "inappropriate", "not_a_refusal"},
            }
            if field in choices and value not in choices[field]:
                raise ValueError(f"{case['review_id']}: invalid {field}")
            if field == "Citation support":
                entries = [v.strip() for v in value.split(",")]
                count = len(case["citation_numbers"])
                valid = (
                    value == "none"
                    if count == 0
                    else len(entries) == count and set(entries) <= {"yes", "no"}
                )
                if not valid:
                    raise ValueError(f"{case['review_id']}: citation entries mismatch")
        target = (
            pending
            if any(v in ("", "____", "unsure") for v in values.values())
            else complete
        )
        target.append(case["review_id"])
    return {"fully_filled_case_ids": complete, "pending_case_ids": pending}


def verify_packet():
    raw = (DIRECTORY / "review-packet.json").read_bytes()
    packet = json.loads(raw)
    mapping = json.loads((DIRECTORY / "review-packet-map.json").read_text())
    if (
        sha256(raw) != mapping["packet_sha256"]
        or sha256((DIRECTORY / "cases.json").read_bytes())
        != mapping["historical_cases_sha256"]
    ):
        raise ValueError("Packet or historical case hash mismatch")
    cases = packet["cases"]
    if len(cases) != 14 or len({c["review_id"] for c in cases}) != 14:
        raise ValueError("Expected 14 unique review cases")
    for case in cases:
        for evidence in case["retrieved_evidence"]:
            path = (ROOT / evidence["source_file"]).resolve()
            if not path.is_relative_to((ROOT / "eval/corpus").resolve()):
                raise ValueError("Evidence must come from the saved public corpus")
            data = path.read_bytes()
            lines = data.decode().splitlines()
            excerpt = "\n".join(
                lines[evidence["start_line"] - 1 : evidence["end_line"]]
            )
            if (
                sha256(data) != evidence["source_sha256"]
                or excerpt != evidence["content"]
            ):
                raise ValueError("Source hash/exact excerpt mismatch")
    text = (DIRECTORY / "HUMAN_REVIEW.md").read_text()
    if sha256(template(text).encode()) != mapping["review_template_sha256"]:
        raise ValueError("Review content changed outside the editable label fields")
    progress = check_entries(text, cases)
    return {
        "packet_evidence": "PASS",
        "case_count": len(cases),
        "exact_excerpts_checked": sum(len(c["retrieved_evidence"]) for c in cases),
        **progress,
        "human_review": "NOT_CONFIRMED_BY_THIS_CHECK",
        "note": "Read-only format/provenance check; "
        "filled fields never auto-approve labels.",
    }


if __name__ == "__main__":
    try:
        print(json.dumps(verify_packet(), indent=2))
    except (ValueError, OSError, KeyError, TypeError) as exc:
        raise SystemExit(f"Review packet check failed: {exc}") from None
