# STEP REPORT — STEP 4

Completed: 2026-10-28 (Asia/Kolkata). Fresh measurement completed 2026-10-27.

Repository: https://github.com/abhi0874/DocRAG
Branch: `feat/production-rag`

Previous-step independent audit: PASS. Tasks: 16/16. Verification groups: 20/20 PASS.
Tests: 118 Python + 44 TypeScript = 162 passed, 0 failed.
GitHub push: NONE. Paid API inference charges: ₹0. Step 5 has not started.

Existing hybrid retrieval was extracted into configurable, measured TypeScript components. Six controlled strategies were evaluated. The existing parallel 12-vector/12-keyword strategy with RRF constant 60 was retained because no candidate improved the measured quality/speed trade-off under the frozen selection rule. No indexes or schema were changed. The two incomplete answers remain documented limitations.

## Mandatory task audit

| Task | Status | Evidence and outcome |
|---|---|---|
| 1. Existing implementation | PASS | Audited cosine vector search, English full-text search, document filters, 12/12 candidates, RRF60, top-six context and metadata. HYBRID_RETRIEVAL.md and retrieval modules. |
| 2. Retrieval correctness | PASS | Hand-calculated RRF/overlap/tie tests; source hashes and isolation verified across 1200 profile observations. Vector similarity ordering checked; fixed-index control ranks reproduced for 100/100 questions in all three repetitions. Legacy SQL ties retain the documented limitation across physical DB changes. |
| 3. Full-text search | PASS | Stored generated content_tsv uses English to_tsvector. 162/162 values populated and correct. Isolated temporary insertion/update/empty/special-character tests rolled back; live SQL term tests passed. |
| 4. Indexes | PASS | Inspected valid/ready chunks_pkey B-tree, chunks_document_id_idx B-tree, chunks_content_tsv_idx GIN and chunks_embedding_idx HNSW cosine. No redundant new index added. |
| 5. Profiling | PASS | 288 read-only EXPLAIN ANALYZE BUFFERS plans; 1200 timed retrieval observations. Separated embedding, branch SQL client time, database wall and RRF. Warm versus new-client conditions documented; no claim of cold-storage measurements. |
| 6. Schema fixes | PASS — none needed | Existing schema/indexes correct. No migration created, so migration rollout/rollback is not applicable. Existing idempotent schema startup succeeded, and temporary FTS fixture was rolled back. |
| 7. Query execution | PASS | Tested one-query combined reads, candidate pool changes and broader parsed keyword matching. Preserved original embedding calls, chunking, prompts and models; retained measured control. No semantic cache or reranker added. |
| 8. Controlled experiments | PASS | control, vector, keyword, combined, pool24 and broad24. Every development run retained with configuration, corpus/dataset/source/code hashes and three repetitions. |
| 9. Holdout discipline | PASS | Reused Step 3 stratified 60/40 split. Selection receipt hashes development artifacts before the final 40-question assessment. Reused benchmark is explicitly not described as unseen data. |
| 10. Retrieval metrics | PASS | Recall@3/5/10, MRR, source precision@6, multi-hop recall and component p50/p95 recomputed from saved rows. Unanswerable cases retained in timing and separately checked end to end. |
| 11. Selection | PASS | Control retained. Combined SQL was slower in the measured batches. Broad OR improved development recall but lost MRR and source precision; rejected under the predeclared rule. |
| 12. End-to-end evaluation | PASS | 100 fresh embeddings/answers/judgments. Separate 100-hit cached replay reproduces all contexts, answers and judgments. Both previous incomplete answers are unchanged. |
| 13. Regression | PASS | Explicit retrieval-only compatibility gate against Step 3; zero Recall@5 and faithfulness drops. Synthetic .020000000001 drops rejected for both metrics with exit 1. Ordinary Step 2 gate remains strict. |
| 14. Meaningful tests | PASS | 162 tests pass; source-corruption, missing observation, altered metric/config/prompt, SQL parameters, branch ranking, metadata, ties, duplicates, invalid input and negative gates covered. Live SQL/API checks complement unit tests. |
| 15. Documentation | PASS | HYBRID_RETRIEVAL.md, RETRIEVAL_EXPERIMENT_LOG.md, COMMAND_CONTRACT.md and this report contain actual results, limitations, commands and runtime/rollback instructions. |
| 16. Final implementation | PASS | Full verification sequence completed after runtime recovery. Production build, real streaming API, SQL checks, preservation checks, historical gates and Git safety passed. No push, deployment or destructive database changes. |

## Verification groups and actual commands

All listed successful commands exited 0. Negative-test subprocess exit 1 is the required passing outcome. Commands run from the existing RAG-Agent checkout; `.venv/bin/python -m` is abbreviated as `python -m` in this table only. Full commands are in COMMAND_CONTRACT.md.

| # | Command / group | Actual result |
|---|---|---|
| 1 | `Prior Step 3 audit: Git identity/history; dataset, source mapping, model digests; historical gates; make lint/test/build-fe` | PASS before implementation; initial tests 106 Python + 38 TS = 144. |
| 2 | `python -m eval.retrieval_experiments schema` | PASS; four valid indexes, generated English tsvector, 162 rows; temporary fixture rolled back. |
| 3 | `python -m eval.retrieval_experiments plans` | PASS; 8 queries × 3 repetitions × 4 variants × 3 statement forms = 288 plans. |
| 4 | `python -m eval.retrieval_experiments matrix` | PASS; six × 60 × 3 development observations + 40 × 3 holdout = 1200. |
| 5 | `python -m eval.retrieval_report --profiles-only` | PASS; full profile metrics/provenance/rank repetition and frozen selection recomputed. |
| 6 | `AI_PROVIDER=ollama python -m eval.run_eval --golden eval/golden_set.jsonl --out eval/results/retrieval-selected-raw.json --retrieval-experiment control` | PASS; 100 fresh embeddings, answers and judgments; all cache misses. |
| 7 | `AI_PROVIDER=ollama python -m eval.run_eval --golden eval/golden_set.jsonl --out eval/results/retrieval-repeat-raw.json --retrieval-experiment control` | PASS; 100 hits, zero misses in each cache category; SQL reran. |
| 8 | `python -m eval.verify_results --diagnostic --baseline eval/results/retrieval-selected-raw.json --current eval/results/retrieval-repeat-raw.json` | PASS artifact verification; DIAGNOSTIC ONLY refers to immutable raw records. Validated result separately gated below. |
| 9 | `python -m eval.promote_local --source eval/results/retrieval-selected-raw.json --out eval/results/retrieval-selected.json` | PASS; unchanged raw measurements plus authorized automated-method provenance. |
| 10 | `python -m eval.retrieval_gate --baseline eval/results/chunking-selected.json --candidate eval/results/retrieval-selected.json` | PASS; Recall@5 decrease 0.000; faithfulness decrease 0. |
| 11 | `python -m eval.retrieval_report` | PASS; exact 100-row cached replay and both real CLI negative gates verified. |
| 12 | `make lint` | PASS; Ruff check/format, ESLint, TypeScript. |
| 13 | `make test` | PASS; 118 Python + 44 TypeScript = 162; zero failures. |
| 14 | `make build-fe` | PASS; Next.js 16.2.6 production build, TypeScript, seven generated pages, existing API routes present. |
| 15 | `make db-status` | PASS after make up; existing owned PostgreSQL server running on loopback port 55432. |
| 16 | `python -m eval.retrieval_sql_checks` | PASS; 21 queries × 2 repetitions = 42 observations; exact terms, punctuation, hostile literals, empty query, absent document, metadata, ranking and isolation. |
| 17 | `python -m eval.retrieval_smoke` | PASS; production GET /api/documents and streaming POST /api/chat; supported BEGIN/COMMIT answer with six verified, unique chunk IDs and in-range citations. |
| 18 | `python -m eval.retrieval_integrity; python -m eval.preservation; python -m eval.validate_dataset --require-review` | PASS; 78 historical files byte-identical, 20 Gemini pairs/151 vectors preserved, 151 original local vectors unchanged, selected 162 chunks verified, tracked/untracked secret scan passed, dataset 100 valid. |
| 19 | `python -m eval.verify_results --diagnostic --baseline eval/results/chunking-selected-raw.json --current eval/results/chunking-repeat-raw.json; python -m eval.chunking_gate --baseline eval/results/baseline-local-ollama.json --candidate eval/results/chunking-selected.json; AI_PROVIDER=ollama make eval-gate` | PASS; Step 3 raw/repeat still verify, original chunking gate passes, ordinary strict Step 2 gate passes. |
| 20 | `git branch --show-current; git remote -v; git diff --check; git status --short; git log -5 --oneline` | PASS; correct branch/remote, no whitespace errors or unexpected deletions; completion is committed locally and final clean-tree status checked separately. |

## Quality and performance comparison

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

All quality values and latency values above are copied from saved JSON. Citation support is 264/264; 98 answers were scored fully correct and two partially correct. All 20 unanswerable questions scored automated faithfulness/correctness 1.0.

Full-run vector query p50/p95: 8.463749999999976 / 10.824635750000017 ms. Keyword query: 8.160374999999988 / 10.71882500000002 ms. RRF: 0.08585400000001187 / 0.10512915000001612 ms. Embedding: 42.35027049999998 / 52.571647600000006 ms. These client query times include new connections; concurrent branch medians must not be added.

Recall@5 change: 0.000. MRR change: 0. Retrieval median change: −8.53195849999999 ms. Pipeline median change: +165.244479 ms. The retained algorithm is unchanged; these different-time measurements do not establish a causal speedup. The warm persistent-pool profile median of 22.127333 ms uses different client conditions. All sampled plans were warm-buffer reads, not cold-disk tests.

Both incomplete answers are unchanged: postgresql-005 omits the continued existence of the savepoint although it is present in the retrieved evidence; postgresql-037 lacks foreign-key evidence in the top-six context. Prompts and reranking were outside this step. All 100 contexts match Step 3; 88 fresh answer texts match exactly. Cached replay matches the fresh Step 4 answers/judgments/contexts 100/100.

## Runtime recovery, limitations and safety

Native PostgreSQL stopped between sessions and was restarted with make up, without resetting data. The fresh evaluation completed before the installed Ollama app changed to 0.40.11. A stopped Ollama server caused the first cached-replay connection attempt to fail before any question. A verified project-local 0.40.9 runtime restored the exact measured runtime and existing pinned model digests; the installed app was not downgraded. The final complete verification sequence then passed.

Official source: [Ollama v0.40.9 release](https://github.com/ollama/ollama/releases/tag/v0.40.9). The archive SHA-256 is cdfaee591d3ba7753e1bb4ae28be228ef7488199f263b7f202e0eddc900c08f4; executable SHA-256 is be4b054f8ebf8b3b185daa30671849a80f22c2b2ef45e064de562f69aba46a96. Source/checksums/server/model metadata are recorded in eval/results/retrieval/runtime-reproducibility.json. The ignored extra runtime/archive occupies approximately 736 MiB. Startup and removal instructions are in COMMAND_CONTRACT.md. The temporary validation server was stopped after the successful checks to release model memory; the native development database remains running.

Python certificate verification failed during release metadata retrieval; system curl retrieved it with TLS verification intact. No certificate checks were disabled. All model inference was loopback-only with cloud disabled. Gemini remains the default application provider; its existing tests and data pass preservation checks, while its live benchmark remains separately incomplete at 20/100. No paid Gemini call was made.

Limitations: small reused English dataset; self-judging; no independent human validation; two incomplete answers; no large-scale/concurrent/cold-disk/multi-turn performance claim. Legacy control SQL ties have no explicit ID secondary key; deterministic fixed-index repeats are verified, but ordering across physical DB changes is not guaranteed. Alternative stable-ID configurations were measured and retained as experiments, not silently adopted.

No schema migration was justified; rollback is not applicable to the database. The application remains on its original control configuration. No Step 2/3 artifact was overwritten, no reference label was changed, no secret was found, and no production data was deleted. No push/PR/merge/deployment occurred. Errors: none unresolved. Pending required Step 4 tasks: none.

## Confirmations

- CONFIRMATION 1 — RETRIEVAL CORRECTNESS: PASS.
- CONFIRMATION 2 — QUALITY AND PERFORMANCE: PASS.
- CONFIRMATION 3 — TESTS AND GITHUB SAFETY: PASS.

## Files and local commits

Implementation and evidence commits preceding this completion report:

- 95eec51 Expose controlled hybrid retrieval strategies and component timings
- b32928b Add frozen retrieval ablations and read-only database profiling
- 715ebae Freeze retrieval selection and enforce Step 3 comparison safeguards
- 46cc6dd Verify frozen retrieval evidence and document measured tradeoffs
- 54377a2 Record retrieval decisions and require exact compatible cached replay
- dc099e3 Validate complete Step 4 evaluation and preserve original runtime provenance

This report is committed separately after the final preservation and whitespace check. All commits remain local.

Changed/added files:

```text
docs/COMMAND_CONTRACT.md
docs/HYBRID_RETRIEVAL.md
docs/RETRIEVAL_EXPERIMENT_LOG.md
eval/local_adapter.ts
eval/results/retrieval-api-smoke.json
eval/results/retrieval-repeat-raw.json
eval/results/retrieval-selected-raw.json
eval/results/retrieval-selected.json
eval/results/retrieval/broad24-development.json
eval/results/retrieval/combined-development.json
eval/results/retrieval/comparison.json
eval/results/retrieval/control-development.json
eval/results/retrieval/control-holdout.json
eval/results/retrieval/keyword-development.json
eval/results/retrieval/pool24-development.json
eval/results/retrieval/preservation.json
eval/results/retrieval/profile-verification.json
eval/results/retrieval/query-plans.json
eval/results/retrieval/runtime-reproducibility.json
eval/results/retrieval/schema-audit.json
eval/results/retrieval/selection.json
eval/results/retrieval/sql-correctness.json
eval/results/retrieval/vector-development.json
eval/retrieval_experiments.py
eval/retrieval_gate.py
eval/retrieval_integrity.py
eval/retrieval_report.py
eval/retrieval_smoke.py
eval/retrieval_sql_checks.py
eval/run_eval.py
lib/rag.ts
lib/rank-fusion.ts
lib/retrieval-config.ts
lib/retrieval-default.json
lib/retrieval.ts
tests/retrieval.test.ts
tests/test_chunking_experiments.py
tests/test_retrieval_experiments.py
docs/STEP4_COMPLETE.md
```

## What you should check yourself

1. Open HYBRID_RETRIEVAL.md and compare the six-strategy table: the original control was retained, and no unsupported improvement is claimed.
2. Read the two incomplete-answer explanations above and the saved answers in eval/results/retrieval/comparison.json.
3. If reproducing the benchmark later, use the project-local 0.40.9 startup command and the Step 4 commands in COMMAND_CONTRACT.md. Do not overwrite the original result files.

STEP 4 COMPLETE
No errors found and all tasks completed.
Can proceed to the next step.
