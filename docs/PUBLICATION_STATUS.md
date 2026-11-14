# DocRAG publication evidence — 13–14 November 2026

Public demo: **https://docrag-demo.onrender.com/**. Choose one of the public sample
questions and open a cited source. No recruiter account, key or local setup is
needed. Free cold starts and shared quotas apply; this is not an availability SLA.

The user explicitly authorized this separate publication phase, including normal
pushes to `feat/production-rag`, free Neon/Render resources, server secrets and
bounded free Gemini checks. Local STEPS0–12 remain historical completed work.
The starting checkout was clean at `d128e82e44cbff7b88c7b1cbe1f01a0d0e08966c`.
The public Git remote was independently verified; no branch merge or force push.

## Publication and hosted CI

The baseline push succeeded. Hosted workflow **CI**, job **checks**, passed on
that exact SHA: [run43220105275](https://github.com/abhi0874/DocRAG/actions/runs/43220105275),
completed2026-11-12T12:44:36Z. See `publication/hosted-ci.json`.
It ran all460 tests, coverage reporting, lint/typecheck, build, real SQL migration/
retrieval fixtures and negative controls. This is actual hosted evidence, not the
previous local Linux equivalent. Standard Ubuntu24.04 runner; no inference key.

[Latest branch CI](https://github.com/abhi0874/DocRAG/actions/workflows/ci.yml?query=branch%3Afeat%2Fproduction-rag)
identifies the final publication commit and its run. This record is committed
before that run can exist: final completion requires observing its success,
normal remote/local SHA equality and a clean working tree. The closing report
provides the final SHA/run rather than inventing a self-referential receipt.

No application, RAG, authentication, model, lockfile, Dockerfile or migration source
changed during publication. New files are guarded publication/check helpers and
sanitized evidence; current documentation now describes the verified online mode.

## Hosted resources and configuration

| Resource | Verified state |
| --- | --- |
| Render | `docrag-demo`, `srv-dbrf4l0u01pc73b2dneg`, Virginia, Docker, Free $0/month,0.1CPU/512MB |
| Initial known-good deployment | `dep-dbrf4lou01pc73b2dq30`, source d128e82, live13 November2026 at16:51:31 IST |
| Runtime | Docker-pinned Node24.22.1/pnpm11.25.0, non-root user, port3000 |
| Health/deployment | `/api/health`; Auto-Deploy OFF; operator manually deploys verified commits |
| Neon | Existing `docrag-db` project `lucky-cake-24873711`, main branch, Free, AWS us-east-1 |
| New database | `docrag_demo_gemini_v1`; existing `neondb` untouched |
| SQL/extension | PostgreSQL18.7(a21afb5), pgvector0.8.6; initial preflight18.6 reflects provider patch evolution |
| Corpus | Two manifest-verified public documents,162 chunks, no historical users/sessions copied |
| Embedding space | `gemini-001-1536-v1`, `gemini-embedding-001`,1536 dimensions; exact vector readback |
| Generation | Standard `gemini-3.5-flash-lite`, existing project with no linked billing account |

Public Git URL was used rather than expanding the existing GitHub App's repository
access. No paid disk, autoscaling, custom domain or payment method was added. An
existing unrelated Render service and an older Vercel deployment connected to the
existing Neon project were discovered and left untouched. Earlier statements that
no deployment existed describe this branch's local checkpoint, not an exhaustive
historical inventory of the user's accounts.

Render received only the11 documented server environment variables from an ignored,
mode600 private file. The Neon login is the new restricted `docrag_demo_runtime`,
not the owner login. It has no superuser/createDB/createRole/replication/bypassRLS or
schema-create permissions. It can operate the intended new database tables; the old
`neondb` exposes zero accessible tables to this role. The strong auth secret and
Gemini key are absent from source and public bundles. No client-public secret vars.

Neon TLS was verified at the actual Node client socket: encrypted, authorized,
TLS1.3, `sslmode=verify-full`. A proxy-side `pg_stat_ssl` value alone was not used
to conclude client TLS failed. The application's pooled connection remains max3.
Initial administrator migrations used a pooled connection,max1, and passed; a
direct connection remains preferred for future migrations/backups.

## Safe database publication and preserved failures

`scripts/demo_publish.ts` defaults to a read-only preflight. It validates source
cluster ownership/name/port, both public-document hashes,162 normalized vectors,
embedding metadata, dedicated Neon destination identity/ownership and emptiness.
Only explicit `--apply` applies the unchanged `db/init.sql` and Drizzle migrations
and copies public data. It never generates embeddings, copies old auth records,
creates/resets a database, truncates tables or updates the local source.

The first copy failed with42P01 because its post-copy check named `user` rather
than `auth_user`; the data transaction rolled back and additive migrations remained.
The helper was corrected. A separately guarded `--resume-empty-schema` requires
exactly the14 reviewed empty public tables plus the Drizzle receipt table, and
matches both migration hashes/timestamps. It cannot accept populated/partial data.
Resume preflight and copy then passed. Both modes now reject the populated target
with expected exit1. All failed and successful receipts are preserved under
`publication/neon-*.json*` and `copy-negative-controls.json`.

Copied corpus hash:
`f0cbcf44b51b75686deec854bb53106b9297146ffa9f551e85899ba17375a0f6`.
Vector hash:
`c54165d3c11c838c7fc53ba6307c3c0e114d971960a19141f97e4a22095c03e5`.
Zero model calls for copying. Schema verification found24 indexes,117 constraints,
auth/ownership/feedback/metrics tables and exact public-vector readback. Two NEW
synthetic accounts were subsequently provisioned for production smoke tests;
private account credentials stay ignored and final sessions were logged out.

## Production acceptance and scope

`publication/production-smoke-b.json`: **53/53 PASS**, exit0, three admitted chat
requests (answer, refusal, cancellation). HTTPS assets, live/ready endpoints, public
corpus, disabled registration/uploads/evaluation writes, origin/input protection,
two-account secure eight-hour sessions/navigation/logout, owner-scoped metrics and
feedback, request IDs, cache bypass, streaming/citations, unanswerable refusal,
application429/Retry-After and recorded cancellation all passed. Public responses
and fetched client assets were checked against the actual private secret values.

The initial smoke attempt failed before any check/model call because the local
Python trust-store file was unavailable (`production-smoke-a.json`). Selecting the
existing OS CA bundle with `SSL_CERT_FILE=/etc/ssl/cert.pem` fixed the runner;
certificate verification was never disabled. No global installation/change.

Browser checks separately observed an anonymous cited answer and source-panel
highlighting of the correct FastAPI passage. Two anonymous UI requests were admitted
across the resumed work, giving **five admitted production chat requests total**:
four completed, one cancelled. Browser console had no captured errors at final
inspection. Script first-text timings1.259s/1.791s/1.769s are smoke observations,
not a benchmark or capacity estimate. Citation validity is not a new human/semantic
answer-quality evaluation.

Natural Render idle wake-up was observed: provider waking screen, then usable
DocRAG and successful DB-backed requests. Neon connectivity recovered after normal
idle intervals without artificial keepalive traffic; its exact suspend/resume
transition and latency were not instrumented. No service was stopped to manufacture
an outage. Provider429/5xx and database failure paths have deterministic/local
coverage; they were not injected into live shared production. The live application
quota429 passed. No claim of a forced provider outage or rollback execution.

## Commands and regression provenance

Commands below require the pinned existing environment. Never put credentials on
the command line or print environment files. Supply private settings to child
processes only; `.local/publication-neon.env`, `.local/publication-render.env` and
`.local/publication-accounts.json` stay ignored. See COMMAND_CONTRACT.md.

```sh
make lint
make test
make cov
.venv/bin/python -m eval.check_regression \
  --baseline eval/results/baseline-local-ollama.json \
  --current eval/results/latest-local-ollama.json
.venv/bin/python -m pytest -q tests/test_observability_gate.py \
  tests/test_security_gate.py tests/test_prompting_gate.py
# Read-only by default; privately provide approved source/destination configuration:
node --import tsx scripts/demo_publish.ts --check
# Only for a separately approved EMPTY destination, never replay against production:
node --import tsx scripts/demo_publish.ts --apply
# Explicitly authorized bounded live check, unused receipt path and synthetic accounts:
SSL_CERT_FILE=/etc/ssl/cert.pem .venv/bin/python -m scripts.publication_smoke \
  --live --receipt .local/publication-smoke-UNIQUE.json
```

`publication/final-local-verification.json` records fresh lint/test/gate/negative-
control commands and exit0. **218 Python+242 TypeScript=460 tests**;34 quality-gate
negative controls also passed. Saved evaluation comparison decreases: recall0,
faithfulness0. It rechecks saved results, NOT fresh generations. Earlier `make cov`
exit0 and local command receipts remain in `local-verification.json`.

STEP12's100 fresh local answers/query embeddings and37 fresh/63 cached judgments
remain frozen: Recall@5 .975,faithfulness1.000,correctness.985,citations265/265.
Historical Gemini retrieval Recall@5 .96875 is a separate1536-dimensional index
measurement over80 answerable questions. No hosted100-answer generation was run.

Python publication integration coverage is **1429/1869=76.46%**, zero excluded
lines, unchanged70% threshold. This explicitly combines **historical STEP12
integration coverage for byte-identical existing Python sources** with **fresh
execution of the new publication helper**. It is not a fresh full integration run.
See `coverage-provenance.json` and `python-combined-coverage.json`. The existing
STEP12 collection74.38% is preserved. TypeScript statements65.36% remains the
separate application measurement; Python unit-only coverage is not the70% gate.
The applicable command was `COVERAGE_FILE=$PWD/.local/coverage-publication/.coverage
make cov-integration-gate` (exit0); original parallel inputs were retained.

Fresh dependency policy passed with exactly two disclosed moderate JavaScript
findings: **esbuild0.18.20 GHSA-67mh-4wv8-2f99**, **minimatch10.2.5
GHSA-g3hv-75wg-m249**. Raw `pnpm audit --json` exited1; no zero-vulnerability claim.
The optional Drizzle CLI/esbuild path is absent from production server traces;
minimatch is tooling-only. Python and actual reranker environment audits exited0.
See `publication/dependency-audit.json` and SECURITY.md; no dependency was upgraded.

## Cost and free-tier limits

Official terms were rechecked before resource creation: [Render Free](https://render.com/docs/free),
[Docker](https://render.com/docs/docker), [Neon pricing](https://neon.com/pricing),
[pooling](https://neon.com/docs/connect/connection-pooling),
[TLS](https://neon.com/docs/connect/connect-securely).
Fresh13 November account checks: Render Hobby **no card on file**, accrued/projected
**$0.00**, no invoices; Free service. Neon **Free**,0.17CU-hours/44.24MB used at
observation. Google Cloud explicitly: **This project has no billing account** and
**This project is not linked to a billing account**. No billing/payment change.
Actual observed paid cost **₹0**; no paid runner/add-on/API was selected.

Render sleeps after15idle minutes; waking can take about a minute. Filesystem is
ephemeral,750free instance-hours are workspace-shared; dashboard allowance5GB
bandwidth/500pipeline minutes. No card means exhausted allowances can suspend
service/builds rather than authorize a paid upgrade. Neon Free1GB/100CU-hours and
scale-to-zero constrain availability. Future provider terms can change; inspect
before future changes. The application uses2questions/minute/user,4global/minute,
50/day application cap, bounded concurrency, zero generation retries,45s timeout,
12KBcontext and1024output tokens. Anonymous visitors share quota. No paid fallback,
keepalive bypass, persistent disk or private corpus upload.

## Rollback and operation

Identify the current and known-good commit in Render Events. The first verified
release is d128e82 / `dep-dbrf4lou01pc73b2dq30`. After final publication redeployment,
the application/Docker inputs must still match this release. With authorization,
use the available previous verified deploy's Rollback action; Free retention is
limited, so preserve commit IDs and rebuild the known-good commit if necessary.
Do not enable Auto-Deploy or roll back schema/data automatically.

For configuration, restore only the reviewed11 settings through Render secrets;
keep exact HTTPS origin, restricted role, no-linked-account acknowledgement and
cache/reranker OFF. Do not expose secret backups in Git. For DB failure, stop further
writes/migration attempts, preserve diagnostics, and inspect identity/receipts.
Before future migrations take a private direct-connection dump, verify its archive
list and restore into a NEW isolated database for testing. No destructive restore
or backup/rollback exercise was performed in this publication.

For Gemini outage/quota exhaustion, retain sanitized errors and no automatic retry
or paid fallback; wait for recovery/quota reset. Any service suspension or material
configuration change needs applicable permission. Do not switch to a local Mac
endpoint from the public service. Old local embeddings, evaluation history, other
projects and the older Neon/Vercel database remain untouched.

Final three confirmations are: production behavior/security; reproducible
publication/CI/documentation; and cost/secret/Git/data safety. All must pass on the
closing remote SHA before declaring this publication phase COMPLETE.
