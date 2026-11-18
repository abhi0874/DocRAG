# Pre-release QA — 18 November 2026

**BLOCKED.** Functional acceptance is incomplete; publication remains prohibited.
Security decision: [SECURITY_DECISION.md](SECURITY_DECISION.md). No exception,
gate suppression, dependency change, application change, push or deployment.
Starting HEAD: `329ec8c595bbcc2c517188a15a4dd60de8f7201c`,
`feat/production-rag`. All 50 initially changed paths are preserved byte-for-byte.
Detailed fresh logs/commands: ignored `.local/prerelease-qa-a/`.

## Fresh verification

| Check | Result |
| --- | --- |
| `make lint` | Exit 0: Ruff, formatting, ESLint, TypeScript |
| `make test` | Exit 0: **218 Python + 336 TypeScript = 554** |
| `pnpm exec next build --webpack` | Exit 0; fresh native production build |
| `make cov` | Exit 0; same 554 tests. Python unit 377/2199 statements (17.14%; terminal rounds to 17%). TypeScript statements 57.46%, lines 61.45%, branches 57.15%, functions 51.17%. This is not fresh combined integration coverage. |
| `pnpm install --offline --frozen-lockfile --ignore-scripts` | Exit 0; no dependency change |
| `scripts.workspace_http --run-id prerelease-a` | Exit 0; **63/63**, ten fresh local answers; owned isolated fixture DB |
| `scripts.observability_setup` | Exit 0; preserved seed copied to new fixture; additive migration checks |
| `scripts.security_http` | Exit 0; **66 HTTP checks + 27 real SQL/retrieval/concurrent-quota checks**, HTTPS cookie/session/logout checks |
| `scripts.observability_http` | Exit 0; **138 assertions**, 33 HTTP request IDs, one public review candidate |
| `scripts.feedback_to_eval` | Exit 0; private export false, golden unmodified |
| `eval.validate_dataset --require-review` | Exit 0 |
| Four gate/report negative-control test modules | Exit 0; **35 passed** |
| `eval.prompt_bytes`, `node --import tsx eval/recheck_citations.ts` | Both exit 0 |
| `eval.citation_cache_http`, `eval.cache_http --prompt-version step5-v1`, `eval.reranking_smoke`, `scripts.security_invalidation --prompt-version step5-v1` | All exit 0; original content restored by invalidation harness |
| `eval.reranking_integrity` | Restricted attempt exit 1 (local socket denied), authorized local-access retry exit 0; historical corpus/vectors/cache evidence preserved |
| `scripts.security_audit` | **Exit 1**, unchanged high-advisory rejection |
| Independent Python and reranker `pip_audit --format json` | Both exit 0; separate checks, not a passing complete dependency gate |

Commands that write standard historical receipt locations were backed up where
identified under `prior-contract-receipts` and `prior-audit`. Container harness
writes its existing `.local/step9-container-http.json`; fresh command/output is
also saved separately. Older named container snapshots remain preserved.
No old passing receipt is represented as fresh acceptance of changed source.

Native service prerequisites: owned PostgreSQL cluster on loopback55433; selected
database `docrag_chunking_heading_1400_280`, role `docrag`, 162 chunks. Existing
Ollama process reports 0.40.9, cloud-disabled environment, loopback11434. Both
required model digests match `lib/local-model-config.json`. Neither service was
restarted or reconfigured. Additional unrelated installed model was not used.

The 63-check workflow covers signup/signin/logout, expiry, upload/index/original
bytes, free-form and follow-up answers, summaries/comparison, unsupported/partial
evidence, citations, streaming cancellation, guest/owner isolation, quotas and
deletion. Provider-specific Gemini behavior has fresh mocked coverage; live
Gemini **22/22 remains historical**, not rerun and no cloud calls made.

## Container verification

User explicitly authorized Docker Desktop startup. Existing restart policies
started DocRAG app/database; all ten unrelated containers remained stopped.
Current source images built with `docker compose --env-file
.local/step9-compose.env build`, exit 0. Only dedicated local DocRAG app was
recreated with `up -d --no-deps app`. Its database volume was retained.

`scripts.container_http`: exit 0, **26 checks PASS**, including actual auth,
streaming/cancellation, persistence, repeat migration, DocRAG-only app/database
outage/recovery. All ten unrelated container IDs/states/restart counts were
identical before/after this suite. No production/unrelated container controlled.

Fresh runtime execution: Node **24.22.1**, UID **1000**, Next **16.4.5**;
container-to-host Ollama returns **0.40.9**. Actual container picomatch SHA256:
`607dc79784c1161c33076903769dba23e63d9d9ccfe3c4695a32ebe3a5ab892d`.
Thus actual image inclusion now confirms the earlier native artifact exposure;
this does **not** resolve the vulnerability. Default container mode is the
established local regression configuration; personal workspace journey was
independently verified in the native opt-in fixture, not falsely attributed to
the container's disabled rollout setting.

## Real browser QA and discovered failure

Safari27.3, production-build preview on loopback8017, isolated synthetic native
database. Browser automation connector was unavailable and agent-browser was not
installed; native Safari interaction was used. No private document was uploaded.

Observed PASS: synthetic registration → signin → private empty library → upload
one-page public synthetic PDF → indexing → free-form question → answer “twelve
seats” → citation focuses matching source → unsupported annual-budget question
refused → reload retains document/session → authorized fixture deletion → empty
library → signout. No password saved to browser/password manager.

Appearance: light/dark selection, 100% glass persists on reload, reduced-motion
preference persists, liquid preview selection, Tab/arrow theme navigation. These
are interaction checks, not a motion/frame-rate audit. Mobile **390×844 Safari
responsive preview** rendered the composer/navigation and Library/Ask/Sources
views; arrow keys selected Sources. Not a physical-device test or complete
mobile end-to-end journey. Safari developer-menu setting was temporarily enabled
for responsive mode and independently observed restored to OFF.

**FAIL: guest free-form question** “How does FastAPI validate request data?”
retrieved six public passages but displayed the generic response error. Server
record: completion failed, category `model`, about6257ms. This is not a valid
refusal and is not overridden by the scripted guest PASS.

One bounded local diagnostic reproduced failure with the same question/context
IDs `[32,78,82,4,84,43]`: finish reason `stop`, substantive answer present, but
the model's evidence quotes were not exact contiguous matches of the passages.
`evidenceCheckedStream` rejected with “Evidence assessment could not be verified”.
Public-only raw output is preserved in `guest-diagnostic.json`. The single extra
final JSON brace is already handled by existing framing logic; the decisive
failure here is strict quote verification. No retry loop, fallback answer or
relaxation of exact evidence checks was introduced. A future repair must preserve
the grounding contract and prove the guest scenario, then rerun affected gates.

Browser error-state handling is observed; successful guest response acceptance
and complete mobile journey remain pending. Other browser engines and physical
devices are not claimed tested. Native API cancellation passed independently.

## Evaluation and remaining work

The fresh 100-question local benchmark completed, exit0, at
`eval/results/observability/prerelease-qa-a/evaluation-raw.json` (new untracked public
evidence preserved). **100 fresh query embeddings, 100 fresh answers, 100 fresh
judgments; zero cache hits**. 80 answerable and20 unanswerable; paid cost0.
Its frozen `step5-v1` engine path does not replace opt-in workspace
evidence-protocol/browser acceptance. Do not label a successful benchmark as a
passing guest workflow. Automated judgments are not independent human review.

| Measurement | Fresh provisional | Historical ui-redesign-d |
| --- | --- | --- |
| Recall@3 / @5 / @10 | .950 / .975 / 1.000 | Same |
| MRR | .972917 | .972917 |
| Automated correctness | .990 | .990 |
| Automated faithfulness | .995 | 1.000 |
| Supported citations | **265/269 (98.513%)** | 265/265 (100%) |
| Unanswerable correctness / faithfulness | **20/20 at1.0** | Comparison not recomputed by subset |
| Retrieval p50 / p95 | 43.05 / 83.68ms | 40.48 / 44.57ms |
| Pipeline p50 / p95 | 5802.26 / 12718.31ms | 5878.97 / 12483.39ms |

Pipeline timing excludes judge, process startup and pacing, per the established
evaluator definition; it is not browser wall-clock latency. Other authorized
local QA overlapped portions of this run, so do not infer a controlled performance
improvement/regression from these differences. Quality issue is isolated in the
saved rows to **postgresql-037**, citation2/6 and faithfulness.5. Do not hide this
behind aggregate Recall or unchanged correctness.

Validation/gates **FAIL**, preserved without altering policy:

- `eval.promote_local`: exit1, “Recorded implementation differs from recorded Git
  revision”. The dirty implementation cannot be certified by HEAD329ec8c.
- `eval.deployment_gate` on the preserved raw result: exit1, provenance/status
  mismatch. No validated candidate was created.
- `eval.check_regression` on the raw result: exit1, local judge calibration not
  human validated. The existing automated validation protocol was not bypassed.
- Numeric observation only: Recall@5 decline0 and faithfulness decline.005 are
  within .02, **but this is not a passing compatible regression gate**. A reviewed
  source/provenance checkpoint and applicable compatibility review are still
  required. No fake clean revision, threshold change or blanket source exception.

The formal27-group runner was not reported PASS: its independent applicable
commands were executed with unique receipts while avoiding redundant migrations
of the preserved native source databases. Security and provenance failures remain
explicit; fresh full integration coverage and remaining browser scope are pending.

Outstanding: exact-quote guest failure; unresolved high CVE-2026-112366; any
incompatible source-comparison gates; full browser/mobile acceptance and final
fresh integration coverage where required. Preserve the existing two moderate
tooling findings and all rejected evidence. No functional-readiness or production
readiness declaration is made.

Production Render/Vercel and Neon were untouched and not freshly health-probed.
No paid API, billing change, push, merge, branch deletion or publication. **₹0**.
Final Git:54 changed paths (50 original unchanged, three new documentation/metrics
files and one new public evaluation artifact); nothing staged or committed.
Exact local-secret comparison plus credential-pattern scan found no matches.
The loopback8017 QA preview remains available with synthetic-only fixture data.
