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

The first control query in the new client process took 62.391541 ms: embedding
50.5135 ms and database wall time 11.614333 ms. The subsequent 179 observations
had medians 20.453667 ms for embedding, 1.551041 ms for database wall time and
22.116291 ms total. The first-query sample is n=1 and the server was already warm;
it is a client-start comparison, not a cold-storage benchmark. The end-to-end
evaluator starts a new Node process and SQL pool per question, unlike the batched
profiler. This is a concrete reason not to equate the 22 ms warm batch with an
application improvement over Step 3's approximately 60 ms measurements.

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

## Full 100-question evaluation

Fresh measurement: 100 query embeddings, 100 answers and 100 automated judgments;
all 300 operations were cache misses. A separate compatible replay had 100 hits
and zero misses for each category, with identical contexts, answers and judgments.
SQL retrieval ran again. This verifies cache compatibility, not fresh-model determinism.

| Metric | Step 3 | Step 4 |
|---|---:|---:|
| recall@3 | 0.95 | 0.95 |
| recall@5 | 0.975 | 0.975 |
| recall@10 | 1.0 | 1.0 |
| mrr | 0.9729166666666667 | 0.9729166666666667 |
| Automated citation_accuracy | 1.0 | 1.0 |
| Automated faithfulness | 1 | 1 |
| Automated correctness | 0.99 | 0.99 |
| retrieval_p50_latency_ms | 60.2312915 | 51.69933300000001 |
| retrieval_p95_latency_ms | 66.68716904999998 | 62.65260654999998 |
| generation_p50_latency_ms | 5708.036021 | 5882.515167 |
| generation_p95_latency_ms | 12969.903556849997 | 11658.978309749995 |
| p50_latency_ms | 5769.012625 | 5934.257104 |
| p95_latency_ms | 13034.495908649997 | 11715.474928849995 |

Step 4 automated citation support is 264/264 occurrences. The judge rated 98
answers fully correct and two partially correct. All 20 deliberately unanswerable
cases received automated faithfulness/correctness 1.0. All 100 retrieved contexts
match Step 3. Both incomplete answers are verbatim unchanged: postgresql-005 still
omits the savepoint's continued existence despite that evidence being present;
postgresql-037 still lacks foreign-key evidence in the six selected excerpts and
refuses that part. Step 4 has not solved these two limitations.

Recall@5 and MRR changes are zero. Observed retrieval median decreased by about
8.532 ms, while pipeline median increased by about 165.244 ms. The strategy is
unchanged, the runs happened at different times, and client/model/database warmup
was not controlled identically. These are observed run differences, not evidence
that a new retrieval optimization made the application faster. The first-query
versus persistent-pool experiment above explains why batch timings differ.

Fresh full-run component p50 / p95, milliseconds:

| Component | p50 | p95 |
|---|---:|---:|
| Embedding, including model verification | 42.3502705 | 52.5716476 |
| Vector query client elapsed | 8.46375 | 10.82463575 |
| Keyword query client elapsed | 8.160375 | 10.718825 |
| Concurrent database wall | 8.545354 | 11.1395215 |
| RRF | .085854 | .10512915 |

These full-run component measurements include new database connections per
question. They must not be confused with the warm persistent-pool measurements.
The outer retrieval timer includes a small wrapper overhead, so it is slightly
larger than the observer's internal total. Pipeline latency includes retrieval
and answer generation, excluding the offline judge and process startup. The
fresh evaluation wall time was 2494.3551187499834 seconds (about 41.6 minutes).

The strict Step 3 comparison gate passes with zero Recall@5/faithfulness drops.
Synthetic decreases of .020000000001 in each guarded metric are rejected with
exit code 1. No threshold, label, reference answer, prompt or model was changed.
The ordinary Step 2 gate is retained separately.

Raw measurements: `eval/results/retrieval-selected-raw.json`.
Validated copy: `eval/results/retrieval-selected.json`.
Cached replay: `eval/results/retrieval-repeat-raw.json`.
Recomputed comparisons/negative gates: `eval/results/retrieval/comparison.json`.

After the fresh run, the installed Ollama app changed to 0.40.11. The original
0.40.9 official release was verified and run from `.local/ollama-runtime-0.40.9`
for replay/API validation, using the existing model files. No global installation
or app downgrade was performed. The runtime receipt and command contract document
its source, checksum, startup and removal. Both services required a restart after
the cross-session pause; measurements were preserved unchanged.

The dataset is small, English-only and reused across steps. The same Qwen family
answers and judges, and the reference-review provenance is unchanged. Independent
human validation has not been established. Automated scores are not guarantees
of correctness. The Gemini benchmark remains separately preserved at 20/100.
No large-corpus, concurrent-load, cold-storage or multi-turn claim is made.
