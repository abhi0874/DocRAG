# Step 4 hybrid retrieval experiments

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

## Retrieval experiment results

All numbers below are recomputed from the saved per-query measurements. Each
row uses 60 development questions, three repetitions, 180 observations. Quality
means use the 48 answerable questions; the 12 unanswerable questions remain in
latency measurements. Retrieval alone does not decide whether an answer refuses.

| Strategy | Recall@3 | Recall@5 | Recall@10 | MRR | Multi-hop Recall@5 | Retrieval p50 / p95 ms |
|---|---:|---:|---:|---:|---:|---:|
| Control: parallel 12/12 AND | .9270833333 | .9583333333 | 1 | .9756944444 | .8333333333 | 22.127333 / 25.556052 |
| Vector only | .9270833333 | .9583333333 | 1 | .9756944444 | .8333333333 | 22.773354 / 27.414561 |
| Keyword only, AND | .0416666667 | .0416666667 | .0416666667 | .0416666667 | 0 | .348563 / .777119 |
| Combined 12/12 AND | .9270833333 | .9583333333 | 1 | .9756944444 | .8333333333 | 23.462167 / 27.610346 |
| Combined 24/24 AND | .9270833333 | .9583333333 | 1 | .9756944444 | .8333333333 | 23.511041 / 28.321854 |
| Combined 24/24 OR | .9270833333 | .9791666667 | 1 | .9739583333 | .9166666667 | 24.091604 / 27.956291 |

**Selection: retain control.** Combining reads was about 1.33 ms slower at the
median in these sequentially ordered, warm batches. Broad OR improved development
Recall@5 by .0208333333 but reduced MRR by .0017361111 and source precision@6
from .7881944444 to .75. It failed the predeclared no-MRR-loss selection rule;
the .02 regression threshold is not permission to sacrifice quality for speed.
Increasing candidate pools alone did not change relevant rankings. No claim of
statistical significance or general speed improvement is made.

The keyword-only result diagnoses an important limitation: AND requires every
non-stopword from a natural-language question to occur in one chunk. It often
returns nothing. This does not mean keyword search or its index is broken;
exact technical-term and isolated full-text tests are separate. Broad OR is a
recorded trade-off, not an adopted optimization. Source precision@6 here counts
chunks from labeled relevant pages among returned top-six chunks; it is a
retrieval diagnostic, not automated citation accuracy or a claim-level score.

Selection was frozen before the one final holdout assessment. Because control
won, control and selected are the same holdout run: 40 questions, 120 observations,
Recall@3 .984375, Recall@5/10 1, MRR .96875, multi-hop Recall@5 1; retrieval p50
22.5857915 ms and p95 26.8047771 ms. All three repeated chunk-rank sequences for
all 100 control questions match the original Step 3 ranking exactly. The 40-question
holdout includes 8 unanswerable questions; 32 are answerable for retrieval quality.

## Component timings and database plans

Control development p50 / p95 in milliseconds:

| Component | p50 | p95 |
|---|---:|---:|
| Query embedding, including digest verification | 20.4550835 | 23.53175035 |
| Vector SQL client elapsed | 1.550125 | 2.0499625 |
| Keyword SQL client elapsed | 1.012396 | 1.382908 |
| Concurrent database wall time | 1.552979 | 2.0545524 |
| RRF merge | .0246875 | .038666 |
| Total retrieval | 22.127333 | 25.55605175 |

Embedding dominates the warm batch. Client SQL times include driver, network and
result decoding; EXPLAIN execution times describe server work and are not the
same measurement. SQL branches overlap, so adding their medians is invalid.

EXPLAIN sampled 8 development questions × 3 repetitions × 4 configurations × 3
statement forms = 288 plans. Control vector execution p50 was .8265 ms, keyword
.2965 ms, and combined .8475 ms. Each control branch used sequential scans in 12
plans and chunks_document_id_idx scans in 12. The combined statements contain
both scans. All sampled plans recorded zero shared read blocks: these were warm
buffer observations, not cold disk tests. GIN and HNSW exist and are valid but the
planner did not choose them for these small filtered queries. There is no measured
case for another index, planner forcing, or an index-removal migration. Existing
HNSW/GIN maintenance and storage overhead remains; large-corpus scalability has
not been measured in Step 4.

Legacy ties retain input insertion order in fusion. The controlled alternatives
use explicit chunk-ID SQL and fusion tie breaks. Fixed-index control repetition
was identical in all 300 observations, but legacy SQL equal-score order is not
guaranteed across physical database changes. This limitation is retained with
the winning existing strategy and must not be described as universal determinism.

## Verification and rollback

Run the Step 4 section of COMMAND_CONTRACT.md. New reports verify the frozen
artifact hashes, every source mapping, repeated chunk ranks, individual and
aggregate metrics, split coverage and the selection rule. The comparison gate
permits only declared retrieval fields and the audited retrieval extraction;
models, query-embedding request, generation instructions, chunker, relevance
labels, and unrelated application hashes must match. Step 3's measured revision
predated adoption of its default chunk size, so the gate verifies the current
chunking default equals the same explicit 1400/280 measured configuration.
The ordinary regression checker remains unchanged and strict.

No schema migration is needed; there is no schema rollback to perform. The
application default is already the retained control. If reverting the code
refactor is ever necessary, use a new revert commit after preserving evidence;
do not reset history or remove saved measurements. Experimental strategies are
available only through explicit internal configuration; user chat requests
cannot override the chosen ranking configuration.

The first end-to-end launch stopped before question 1 because the native
PostgreSQL service had stopped between work sessions. `make up` restarted the
owned cluster, using its existing idempotent schema setup, and `make db-status`
confirmed it running. No reinstall or data reset was performed. The applicable
verification sequence must pass after recovery; this operational issue is not
silently treated as an evaluation result.
