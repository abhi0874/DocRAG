# STEP REPORT — STEP 9

Completed 7 November 2026 (Asia/Kolkata), locally only.
Fresh acceptance run: `step9-final-e`. Historical receipts remain preserved.

Repository: `abhi0874/DocRAG`, existing `RAG-Agent` checkout.
Branch: `feat/production-rag`. Steps 10–12 have not been started.

Production-compatible Docker and dedicated pgvector services now support the real
PDF/chat/authentication flow. CI exercises actual SQL and migrations without model
or production keys. Tests run portably from clean source and preserve private review
metadata and historical files. Measured integration coverage meets the original
Python target. No authentication, RAG setting or quality threshold was weakened.

## Completion matrix — 20/20

| Task | Result and evidence |
| --- | --- |
| 1 Inventory | PASS — TESTING.md lists unit, SQL, HTTP, cache, evaluation and UI evidence |
| 2 Strategy | PASS — deterministic CI separated from real local model verification |
| 3 Isolation | PASS — owner-checked native clones, unique CI schemas and dedicated Docker volume |
| 4 Integration gaps | PASS — real SQL ACLs, migration preservation, container HTTP and negative controls |
| 5 Coverage | PASS — 1,021/1,442 Python script statements, 70.80%; all scripts retained |
| 6 Docker availability | PASS — Engine 29.9.2, Compose 5.6.1 |
| 7 Other projects | PASS — identity/start time/mounts/ports unchanged within fresh and saved bounded test windows; broader historical restart attribution remains unknown |
| 8 Dockerfile | PASS — pinned build, standalone assets/PDF worker, UID 1000, secret scan |
| 9 Database | PASS — PostgreSQL 16.12, pgvector 0.8.1, vector(768), both Drizzle migrations |
| 10 Compose | PASS — dedicated project/network/volume; app loopback 8010; DB internal-only |
| 11 Ollama | PASS — real Docker Desktop host connectivity, upload embedding and chat inference |
| 12 MiniLM | PASS — disabled default and Linux missing-runtime fallback; no weights/Python env in app image |
| 13 Authentication | PASS — two accounts, cookies, sessions, origin checks, eight-hour expiry and logout replay |
| 14 Container startup | PASS — 26 HTTP/lifecycle checks; Linux citation/cache regressions also pass |
| 15 Lifecycle | PASS — app/DB restart, session/data persistence, outage failure/recovery, graceful stop |
| 16 CI | PASS — pinned least-privilege single job; no inference keys, deployment or publishing |
| 17 Gates | PASS — real SQL fixture/ACL negative control; unchanged .02 quality gates |
| 18 Local CI | PASS — clean-source macOS and Linux commands; remote run explicitly deferred |
| 19 Regressions | PASS — full 27-group contract, 100 questions, preservation and audit policy |
| 20 Documentation/Git | PASS — corrected documentation/evidence, secret scan and local-only acceptance |

## Fresh acceptance — 7 November 2026

The initial read-only probes failed with ECONNREFUSED because no Ollama process or
listener was running. The user authorized starting the preserved checksum-matching
0.40.9 runtime on 127.0.0.1:11434 with OLLAMA_NO_CLOUD=1. Both host and Docker
version probes then passed; both API model digests exactly matched frozen config.
No download, update, wider network binding or unrelated service change occurred.
The server remains running for local use; its private log is
`.local/step9-authorized-ollama-20261107.log`.

Fresh `step9-final-e` repeated all 27 contract groups, all exit 0, against verified
native ownership/identity. It includes 198 Python, 221 TypeScript, 53 overlapping
focused tests, security/SQL, cancellation, citations, observability and preservation.
The 26-check container suite passed after explicit permission for DocRAG-only
restart/outage checks. Dedicated containers recovered healthy; other-project
identity, start time, status, mounts and bindings matched the pre-test snapshot.
This is bounded evidence only. Its historical restarts remain unattributed.

Fresh local Linux lint/test/coverage/build: 4/4 exit 0. Actual CI migration and
retrieval commands each exited 0 (10 retrieval checks). Workflow validation passed
17 checks. The existing unchanged image passed a fresh scan of 1,585 files; logs
passed a scan of 214 structured events. Both found zero configured-secret matches.
The image build remains historical; fresh native and Linux production builds passed.

Fresh combined coverage: 1,021/1,442 Python scripts statements = 70.80%, 421 missing,
zero exclusions; unchanged 70% gate exit 0. Unit-only remains 295/1,442 = 20.46%.
Fresh Linux TypeScript coverage remains 66.17% statements, 64.82% branches,
59.28% functions, 68.05% lines. See `docs/step9/*final-e.json` for fresh receipts.
Detailed command logs are `.local/observability-verify-step9-final-e/`,
`.local/step9-ci-linux-output-final-e/`, `.local/step9-container-final-e.log`,
`.local/step9-ci_migrations-final-e.log`, `.local/step9-ci_retrieval-final-e.log`
and `.local/step9-coverage-gate-final-e.log`. Old files were not replaced.

Accepted fresh execution artifact: `eval/results/observability/step9-final-e/evaluation.json`.
All 100 questions completed with 100 compatible hits each for embeddings, answers
and judgments, zero misses; retrieval reran. This is cached generation, not fresh
inference. Metrics match final-d: Recall@5 .975, faithfulness .995, correctness .985,
citation support 260/260. Both Step 7 and Step 8 comparisons passed; Step 8 declines
are 0 and .005 under unchanged .02 gates. All 210 saved implementation hashes match.

Fresh audit policy exit 0; raw JavaScript exit 1 still discloses moderate
GHSA-67mh-4wv8-2f99 (esbuild) and GHSA-g3hv-75wg-m249 (minimatch). Main Python and
optional reranker audits exited 0. See SECURITY.md for reviewed tooling reachability.
Remote Actions remains NOT RUN — NO PUSH AUTHORIZED. Browser evidence is historical.
No code repair was required; recovery was the authorized service start. Earlier
failed final-a/b/c evidence and the rejected final-c raw result remain preserved.

## Historical 6 November verification detail

The following detailed commands and measurements describe preserved final-d,
unless explicitly stated otherwise; they are not newly executed under that ID.

## Runtime and test results

Node **24.22.1** locally, in images and CI configuration; pnpm **11.25.0**;
Python **3.14.6**. All 37 pinned Python requirements installed in a fresh isolated
environment; `pip check` exited 0. Linux toolbox also installed the pinned set.
Docker **29.9.2**, Compose **5.6.1**. Preserved Ollama **0.40.9** was used for the
benchmark; installed **0.40.14** was restored afterward. Both frozen model digests
were preserved. Reranking and public response caching remain OFF by default.

- Python: **198 passed, 0 failed**. TypeScript: **221 passed, 0 failed**.
  Total: **419** unique unit tests. Focused 53-test suite also passed; it is not
  added again to the total. The cancellation-stage/runtime tests remain included.
- Native HTTP: **66 security checks**, **27 SQL isolation/concurrent quota checks**,
  and **138 observability assertions** passed. Private feedback export restrictions
  passed; golden labels were not modified.
- Container: **26 HTTP/lifecycle checks**, real streaming cancellation, single
  terminal metric, no rateable partial answer, private BYPASS, feedback ownership,
  expiry, repeat migration, restart and DB loss/recovery passed.
- CI SQL: **10** production retrieval/RRF/ownership checks passed; actual migrations
  applied twice and preserved a session. Removing ACL predicates only in a
  temporary copy correctly produced exit **1**. Production code was unchanged.
- Workflow static validation: **17 checks** passed. Clean Linux `make lint`,
  `make test`, `make cov`, `make build-fe`: **4/4 exited 0**.
- Image scan: **1,585 files**, **0 configured-secret matches**, **0 forbidden
  env/weight files**, required assets present, Node 24.22.1 and UID 1000.
  Final container log scan: **107 structured events**, no configured secrets or
  sensitive request fields found. This is a bounded check, not a universal proof.

### Coverage scope and gate

Python unit-only coverage: **295/1,442 = 20.46%**. The final combined measurement
covers **1,021/1,442 = 70.80%**, with **421 missing statements**. It combines only
coverage fragments from the successful final 27-group run and final container run.
The denominator is every Python module under `scripts`, including new tooling;
no difficult script was omitted. This is not whole-backend coverage: the backend
is TypeScript, and Python evaluation modules are outside this historical denominator.

TypeScript: statements **66.17% (1082/1635)**, branches **64.82% (776/1197)**,
functions **59.28% (198/334)**, lines **68.05% (784/1152)**. UI paths and some direct
DB helpers remain gaps in unit instrumentation; real HTTP/SQL tests supplement them.
The interim 64.56% Python measurement correctly failed with exit **2**; the final
unchanged **70%** gate exited **0**. Ordinary hosted CI reports unit coverage;
the model-dependent combined gate remains separately mandatory locally.

## Full evaluation and provenance

Accepted result: `eval/results/observability/step9-final-d/evaluation.json`.
Verified implementation revision: `ab77e34d4d73253e90afbb77fb2130e4f9052cb0`.
**100/100** questions; **100 compatible embedding, answer and judgment cache hits**,
zero misses in this final run. SQL retrieval ran again. This was **not fresh model
generation**. The preceding attempts generated the caches under identical application,
model, prompt and evidence configuration. Cache replay timings are not inference
latency measurements and are not presented as a speedup.

| Metric | Actual result |
| --- | --- |
| Recall@3 | 0.95 |
| Recall@5 | 0.975 |
| Recall@10 | 1.0 |
| MRR | 0.9729166666666667 |
| Automated faithfulness | 0.995 |
| Automated correctness | 0.985 |
| Automated citation support | 260/260 |

The existing contract gate against Step 7 passed. An additional gate against
`step8-final-a` also passed: Recall@5 decline **0.000**, faithfulness decline
**0.005**, both within the unchanged **0.02** limits. All 100 ranked evidence
sequences match. Correctness is 0.005 lower than Step 8; citation count changed
from 264 to 260 with different generated answers. Automated scores are not a
perfect-accuracy or independent-human-validation claim.

Preservation: **100 golden questions**, **162 selected chunks**, **151 original
local vectors**, **151 Gemini vectors**, **20 Gemini cache pairs**, frozen labels,
source files and historical results passed the existing hash checks. No database
reset, unrelated container stop, volume deletion, prune, push or deployment occurred.

## Exact full-contract commands

Run: `.venv/bin/python -m coverage run -m scripts.verify_observability --run-id step9-final-d`
with the documented integration coverage configuration. Overall exit **0**;
**27/27 groups passed**, with source bytes unchanged during the run.

| Group | Actual command | Exit |
| --- | --- | --- |
| 1 | `make lint` | 0 |
| 2 | `make test` | 0 |
| 3 | `pnpm exec vitest run tests/cache-api.test.ts tests/reranker-api.test.ts tests/observability.test.ts` | 0 |
| 4 | `make build-fe` | 0 |
| 5 | `.venv/bin/python -m scripts.observability_setup` | 0 |
| 6 | `.venv/bin/python -m scripts.security_setup --apply-selected` | 0 |
| 7 | `.venv/bin/python -m scripts.security_setup --apply-configured` | 0 |
| 8 | `.venv/bin/python -m scripts.security_http` | 0 |
| 9 | `.venv/bin/python -m scripts.observability_http` | 0 |
| 10 | `.venv/bin/python -m scripts.feedback_to_eval` | 0 |
| 11 | `.venv/bin/python -m eval.validate_dataset --require-review` | 0 |
| 12 | `.venv/bin/python -m eval.prompting_gate --baseline eval/results/reranking-selected.json --candidate eval/results/prompting/step5-v1.json` | 0 |
| 13 | `.venv/bin/python -m eval.prompting_gate --baseline eval/results/reranking-selected.json --candidate eval/results/prompting/grounded-v1.json` | 0 |
| 14 | `.venv/bin/python -m pytest -q tests/test_prompting_gate.py tests/test_prompting_report.py tests/test_security_gate.py tests/test_observability_gate.py` | 0 |
| 15 | `.venv/bin/python -m eval.prompt_bytes` | 0 |
| 16 | `node --import tsx eval/recheck_citations.ts` | 0 |
| 17 | `.venv/bin/python -m eval.citation_cache_http` | 0 |
| 18 | `.venv/bin/python -m eval.cache_http --prompt-version step5-v1 --out .local/observability-verify-step9-final-d/cache-http.json` | 0 |
| 19 | `.venv/bin/python -m eval.reranking_smoke --out .local/observability-verify-step9-final-d/streaming.json` | 0 |
| 20 | `.venv/bin/python -m scripts.security_invalidation --prompt-version step5-v1 --out .local/observability-verify-step9-final-d/invalidation.json` | 0 |
| 21 | `.venv/bin/python -m eval.run_eval --golden eval/golden_set.jsonl --prompting-experiment step5-v1 --out eval/results/observability/step9-final-d/evaluation-raw.json` | 0 |
| 22 | `.venv/bin/python -m eval.promote_local --source eval/results/observability/step9-final-d/evaluation-raw.json --out eval/results/observability/step9-final-d/evaluation.json` | 0 |
| 23 | `.venv/bin/python -m eval.observability_gate --baseline eval/results/security/step7-final-b/evaluation.json --candidate eval/results/observability/step9-final-d/evaluation.json` | 0 |
| 24 | `.venv/bin/python -m eval.reranking_integrity --out .local/observability-verify-step9-final-d/preservation.json` | 0 |
| 25 | `.venv/bin/python -m eval.prompting_report --out .local/observability-verify-step9-final-d/historical-report.json` | 0 |
| 26 | `.venv/bin/python -m scripts.security_audit` | 0 |
| 27 | `git diff --check` | 0 |

Additional commands: `make cov` exit **0** (198 Python/221 TypeScript);
`COVERAGE_FILE="$PWD/.local/coverage-step9-final/.coverage" make cov-integration-gate`
exit **0**; Compose `config --quiet`, `build`, `up -d --no-deps --wait app`,
`python -m scripts.container_http`, and image/log scans exited **0**. Native
`make db-status` exited **0**. Actual CI migration/retrieval scripts in Linux,
workflow YAML validator, optional reranker fallback and preservation checks exited
**0**. See the [receipt directory](step9/) and ignored `.local` logs.

### Corrected failures and command adaptations

- Missing standalone PDF worker caused upload failure; tracing now packages it.
- CI needed full Git history and a public chunk mapping restored from committed
  data. Review unit tests now synthesize withheld metadata, split tests use temporary
  copies, and GNU Make dry-run directory banners are disabled. Assertions remain.
- ESLint/TypeScript now exclude generated private `.local` directories; application
  sources, tests and coverage scope remain checked.
- The Linux test toolbox's pnpm launcher was corrected to `pnpm.mjs`. Offline
  tests passed, but the build required network access for existing Google fonts;
  the complete Linux sequence then passed with build networking available.
- First model evaluation timed out after 90 questions. Compatible completed work
  was retained and the unchanged runtime retried. A subsequent full result was
  correctly rejected because implementation was not committed. That provisional
  artifact is retained with a rejection note. Local code commits resolved provenance;
  the complete final contract then passed without bypassing the validator.

## Dependency audits and limitations

Audit policy: PASS, exit **0**. Raw JavaScript audit: exit **1**, two disclosed
**moderate** esbuild/minimatch tooling findings. Their reviewed production-trace
reachability policy passed. Main Python and actual optional reranker environment
audits: raw exit **0**, no known findings. This is not a zero-vulnerability claim.

**Remote GitHub Actions: NOT RUN — NO PUSH AUTHORIZED.** Local Linux verification
used Docker ARM64 on this Mac; hosted Ubuntu/x64 provisioning remains unverified.
Ordinary CI does not run the full local model evaluation. Browser screenshots are
historical Step 8 evidence, not a fresh Step 9 browser pass. Host Ollama connectivity
is Docker Desktop-specific. Optional MiniLM is not packaged for Linux deployment.
HTTPS, online inference and hosting remain future work; no deployment is made here.

## Final confirmations and local history

CONFIRMATION 1 — TESTING: **PASS**.
CONFIRMATION 2 — DOCKER: **PASS**.
CONFIRMATION 3 — CI AND GITHUB SAFETY: **PASS; remote Actions deferred, no push**.

Implementation commits: `d28ddb0` (Docker) and `ab77e34` (CI/integration tests).
The final documentation/evidence commit is identified by
`git log -1 --format=%H -- docs/STEP9_COMPLETE.md`; a document cannot contain its
own commit hash. Previous `df31231` and `31cfd52` remain ancestors. Commit-candidate secret scanning and exact staging are required for the final local
commit. The commit containing this report is resolved by the command above; the
post-commit status is reported in the final response. No existing work was discarded.
All changes are local. GitHub push: **NONE**. Paid API charges: **₹0**.
All mandatory verification and documentation requirements passed. The final local
commit records these artifacts. Remote verification remains deferred.

Files changed include Dockerfile/Compose/allowlist/migration, protected page build
mode, provider container guards, PDF worker tracing, CI workflow/SQL tests, portable
Python fixtures and operational tests, coverage target/configuration, generated-file
exclusions, Docker/CI/testing documentation, updated handoff/status/contract and new
verification artifacts. Historical evaluation files were not overwritten.

## What you should check yourself

1. Open `http://127.0.0.1:8010/sign-in`; the dedicated local container should respond.
2. Read DOCKER.md before stopping services; use the named Compose project and retain
   its volume. Do not touch the other project's port 55432.
3. Read CI.md's remote-run limitation before authorizing any future publication.
4. Compare the accepted evaluation and coverage receipts with the numbers above;
   cached results and automated scores do not promise perfect answers.

STEP 9 COMPLETE
No errors found and all tasks completed.
Can proceed to the next step.

Step 10 is not authorized and was not started.
