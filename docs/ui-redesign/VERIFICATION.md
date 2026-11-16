# MONO / GLASS — local verification evidence

The full native contract run, `ui-redesign-d`, completed **27/27 groups, exit 0**
at 2026-11-15 18:33:53 UTC (16 November, 00:03:53 Asia/Kolkata). This records
backend/functionality verification for the local frontend redesign, not a new
deployment or a claim that every browser acceptance check is complete. Browser,
optical and performance evidence is separate in this directory.

The checkout was `feat/production-rag`, HEAD
`b40319ccce62390edd4f8acd6573abc836671f53`, with the intentional redesign diff.
Node 24.22.1 and pnpm 11.25.0 were retained. The verifier froze 245 source files;
its final equality assertion passed, and an independent post-run hash comparison
found no changed files at that checkpoint. A subsequent browser-discovered UI
request serialization repair is verified separately below. Run d is not presented
as 27/27 checks executed on that later source. See [exit receipt](verification-exit-d.json).

## Reproduction and receipts

After verifying the owned native database and preserved model service, the final
command was run with private local configuration and this coverage collection:

```sh
COVERAGE_FILE="$PWD/.local/coverage-ui-redesign-d/.coverage" \
COVERAGE_RCFILE=.coveragerc.integration \
.venv/bin/python -m coverage run -m scripts.verify_observability \
  --deployment --run-id ui-redesign-d
```

Use a new run ID for reproduction; never overwrite this run. The `--deployment`
flag selects the existing local compatibility gate and does not publish anything.
A separate guard sampled the Ollama API 253 times, requiring version 0.40.9;
no runtime guard error occurred. The source stayed fixed throughout the run.

Individual commands and actual exit codes are preserved in
`.local/observability-verify-ui-redesign-d/commands.json`; each group has its
numbered log there. All rows below exited **0**. `py` denotes `.venv/bin/python -m`.

| Log | Command / check | Observed result |
| --- | --- | --- |
| 00 | `make lint` | Ruff, formatting, ESLint and TypeScript pass |
| 01 | `make test` | 218 Python + 269 TypeScript = **487 tests**, zero failures; 28 TS files |
| 02 | `pnpm exec vitest run tests/cache-api.test.ts tests/reranker-api.test.ts tests/observability.test.ts` | 53 focused tests; a subset of the unit suite, not 53 additional unique tests |
| 03 | `make build-fe` | Production build passes |
| 04 | `py scripts.observability_setup` | Additive migration twice; all 11 legacy tables, users, sessions, private files and embeddings preserved |
| 05 | `py scripts.security_setup --apply-selected` | Selected local database migration check passes |
| 06 | `py scripts.security_setup --apply-configured` | Configured local database migration check passes |
| 07 | `py scripts.security_http` | **66 real HTTP checks + 27 SQL checks**; HTTPS cookie flags, eight-hour session and logout replay checked |
| 08 | `py scripts.observability_http` | **138 assertions**, 33 HTTP request IDs; one public-only review candidate |
| 09 | `py scripts.feedback_to_eval` | Public review export passes; no private export or golden-label promotion |
| 10 | `py eval.validate_dataset --require-review` | Preserved 100-question dataset and review receipt pass |
| 11 | `py eval.prompting_gate --baseline eval/results/reranking-selected.json --candidate eval/results/prompting/step5-v1.json` | Saved selected-prompt regression gate passes |
| 12 | Same gate with `eval/results/prompting/grounded-v1.json` | Saved comparison-prompt gate passes |
| 13 | `py pytest -q tests/test_prompting_gate.py tests/test_prompting_report.py tests/test_security_gate.py tests/test_observability_gate.py` | **35 focused gate/regression tests**, including negative controls; included in the 218 Python total |
| 14 | `py eval.prompt_bytes` | **200/200** effective saved prompts byte-identical |
| 15 | `node --import tsx eval/recheck_citations.ts` | Saved structural replay passes; selected prompt has 80 cited answers and 20 refusals; the historical comparison's rejected `postgresql-042` remains disclosed |
| 16 | `py eval.citation_cache_http` | Invalid references cannot replay; cited answers and valid uncited refusals can replay |
| 17 | `py eval.cache_http --prompt-version step5-v1 --out .local/observability-verify-ui-redesign-d/cache-http.json` | Public-cache rules pass; 12 eligible HITs and six MISSes; private/history bypass remains tested separately |
| 18 | `py eval.reranking_smoke --out .local/observability-verify-ui-redesign-d/streaming.json` | Disabled/enabled/missing-model/timeout paths pass, including source provenance and worker shutdown |
| 19 | `py scripts.security_invalidation --prompt-version step5-v1 --out .local/observability-verify-ui-redesign-d/invalidation.json` | Changed fixture content bypasses stale cache; original content restored; no original row deleted |
| 20 | `py eval.run_eval --golden eval/golden_set.jsonl --prompting-experiment step5-v1 --out eval/results/observability/ui-redesign-d/evaluation-raw.json` | 100-question local inference completes |
| 21 | `py eval.promote_local --source eval/results/observability/ui-redesign-d/evaluation-raw.json --out eval/results/observability/ui-redesign-d/evaluation.json` | Authorized automated validation passes; not independent human validation |
| 22 | `py eval.deployment_gate --baseline eval/results/observability/step10-final-c/evaluation.json --candidate eval/results/observability/ui-redesign-d/evaluation.json` | Configuration/evidence compatibility and unchanged **.02** numerical limits pass |
| 23 | `py eval.reranking_integrity --out .local/observability-verify-ui-redesign-d/preservation.json` | Historical evidence/data and asset-secret checks pass |
| 24 | `py eval.prompting_report --out .local/observability-verify-ui-redesign-d/historical-report.json` | Historical report replay passes; this is not new inference |
| 25 | `py scripts.security_audit` | Existing risk policy passes; raw JS audit still exits 1 for two reviewed moderate findings |
| 26 | `git diff --check` | Pass |

Streaming cancellation, private ownership, origin restrictions, quota behavior,
receipt/feedback ownership and persistence failure paths are covered by the unit,
security and observability suites. Their passing counts do not substitute for the
separate real-browser upload/chat/citation/stop checks.

## Final cancellation repair and applicable repeat verification

The real browser found that cancelling before the first answer token leaves an
assistant shell with source metadata but no text. Sending that empty text in the
next request correctly failed the existing server schema with HTTP 400. The UI
now excludes only empty assistant shells from its outgoing text history in
`lib/ui/chat-request.ts`; partial answers and citations remain, and invalid user
text still reaches the unchanged server validator. The failed screenshot and
original preview log are retained. No backend validator was weakened.

After this repair, **14/14 applicable command checks passed, all exit 0**:

| Check | Result / private local log |
| --- | --- |
| `make lint` | PASS; `.local/ui-redesign/lint-post-stop.log` |
| `make test` | **491 tests = 218 Python + 273 TS**, 29 TS files, zero failures; `tests-post-stop.log` in the same directory |
| `make cov` | 491 tests pass; `coverage-post-stop.log` in the same directory; percentages below |
| Production build and focused cancellation/citation/cache/runtime tests | 36 focused TS tests, included in the 273 total |
| Real security HTTP and SQL suite | 66 HTTP + 27 SQL checks |
| Real observability suite | 138 assertions |
| Real citation/cache replay | PASS, including rejected references |
| Four Python gate/negative-control files | 35 tests, included in the 218 total |
| Deployment compatibility + STEP12 numerical regression comparisons | Both PASS, original .02 limits |
| Preservation, dependency policy and whitespace checks | PASS |

The last seven table rows summarize the **11** exact commands/codes in
[post-stop-exit.json](post-stop-exit.json), with logs under
`.local/ui-redesign-post-stop/`. The three separate make commands bring the total
to 14. Focused tests and coverage reruns are not added to the unique test count.
The 184-entry post-fix source manifest remained unchanged during verification
and final review (SHA256 `2cc07315ad56ad054bf020d835edbb3487b063b4d4521521d3fbac0f68bfbce0`).

Only `components/workspace.tsx` differs among run d's 245 frozen files; the helper
and its four regression tests are new. The unchanged evaluator uses its own
single-turn `eval/local_adapter.ts` call to `startRagAnswer`, not this UI history
serializer. Run d's engine evaluation is therefore retained with its original
provenance, not called a second fresh evaluation. Final production browser checks
then reproduced stop-before-text followed by a successful answer and exact source
focus. Upload, feedback, owned evaluation/metrics, account isolation and logout
protection also passed; see [native-browser-final.json](native-browser-final.json).

## Fresh evaluation and model identity

The [promoted result](../../eval/results/observability/ui-redesign-d/evaluation.json)
contains **100 fresh answers and 100 fresh query embeddings**, with **15 fresh and
85 cached judgments**. SQL retrieval was rerun. Cached judgments and the preserved
calibration are not described as fresh model generations. The authorized validator
explicitly reports `independent_human_validation: false`.

| Measurement | Result |
| --- | --- |
| Questions | 80 answerable, 20 unanswerable |
| Recall@3 / @5 / @10 | .950 / **.975** / 1.000 |
| MRR | .9729167 |
| Faithfulness / correctness | **1.000 / .990** |
| Citation support | **265/265**, 1.000 |
| Retrieval p50 / p95 | 40.48 / 44.57 ms |
| Fresh answer generation p50 / p95 | 5,832.81 / 12,443.73 ms |
| Pipeline p50 / p95 | 5,878.97 / 12,483.39 ms |
| Evaluation wall time | 1,059.95 s; 18:15:41–18:33:21 UTC |
| Paid API charges | ₹0; local Ollama only |

The gate reports recall decline 0 and faithfulness decline −.005 (an increase),
within unchanged .02 thresholds. This is not a causal claim that the UI improved
answer quality. Correctness remains below 1: `postgresql-005` omitted that a
savepoint remains defined after rollback; `postgresql-037` omitted the foreign-key
part absent from its retrieved excerpts. Both received .5 correctness and remain
in the result. No labels, prompts or thresholds were changed to hide these limits.

[Runtime recovery evidence](runtime-recovery-d.json) verifies the owned native
PostgreSQL cluster at port 55433, preserved Ollama **0.40.9**, loopback binding and
cloud disabled. The evaluator records PostgreSQL 16.15 and pgvector 0.8.6.

| Model | Verified digest |
| --- | --- |
| `qwen3.8:latest` | `47951e4a666180bc2aedfc93c169472f2de783696fe196efbf063f5730ecf163` |
| `embeddinggemma:300m` | `85462619ee721b466c5927d109d4cb765861907d5417b9109caebc4e614679f1` |

No model downloads or updates were performed. The final native receipt is not a
fresh container-connectivity, Gemini, hosted CI or production deployment result.

## Coverage scope and unchanged backend

The final post-fix `make cov` measurement in
`.local/ui-redesign/coverage-post-stop.log` exited 0 with **491 tests**. Python
unit-only script coverage is **377/1869 = 20.17%** (console rounded to 20%).
TypeScript coverage is **58.31% statements (1280/2195)**, **59.21% branches
(938/1584)**, **50.75% functions (234/461)** and **62.50% lines (937/1499)**.
The TS denominator grew with the UI; coverage is lower than historical 65.36%.
Browser checks are not included in V8 coverage. No TS percentage gate exists,
and no new gate or exclusion was introduced. Earlier `coverage-unit.log`
(58.34%) and `coverage-final.log` (58.10%) remain historical intermediate runs.

The final native run's separate coverage inputs are retained under
`.local/coverage-ui-redesign-d/`. They are not claimed to establish a fresh full
70% integration pass. The last complete documented Python measurement is
**historical publication coverage 1429/1869 = 76.46%**, zero exclusions, with its
explicit mixed historical/fresh provenance in
[PUBLICATION_STATUS](../PUBLICATION_STATUS.md). The earlier STEP12 74.38% collection
also remains preserved. Neither historical percentage is relabeled fresh.

Final byte comparison found all 106 selected tracked API/backend, Python-script,
database, dependency and build/configuration files unchanged against `b40319c`;
see `backend-preservation-final.json` for the exact paths. An earlier independent
review also checked 105 selected files; the earlier 66-file receipt is retained. All 23 script hashes listed in the publication coverage provenance
still match; the publication helper itself is also unchanged from that commit.
The UI task does not change Python, Docker, database or load-test implementation.
The roadmap's complete container/load coverage collection is therefore retained
as historical evidence rather than rerun only to increase this frontend task's
coverage number. The existing 70% gate and denominator remain unchanged.

## Security, preservation and limits

Fresh dependency policy evaluation passed. Raw `pnpm audit --json` exited **1**:
`esbuild` GHSA-67mh-4wv8-2f99 and `minimatch` GHSA-g3hv-75wg-m249 are the two
previously reviewed moderate tooling findings. The optional Drizzle CLI/esbuild
peer remains absent from production server dependency traces. Python audit scanned
38 installed packages and the optional reranker audit 42 packages; both exited 0
with no known findings. See [SECURITY](../SECURITY.md) for the existing assessment.
This is not a zero-vulnerability JS claim, and no dependency upgrade was made.

Preservation verified 97 historical file hashes, the 100-question golden set,
162 selected chunks, 20 original Gemini cache pairs, 151 original Gemini vectors
and 151 original local vectors. Those original vectors are distinct from the
selected 162-chunk and later demo indexes. Existing cache defaults, model settings,
ownership and security code are unchanged. The final exact-staging/history/secret
review is documented separately in [ACCEPTANCE](ACCEPTANCE.md) and the local Git
receipts; passing verifier asset scans alone is not that release checkpoint.

## Rejected and interrupted evidence

| Run / observation | Actual outcome and disposition |
| --- | --- |
| `ui-redesign-a` | Exit **2** at `make test`. An accidental process-wide `AI_PROVIDER=ollama` override exposed a missing isolated URL in one suite. The launcher was corrected; no assertion or test was weakened. [Receipt](verification-exit-a.json) retained. |
| `ui-redesign-b` | Exit **1** at group 22: actual Ollama 0.40.14 disagreed with required 0.40.9. Its 100-answer result and rejected gate remain in `eval/results/observability/ui-redesign-b/`. It is not accepted regression evidence. Earlier 0.40.9 startup evidence does not explain the later replacement; cause unknown. |
| `ui-redesign-c` | **Interrupted**, exit unavailable, 20 groups completed and 57/100 questions observed. No completion receipt; not accepted. The verifier, previews and model processes were absent at independent inspection; cause unknown. [Receipt](verification-exit-c.json) retained. |
| CSS optics check | Actual Chromium backdrop blur was missing because the installed minifier retained only the prefixed declaration. Standard declaration last corrected output; computed High = `blur(12px)`, Low = `none`. This repair preceded final run d. [Receipt](compiled-glass-fix.json). |
| Early screenshots/performance | `capture-a-*` includes stale viewport rasters; `performance-browser.json` precedes the blur correction. They remain retained and must not be cited as final optics/performance proof. Final browser records are separate. |
| `ui-redesign-d` | **PASS 27/27, exit 0**, with its source frozen and runtime continuously checked. It preceded the final UI-only cancellation repair; see the 14 applicable repeat checks above. |

The stopped services were restarted only under the user's existing authorization,
after ownership/port checks. No conflicting process was killed. No cause is
attributed to another project or to DocRAG without evidence. Historical production,
container, cloud-provider and hosted-CI receipts retain their original dates and
scope; this local run does not refresh them.

## Source fingerprints

Full frozen manifest: `.local/observability-verify-ui-redesign-d/source-hashes.json`
(245 entries), SHA256
`7950043d155009afa3d7977392cf73a83968cfd96c016418911cd02648a9bcaf`.
Promoted evaluation SHA256:
`f38b84ebc4b901af0b12c822909cf7b5fdc45f531947b152592a3e89992bd876`.

| Source measured by run d (pre-serializer repair) | SHA256 |
| --- | --- |
| `app/globals.css` | `644cf0d50c05f9faa2ffebf451c62c984843fa9b6a5ecb48380f5cc9c9d84d72` |
| `components/ui/liquid-pill-group.tsx` | `8d3f8c905cf07cb020bc9afd3aa8094dc74fffa1b9f5c02ec88d3ba8d4511213` |
| `lib/ui/liquid-physics.ts` | `6d05298cb655826eb11262731a8f789ba237447e4217ccbbfe2585bd3d9a7fda` |
| `components/appearance.tsx` | `c30bd46baf509312c25b81f6312d494bdff6b64874351e9d008f213bac9947e3` |
| `components/chat-panel.tsx` | `2a2dfeebedf392247b006a077b757879f39c944ef4c71858f48eb2aaec849a52` |
| `components/sources-panel.tsx` | `8383faf9e83c14c0a7db3440573deb39b8e2e5850e9e36e932169668e483cd5f` |
| `components/workspace.tsx` | `b6a61aac7639c0feca6e32e7313f69d645c174947196e5f1579968aefae02231` |
| `components/demo-workspace.tsx` | `0befe070295c7915063674a74049d42ae12f2e25568ebff16febf558d1ffec3f` |
| `components/document-panel.tsx` | `79314554a224040cbb6d053263a209a30bc0bee3ea36ccb817b3d60efe22f4b0` |
| `components/message-content.tsx` | `c223e0f7564dac7bbd9d1f6d2c26b16c66f7d53372840456128e6f37b791adf1` |

The final UI-only delta and final source hashes are in `final-source-review.json`.
