# STEP 12 COMPLETE — final local verification and release readiness

Accepted 12 November 2026 (Asia/Kolkata), for local release readiness only.
21/21 tasks; all three user-delegated confirmations PASS. No public deployment,
cloud resources, push, PR, merge, paid usage or billing activation. Remote GitHub
Actions NOT RUN. Further publication/deployment requires explicit authorization.

## Verified result

- 27/27 full verification groups; 460 unit tests (218 Python, 242 TypeScript),
  zero failures. Additional focused gates remain separate from this unique count.
- 66 real security HTTP checks, 27 SQL checks, 138 telemetry assertions,
  26 final container checks and 10 Linux retrieval checks; migration repeatability
  preserves sessions. Production build and runtime checks pass.
- Python integration coverage 74.38% (1269/1706 statements, zero exclusions),
  unchanged required 70% gate. TypeScript statements 65.36%, branches 64.12%,
  functions 58.28%, lines 67.53%. Unit-only Python coverage is not this figure.
- 100-question local evaluation: Recall@5 .975, faithfulness 1.000,
  correctness .985, citations 265/265. All100 answers and query embeddings fresh;
  37 fresh/63 cached judgments. Correctness fell .005 from STEP11, traced to an
  incomplete transaction example; preserved and explained, not rerun away.
  Existing .02 recall/faithfulness gates and same-configuration STEP11 comparison pass.
- Ollama 0.40.9, cloud off, both immutable digests, native and container connectivity
  pass. Local 162x768 and separate demo 162x1536 vectors remain intact; historical
  cloud Recall@5 .96875 is preserved separately. No fresh Gemini call was needed:
  unchanged live STEP11 receipts plus fresh configuration/error/privacy mocks.
- 18 bounded local load stages pass: 6,786 requests, 2,567 HTTP429 quota rejections,
  no unexpected failures. Streaming model queue p95: 5 users 4.929s, 20 users
  14.277s, 50 users 73.204s. These are separate from HTTP p95 4.797/2.894/4.829s.
  Two-call model cap retained; no claim of50 concurrent generations or endurance.
- Two moderate JS tooling advisories remain under the existing risk policy;
  raw JS audit exit1, Python/reranker exit0. No zero-vulnerability claim.
- Fresh local browser sample/navigation and390px/320px layouts pass. Live Gemini
  answer/citation/refusal/cancellation remains explicitly historical STEP11 evidence.
  README, handoff, deployment and portfolio claims are reconciled.

## Changes and failures retained

Measured application source remains83e13c7. STEP12 changes are documentation and
public verification artifacts only; all224 STEP11 and227 verifier source hashes
match. No architecture, model, dependency, security threshold or test was changed.
Historical results, calibration, golden labels,162 chunks, original vectors and
Gemini caches remain preserved.

Initial container upload failed500 because Ollama was unavailable; PostgreSQL was
also stopped. The user explicitly authorized both starts. Container retry passed.
A later session found both stopped again and Docker unavailable; the user separately
authorized Docker Desktop startup. Final read-only service checks and26 container
checks pass after recovery. Causes of these outages remain unknown. The unrelated
text-to-sql container stays exited with unchanged lifecycle times/restart count.
No causation is attributed to DocRAG without evidence.

Interim integration coverage58.21% failed; completing real container/load paths
raised coverage to74.38% without exclusions. A temporary demo launcher import-path
error was corrected before browser verification. The initial secret pattern scan
flagged only explicit sample/test URL literals; exact reviewed exceptions retain
actual-private-value checks. All prior logs/failures are preserved.

## Evidence and reproduction

- [Task ledger](step12/task-ledger.md), [acceptance criteria](step12/acceptance.md)
- [Source/security/operations review](step12/review.md)
- [27 command receipts](step12/contract-results.json), [verification summary](step12/verification-summary.json)
- [Evaluation summary](step12/evaluation-summary.json); raw/promoted full results:
  `eval/results/observability/step12-final-a/`
- [Container](step12/container-final.json), [Linux CI](step12/local-ci-checks.json),
  [final services](step12/final-services.json), [preservation](step12/preservation.json)
- [Coverage](step12/python-integration-coverage.json), [TypeScript](step12/typescript-coverage.json),
  [load summary](step12/load-summary.json); full `loadtest/step12-coverage-a.json`
- [Browser](step12/browser.json), [dependency audit](step12/dependency-audit.json),
  [secret/history scan](step12/secret-scan.json), [log hashes](step12/log-manifest.json)
- [Command contract](COMMAND_CONTRACT.md), [portfolio evidence](PORTFOLIO_EVIDENCE.md)

Final acceptance applies to the local commit containing this report, after exact
staging/secret review and clean-status verification. Expired load PTY exit was not
invented: its completed PASS receipt and18 stages were inspected. Other recorded
command exits are observed receipts. See review.md for CI and deployment limits.

Confirmations1/2/3: PASS — correctness/security; reproducible verification/operations;
documentation/release scope/Git safety. No mandatory local blocker remains.
Actual hosting eligibility/TLS/cold starts/public-domain streaming and remote CI
are later, separately authorized checks. Release ready does not mean deployed.
