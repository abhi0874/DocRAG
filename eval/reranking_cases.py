"""Diagnostic answer/evidence checks; never used to tune frozen selection."""

import subprocess

from eval.corpus import CORPUS, ROOT, load_corpus, sha256
from eval.judge import judge
from eval.reranking_experiments import DIRECTORY, configuration
from eval.retrieval_experiments import configuration as original_configuration
from eval.retrieval_experiments import inputs, save
from eval.runtime import call_adapter


def main():
    output = DIRECTORY / "case-diagnostics.json"
    if output.exists():
        raise ValueError("Preserve diagnostic answers")
    records, _, mapping = inputs()
    corpus = {s["source_id"]: s for s in load_corpus()["sources"]}
    chosen = [r for r in records if r["id"] in ("postgresql-005", "postgresql-037")]
    for doc in ("fastapi", "postgresql"):
        chosen.append(
            next(
                r
                for r in records
                if r["id"].startswith(doc) and r["type"] == "unanswerable"
            )
        )
    rows = []
    for record in chosen:
        document = next(
            c["document_id"]
            for c in mapping.values()
            if c["document_key"] == record["document_key"]
        )
        pool = call_adapter(
            {
                "action": "retrieve",
                "question": record["question"],
                "documentId": document,
                "topK": 24,
                "config": original_configuration("control"),
            }
        )["ranked"]
        for name in ("control", "top10", "top20"):
            config = configuration(name)
            response = call_adapter(
                {
                    "action": "answer",
                    "question": record["question"],
                    "documentId": document,
                    "config": config,
                }
            )
            assert response["selection"]["trace"]["status"] != "fallback"
            for chunk in response["ranked"] + pool:
                match = mapping[chunk["id"]]
                assert match["document_key"] == record["document_key"]
                assert match["content_sha256"] == sha256(chunk["content"].encode())
                chunk["source_id"] = match["source_id"]
            supporting = [
                {
                    "source_id": sid,
                    "text": (CORPUS / corpus[sid]["text_file"]).read_text(),
                }
                for sid in record["relevant_source_ids"]
            ]
            judgment, cached = judge(
                record,
                response["answer"]["text"],
                response["ranked"][:6],
                supporting,
                config["judge_model"],
                config,
            )
            rows.append(
                {
                    "id": record["id"],
                    "type": record["type"],
                    "name": name,
                    "question": record["question"],
                    "reference_answer": record["reference_answer"],
                    "complete_hybrid_pool": pool,
                    "response": response,
                    "judgment": judgment,
                    "judge_cache_hit": cached,
                    "config": config,
                }
            )
            print(
                f"{record['id']} {name}: {judgment['judgment']['correctness']}",
                flush=True,
            )
    result = {
        "rows": rows,
        "status": "diagnostic",
        "selection_unchanged": True,
        "git_revision": subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True
        ).strip(),
        "disclosure": (
            "Four targeted questions per configuration; automated scores; "
            "not all100 candidate quality."
        ),
    }
    save(output, result)


if __name__ == "__main__":
    main()
