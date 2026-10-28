# Step 5 — NOT COMPLETE (2026-10-28)

Repository: https://github.com/abhi0874/DocRAG
Branch: feat/production-rag. No push, deployment or paid inference.
Previous-step audit: PASS before implementation.

Stopped under the user's explicit three-attempt rule. Do not begin Step 6.

## Blocking failure

`make build-fe` exits 2. Three genuine attempts encountered the same Turbopack
failure (the initial restricted-network font download failure was separate):

```
Failed to write app endpoint /page
[project]/lib/reranker-client.ts [app-route] (ecmascript)
Symlink [project]/.local/reranker-minilm/env/bin/python is invalid,
it points out of the filesystem root
```

Attempts: direct Python spawn; runtime tracing annotations; `/usr/bin/env` launch
with separate argument vector. The final change remains uncommitted and has NOT
passed the production build. Do not claim production API integration verified.
No fourth workaround was attempted. Next action, after the user resumes, is to
resolve optional host-runtime tracing without bundling the virtual environment,
then rerun the entire applicable verification list.

## Checks actually run

- Prior Step 4 audit: passed 162 tests, lint, build, historical gates, dataset,
  saved metrics, corpus mappings and preservation (before Step 5 changes).
- Current `make lint`: exit 0 (Ruff, formatting, ESLint, TypeScript).
- Current `make test`: exit 0, 128 Python + 70 TypeScript = 198 passed, 0 failed.
- Current `make build-fe`: exit 2, blocker above.
- Real offline CPU/MPS probe: passed six inferences per device, pinned weights.
- Historical `profile_report()`: exit 0; recomputed Step 4 profiles preserved.
- New reranking gate boundary/configuration negative tests: passed in unit suite.
- Final all-100 reranking run, validated result and measured regression gate: NOT RUN.
- Real production HTTP reranker/fallback/lifecycle checks: NOT RUN.
- A subsequent preservation check was blocked by sandbox loopback permissions;
  repeat with local-service access. This does not establish data corruption.

## Preliminary experiments — not final benchmark evidence

The three development configurations ran on 60 questions, three repetitions each;
control holdout ran 40 questions, three repetitions. Actual top20 pools contained
12 candidates, not 20. No inference fallback was recorded. The selection rule
retained control because both rerankers reduced MRR. Selection is preserved.

| Development metric | Control | Top10 | Up to20 (actual12) |
|---|---:|---:|---:|
| Recall@3 | .9270833333333334 | .9479166666666666 | .9479166666666666 |
| Recall@5 | .9583333333333334 | .96875 | .96875 |
| Recall@10 | 1 | 1 | 1 |
| MRR | .9756944444444444 | .9340277777777778 | .9236111111111112 |
| Multi-hop Recall@5 | .8333333333333334 | .875 | .875 |
| Selection median ms | 19.815146 | 140.545521 | 164.776667 |

These are preliminary: build/test processes overlapped measurements, and the
runtime-launch file was edited while the matrix was running. Consequently the
recorded source fingerprints must be reconciled with each process's loaded code;
these files MUST NOT serve as final provenance/latency evidence. Preserve them,
then use a separately named final run after code is committed and stable. Do not
retune against holdout. No quality improvement claim is established.

The CPU/MPS toy probe was separate: CPU warm median3.14ms, initialization1475.40ms,
peak RSS542,801,920bytes; MPS warm median3.58ms, initialization1524.78ms,
peak RSS633,667,584bytes. These are two short passages, not full-document timings.

## Incomplete answers

postgresql-005: prior final context already contained the savepoint's continued
existence. The generator omitted it; no new selected answer has been evaluated.
postgresql-037: foreign-key evidence was present at original rank10, outside final
six. A complete candidate-pool/source audit and new selected answer remain pending.
Golden reference answers and generation prompt are unchanged.

## Task audit and confirmations

Fully completed task groups: 1 (path inspection), 3 (model selection/install),
4 (real minimal inference), 5 (optional interface): 4/17.
Tasks 2,7–11,14–16 have partial implementation/evidence, not final completion.
Tasks 6,12,13,17 require production/full-run verification.

CONFIRMATION 1 — IMPLEMENTATION: FAIL (production verification incomplete).
CONFIRMATION 2 — EVALUATION: FAIL (full100 and final gate incomplete).
CONFIRMATION 3 — TESTING AND GITHUB SAFETY: FAIL (build and required work incomplete;
GitHub safety respected).

The Step 4 full100 metrics remain Recall@3 .95, Recall@5 .975, Recall@10 1,
MRR .9729166666666667, automated citation1, faithfulness1, correctness.99.
No comparable Step 5 full100 metrics exist yet. Reranking remains disabled by default.

## Saved work

71f47fc: isolated removable MiniLM runtime, dependency pins, probe, setup docs.
449d277: optional Next.js selection, worker client, fallback/configuration tests.
d0806f8: controlled experiments, historical verification adaptation, new strict gate.
Uncommitted: latest unsuccessful runtime-launch adjustment, preliminary matrix
artifacts, and this status report. No history rewriting or cleanup of user data.

Major files: lib/reranker-{model.json,config.ts,client.ts}, lib/rerank.ts,
lib/select-context.ts, scripts/reranker_{setup,worker,probe}.py,
requirements-reranker.txt, chat/comparison routes, eval/local_adapter.ts,
eval/run_eval.py, eval/reranking_{experiments,gate}.py, related tests and docs.

## What you can check

1. Read RERANKING.md for the exact installed directory and removal command.
2. Keep reranking disabled until the production build/API checks pass.
3. Treat the saved development results as preliminary; no all100 improvement
   or perfect-answer guarantee has been established.

STEP 5 NOT COMPLETE
Errors/issues: production build fails on optional Python environment tracing.
Pending tasks: resolve build, production API/fallback/lifecycle checks, final
controlled measurements, full100 answer evaluation, strict gate, preservation audit.
DO NOT PROCEED TO NEXT STEP.

## Recovery update

The user resumed with a dedicated recovery request. The production build blocker
was resolved by an explicit absolute `DOCRAG_RERANKER_HOME` server-launch setting.
No environment/model relocation was needed. Lint,198 tests and build passed.
Production smoke and final experiments are in progress; completion is not yet claimed.
The failure narrative above is retained as historical evidence.
