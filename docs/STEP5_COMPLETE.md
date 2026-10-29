# STEP REPORT — STEP 5 FIX

Completed verification: 2026-10-29 (Asia/Kolkata).

Repository: https://github.com/abhi0874/DocRAG
Branch: `feat/production-rag`

Previous Step 4 audit: PASS. Original Step 5 task groups: 17/17. Final verification groups: 18/18 PASS.
Tests: 138 Python + 70 TypeScript = 208 passed, 0 failed. Nothing pushed. Paid API charges: ₹0.

The production build now succeeds because the optional Python installation is configured at server launch through an absolute `DOCRAG_RERANKER_HOME`, instead of being discovered as project-relative bundle assets. No environment, weights or Ollama models were moved or deleted. Next.js remains the web backend.

Reranking is tested and available, but disabled by default. The original hybrid strategy won the predeclared development rule: MiniLM improved recall slightly but reduced MRR and added latency. Selected full 100-question quality matched Step 4. This step does not claim perfect answers or remote deployment.

## Full 100-question quality (automated)

| Metric | Step 4 | Step 5 selected |
|---|---:|---:|
| recall@3 | 0.95 | 0.95 |
| recall@5 | 0.975 | 0.975 |
| recall@10 | 1.0 | 1.0 |
| mrr | 0.9729166666666667 | 0.9729166666666667 |
| citation_accuracy | 1.0 | 1.0 |
| faithfulness | 1 | 1 |
| correctness | 0.99 | 0.99 |

Citation occurrences: 269/269. 98 complete and 2 partially correct answers under the automated rubric. 20 unanswerable cases received full automated quality scores; these do not independently prove every refusal correct.

## Latency and resource conditions

| Full 100-question observed wall timing (ms) | Step 4 p50/p95 | Step 5 p50/p95 |
|---|---:|---:|
| Retrieval | 51.69933300000001 / 62.65260654999998 | 33.5998335 / 41.63567740000001 |
| Generation | 5882.515167 / 11658.978309749995 | 5241.5173125 / 12066.2289393 |
| Pipeline | 5934.257104 / 11715.474928849995 | 5277.7874795 / 12102.8084482 |

The resumed run contains 17 cached embeddings/answers and 16 cached judgments; 83 answers and 84 judgments were fresh. Its mixed-cache overall timing is NOT an optimization speedup. For the 83 fresh-answer questions, Step 5 retrieval p50/p95 was 37.322416/41.6953542ms and pipeline 5931.755875/12502.1708536ms. Step 4 on those same questions: retrieval 51.690875/61.1969208ms and pipeline 6116.51925/13018.0123083ms. These are descriptive observations across runs, not controlled proof of speed improvement.

Pipeline excludes evaluation-process startup and judging, as in the unchanged metric definition. SQL executes on every request; query/answer/judge caches require compatible configuration and context. The separate replay had 100 hits and 0 misses in each category and reproduced all contexts, answers and judgments. Cache replay is not fresh-model determinism.

MiniLM: `cross-encoder/ms-marco-MiniLM-L6-v2`, Apache-2.0, revision `233902d25c440f23af6f7d6e94d2946bac0bee0a`. CPU 4 threads, batch 8, max 512 tokens; no truncated pairs in the measured candidate matrix. Python 3.14.6, Torch 2.14.1, Transformers 5.21.0; environment pins in requirements-reranker.txt. Ollama 0.40.9 and both original model digests verified. CPU and MPS real inference passed.

Clean matrix: 3 configurations × 60 development questions × 3 repetitions plus 40 control holdout questions × 3 = 660 observations. Pools 10 and up to 20 (actual 12); RRF 12/12 and chunking 1400/280 unchanged. Warm reranker p50/p95: top10 114.652750/131.2215494ms; larger 137.374375/158.4795039ms (179 warm observations each). Cold worker requests 1633.008875/1689.425333ms; initialization 1465.675125/1495.555834ms. Peak worker RSS 782,876,672/885,063,680 bytes. The selected disabled configuration has no model inference overhead. Full tables and CPU/MPS toy measurements are in RERANKING.md.

## The two incomplete answers

- postgresql-005: source chunk 106 remains rank 1. The final context explicitly contains the savepoint’s continued existence; all three targeted configurations omit that detail. Automated F 1 / C 0.5. This is an answer-composition limitation; reranking did not repair it.
- postgresql-037: complete hybrid pool contains 12 chunks, including foreign-key evidence 128 at original rank 10, 126 at 11 and 123 at 12. Top 10 reranking puts 128 at 9; larger reranking puts 123 at 9 and 128 at 10. The final six remain join passages. Both reranked diagnostic answers remain incomplete (F 1 / C 0.5). The full selected run also remains incomplete.
- A separate fresh control diagnostic supplied the correct foreign-key fact despite its absence from selected context. Its automated correctness was 1 but faithfulness 0.5. This is a grounding failure, NOT a fix. It is preserved in case-diagnostics.json and not hidden by the full 100-question faithfulness score.

The targeted diagnostic set has four questions per configuration (two above plus one unanswerable per document). Control F/C = .875/.875; top 10 and larger F/C = 1/.75; all five evaluated citation occurrences/configuration were supported. These tiny diagnostic averages are not comparable to the full 100-question aggregate and were not used for selection. Citation accuracy measures cited occurrences, not coverage of every uncited claim.

## Verification groups

All positive commands below exited 0. Synthetic excessive-regression subprocesses correctly exited 1. Full commands and environment setup are in COMMAND_CONTRACT.md.

| # | Check | Result |
|---|---|---|
|1|Original Step 4 independent audit|PASS; 162 original tests, build/lint, metrics, dataset and preservation|
|2|`make lint`|PASS; Ruff, formatting, ESLint, TypeScript|
|3|`make test`|PASS; 138 Python + 70 TypeScript|
|4|`make build-fe`|PASS; production build, all API routes emitted; no type-check suppression|
|5|Production trace audit|PASS; 10 manifests, no Python venv/site-packages/safetensors entries, required API routes present|
|6|`scripts.reranker_probe --out .../device-probe-final.json`|PASS; 6 real inferences each on CPU/MPS; weights verified|
|7|`eval.reranking_smoke --out .../api-smoke-final.json`|PASS; home/documents/streaming chat; enabled, disabled, missing runtime, timeout; exact fallback IDs and worker shutdown|
|8|`eval.reranking_experiments matrix`|PASS; 660 clean observations, frozen control selection|
|9|`eval.reranking_report --profiles-only`|PASS; source/code provenance, all repeated ranks, split coverage, metrics, chronology|
|10|`eval.run_eval ... --reranking-experiment control` selected run|PASS; 100 complete records; original raw file retained|
|11|`eval.promote_local --source ...raw.json --out ...selected.json`|PASS; automated protocol attached without changing measurements|
|12|`eval.reranking_gate --baseline ...retrieval-selected.json --candidate ...reranking-selected.json`|PASS; exact thresholds,zero Recall@5/faithfulness loss|
|13|`eval.reranking_report` and negative tests|PASS; 100 exact disabled evidence matches; >.02 recall/faithfulness drops rejected; unrelated model/prompt/context changes rejected|
|14|`eval.reranking_cases`|PASS; 12 diagnostic generations/judgments; limitations retained|
|15|Separate full cached replay and `eval.verify_results --diagnostic`|PASS; 100 hits/category, exact contexts/answers/judgments|
|16|`eval.validate_dataset --require-review`|PASS; unchanged100 questions/corpus/source mapping|
|17|`eval.reranking_integrity`, historical `AI_PROVIDER=ollama make eval-gate`|PASS; all prior artifacts, Gemini 20 cache pairs / 151 vectors, original 151 local vectors and 162 selected chunks; secret scan|
|18|Git/process safety audit|PASS; branch/history preserved, no push, no destructive data changes; benchmark server stopped and desktop supervisor restored|

## Original 17-task audit

|Task|Evidence / outcome|
|---|---|
|1 Retrieval inspection|Existing Next.js/Drizzle/hybrid path, adapters and source metadata inspected; insertion through selectContext|
|2 Incomplete-answer audit|Exact references, full candidate pools, context and answers retained in diagnostics; composition versus selection distinguished|
|3 Model selection|Official model/license/revision checked; user-approved removable installation; pinned dependencies and checksum|
|4 Real inference|CPU/MPS numeric finite scores and expected simple ordering; cold/warm/resource measurements|
|5 Optional interface|Disabled/enabled selection, stable ranks/ties, preserved identities and scores; disabled default|
|6 Real application|Production HTTP enabled mode changes sources with real scores; Next.js remains backend|
|7 Fallback|Missing runtime, timeout, failure/invalid-score unit cases; explicit status/reason; original ordering preserved|
|8 Controlled configurations|Off/top10/up to 20; frozen development/holdout split and unchanged retrieval/model settings|
|9 Retrieval quality|Recall 3/5/10, MRR,multi-hop coverage,candidate coverage/rank changes and actual counts saved/recomputed|
|10 Latency/resources|Hybrid, initialization,warm/cold reranking,selection,pipeline and RSS measured; cache conditions disclosed|
|11 Selection|Control retained under frozen rule; measured no worthwhile overall gain; disabled by default|
|12 Both answers revisited|Neither reranker reliably repaired either; extra control grounding failure disclosed|
|13 Full end-to-end|100 records through shared actual application selection/generation; source/code/caches verified|
|14 Regression|Step 4-compatible strict >.02 gate passes; negative tests and unrelated-change rejection pass|
|15 Tests|208 passing; unit/mocked failures plus real HTTP/model checks; safe removal tested only on temporary fixtures|
|16 Documentation|RERANKING.md, COMMAND_CONTRACT.md, STEP5_STATUS.md and this report; preliminary evidence preserved|
|17 Final verification|All groups above passed; local commits only; no mandatory Step 5 work remains|

## Local change record

All commits below are local; the original three Step 5 commits and Step 4 ancestor remain intact. The final documentation commit is available from `git log -1` after this report is committed.

- `71f47fc` — Add isolated removable MiniLM runtime and device probe
- `449d277` — Integrate optional local reranking with explicit hybrid fallback
- `d0806f8` — Add controlled reranking experiments and strict regression gate
- `0c1f418` — Separate optional host runtime from Next.js build asset discovery
- `df6f77a` — Preserve pilot evidence and verify production reranker modes
- `ee7e528` — Freeze clean reranking comparison and retain hybrid default
- `dba44c8` — Verify reranking evidence and record interrupted evaluation recovery
- `23db715` — Tighten reranking compatibility and document measured runtime costs
- `f25bc78` — Record complete resumed 100-question Step 5 measurements
- `25aac9d` — Record verified Step 5 results and production checks

Changed files relative to the completed Step 4 commit `4ba666c`:

```text
.env.example
app/api/chat/route.ts
app/api/evaluations/route.ts
docs/COMMAND_CONTRACT.md
docs/RERANKING.md
docs/STEP5_COMPLETE.md
docs/STEP5_STATUS.md
eslint.config.mjs
eval/local_adapter.ts
eval/reranking_cases.py
eval/reranking_experiments.py
eval/reranking_gate.py
eval/reranking_integrity.py
eval/reranking_report.py
eval/reranking_smoke.py
eval/results/reranking-final/api-smoke-final.json
eval/results/reranking-final/api-smoke.json
eval/results/reranking-final/case-diagnostics.json
eval/results/reranking-final/control-development.json
eval/results/reranking-final/control-holdout.json
eval/results/reranking-final/desktop-restoration.json
eval/results/reranking-final/device-probe-final.json
eval/results/reranking-final/device-probe.json
eval/results/reranking-final/preservation.json
eval/results/reranking-final/runtime-build-audit.json
eval/results/reranking-final/selection.json
eval/results/reranking-final/top10-development.json
eval/results/reranking-final/top20-development.json
eval/results/reranking-final/verified-report.json
eval/results/reranking-repeat-raw.json
eval/results/reranking-selected-raw.json
eval/results/reranking-selected.json
eval/results/reranking/control-development.json
eval/results/reranking/control-holdout.json
eval/results/reranking/device-probe.json
eval/results/reranking/selection.json
eval/results/reranking/top10-development.json
eval/results/reranking/top20-development.json
eval/retrieval_report.py
eval/run_eval.py
eval/runtime.py
lib/rerank.ts
lib/reranker-client.ts
lib/reranker-config.ts
lib/reranker-model.json
lib/select-context.ts
requirements-reranker.txt
scripts/reranker_probe.py
scripts/reranker_setup.py
scripts/reranker_worker.py
tests/reranker-api.test.ts
tests/reranker.test.ts
tests/select-context.test.ts
tests/test_reranker_removal.py
tests/test_reranking_gate.py
tests/test_reranking_report.py
tests/test_retrieval_experiments.py
tsconfig.json
```

## Limitations and user checks

Automated scores are not independent human validation. The small two-document, 12-page benchmark and reused 60/40 split do not establish general accuracy. The extra unsupported control answer shows that full-run F 1 does not guarantee grounded answers on every fresh call. The original Gemini benchmark remains 20/100 and is preserved; no Gemini quota was consumed here. No remote host/deployment was verified. A host enabling reranking must separately provision Python/weights/worker modules and its absolute runtime path; otherwise explicit hybrid fallback applies. API charges are ₹0; local computation still uses power and memory.

What you can check: (1) Read the optional configuration and removal instructions in RERANKING.md; (2) keep RERANKER_ENABLED=false for the selected default; (3) inspect the two saved PostgreSQL answers and grounding limitation before presenting benchmark claims. No installation or key entry is needed.

Build recovery errors were resolved without dependency downgrades, environment deletion, or disabling tracing/types. Two ad hoc audit commands initially used system Python without the project’s psycopg/dotenv packages; both were rerun successfully through the documented .venv. No dependency or application changes were needed. A restricted font fetch and an unavailable sandbox MPS device were resolved with permitted network/GPU access, not disabled checks. Desktop automatic server relaunch was handled by temporary, authorized process control and restored afterward.

CONFIRMATION 1 — BUILD AND INTEGRATION: PASS
CONFIRMATION 2 — EVALUATION: PASS
CONFIRMATION 3 — TESTS AND GITHUB SAFETY: PASS

No unresolved implementation/test failures. Known answer limitations are described above. No required Step 5 tasks pending. No Step 6 work or GitHub push.
