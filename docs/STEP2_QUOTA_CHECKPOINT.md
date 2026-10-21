# STEP 2 — live evaluation quota checkpoint

Date: 2026-10-21 (Asia/Kolkata). STEP 2 is NOT COMPLETE.
Repository: https://github.com/abhi0874/DocRAG
Branch: feat/production-rag. No push, PR, merge, deployment or STEP 3 work occurred.

This supersedes the pending-review status in STEP2_REVIEW_CHECKPOINT.md. That file
is retained as the historical pre-review report. The previous-step audit passed.

## Completed work: 12/15 task groups

Tasks 1–10, 13 and 14 are implemented. Tasks 11 (complete real baseline),
12 (two complete runs) and 15 (all final verification) remain incomplete.
The user explicitly confirmed review of all 100 questions, then delegated the
scope decision after supplying outside answers. The original 20 unanswerable
questions remain unchanged: they test refusal when the selected corpus lacks
the answer. They do not represent questions that are unknowable in general.

The hash-bound receipt is eval/human_review.json. The set contains 60 easy,
20 multi_hop and 20 unanswerable questions; 50 use each documentation source.
The isolated evaluation database retains 2 documents, 12 sources and 151 chunks
(88 FastAPI, 63 PostgreSQL). The separate application database still has 0 chunks.
Reingestion verifies existing IDs/content/mappings and makes no new model calls.

The Python evaluator invokes the actual TypeScript hybridSearch function and the
same generation function as the chat route. Extracting lib/rag-answer.ts was
necessary to share the original call without duplicating it. A contract test
checks the original literal prompt, model, converted messages and SDK defaults.
Chunking, embeddings, ranking, RRF, answer top-K, answer model and prompt remain
unchanged. Caches affect only evaluation; SQL retrieval still runs every time.

The evaluator implements recall@3/5/10, MRR, semantic citation judgments,
faithfulness/correctness, measured timings, available provider token usage,
strict validation, hash-keyed caches and the unchanged 0.02 regression threshold.
eval/README.md documents rubrics, calculations, limitations and reproducibility.
make eval and make eval-gate now execute the real implementations.

## Actual verification results

The latest ordered A–H attempt passed 7 of its 8 executed commands, then stopped
at D1. Subsequent independent application checks passed, but do not substitute
for a successful complete A–H sequence. Restart that entire sequence after quota
is available; preserve the first complete validated result as the baseline.

| Command/check | Exit | Actual result |
| --- | ---: | --- |
| python -m pytest tests/test_metrics.py -q | 0 | 26 hand-calculated metric/regression tests passed |
| python scripts/ingest_corpus.py | 0 | Existing 2 documents, 12 sources, 151 chunks verified |
| python scripts/eval_db_query.py "SELECT count(*) FROM chunks" | 0 | 151 |
| Evaluation source/chunk join in COMMAND_CONTRACT.md | 0 | All 12 intended source IDs; counts total 151 |
| python scripts/db_query.py "SELECT count(*) FROM chunks" | 0 | Application database remains 0 |
| wc -l eval/golden_set.jsonl | 0 | 100 |
| python -m eval.validate_dataset --require-review | 0 | Valid dataset, source mappings and confirmed receipt |
| make eval | 2 | Underlying evaluator exit 1: provider daily quota exhausted |
| make lint (independent post-fix check) | 0 | Ruff, format check, ESLint, TypeScript passed |
| make test (independent post-fix check) | 0 | 68 Python + 14 TypeScript = 82 passed, 0 failed |
| make build-fe (independent post-fix check) | 0 | Next compilation, type check and page generation passed |

The most recent run reused three complete answer/judgment pairs from cache before
failing on the next judge request. The current configuration has one additional
generated answer awaiting its judgment. Across both judge-format configurations,
ignored local storage contains five query embeddings, five answers and three
valid judgments. These are partial progress, not a completed baseline. No
eval/results/baseline.json or latest.json was written. No partial aggregate is
presented as a project performance score.

Git branch/status/diff checks passed before this report was saved. Actual
credential scans passed without printing values; .env, caches and latest.json
are ignored. Only .env.example is tracked. Previous history remains intact.
Read-only remote inspection showed main still at
7ccc792669cef1c254d71ebc342fa4ba624584fa, the pre-existing v0 branch still at
f8d2cf1399b295c1eb4887442ee68a39e6c15e68, and no published development branch.

## Failures, diagnosis and current blocker

An initial judge call failed with temporary provider high demand. A later attempt
received Markdown-fenced JSON instead of plain JSON on all three validation
attempts; no scores were accepted. A diagnostic confirmed the exact formatting
problem. The judge now requests the SDK's JSON response mode, retaining the full
schema, score and citation validation. Three real judgments then passed.
All checks were restarted from the top after this correction.

The next failure was a daily provider quota. The sanitized error included:

    AI_APICallError: You exceeded your current quota
    generativelanguage.googleapis.com/generate_content_free_tier_requests
    limit: 20, model: gemini-3.6-flash

The last request reported approximately 14 hours 28 minutes until reset. That was
the wait reported at the time, not a continuously updated countdown. The configured
requested answer/judge model remains gemini-3.5-flash; the provider's error labels
its quota bucket gemini-3.6-flash. No model substitution was made. Provider aliases
are a documented reproducibility limitation.

The user saved another key, and a private equality check confirmed that the
evaluator loaded exactly the value in .env, without an exported key overriding it.
The same exhausted free-tier quota was returned. The user ultimately chose to
stay on the free tier. A dedicated DocRAG Google project was prepared with explicit
authorization, but no billing was enabled. Its free quota was not used to work
around the existing limit. Credential displays were closed; no key is recorded here.

Earlier environment-only issues were resolved: the existing native database was
restarted without deleting data, and the application build was rerun with network
access for its existing Google Fonts. Docker and new global installations were
unnecessary. These fixes do not remove the current external quota blocker.

## Metrics and final confirmations

Recall@3, recall@5, recall@10, MRR, citation accuracy, faithfulness, correctness,
p50/p95 latency, tokens/query and estimated cost/query: UNAVAILABLE as complete
baseline metrics. Individual calls have real usage/timing records, but aggregating
three completed questions would not meet the required 100-question baseline.
Complete token/cost totals also require the limitations documented in eval/README.md.

Reproducibility: NOT RUN for two complete evaluations.
First/second full-precision recall@5: UNAVAILABLE.
Positive baseline regression gate and saved-baseline verification: NOT RUN.
Regression boundary/invalid-input unit tests passed; a synthetic CLI rejection
and full provenance verification still belong to the complete final sequence.

CONFIRMATION 1 — DATASET: PASS.
CONFIRMATION 2 — BASELINE: FAIL (full live run missing).
CONFIRMATION 3 — ALL TASKS AND GITHUB SAFETY: FAIL (tasks 11, 12, 15 pending;
GitHub safety itself passed).

## Resume safely

Keep .local intact: it holds the owned database and successful call caches.
After the provider's daily quota resets, resume the full A–H sequence in
docs/COMMAND_CONTRACT.md. Do not switch free-tier keys/projects to evade the limit.
At 20 generation requests per day, roughly 200 answer/judge requests require
multiple daily windows; retries and other activity also consume available quota.
Do not change the reviewed dataset, application models or scoring rules merely
to obtain a passing result. Do not create a baseline until all 100 rows succeed.

Check the reviewed set in eval/REVIEW_NEEDED.md, this checkpoint, and the project
quota shown in Google AI Studio. Keep keys out of chat and Git. No background
automation has been scheduled. The next executor must not begin STEP 3.

STEP 2 NOT COMPLETE
Errors/issues: Gemini daily free-tier quota exhausted.
Pending tasks: Complete baseline, second evaluation, regression gate and full A–H verification.
DO NOT PROCEED TO NEXT STEP.
