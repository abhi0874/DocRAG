"""Live keyword/metadata/isolation checks through the actual TypeScript search."""

import json

from eval.chunking_experiments import connect_experiment
from eval.corpus import sha256
from eval.retrieval_experiments import DIRECTORY, configuration, inputs, save
from eval.runtime import call_adapter


def main():
    _, _, mapping = inputs()
    documents = sorted({c["document_id"] for c in mapping.values()})
    terms = [
        "PostgreSQL",
        "pgvector",
        "FastAPI",
        "HTTP GET",
        "weather",
        "ROLLBACK",
        "savepoint",
        "!?'&|:",
        "'); DROP TABLE chunks; --",
        "",
    ]
    requests = [
        {"id": f"{doc}-{i}", "documentId": doc, "question": term}
        for doc in documents
        for i, term in enumerate(terms)
    ]
    requests.append(
        {"id": "absent-document", "documentId": 2147483647, "question": "PostgreSQL"}
    )
    expected = {}
    with connect_experiment("heading-1400-280") as conn:
        conn.read_only = True
        for request in requests:
            rows = conn.execute(
                "SELECT id, "
                "ts_rank(content_tsv,plainto_tsquery('english',%s)) AS score "
                "FROM chunks WHERE document_id=%s AND content_tsv @@ "
                "plainto_tsquery('english',%s) ORDER BY score DESC,id ASC LIMIT 10",
                (request["question"], request["documentId"], request["question"]),
            ).fetchall()
            expected[request["id"]] = [r[0] for r in rows]
        nullable = conn.execute(
            "SELECT is_nullable FROM information_schema.columns "
            "WHERE table_name='chunks' AND column_name='content'"
        ).fetchone()[0]
        if nullable != "NO":
            raise ValueError("Unexpected nullable chunk content")
    result = call_adapter(
        {
            "action": "profile",
            "config": configuration("keyword"),
            "uncachedRetrieval": True,
            "requests": requests,
            "repetitions": 2,
        }
    )
    lookup = {r["id"]: r for r in requests}
    for row in result["rows"]:
        request = lookup[row["id"]]
        if [r["id"] for r in row["ranked"]] != expected[row["id"]]:
            raise ValueError("TypeScript keyword results differ from live SQL ranking")
        if row["timing"]["embedding_ms"] != 0:
            raise ValueError("Keyword-only retrieval unexpectedly embedded query")
        for hit in row["ranked"]:
            source = mapping[hit["id"]]
            if (
                source["document_id"] != request["documentId"]
                or source["page_number"] != hit["pageNumber"]
                or source["content_sha256"] != sha256(hit["content"].encode())
            ):
                raise ValueError("Keyword document/source isolation mismatch")
    # No relevance annotations are invented for terms absent from the saved corpus.
    receipt = {
        "status": "PASS",
        "queries": len(requests),
        "repetitions": 2,
        "observations": len(result["rows"]),
        "model_inference": "none",
        "content_nullable": nullable,
        "queries_and_chunk_ids": [
            {**r, "chunk_ids": expected[r["id"]]} for r in requests
        ],
    }
    save(DIRECTORY / "sql-correctness.json", receipt)
    print(
        json.dumps({k: v for k, v in receipt.items() if k != "queries_and_chunk_ids"})
    )


if __name__ == "__main__":
    main()
