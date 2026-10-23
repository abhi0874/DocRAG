# STEP 2 — live evaluation quota checkpoint

Original checkpoint: 2026-10-21. Updated: 2026-10-23 (Asia/Kolkata).
STEP 2 is NOT COMPLETE.
Repository: https://github.com/abhi0874/DocRAG
Branch: feat/production-rag. No push, PR, merge, deployment or STEP 3 work occurred.

This supersedes the pending-review status in STEP2_REVIEW_CHECKPOINT.md. That file
is retained as the historical pre-review report. The previous-step audit passed.

## Latest status after the October 23 daily reset

The evaluator has **20 of 100 complete cached answer/judgment pairs**, eleven
more than the October 22 checkpoint. Today's first verification started after
the published daily reset, reused the previous nine completed pairs, and reached
fastapi-020. The next answer stream failed with the SDK's generic missing-output
message. No partial result or baseline was written.

Local commit 38de202 makes the evaluator observe the answer stream's error events
alongside text and usage promises. It preserves the underlying provider error and
rejects partial text from failed streams before caching or scoring. Three tests
cover the masked error, partial output and unchanged successful output. Application
generation, models, prompts, retrieval, scoring and semantic cache keys are unchanged.

After this fix, the full A–H verification was restarted from A. All seven A–C
commands passed with exit 0, including 26 metric tests, idempotent ingestion,
151 evaluation chunks, 12 sources, 0 application chunks and 100 reviewed questions.
D1 reused all twenty completed pairs, then reported the actual provider error:

    AI_APICallError: You exceeded your current quota
    generativelanguage.googleapis.com/generate_content_free_tier_requests
    limit: 20, model: gemini-3.6-flash
    Please retry in 22h39m39s.

make eval exited 2 (underlying evaluator exit 1). The run stopped there; no
baseline.json or latest.json exists. Independent checks passed for this code:
make lint exit 0; make test exit 0 with 70 Python and 19 TypeScript tests
(89 total, zero failed); make build-fe exit 0. Thus the latest ordered attempt
passed 7/8 executed checks; including those three independent checks gives
10/11, not a completed A–H verification. Tasks 11, 12 and 15 remain pending.

Google's [rate-limit documentation](https://ai.google.dev/gemini-api/docs/rate-limits),
rechecked October 23, says daily quotas reset at midnight Pacific time. The next
published reset is **October 24, 2026, at 12:30 IST**. Availability and unused quota
are not guaranteed. No billing, key/account rotation, model substitution, push,
deployment or STEP 3 work occurred. Saved caches remain available for the next run.

Git status/diff and credential checks passed before this checkpoint commit.
Only .env.example is tracked; .env and .local remain ignored. The remote branch
references were verified unchanged from the values recorded below.

## October 22 daily-reset results (historical)

The evaluation now has **9 of 100 complete cached answer/judgment pairs**, six
more than at the previous checkpoint. The first full attempt started at
07:00:26 UTC (12:30:26 IST), after the published daily reset. The same saved key
was used; no account rotation, billing activation or model substitution occurred.
The current blocker is again the daily free-tier request quota. The final provider
error reported limit 20 and a retry delay of 23h48m23s. The next published reset is
October 23, 2026, at 12:30 IST. This is a scheduled reset, not a guarantee of model
availability or that other activity will leave the entire quota unused.

Two attempts encountered temporary model high demand, with backoff between full
verification restarts. Further progress reached six questions, then the provider
reported a short-window limit of five requests with a roughly 35-second retry
delay. This exposed a pacing problem: the original seven-second spacing was too
short, and SDK retry attempts were not individually spaced.

Local commit e076308 fixes only the evaluation harness. Every generation HTTP
attempt, including retries, now waits at least 13 seconds from the preceding
attempt. Evaluation timing subtracts that deliberate wait. Production generation,
retrieval, model configuration, chunking, prompts and scoring rules remain unchanged.
Pacing stays in result provenance but no longer changes semantic cache identities.
Legacy seven-second entries are read only if every other model/prompt/corpus/config
input matches exactly, then copied to the current cache key without altering their
responses. Tests cover retry pacing across adapter instances, requests that must
not consume generation pacing, and legacy/current judgment reuse after interval
changes. All six complete cached pairs were demonstrably reused in the live rerun.

After the fix, the entire A–H sequence was restarted. A–C passed (seven commands,
all exit 0; 26 metric tests). D1 reached question fastapi-009, then stopped on the
daily quota error: make eval exited 2, with underlying evaluator exit 1. No baseline
or latest result was written. The independent application checks for this exact
implementation passed: make lint exit 0; make test exit 0 with 70 Python and
16 TypeScript tests (86 total, zero failed); make build-fe exit 0. These do not
replace the pending complete A–H run, positive baseline gate or repeat evaluation.
Read-only GitHub branch references remained unchanged from the values below.

The raw file count in cache directories is no longer a completed-question count:
legacy entries are intentionally retained alongside migrated entries. Progress is
the evaluator's nine successfully completed question/judgment records. No partial
scores are presented as baseline measurements. Tasks 11, 12 and 15 remain pending.

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

## October 21 verification results (historical)

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

### October 22 resume before quota reset

At approximately 03:06 IST, the published daily reset had not occurred yet.
Google's [rate-limit documentation](https://ai.google.dev/gemini-api/docs/rate-limits)
states that daily quotas reset at midnight Pacific time. Converting October 22
midnight America/Los_Angeles with the timezone database gives October 22,
12:30 IST. A new Indian calendar date does not itself reset the provider quota.
No new model requests were made during this preflight; no accounts or keys were
rotated. The local database was started with make up without deleting data.

All seven A–C commands in the table above were rerun and exited 0: 26 metric tests,
idempotent ingestion, evaluation chunk count, source ownership join, unchanged
application count, dataset line count and confirmed-review validation. Counts
remain 151 chunks, 12 sources and 100 reviewed questions. Existing caches remain
five embeddings/five answers across configurations and three valid judgments.

The outstanding synthetic CLI regression check was also executed independently,
using temporary explicitly synthetic inputs through eval.verify_results.negative_gate.
It passed by observing exit 1 with the exact error:

    Regression gate failed: Regression: recall@5 decreased by 0.020000000001 (>0.02)

This makes 8/8 non-provider preflight checks passed. Synthetic values were never
written to a baseline or reported as measured performance. The real positive gate,
two-run comparison and complete A–H sequence remain pending. The earlier 82-test,
lint and build results still describe the unchanged implementation; they were
not represented as fresh runs on October 22. Only checkpoint/command documentation
was updated in this resume.

Recall@3, recall@5, recall@10, MRR, citation accuracy, faithfulness, correctness,
p50/p95 latency, tokens/query and estimated cost/query: UNAVAILABLE as complete
baseline metrics. Individual calls have real usage/timing records, but aggregating
the partially completed questions would not meet the required 100-question baseline.
Complete token/cost totals also require the limitations documented in eval/README.md.

Reproducibility: NOT RUN for two complete evaluations.
First/second full-precision recall@5: UNAVAILABLE.
Positive baseline regression gate and saved-baseline verification: NOT RUN.
Regression boundary/invalid-input unit tests and the independent synthetic CLI
rejection passed. Full baseline provenance verification remains pending, and the
synthetic rejection will run again inside the complete final sequence.

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
