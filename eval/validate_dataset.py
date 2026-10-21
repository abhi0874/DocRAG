"""Validate candidates mechanically; semantic quality still requires human review."""

import argparse
import json
import re
from collections import Counter
from difflib import SequenceMatcher
from pathlib import Path

from eval.corpus import ROOT, load_corpus, sha256

TYPES = {"easy", "multi_hop", "unanswerable"}
PENDING = "ai_generated_pending_human_review"


def normalized(text):
    return re.sub(r"\W+", " ", text.casefold()).strip()


def validate_records(records, sources):
    if not 100 <= len(records) <= 150:
        raise ValueError("Dataset must contain 100–150 records")
    ids, questions = set(), set()
    for r in records:
        if not isinstance(r, dict):
            raise ValueError("Every record must be an object")
        for key in (
            "id",
            "question",
            "reference_answer",
            "source_section",
            "type",
            "document_key",
            "review_status",
        ):
            if not isinstance(r.get(key), str) or not r[key].strip():
                raise ValueError(f"Missing/non-string/empty field: {key}")
        if r["id"] in ids or normalized(r["question"]) in questions:
            raise ValueError("Duplicate ID or normalized question")
        ids.add(r["id"])
        questions.add(normalized(r["question"]))
        if r["type"] not in TYPES:
            raise ValueError("Invalid question type")
        if r["document_key"] not in {s["document_key"] for s in sources.values()}:
            raise ValueError("Invalid document key")
        # Review is stored in a separate hash-bound receipt, never guessed from data.
        if r["review_status"] != PENDING:
            raise ValueError(
                "Candidate review status must not claim human verification"
            )
        refs = r.get("relevant_source_ids")
        if not isinstance(refs, list) or any(not isinstance(s, str) for s in refs):
            raise ValueError("Relevant source IDs must be a list of strings")
        if len(refs) != len(set(refs)) or any(s not in sources for s in refs):
            raise ValueError("Duplicate or unknown source reference")
        if any(sources[s]["document_key"] != r["document_key"] for s in refs):
            raise ValueError("Reference outside the selected document")
        if r.get("reference_urls") != [sources[s]["url"] for s in refs]:
            raise ValueError("Source URLs do not match the manifest")
        if r["type"] == "easy" and len(refs) != 1:
            raise ValueError("Easy questions require one source")
        if r["type"] == "multi_hop" and len(refs) < 2:
            raise ValueError("Multi-hop questions require multiple supporting sources")
        if r["type"] == "unanswerable":
            if (
                refs
                or r["reference_answer"] != "I could not find this in the document."
            ):
                raise ValueError("Unanswerable record must have no relevance labels")
            if (
                not isinstance(r.get("unsupported_reason"), str)
                or not r["unsupported_reason"]
            ):
                raise ValueError("Unanswerable question needs an absence explanation")
        else:
            if r["source_section"] != " + ".join(sources[s]["section"] for s in refs):
                raise ValueError("Source section titles do not match the manifest")
            evidence = r.get("support_locations")
            if not isinstance(evidence, dict) or set(evidence) != set(refs):
                raise ValueError("Missing supporting locations")
            for source_id, terms in evidence.items():
                text = (
                    ROOT / "eval/corpus" / sources[source_id]["text_file"]
                ).read_text()
                if (
                    not isinstance(terms, list)
                    or not terms
                    or any(
                        not isinstance(term, str)
                        or not term.strip()
                        or term not in text
                        for term in terms
                    )
                ):
                    raise ValueError("Supporting location not found in pinned source")
    if {r["type"] for r in records} != TYPES:
        raise ValueError("All question types must be represented")
    if {r["document_key"] for r in records} != {"fastapi", "postgresql"}:
        raise ValueError("Both documentation sources must be represented")
    near = []
    for i, left in enumerate(records):
        for right in records[i + 1 :]:
            ratio = SequenceMatcher(
                None, normalized(left["question"]), normalized(right["question"])
            ).ratio()
            if ratio >= 0.88:
                near.append([left["id"], right["id"], ratio])
    return {
        "records": len(records),
        "types": dict(Counter(r["type"] for r in records)),
        "documents": dict(Counter(r["document_key"] for r in records)),
        "near_duplicate_candidates": near,
    }


def validate(path, require_review=False):
    manifest = load_corpus()
    raw = path.read_bytes()
    records = [json.loads(line) for line in raw.decode().splitlines()]
    result = validate_records(records, {s["source_id"]: s for s in manifest["sources"]})
    result.update(
        {
            "dataset_sha256": sha256(raw),
            "corpus_hash": manifest["corpus_hash"],
            "human_review": "pending",
            "semantic_validation": "AI-assisted only",
        }
    )
    receipt_path = ROOT / "eval/human_review.json"
    if receipt_path.exists():
        receipt = json.loads(receipt_path.read_text())
        if (
            receipt.get("dataset_sha256") != sha256(raw)
            or receipt.get("corpus_hash") != manifest["corpus_hash"]
            or receipt.get("reviewed_ids") != [r["id"] for r in records]
            or receipt.get("status") != "human_confirmed"
            or not receipt.get("confirmation")
            or not receipt.get("confirmed_at")
        ):
            raise ValueError("Human review receipt does not cover the exact dataset")
        result["human_review"] = "confirmed"
        result["semantic_validation"] = "human-confirmed candidates; hash-bound receipt"
    if require_review and result["human_review"] != "confirmed":
        raise ValueError("Human review pending: read eval/REVIEW_NEEDED.md")
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--golden", type=Path, default=ROOT / "eval/golden_set.jsonl")
    parser.add_argument("--require-review", action="store_true")
    args = parser.parse_args()
    try:
        print(json.dumps(validate(args.golden, args.require_review), indent=2))
    except (ValueError, OSError, KeyError, TypeError) as exc:
        parser.exit(1, f"Dataset validation failed: {exc}\n")


if __name__ == "__main__":
    main()
