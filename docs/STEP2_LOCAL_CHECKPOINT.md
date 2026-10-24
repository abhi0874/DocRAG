# STEP 2 local evaluation checkpoint — 2026-10-24

STEP 2 NOT COMPLETE. Both 100-question local diagnostic runs completed; the
verified baseline is deliberately absent. The remaining requirement comes from
Task 11 of the user's request: independently established human calibration labels.
The user delegated technical decisions but said they did not understand the labels.
That is not a review confirmation, and no human-review receipt was invented.

## Work completed

The optional TypeScript Ollama provider reuses the existing chunking, hybrid search,
RRF, answer prompt, streaming and citations. Gemini remains the default. The local
index preserves the same 151 chunk texts and source identifiers in a separate
768-dimensional database. The original 20 Gemini answer/judge pairs, 85 recorded
cache files and all 151 Gemini vectors passed the preservation check after both runs.
The ordinary application database remains at zero chunks, as before this work.

The previous-step audit passed. Tasks 1–10, 13 and 15 are completed (12/16).
Task 11 remains pending human labels; Task 12 lacks a verified baseline; Task 14
lacks a successful positive baseline gate; Task 16 cannot pass every requirement.
No STEP 3 work, GitHub push, PR, merge, deployment, paid inference or destructive
operation was performed. No fresh Gemini model calls were needed for this check.

## Measured results: provisional quality scores

The result files explicitly carry status `provisional`. Their top-level
`human_review: confirmed` refers only to the unchanged 100-question golden dataset;
`judge_calibration.human_review: pending` separately identifies the missing review.
Citation accuracy, faithfulness and correctness remain unvalidated judge estimates.
Retrieval is computed mechanically over the 80 answerable questions. All 100
questions, including 20 intentionally unanswerable questions, have answers/judgments.

| Metric from first complete diagnostic | Value |
| --- | --- |
| recall@3 | 0.93125 |
| recall@5 | 0.9625 |
| recall@10 | 0.99375 |
| mrr | 0.95875 |
| citation_accuracy | 1.0 |
| citation_supported | 298 |
| citation_denominator | 298 |
| faithfulness | 0.995 |
| correctness | 0.975 |
| p50_latency_ms | 5165.6565835 |
| p95_latency_ms | 11939.51523895 |
| answerable_count | 80 |
| unanswerable_count | 20 |
| tokens_per_query | 6443.79 |
| tokens_unavailable_reason | None |
| estimated_cost_per_query_usd | 0 |
| cost_unavailable_reason | None |
| answer_tokens_per_query | 1592.21 |
| judge_tokens_per_query | 4823.64 |
| retrieval_p50_latency_ms | 31.57474949999998 |
| retrieval_p95_latency_ms | 40.85333749999998 |
| generation_p50_latency_ms | 5130.316666499999 |
| generation_p95_latency_ms | 11899.3349521 |

The first complete run resumed earlier work: embedding and answer cache hits/misses
were 16/84 each; judge hits/misses were 15/85. It ran for
2136.741802958015 seconds (35.61 minutes), including offline judge inference.
Its latency is a mixture of cached and fresh operations, excludes judge time,
pacing and process startup, and is not a cold full-run performance claim.
Tokens/query includes query embeddings, answers and judges; cached usage is historical.
Document-ingestion tokens are excluded from that per-query total. The raw result's
phrase "amortized separately" does not supply a numeric ingestion amortization.
Paid API inference charges were ₹0; electricity/hardware costs are not measured.

The second run reused all 100 embeddings, answers and judgments, with zero misses.
SQL retrieval ran again. Both unrounded Recall@5 values were exactly 0.9625.
The second run's 18.204853500000013 ms p50 and 18.94176845000002 ms p95 describe
cache reuse, not fresh generation. Fresh-generation or independent-judge
variability has not been established.

## Provenance and calibration

Ollama 0.40.9; answer and judge qwen3.8:latest, nvfp4, MLX, with digest
47951e4a666180bc2aedfc93c169472f2de783696fe196efbf063f5730ecf163.
Embedding model embeddinggemma:300m, 768 dimensions, digest
85462619ee721b466c5927d109d4cb765861907d5417b9109caebc4e614679f1.
Actual local chat and embedding calls passed. Apple M5 Pro / 48 GiB; loaded models
reported GPU acceleration. Detailed model metadata reported 27,781,081,984 parameters.
Settings: context 32768, max output 2048, temperature 0, requested seed 42,
top_k 20, top_p 0.95, min_p 0, repeat_penalty 1, presence_penalty 0, thinking false.
Full settings, source IDs, answers, judgments and model usage are saved in both results.

Dataset SHA-256: 1867147d2667a2745d6cf0b2139225395f2599a1b68803fb37356964febab78b
Corpus SHA-256: d496bb83aa5750d540b25a4395657e2c238d237e2e187e9ec192c7246a7f579c
Configuration SHA-256: ac6fefd8f60b35abcad3be91ae3b4274d54268e043081c1618c760a4307a9c0a
Implementation Git revision: 326210ce69d6a2fad4f8335eb8741dee69ab637c.
Both results honestly record a dirty working tree at start: pending docs/reports.
The verifier matched the recorded application/evaluator code hashes to that revision.

Initial faithfulness calibration was 12/14, below the predeclared 90% threshold.
A local-only prompt clarification separated factual support from citation accuracy.
Labels, criteria and the Gemini rubric were unchanged. All 14 cases now match every
proposed label. These are AI-proposed labels, and the same cases guided the prompt
repair; this is neither independent human validation nor held-out judge accuracy.
Qwen judging its own answers also leaves self-preference risk.

## Actual verification

27 checks executed: 24 exited zero, one expected-rejection check passed with exit 1,
and two required checks remain blocked (25/27 satisfied). Separately, both synthetic
threshold CLI checks rejected drops of 0.020000000001 with exit 1. Those synthetic
numbers are not model performance. Full tests: 78 Python + 29 TypeScript = 107 passed,
0 failed. The focused 30-test metrics run is included in those 78, not added again.
Lint and production build passed. Node emitted a nonfatal module.register deprecation.

| Command | Exit | Outcome |
| --- | --- | --- |
| git branch --show-current | 0 | PASS |
| ollama --version | 0 | PASS |
| ollama list | 0 | PASS |
| ollama show qwen3.8:latest | 0 | PASS |
| curl --fail --silent --show-error http://localhost:11434/api/tags | 0 | PASS |
| make up | 0 | PASS |
| make local-check | 0 | PASS |
| make local-ingest | 0 | PASS |
| make local-ingest | 0 | PASS |
| .venv/bin/python -m eval.preservation | 0 | PASS |
| .venv/bin/python -m eval.validate_dataset --require-review | 0 | PASS |
| .venv/bin/python -m pytest tests/test_metrics.py -q | 0 | PASS |
| make local-calibrate | 0 | PASS |
| .venv/bin/python -m eval.local_calibration --verify | 1 | BLOCKED |
| env AI_PROVIDER=ollama make eval | 0 | PASS |
| .venv/bin/python -m eval.verify_results --diagnostic --baseline eval/results/diagnostic-local-ollama-first.json --current eval/results/latest-local-ollama.json | 0 | PASS |
| env AI_PROVIDER=ollama make eval | 0 | PASS |
| .venv/bin/python -m eval.verify_results --diagnostic --baseline eval/results/diagnostic-local-ollama-first.json --current eval/results/latest-local-ollama.json --out eval/results/reproducibility-local-diagnostic.json | 0 | PASS |
| env AI_PROVIDER=ollama make eval-gate | 2 | BLOCKED |
| .venv/bin/python -m eval.check_regression --baseline eval/results/diagnostic-local-ollama-first.json --current eval/results/latest-local-ollama.json | 1 | PASS (expected rejection) |
| make lint | 0 | PASS |
| make test | 0 | PASS |
| make build-fe | 0 | PASS |
| .venv/bin/python -m eval.preservation | 0 | PASS |
| git diff --check | 0 | PASS |
| git status --short | 0 | PASS |
| git log -5 --oneline | 0 | PASS |

Exact blockers:

- `Local calibration failed: Human calibration labels still unconfirmed; quality metrics provisional`
- `Regression gate failed: [Errno 2] No such file or directory: 'eval/results/baseline-local-ollama.json'`

Provisional input rejection additionally returned:
`Regression gate failed: Local judge calibration is not human validated`.
The orchestration process finished collecting independent checks with exit 0;
that does not mean the required baseline gate or STEP 2 passed.

## Files, adaptations and next action

Provider-specific Make targets select `latest-local-ollama.json` and the intended
`baseline-local-ollama.json`. That baseline has not been created. Diagnostic output
is saved separately as `diagnostic-local-ollama-first.json` and
`diagnostic-local-ollama-second.json`, with `reproducibility-local-diagnostic.json`.
The diagnostic verifier flag allows inspection only and does not bypass the real gate.
The command contract documents these adaptations and the mandatory verified path.

Implementation commits: 945a902, 40280a3, 14420fb, 326210c. Result evidence is committed locally as 451ae3b; this report and the review guide
are saved in the following documentation commit. The active branch remains feat/production-rag in the existing
https://github.com/abhi0874/DocRAG repository. Earlier history is retained. Final secret scanning found no private .env values or
Google-key patterns in tracked/untracked deliverables; database-URL patterns were
restricted to verified example/test placeholders. Only .env.example is tracked,
and .env is ignored. Both saved diagnostic files match the reproducibility hashes.
The additional application database SELECT exited 0 with count 0.

For the next review, open eval/calibration/BEGINNER_REVIEW.md in Codex, then
compare the 14 short answers with their adjacent source excerpts in REVIEW.md.
No machine-learning expertise is required. A person must actually confirm or correct
those labels before a human-review receipt is recorded. Delegating implementation
decisions is not evidence of human review. The original 100-question review need
not be repeated. After review, rerun the full documented verification and only then
create a verified baseline if every requirement passes. Do not simply rename these
provisional files or edit their status to complete.

Check the saved diagnostic metrics and their caveats, the 14 calibration examples,
and docs/LOCAL_OLLAMA.md for future model removal instructions. Nothing was uninstalled.
This local benchmark does not provide online hosting for recruiters; deployment is
outside STEP 2 and remains future work.

CONFIRMATION 1 — OLLAMA AND DATASET: PASS.
CONFIRMATION 2 — COMPLETE LOCAL BASELINE: FAIL.
CONFIRMATION 3 — ALL TASKS AND SAFETY: FAIL (required work remains; safety checks passed).

The completed local benchmark measures DocRAG with Ollama using the recorded local
models and evaluation configuration. Here "completed" means all diagnostic rows ran;
quality validation and baseline approval remain incomplete.
The earlier Gemini-specific evaluation remains incomplete at 20/100 and has been
preserved separately. No Gemini benchmark results have been fabricated or
represented as local-model results.

STEP 2 NOT COMPLETE
Errors/issues: Human judge-calibration labels remain unconfirmed; verified baseline/gate unavailable.
Pending tasks: Human calibration review, verified baseline, positive gate and final verification.
DO NOT PROCEED TO NEXT STEP.
