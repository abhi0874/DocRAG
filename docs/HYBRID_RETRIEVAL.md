# Step 4 hybrid retrieval experiments — in progress

## Previous-step audit (2026-10-27)

Existing checkout: abhi0874/DocRAG, branch feat/production-rag, clean HEAD 0dec8b9.
All seven Step 3 commits and earlier history remain present. No push was performed.
Step 3 source/metric recomputation, immutable baseline byte checks, dataset review,
162 persisted chunks/source mappings, model digest checks, regression checks,
lint, 106 Python + 38 TypeScript tests and production build passed. Step 2 and
Step 3 raw/validated artifacts remain intact. Gemini preservation passed for all
20 saved pairs and 151 original vectors. Ollama remains 0.40.9 with the original
Qwen/EmbeddingGemma digests and 768-dimensional local vectors.

Immediate control: Step 3 heading-v1 1400/280, 162 chunks, Recall@3/5/10
0.95 / 0.975 / 1.0, MRR 0.9729166666666667. Automated faithfulness/correctness
1.0 / 0.99. Source-page relevance at original chunk ranks remains unchanged.

postgresql-005 is a generation omission: excerpt 1 explicitly says the savepoint
continues to be defined, but the answer omitted that detail. Retrieval already
provided the evidence. postgresql-037 is an evidence-selection issue: its six
answer excerpts all describe joins, omitting the foreign-key evidence required by
the second half of the question. The full saved corpus contains that evidence.
Neither finding justifies changing prompts or judge criteria in this step.

## Existing implementation and latency interpretation

The TypeScript hybridSearch embeds a question, runs two parameterized SQL SELECTs
concurrently, and merges ranks in JavaScript. Vector ordering uses cosine distance
(<=>); similarity is 1 minus that distance. Each search returns at most 12 chunks
filtered by document_id. Keyword search uses ts_rank with English plainto_tsquery.
content_tsv is a stored generated English to_tsvector expression. RRF adds
1/(60 + one-based rank) from each list. Shared chunk IDs merge once. The first six
fused chunks become answer context; evaluation inspects ten for retrieval metrics.
Historical equal scores preserve list insertion order; SQL ties have no explicit
secondary key. Candidate strategies add explicit ID tie ordering.

Existing indexes are chunks_pkey (B-tree primary key), chunks_document_id_idx
(B-tree), chunks_content_tsv_idx (GIN), and chunks_embedding_idx (HNSW cosine).
All 162 chunks have embeddings and correct generated tsvectors. No missing schema
structure has been found; no new production index or migration is currently needed.

The historical 31.57 ms versus 60.23 ms medians both wrap the whole hybridSearch,
including embedding, model-digest HTTP verification and database connection/query
work. Step 2 mixed 16 cache hits and 84 fresh embeddings; Step 3 used 100 fresh
embeddings. Chunk counts differ, but model settings and 12/12/RRF60 retrieval are
the same. Neither run separated embedding/SQL/fusion time or controlled server/OS
cache warmth. The SQL calls are concurrent in both. The old difference cannot be
causally attributed to chunking alone. New instrumentation separates components.

## Frozen measurement design

Reuse the exact Step 3 seed-42, document/type-stratified split: 60 development,
40 holdout. Both sets were used previously, so this is not an unseen benchmark.
No labels, chunk boundaries, embeddings, prompts or judge settings are changed.
Read-only experiments use the existing frozen selected index; they do not rewrite it.

Six configurations: original parallel 12/12 hybrid control; vector-only 12;
keyword-only 12; combined single SQL hybrid 12/12; combined 24/24;
combined 24/24 with OR between safely parsed keyword lexemes. RRF remains 60.
The broader query is built by PostgreSQL from parameterized plainto_tsquery output,
not by interpolating raw user text into SQL. All experimental variants use ID ties.

Each configuration runs three repetitions per development question using actual
TypeScript hybridSearch. No query-embedding cache is used for profiling. Each
process reuses its SQL pool: only the first query starts with new connections;
the server is already warm. We do not flush OS caches or restart PostgreSQL.
Separate EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECTs run in read-only transactions
on eight development questions, three repetitions, four hybrid variants.
Vector/keyword times for combined execution are unavailable at the application
boundary, rather than falsely reported as zero; component database execution is
recorded by the query plans. Concurrent query durations must not be added together.

Frozen selection: only hybrid candidates with no development Recall@5 or MRR loss
are eligible. Maximize Recall@5, MRR, then multi-hop Recall@5; median total retrieval
time breaks quality ties. Vector-only and keyword-only are diagnostic ablations.
Freeze selection before measuring control/selected holdout. If no candidate meets
the quality criteria, keep control. Report every attempt, including failures.

## Scope and reversibility

Retrieval/model code is refactored only to expose configuration and timings around
the existing algorithms. The default remains control until measured selection.
The Step 3 compatibility test now uses its frozen result/revision rather than
assuming future HEADs are still Step 3; its positive and negative checks remain.
Production semantic caching, rerankers and generation-prompt changes are excluded.
No production schema changes are planned. Full-text insertion/update behavior is
checked in an isolated temporary table and rolled back, without changing existing
rows or sequences. Roll back a selected strategy by selecting the control settings.
