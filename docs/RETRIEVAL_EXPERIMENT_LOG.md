# Step 4 retrieval experiment log

Frozen corpus: heading-v1 1400/280, 162 chunks. Same Step 3 source annotations, models, prompts and judge rubric. No paid inference.

## Development measurements

| Strategy | Recorded UTC | Result |
|---|---|---|
| control | 2026-10-27T13:18:13.302751+00:00 | Retained: quality matched historical control and lowest eligible hybrid median latency. |
| vector | 2026-10-27T13:18:18.272715+00:00 | Diagnostic ablation: same development source quality; no measured benefit over hybrid. |
| keyword | 2026-10-27T13:18:19.099535+00:00 | Diagnostic ablation: AND over complete questions usually returned no results. |
| combined | 2026-10-27T13:18:24.206854+00:00 | Not selected: same quality; median retrieval slower than control. |
| pool24 | 2026-10-27T13:18:29.291358+00:00 | Not selected: larger pools did not improve measured rankings; slower than control. |
| broad24 | 2026-10-27T13:18:34.480941+00:00 | Ineligible under frozen selection rule: improved Recall@5 but reduced MRR and top-six source precision. |

Selection frozen at `2026-10-27T13:18:34.500710+00:00`. The saved selection receipt binds every development file by SHA-256 before holdout.

## Final assessment

Control was selected, so one 40-question / three-repetition holdout run assesses both control and winner. Holdout Recall@5 is 1.0 and MRR is .96875. No new strategy was selected after observing holdout.

The first full-answer launch exited before question 1 with `OperationalError`: the native PostgreSQL server was stopped. `make db-status` confirmed this; `make up` restarted the existing owned cluster. The retry uses the same frozen configuration. No result artifact was created by the failed launch.

Full-answer evaluation results and final verification are recorded in STEP4_COMPLETE.md only after those commands finish. No failed candidate was deleted or retuned.

Artifacts: `eval/results/retrieval/*-development.json`, `control-holdout.json`, `selection.json`, `query-plans.json`, and `profile-verification.json`. Detailed methodology and exact metrics: HYBRID_RETRIEVAL.md and the JSON artifacts.
