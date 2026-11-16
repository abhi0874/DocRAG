# MONO / GLASS local redesign complete — 16 November 2026

The separate frontend redesign is complete locally on `feat/production-rag`.
See [acceptance](ui-redesign/ACCEPTANCE.md), [verification](ui-redesign/VERIFICATION.md)
and [performance](ui-redesign/PERFORMANCE.md). The existing public deployment at
`b40319c` is unchanged; this redesign has NOT been pushed or redeployed.

Both themes, liquid controls, appearance preferences and responsive public/native
workspaces are implemented. Final 491 unit tests, lint/build and 14 applicable
post-repair commands pass. The earlier 27/27 full contract result is retained with
its exact pre-serializer source provenance. Its 100 fresh local answers/embeddings
and 15 fresh/85 cached judgments yield Recall@5 .975, faithfulness 1, correctness
.990 and citations 265/265; unchanged regression gates pass.

Real local browser upload/chat/citation/cancellation/feedback/isolation checks pass.
Chromium 157 and Safari 27.3 have the documented browser scopes. Short interaction
measurements observed approximately 120Hz, p95 8.6–9.3ms, 11 estimated drops over
13,173 frames and no observed long tasks. 165Hz and physical-device testing remain
unverified. Final TS statement coverage58.31%; Python unit20.17%; complete Python
integration76.46% remains historical. Two reviewed moderate JS advisories remain.

Implementation commit: `acddb35`. Exact-stage and local-commit receipts are under
docs/ui-redesign; LOCAL_COMMITS.md identifies its containing evidence commit.
Preserve all rejected/interrupted runs. No new dependency, paid API, model change,
unrelated service change or destructive operation. Further push, hosted CI,
redeployment and production smoke checks require separate explicit authorization.
Service availability must be inspected afresh before future work.

## Earlier publication and roadmap checkpoints (historical)

# Public deployment verified — 13–14 November 2026

The user explicitly authorized the separate publication phase after STEP12.
Live demo: https://docrag-demo.onrender.com/ — Render Free in Virginia, Neon Free
public-only database, existing unbilled Gemini project. Production acceptance:
53/53 checks PASS, including two-user HTTPS sessions, streaming/citations, refusal,
feedback isolation, cancellation and quota rejection. Baseline d128e82 was pushed
normally and hosted CI passed. See [PUBLICATION_STATUS](PUBLICATION_STATUS.md)
for receipts, final-commit verification procedure, cost evidence and rollback.

460 fresh unit tests, lint, saved-evaluation regression gate and34 negative controls
pass. Local100-question and cloud-retrieval results retain their original provenance;
no100-question hosted generation was run. Two reviewed moderate JS advisories remain.
No paid plan, payment method, billing activation, unrelated service change, force
push, PR or merge. Historical no-publication statements below describe their dates.
Future material changes still require applicable authorization. Inspect actual Git,
latest hosted CI and live services; saved checks are not an uptime guarantee.

## Historical local STEP12 acceptance

# STEP 12 COMPLETE — local release readiness — 12 November 2026

21/21 tasks and confirmations1/2/3 PASS. See STEP12_COMPLETE.md and step12/ for
commands, preserved failures, source hashes, provenance and limitations.
27/27 groups,460 unit tests,26 container checks and local CI-equivalent checks pass.
Python integration coverage74.38%; TypeScript statements65.36%.100 fresh answers/
query embeddings,37 fresh and63 cached judgments:Recall@5 .975,faithfulness1.000,
correctness.985,citations265/265. The.005 correctness decrease is documented.

Ollama0.40.9/cloud-off/digests, owned native PostgreSQL55433 and DocRAG containers
pass after explicitly authorized recovery. Unrelated container remains exited and
untouched; outage causes unknown.18 bounded load stages pass:6786 requests,
2567 quota rejections,zero unexpected failures;50-user queue p95 73.204s,cap2.
Two reviewed moderate JS tooling advisories remain; Python/reranker audits pass.

Source83e13c7 remains unchanged; this checkpoint adds only reviewed documentation
and public evidence. Local completion is subject to the containing commit's final
clean-status check. No push, public deployment, remote Actions, PR, merge, cloud
resources, paid usage or billing activation. Further publication/deployment needs
explicit authorization. Reinspect live services before future work.

## Historical STEP12 checkpoints — superseded

# STEP 12 IN PROGRESS — confirmation criteria authorized

The user delegated definition of STEP12 confirmations1/2/3. Acceptance criteria
are recorded in step12/acceptance.md: application correctness/security;
reproducible verification/operations; documentation/release scope/Git safety.
The previous missing-definition blocker is resolved. STEP12 remains NOT COMPLETE.
Fresh full verification and final audits are pending. No publication is authorized.

## Earlier STEP12 initial audit

# STEP 12 AUTHORIZED — initial audit complete, acceptance definitions pending

The user's later STEP12 request supersedes earlier authorization boundaries below.
STEP12 is NOT COMPLETE. Initial checkout was clean at83e13c7 onfeat/production-rag.
Independent audit matched224 STEP11 source hashes, all27 passing saved command
receipts and their logs,460 saved tests,26 container checks and validated the
100-question result/provenance. No material result discrepancy was found in this
initial audit. Fresh STEP12 lint and460 unit tests pass; service/digest/database
ownership and separate768/1536-dimensional vector checks pass. No service changes,
model calls, push, deployment or billing action occurred.

No repository definitions of STEP12 confirmations1/2/3 were found. The user
explicitly prohibits inventing these definitions; clarification is pending.
Do not declare STEP12 complete or release ready. Remaining fresh full integration,
evaluation/security/browser/CI checks and final documentation/portfolio/Git work
are pending. See step12/initial-audit.json. Earlier completion claims below apply
only to STEP11's authorized local scope, not STEP12.

## Historical STEP 11 checkpoint

# STEP 11 COMPLETE — local preparation only — 10 November 2026

12/12 tasks accepted; all three confirmations PASS. Read STEP11_COMPLETE.md for
scope, commands, provenance and limitations. Source commits9cc80bc,71ce85d,f9f33d8;
final documentation/evidence belongs to the commit containing this checkpoint.

27/27 contract groups,460 tests,26 container checks and fresh Linux SQL checks
passed. The100-question local evaluation has100 fresh answers,92 fresh/8 cached
judgments:Recall@5 .975,faithfulness1.000,correctness.990,citations264/264.
Regression thresholds remain.02. Python integration coverage71.16% (1214/1706,
zero exclusions) passes70%; TypeScript statements65.36%. The coverage accumulation
bug was repaired and verified by repeat gate execution; earlier failures remain.

Owned PostgreSQL55433, preserved Ollama0.40.9/cloud-disabled/both digests and
DocRAG Docker services passed. Container-host connectivity passed. The unrelated
text-to-sql container stayed exited and untouched, with matching minimal snapshots.
Service outage and historical restart causes remain unknown.

Public Gemini streaming/citations/refusal/cancellation/quotas passed. Separate
162 cloud vectors and100-query retrieval yield Recall@5 .96875; this is not an
answer-quality benchmark. Billing confirmation is resolved; no linked account.
Mobile390px/320px layout passes after repair.18 load stages passed:6787 requests,
2438 HTTP429,zero unexpected errors. Two moderate JS tooling advisories remain
under the existing reviewed policy; Python/reranker audits pass.

NOT DEPLOYED. Remote GitHub Actions NOT RUN. No cloud resources, push, PR, merge,
paid API usage or billing activation. STEP12 is NOT AUTHORIZED and NOT STARTED.
Reinspect live services before later work; these are saved verification results.

## Earlier checkpoints (historical, superseded)

# STEP 11 RECOVERED; VERIFICATION IN PROGRESS — 10 November 2026

The user explicitly authorized service recovery. The owned PostgreSQL cluster,
preserved loopback/cloud-disabled Ollama0.40.9 (both digests), Docker Desktop and
DocRAG containers are freshly verified. The unrelated text-to-sql container stayed
exited and untouched. No database/schema/model reset or software replacement.
See step11/recovery-20261110.json.

All frozen verification source hashes match. The20 completed contract receipts
are retained; seven remaining groups resume through the existing evaluator/cache
logic in .local/step11-resumed-verification-a. No result splicing. Final fresh/cache
counts and quality gates remain pending; do not claim100 questions complete.

Live public-demo answer/citation navigation, unanswerable refusal, private-text/
upload/evaluation denials, all three SQL quota caps and cancellation telemetry
passed after recovery. Mobile390px inspection found header overflow to445px;
repair waits until the measured source snapshot is released. Interim integration
coverage57.39% fails the unchanged70% gate; final bounded load coverage is pending.
No new cloud indexing or large Gemini answer evaluation is needed.

STEP11 remains NOT COMPLETE. All three final confirmations pending. No push,
public deployment, billing activation or STEP12. Preserve uncommitted work and all
prior failed/interrupted receipts. Earlier blocked snapshots below are historical.

## Earlier checkpoint

# STEP 11 BLOCKED — 10 November 2026

3/12 task areas have accepted evidence: prior STEP10 prerequisite audit, hosting
research/design recommendation, and isolated cloud embedding/retrieval measurement.
Current live prerequisites FAIL; earlier audit success does not establish current
availability. Source commit9cc80bc is local. All uncommitted implementation,
documentation and historical evidence remain preserved.

On resume, Ollama11434 and demo8006 refuse connections; owned native PostgreSQL
reports stopped (make exit2); Docker daemon socket is absent. Evaluation/demo
processes are not running. Cause unknown. No recovery/service action was taken.
Stop until authorized prerequisite recovery; do not substitute runtimes or reset data.

Before interruption:218 Python +242 TS tests, lint/build,66 security HTTP checks,
138 observability assertions and26 container checks passed. The full contract
completed20/27 groups and reached12/100 fresh local answer/judge cases; it is NOT
complete. All evaluation gates and final integration coverage remain pending.

Google Cloud screenshots confirmed no linked billing account. Two bounded live
Gemini probes passed. Explicitly authorized bootstrap indexed162 public chunks in
new local docrag_demo_gemini_v1, preserving local vectors. Separate100-question
cloud retrieval:Recall@3 .93125, Recall@5 .96875, Recall@10 .99375 (80 answerable
cases). No cloud answer-quality evaluation is implied. Browser observed submission
and loading, not a verified completed answer/citation flow. No public deployment.

See step11/resume-blocker-20261110.json, cloud-retrieval-summary-a.json and
DEPLOYMENT.md. Three confirmations pending. No push, paid usage, billing activation
or STEP12. Remaining source/docs are intentionally uncommitted pending verification.

## Earlier STEP 11 checkpoints (historical)

# STEP 11 NOT COMPLETE — 10 November 2026

1/12 tasks accepted: STEP 10 prerequisite audit. All 213 saved source hashes
match; 27/27 historical verification receipts passed. Fresh owned database status
and pinned Node pass. Authorized Ollama0.40.9 startup, both digests and host/native/
container access passed; see docs/step11/ollama-startup-20261110.json (path from repository root).

Stopped at the required Gemini manual gate: project billing-disabled status and
actual model quotas are unconfirmed. No live Gemini calls or cloud implementation.
See [task inventory and console instructions](step11/gemini-manual-gate-20261110.md).
All three STEP 11 confirmations remain pending. No push, deployment, paid API or
STEP 12. Earlier reports below are historical and do not grant publication authority.

## Previous completed STEP 10 checkpoint

# STEP 10 COMPLETE — 9 November 2026 (Asia/Kolkata)

12/12 tasks and all three local confirmations passed. Fresh final-c:27/27 command
groups,208 Python +221 TypeScript tests,26 container checks and18/18 sustained
load stages. Python integration coverage74.34% exceeds unchanged70% (no exclusions);
unit-only22.14%, TypeScript66.17%. See STEP10_COMPLETE.md and step10/final-c-verification.json.

Fresh loadD:6,795 requests;2,480 HTTP429 errors; no other request failures.
Streaming successful RPS5/20/50 users:1.643/1.179/0.658; queue p95:
5.067/14.559/74.737s. Model admission is capped2; no production speedup or
50-way generation capacity is claimed. Capacity/quotas remain documented limits.

The100-question evaluation reran SQL retrieval and reused100 compatible cached
answers/judgments:Recall@5 .975, faithfulness .995, correctness .985,260/260
citations. Original and STEP9 comparison gates passed, thresholds unchanged.02.
Raw JS audit exits1 for two reviewed moderate tooling advisories; policy and
Python/reranker audits pass. Remote Actions NOT RUN—no push authorized.

Authorized recovery restored Docker, owned native PostgreSQL55433 and preserved
Ollama0.40.9 on loopback11434/cloud off. Both digests and host/container access
pass. DocRAG app/database are healthy. The unrelated database remained stopped;
its full bounded lifecycle/configuration comparison passed. No explicit control
of that container occurred. Earlier outages/restart attribution remain unknown.

Local implementation:f2497ff (stopped-service isolation guard),af5bea3 (cache-stage
warm-up),19da816 and1f8eaa4 (load harness). Checkpoint86748d1 and all earlier
history/rejected evidence remain. Resolve the final evidence commit via
`git log -1 --format=%H -- docs/STEP10_COMPLETE.md`.
No push, PR, deployment, paid API or STEP11. STEP11 requires explicit authorization.

## Previous recovery checkpoint

# STEP 10 RECOVERED, FINAL VERIFICATION IN PROGRESS — 9 November 2026

The user authorized safe normal Docker startup. DocRAG containers are healthy;
the unrelated database remained stopped and untouched. Owned native PostgreSQL
and preserved loopback/cloud-disabled Ollama0.40.9 were restored under existing
authorization; read-only identity and host/container digest checks passed.

Commit f2497ff strengthens container isolation checks to preserve an initially
stopped unrelated service. Seven tests and26/26 container lifecycle checks passed.
Fresh load step10-d and final verification are in progress, with independent
coverage collection. Prior coverage failure and all historical receipts remain.
STEP10 is NOT COMPLETE pending mandatory checks, review and final confirmations.
No push or STEP11 is authorized.

## Previous blocked checkpoint

# STEP 10 NOT COMPLETE — 9 November 2026 (Asia/Kolkata)

9/12 tasks complete; current service confirmation, remaining mandatory verification
and final completion acceptance are blocked. No STEP 11 or publication authorized.

- Sustained step10-c passed18/18 validation stages:6,819 requests,2,474 HTTP429
  errors, no other request failures.50-user streaming:0.652 successful RPS,
  HTTP p95 4.992s, client queue p95 75.216s. The queue bottleneck remains.
- Full step10-final-b passed27/27 command groups at af5bea3:201 Python +221 TS
  tests,66 HTTP security checks,27 SQL/quota checks,138 observability assertions.
  All212 source hashes still match.100-question retrieval reran;100 answers and
  judgments were compatible cache hits, not fresh generations. Gates unchanged.
- make cov exited0:Python unit21.00%, TypeScript66.17%. Independent integration
  gate exited2 at66.73%, below unchanged70%; container suite coverage is pending.
- Container suite exited1 at its first read-only database identity query because
  Docker daemon socket was missing. No suite service changes occurred. Final
  host probes also found native PostgreSQL stopped (make exit2) and Ollama refused
  connections. Cause unknown; no attribution to another project. Earlier bounded
  isolation comparisons passed and do not establish current container health.
- Shared Docker Desktop startup needs permission because existing restart policies
  may start unrelated containers. It was requested, not assumed. Prior native
  PostgreSQL/Ollama recovery authorization remains subject to safety checks.
- Harness commits1f8eaa4,19da816,af5bea3 are local. Rejected step10-b cache-TTL
  evidence and all historical results remain. Two moderate JS tooling advisories
  remain disclosed; audit policy passed. Remote Actions NOT RUN; no push.

See LOAD_TESTING.md, step10/measurements.md, step10/final-b-verification.json and
step10/final-prerequisite-blocker.json. Restore/verify prerequisites before further
tests; then complete container checks, unchanged integration gate and final review.
Do not claim STEP 10 complete.

## Previous in-progress checkpoint

# STEP 10 RESUMED — 8 November 2026

Authorized recovery passed. Native owned docrag_dev is running on55433; recovery
performed no initialization, migration or SQL writes. The idle0.40.14 Ollama child
was replaced by preserved0.40.9 on loopback11434 with cloud disabled. Both frozen
model digests and host/container connectivity passed. Fresh chat inventory found
no other active chats; three connection observations found no active Ollama clients.
The apparent other Codex parent was verified as the shared host for this inspection;
it and the RepoMind web server remained untouched. Detailed safety evidence is in
docs/step10/recovery-complete-20261108.json.

Local commit19da816 adds repeated closed-loop VUs after initial burst measurements
proved insufficient for sustained acceptance. Run step10-b is in progress. STEP10
is NOT COMPLETE; final regressions, coverage, evidence review and commit remain.
No shared configuration, model, architecture, security threshold or cache default
changed. STEP11 remains unauthorized. No push or deployment.

## Earlier recovery checkpoints

# STEP 10 RECOVERY PARTIAL — 8 November 2026

Authorized pg_ctl start exited0 without initialization, schema replay or SQL writes.
Read-only SQL verified docrag_dev in the checkout-owned cluster on loopback55433.
Ollama remains0.40.14; it and its Codex parent were not stopped or modified.
Replacement safety is not established: other recent chats are inactive after
errors, but a RepoMind web server remains running under the shared Codex parent
and its application uses Ollama. No established11434 connections were observed;
that does not prove no task/client depends on it. User confirmation is required
before the conditional Ollama switch. No new load/regression tests ran.
See docs/step10/recovery-postgres-20261108.json. Preserve all pending work.

## Earlier blocked checkpoint

# STEP 10 BLOCKED — 8 November 2026 (Asia/Kolkata)

On resume, mandatory live prerequisites failed: Ollama reports0.40.14 instead of
pinned0.40.9, and make db-status exits2 because the owned native cluster is stopped.
No service was started/stopped/reconfigured on resume. Do not continue measurements
until prerequisite restoration is authorized and independently verified. The cause
of changed service state is unknown; do not attribute it to another project.

Preserved work: local commit1f8eaa4; step10-a contains18 passing bounded burst stages
(450 requests, zero errors) for5/20/50 virtual users with model concurrency capped2.
This is not sustained concurrency acceptance. step10-final-a completed27/27 groups
before interruption. A sustained lightweight-workload pass, final regression and
coverage acceptance, documentation completion, secret scan and final evidence
commit remain pending. Current documentation/evidence changes are intentionally
uncommitted. STEP11 is not authorized; no push or deployment occurred.

## Prior in-progress checkpoint

# STEP 10 IN PROGRESS — 7 November 2026

The user authorized STEP 10 only. STEP 9 prerequisite source/evidence and live
runtime/database/connectivity checks passed independently. Local implementation
commit1f8eaa4 adds the bounded load harness and measurement-math tests; it is not
completion evidence. Trial step10-a uses an isolated public fixture database and
loopback8011 app, retaining all data and obeying the existing authentication quota.
See LOAD_TESTING.md for exact bounds and pending measurements. STEP 11 is not
started or authorized. No push, PR or deployment is authorized.

## Previous completed STEP 9 checkpoint

# STEP 9 COMPLETE — 7 November 2026 (Asia/Kolkata)

All 20 tasks and all three local confirmations passed. Fresh step9-final-e:
27/27 contract groups, 26/26 container checks, 198 Python + 221 TypeScript tests,
70.80% integration coverage, four Linux CI commands, actual SQL/migrations and
unchanged .02 regression gates. All 210 implementation hashes remain matched.
See STEP9_COMPLETE.md and docs/step9/*final-e.json for detailed fresh evidence.
Final local documentation/evidence commit is resolved via
`git log -1 --format=%H -- docs/STEP9_COMPLETE.md`.

Ollama 0.40.9 was started with explicit permission on loopback11434 and cloud off;
host/container connectivity and both frozen digests passed. No model downloads.
DocRAG app/database are healthy; native owned database is running on55433.
The unrelated text-to-sql database is healthy on55432; its state/mounts/bindings
were unchanged during this test window. Historical restart attribution is unknown.

Final-e reran retrieval for100 questions and reused100 compatible cached answers
and judgments: Recall@5 .975, faithfulness .995, correctness .985, citations260/260.
Raw JS audit remains exit1 with two moderate tooling advisories; policy passed.
Remote Actions NOT RUN — NO PUSH AUTHORIZED. Browser evidence remains historical.
Steps10–12 are not started; Step10 requires explicit instructions/authorization.
No push, PR, merge, deployment or publication occurred.

## Earlier checkpoint history (not current service state or authorization)

# Account-switch checkpoint — STEP 9 IN PROGRESS, NOT COMPLETE

Updated 7 November 2026 (Asia/Kolkata). The user authorized continuation after
checkpoint `3466d78`, then requested this handoff update. Stop after this update;
no Step 10, push, PR or deployment is authorized. The earlier checkpoint below
is historical; this section supersedes its paused authorization and service state.

## Latest continuation evidence

- Implementation remains committed in `d28ddb0` and `ab77e34`; checkpoint `3466d78`
  and all earlier history remain preserved. All **210** saved verified source
  hashes still match. No implementation changes were made during this resumption.
- Saved final verification remains **27/27 PASS**, 198 Python and 221 TypeScript
  tests. Python scripts integration coverage is 70.80%; unit-only 20.46%.
  These are saved results, not a new full test run on 7 November.
- `docs/step9/resume-verification.json` records five new passing checks: Compose
  validation, DocRAG app restart/health, sign-in HTTP 200, container-to-host Ollama,
  and unchanged other-project state/mounts/bindings across that bounded check.
- `make db-status` confirmed the owned native cluster running on loopback 55433.
  Native identity was verified as `docrag_dev` during restoration. Container SQL
  inspection exited 0: `docrag_container`, port5432, pgvector0.8.1, two migrations.
- DocRAG app and database are healthy; app binds loopback8010 and Docker database
  has no host binding. Installed Ollama0.40.14 is serving; full historical benchmark
  requires preserved0.40.9. Do not silently use the desktop version for evaluation.
- Other-project `text-to-sql-db-1` is **stopped (exited)**, not currently healthy.
  Its configured port remains loopback55432. This continuation left it stopped.
- The earlier start-time discrepancy remains an attribution limitation. User says
  another task may have restarted it; this is possible, not verified. The changed
  start time precedes the final 6 November container test. The 26-check historical
  suite and new five-check probe establish isolation within their test windows,
  not an unchanged start time across the whole multi-day task.
- Saved Step8-to-Step9 regression gate was revalidated PASS in
  `.local/step9-resume-gate.log`: recall decline0, faithfulness decline.005,
  thresholds unchanged.02. No new model generation or paid API call was made.

## Exact remaining work

1. Reconcile `docs/STEP9_COMPLETE.md`: it is still a draft, dated6 November, with
   premature completion and blanket other-container-unchanged claims. Replace
   these with the bounded evidence above and explicitly retain unknown attribution.
2. Reconcile PROJECT_HANDOFF, ACCOUNT_SWITCH_GUIDE and Docker/testing docs with
   current status. The 26-check container helper expects the other project healthy;
   do not start that unrelated container just to rerun it. Preserve stopped state.
3. Review all saved command receipts, coverage, evaluation provenance and final
   report. Accepted evaluation is `step9-final-d`:100 compatible cached answers
   and judgments, not fresh generation; metrics below remain applicable.
4. Secret-scan all intended commit candidates without printing credentials;
   run `git diff --check`, inspect staged contents, then commit only verified
   Step9 documentation/evidence locally. Preserve rejected `step9-final-c` and
   its rejection note. Do not overwrite historical artifacts.
5. Verify clean tree/history and issue the required full Step9 report only after
   all mandatory local acceptance items are satisfied. Remote Actions remains
   NOT RUN — NO PUSH AUTHORIZED. Stop after Step9.

No full tests/builds/evaluation were rerun for this handoff update. Outstanding
work is documentation/evidence reconciliation and final local acceptance, not a
known new implementation failure. All uncommitted files listed below remain;
`docs/step9/resume-verification.json` is an additional new receipt.

## Historical 6 November checkpoint (retain for context)

## Repository and scope

Existing checkout: `/Users/abhisheshramadasshet/Documents/ChatGPT/DocRAG/RAG-Agent`.
Required branch: `feat/production-rag`. Implementation HEAD before this documentation
checkpoint: `ab77e34d4d73253e90afbb77fb2130e4f9052cb0`.
Local commits: `d28ddb0` Docker isolation/runtime, `ab77e34` CI/integration tests.
Earlier `31cfd529954feb638d7577d4594eb11a3920150a` handoff and `df31231`
Makefile correction remain preserved. No staged files existed at checkpoint start.
Only this status file is authorized for the checkpoint commit. No push, PR,
deployment, Step 10, test/build/evaluation or service mutation is authorized here.

## Completed implementation and saved verification

These are existing receipts inspected during checkpoint preparation, not new runs.
They do not establish overall Step 9 completion while final reconciliation is pending.

- Task 1–2: test inventory/strategy drafted in TESTING.md.
- Task 3–4: isolated database tests and integration gaps implemented, including
  real SQL retrieval, auth/ownership, migrations and container lifecycle tests.
- Task 5: measured Python scripts integration coverage **70.80% (1021/1442)**,
  no excluded statements; unit-only **20.46% (295/1442)**. TypeScript statements
  **66.17%**, branches64.82%, functions59.28%, lines68.05%.
- Task 6–14: Docker availability, pinned image, dedicated pgvector/Compose,
  host Ollama connectivity, MiniLM disabled/fallback, authentication and HTTP
  checks have passing saved evidence. Node24.22.1, pnpm11.25.0, Python3.14.6;
  Docker29.9.2, Compose5.6.1. Image scan recorded1585 files and no secret matches.
- Task 15: saved container suite passed **26 checks**, including restart, expiry,
  cancellation, DB-loss recovery and before/after other-container comparison.
  The broader other-project start-time discrepancy remains unresolved (below).
- Task 16–18: CI workflow and deterministic SQL/migration tests implemented.
  Linux lint/test/coverage/build sequence recorded four exit0 results; workflow
  static validation recorded17 checks; SQL retrieval recorded10 checks. An ACL
  removal in a temporary copy correctly failed. Remote Actions has NOT run.
- Task 19: prior prerequisite `step9-prerequisite-b` passed27/27; final contract
  `step9-final-d` also passed27/27 with **198 Python +221 TypeScript tests**,
  focused53 tests,66 security HTTP checks,27 SQL/quota checks and138 observability
  assertions. Lint/build/preservation and audit-policy checks passed in that run.
- Task 20: documentation and evidence are drafted but final reconciliation,
  review, remaining local commits and clean-tree verification are pending.

Evidence: `.local/observability-verify-step9-final-d/{commands,complete,source-hashes}.json`,
`docs/step9/`, `.local/step9-ci-linux-output/commands.json`,
`.local/step9-container-http-final.log`, `.local/step9-coverage-gate-final.log`.
All logs and private runtime state under `.local` remain ignored.

## Evaluation and failures

Accepted saved result: `eval/results/observability/step9-final-d/evaluation.json`.
100/100 questions, **100 compatible cached embeddings, answers and judgments**,
zero misses; retrieval reran. This is not fresh generation.
Recall@3 .95; Recall@5 .975; Recall@10 1.0; MRR .9729166666666667;
automated faithfulness .995; correctness .985; citation support260/260.
Existing gate passed; additional Step8 comparison passed with recall decline0 and
faithfulness decline.005 against unchanged.02 limits. These are automated scores,
not perfect-accuracy claims. Golden100 questions and selected162 chunks preserved.

Earlier failures were retained and diagnosed: missing standalone PDF worker;
private metadata dependency in tests; GNU Make output differences; historical
split writes; incorrect Linux pnpm launcher; offline Google-font build fetch;
lint traversing generated `.local` files. Fixes and later passes are recorded.
`step9-final-a` timed out after90 questions. `step9-final-b` failed generated-file
lint. `step9-final-c` completed100 but promotion rejected uncommitted implementation
provenance. Its raw artifact and rejection note remain; do not promote it as-is.
The implementation was committed and `step9-final-d` passed the full contract.
No quality gate or validator was bypassed. Final Python coverage gate exited0;
interim below-target measurement correctly exited2.

Dependency policy passed, with raw JavaScript audit exit1 for two reviewed moderate
esbuild/minimatch tooling advisories. Python and installed optional reranker audits
exited0. Do not describe this as zero vulnerabilities.

## Read-only service observations and unresolved isolation evidence

Observed during this checkpoint, without changing any service:

- `docrag-step9-app-1`: healthy,127.0.0.1:8010→3000;
  started2026-11-06T16:27:32.086568259Z.
- `docrag-step9-db-1`: healthy, internal5432 only;
  started2026-11-06T16:27:27.954123341Z. Previously verified identity:
  `docrag_container`, PostgreSQL16.12, pgvector0.8.1, vector(768), two migrations.
  No fresh SQL inspection was performed for this checkpoint.
- Native status command exited0, PID93967, owned `.local/postgres`, loopback55433.
  Previously verified database name `docrag_dev`; no fresh SQL connection here.
- `text-to-sql-db-1`: healthy,127.0.0.1:55432→5432, current start time
  **2026-11-06T12:37:09.621671668Z**, container ID
  `6137c9c00ed00cb1990d6e1914a70485d311fc2c91236d57106b6ec09996ba7f`.

The other project's earlier snapshot recorded start time
**2026-11-06T07:41:47.665316345Z**. A final comparison therefore failed. Later
inspection reported restart count0 and OOMKilled=false; a bounded Docker event
query returned no retained matching events, which does not establish the cause.
The final container-test receipt timestamp is **16:27:37.593073Z**, so the changed
12:37 start time PRECEDES that final test. An earlier suggestion that it happened
"after the tests" was unsupported and must not be repeated. The suite's before/after
comparison passed within its own test window, but a blanket claim that the other
container's start time never changed during the entire task is not substantiated.
No command intentionally stopping that other container was issued by this work.
Cause/attribution remains unknown. Do not modify it to investigate or conceal this.
See `.local/step9-other-project-events.json`. Inspection approval once timed out;
the permitted retry succeeded. This was not an unsafe-action rejection.

## Preserved uncommitted work

After committing this checkpoint, these tracked modifications remain:

```text
docs/ACCOUNT_SWITCH_GUIDE.md
docs/COMMAND_CONTRACT.md
docs/PROJECT_HANDOFF.md
```

Untracked files/directories remain:

```text
docs/CI.md
docs/DOCKER.md
docs/STEP9_COMPLETE.md
docs/TESTING.md
docs/step9/
eval/results/observability/step9-final-c/
eval/results/observability/step9-final-d/
eval/results/observability/step9-prerequisite-b/
```

Preserve all of them. Some drafted files incorrectly claim overall completion or
unchanged other-project state. They were not corrected here because ONLY this file
was authorized to change. The working tree is intentionally not clean. Never reset,
clean, stash, delete receipts or force a clean tree. Private environment files and
credentials remain ignored; do not print them.

## Exact continuation instructions for the new account

1. Open this existing RAG-Agent checkout, not its parent or a new clone. Read
   AGENTS.md, this file, PROJECT_HANDOFF.md and COMMAND_CONTRACT.md; this checkpoint
   and the user's pause override contradictory completion language elsewhere.
2. Inspect branch, HEAD, status, staged changes and saved receipts read-only.
   Resolve this checkpoint commit with `git log -1 --format=%H -- docs/CURRENT_STATUS.md`.
3. Keep STEP9 PAUSED/NOT COMPLETE until the user explicitly authorizes resumption.
   Do not start tests, builds, evaluations, service changes or new implementation
   merely because the account changed.
4. Once authorized, reconcile the other-container timeline and the isolation claim
   using available evidence. Do not assume empty events prove no restart. Ask for
   context if attribution cannot be established; do not stop unrelated services.
5. Review the existing Docker26-check, CI/Linux and accepted evaluation receipts.
   Decide which checks require rerunning after corrections, using fresh run IDs and
   the pinned runtime. No new evaluation is currently required by a demonstrated
   score failure; final evidence acceptance is pending. Remote Actions remains
   **NOT RUN — NO PUSH AUTHORIZED**.
6. Reconcile all draft docs/report with actual evidence, review new artifacts for
   secrets, and commit only verified authorized work locally. Verify history,
   final status and all three Step9 confirmations before any completion claim.
   Stop after three genuine unsuccessful repairs of the same diagnosed blocker.

STEP 9 PAUSED — NOT COMPLETE.
Pending: isolation-evidence reconciliation, draft-report correction/review,
final evidence acceptance and local documentation/artifact commits.
DO NOT PROCEED TO NEXT STEP.
