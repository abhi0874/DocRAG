# STEP 11 deployment preparation — not publicly deployed

This is local preparation, not permission to publish. STEP 11 local preparation and its three confirmations passed;
see STEP11_COMPLETE.md for exact verified scope and retained limitations. Remote
GitHub Actions has not run. STEP 12 final verification is authorized; publication
and cloud provisioning still require separate explicit authorization.

## Architecture and budget

Recommended candidate: the existing pinned Docker image on **Render Free**, with
**Neon Free PostgreSQL/pgvector**, and standard Gemini inference/embeddings. Local
Ollama remains unchanged. Expected hosting/API spend is ₹0 only while accounts
remain on the reviewed free plans, Google has no linked billing account and no
paid features are enabled. Do not add a payment method, paid disk or subscription.

| Option | Assessment |
|---|---|
| Render Free Docker | Preserves Node24.22.1 and the existing Node Route Handlers/streaming server. Services sleep after15 idle minutes; waking can take about a minute. Filesystem is ephemeral, free disk persistence unavailable.750 free instance hours are shared per workspace; usage/network/build limits and suspension remain operational risks. No availability promise; intended as a hobby/recruiter preview, not a production SLA. |
| Neon Free | PostgreSQL/pgvector; currently1GB storage and100 CU-hours per project/month. Idle compute scales down. Keep a separate demo database, verified TLS and small client pool. Do not replace Better Auth with Neon Auth. |
| Vercel Hobby | Attractive Next.js integration, but the supported Node major receives automatic minor/patch updates, conflicting with this project's exact24.22.1 pin. Hobby personal/noncommercial restrictions also need project-specific assessment. Not selected. |
| Railway/Fly | Usage credits/trials or metered pricing do not establish a durable ₹0 deployment for this app. Not selected. |

Official sources checked during preparation (Render Free and Neon pricing rechecked
during STEP 12): [Render Free](https://render.com/docs/free),
[Docker](https://render.com/docs/docker), [Blueprint fields](https://render.com/docs/blueprint-spec),
[Neon pricing](https://neon.com/pricing), [pooling](https://neon.com/docs/connect/connection-pooling),
[pgvector](https://neon.com/docs/extensions/pgvector),
[Vercel Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions),
[Hobby usage](https://vercel.com/docs/limits/fair-use-guidelines),
[Railway trial](https://docs.railway.com/pricing/free-trial), [Fly pricing](https://fly.io/docs/about/pricing/).
Choose colocated application/database regions supported by the free plans at actual
provisioning time. Region availability, account eligibility, deployed streaming,
cold starts and provider network behavior remain unverified without deployment.
Render can suspend free services with unusual external traffic; this matters for
an external database/model API. Do not treat the recommendation as an SLA.

## Models and privacy

Hosted answers use reviewed configurable `GEMINI_CHAT_MODEL=gemini-3.5-flash-lite`.
Only this reviewed model is currently accepted; changing the allowlist requires
quota and quality review. No paid-model fallback exists. Standard Google streaming
fits the existing text/citation/cancellation pipeline.

Gemini Live is deferred as an optional future voice capability, not a requirement.
Its stateful bidirectional WebSocket protocol would introduce session/transport
work unrelated to this text-first RAG interface. No Gemini3.8 Live compatibility
claim or implementation is made. See [official Live reference](https://ai.google.dev/api/live).

The public demo accepts only the100 existing public sample questions, one message
at a time, against hash-verified public documents. Private uploads, arbitrary
conversation text and evaluation POSTs are refused in demo mode. Local Ollama
retains the private-document workflow. This is deliberate because unpaid Gemini
content may be used for product improvement: [terms](https://ai.google.dev/gemini-api/terms).
The browser never receives the Gemini key; it receives public question text only.
Existing auth/ownership/origin/feedback protections remain in place. Public access
uses the existing anonymous public-document capability, not a shared privileged account.

## Billing evidence and quota limits

User-provided AI Studio evidence: Free tier, generation15 RPM/250K TPM,
embedding100 RPM/30K TPM. RPD is **unavailable/not displayed** for both models.
The Google Cloud screenshot dated10 November confirms the same selected project
has no billing account and is not linked to one. No billing setting was changed.
Do not copy account screenshots containing unrelated personal UI into Git.

The [pricing page](https://ai.google.dev/gemini-api/docs/pricing) lists standard
`gemini-3.5-flash-lite` input/output and `gemini-embedding-001` text input as free-tier
eligible. Project limits remain authoritative; [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)
can change. No search/maps grounding, provider context caching, Flex tier or paid
asynchronous embedding Batch jobs are used.

Application limits:2 admitted questions/minute per user (anonymous users share one
bucket),4/minute globally,50 per fixed application quota window of24hours. The
last value is an application cap, **not an invented provider RPD**. Counters are
atomic PostgreSQL rows shared across workers. Existing two-work admission remains.
Fixed-window boundaries can admit two windows close together; the4/minute cap
still leaves margin below15 RPM. Generation context is capped at12,000 UTF-8 bytes,
output at1,024 tokens, total generation timeout45s and retries0. Provider errors
are sanitized; the UI never automatically retries. Availability is limited.

## Separate embedding space

Ollama768-dimensional vectors remain intact. Cloud indexing/query embedding both
use `gemini-embedding-001`,1,536 dimensions, matching retrieval task types and L2
normalization. Dedicated database `docrag_demo_gemini_v1` plus metadata version
`gemini-001-1536-v1` prevents accidental database/model mixing. Dimensions alone
are not model identity. Historical Gemini embedding2 data is not reused.

`scripts/demo_bootstrap.ts` verifies source cluster ownership and both frozen
public-document hashes, refuses nonempty targets, copies original chunk IDs and
metadata without old vectors, and writes readiness metadata only after all new
vectors commit. Standard synchronous embedding requests are paced with bounded
input bytes; no asynchronous Batch job is created. The local source is read-only.
Bootstrap must run separately from public traffic to reserve quota.
A failed partial target is preserved; never automatically drop or reset it.
Independent cloud retrieval evaluation is required; local metrics do not establish
cloud quality. Precomputed Ollama document vectors would still require compatible
query embeddings, so they cannot alone make the cloud app independent of the Mac.

## Configuration and operation

`deployment/render.yaml` is a review-only blueprint; applying it requires separate
publication approval. It pins the existing Dockerfile, free plan, port3000,
`/api/health`, and disables automatic deployment. No production resources exist.
Configure secrets in the provider dashboard privately, never in Git or images:

- `DOCRAG_DEPLOYMENT=recruiter-demo`, `AI_PROVIDER=gemini`.
- `GEMINI_API_KEY` and reviewed `GEMINI_CHAT_MODEL`.
- `DOCRAG_GEMINI_BILLING_CONFIRMED=no-linked-account` only after actual console verification.
- `DEMO_DATABASE_URL`: exact dedicated database, Neon host, `sslmode=verify-full`.
- `BETTER_AUTH_SECRET`: private strong secret; `DOCRAG_APP_ORIGIN`: exact HTTPS origin.
- Keep `DOCRAG_LOCAL_HTTP` unset remotely, cache/reranker OFF.

Use Neon pooled connection for application traffic (pool max3, connection timeout5s),
and a direct connection for bootstrap/migrations. Existing Better Auth remains
operator-managed:8-hour database sessions, secure/HttpOnly/SameSite cookies and
exact trusted origin. No forwarded-IP authentication or origin trust is introduced.
No database contents or URLs are exposed by health endpoints. `/api/health` checks
liveness; `/api/ready` checks database/space configuration without a charged model
call. Actual model availability requires a separate bounded probe.

Before authorized provisioning: create a dedicated empty database; use the existing
schema and Drizzle security migrations through the guarded bootstrap. Never run
these against the Ollama or historical Gemini database. For local verification,
use the owned cluster and the separately authorized local demo database. Private
source/target connection strings stay in ignored environment files.

The original private file workflow persists bytes in PostgreSQL, not container
storage; cloud demo uploads are disabled. Render's ephemeral filesystem is not a
place for persistent documents, sessions, vectors or backups.

## Recovery and verification

Before future migrations, export a private `pg_dump --format=custom` backup through
the direct connection, verify it with `pg_restore --list`, and test restoration to
a **new isolated database**. These are procedures, not executed backup claims.
Rollback app code to a previously verified image; never roll back auth schema or
rewrite vectors destructively. Restore data into a new database and switch only
after validation/approval. Preserve failed runs for diagnosis.

See COMMAND_CONTRACT.md for local tests. STEP 11 live probe records fresh requests
separately from mocked streaming tests. All original citation/cache/auth/cancellation
regressions and the100-question Ollama evaluation remain required. The explicit
new deployment compatibility gate preserves .02 thresholds and rejects changed
local models, prompts, evidence or undeclared source changes; historical gates
remain untouched. Cloud retrieval evaluation is separate, never compared as if it
were the same embedding space. Remote GitHub Actions remains NOT RUN.

STEP 10's50-user queue p9574.74s and2,480 quota rejections are historical local data,
not Gemini capacity measurements. The demo has intentionally much lower quotas.

## Local verification evidence, 10 November 2026

The authorized bootstrap completed all 162 public chunks in the separate local
database. Fresh query embeddings and SQL retrieval covered all 100 golden
questions; the existing metric excludes 20 unanswerable questions from recall.
Cloud Recall@3/@5/@10 is .93125/.96875/.99375. The historical local Recall@5 is
.975; the difference of -.00625 is descriptive, not a same-configuration gate.
See step11/cloud-retrieval-summary-a.json. No cloud answer-quality benchmark is
implied by this retrieval measurement.

The bounded live provider probe passed streaming generation and a normalized
1,536-dimensional embedding. After authorized service recovery, the production
demo returned a cited answer, navigated to its source, produced a valid uncited
refusal, denied private text/uploads/evaluation writes, enforced quota rejection
and recorded cancellation. These are live checks; provider 429/5xx no-retry tests
use deterministic mocks and are labelled separately. Mobile header overflow was subsequently repaired; the local100-question
evaluation and71.16% integration coverage gate passed. Earlier failures are retained.

No cloud resource or database was provisioned. The local demo database proves
the isolated schema and embedding path; it does not prove remote TLS, region
availability, real hosting cold-start latency or public-domain operation.

## Reproducing the bounded provider checks

Use the pinned Node path and privately supplied child-process environment. The
live probe refuses an existing receipt before making a request; use a new reviewed
receipt filename for an explicitly needed fresh probe. Do not delete old receipts.
The replay negative control exits 1 intentionally and makes no API request.

The exact executed retrieval and quota diagnostic sources are preserved in
`step11/cloud-retrieval-command.ts.txt` and `step11/cloud-quota-command.ts.txt`.
They were run from ignored `.local/` with `node --import tsx`, private demo
configuration and the confirmed-billing acknowledgement. Before another retrieval
run, choose new output/vector filenames and check they do not exist **before**
allowing API calls; the saved diagnostic's original exclusive writes occur after
query embedding. Reuse compatible saved query vectors for SQL-only diagnostics
instead of needlessly regenerating them. Those vectors remain ignored; they are
not proof of fresh embedding calls on reuse. The quota diagnostic uses unique
synthetic identities and leaves the real public/global quota counters unchanged.

The completed local regression is in
`eval/results/observability/step11-final-a/evaluation.json`, with original raw
measurements retained beside it. `step11/contract-results-a.json` records the
20 pre-outage and seven resumed command receipts. All 100 answers were freshly
generated; eight judge results were reused and 92 were fresh. No result sets were
manually spliced. The final browser-only repair does not change evaluated RAG,
provider, auth, prompt or citation code; affected build/test/browser checks are
recorded separately.
