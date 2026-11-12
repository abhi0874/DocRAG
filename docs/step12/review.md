# STEP 12 final review

Scope: final local verification of measured source `83e13c7`; no implementation,
model, architecture, dependency or security-policy changes. The user delegated the
three acceptance definitions in acceptance.md. All earlier evidence is preserved.

## Architecture and trust boundaries

Source review followed `app/api`, `lib/auth.ts`, `lib/security/{http,access,pdf}.ts`,
`lib/retrieval.ts`, `lib/rank-fusion.ts`, chat/cache/citation code, feedback/metrics,
provider configuration and demo modules. Next.js Route Handlers remain the backend;
Python remains evaluation/operations tooling. Drizzle/pgvector, hybrid search/RRF,
optional disabled MiniLM, disabled default response cache and telemetry are intact.

Sessions remain database-validated, fixed eight hours with refresh disabled;
HttpOnly/SameSite and HTTPS Secure cookies, exact host/origin checks, bounded bodies
and operator-created accounts remain. Both vector and keyword SQL restrict access
before LIMIT; citation/document/feedback/metrics authorization is server-side.
Fresh tests: 66 real HTTP checks, 27 SQL isolation/quota checks, 138 telemetry
assertions, 26 final Docker checks and 10 Linux retrieval checks. Upload content,
size, malformed PDF, origin and two-user ownership controls pass. Synthetic test
accounts and public fixtures remain isolated; private feedback export remains off.

Permanent `[-1]` and invalid citation after one-line triple-backtick regressions
remain in citations/cache tests and pass. Invalid cache entries are evicted before
replay bytes; invalid/incomplete/cancelled generations are never committed to cache.
Valid uncited refusals remain supported. Private/history requests bypass cache;
receipt, cancellation and feedback accounting are tested through actual HTTP/SQL.

## Providers and vector integrity

Preserved Ollama 0.40.9, cloud disabled, both exact historical digests and host/
Docker connectivity pass after authorized recovery. Native selected corpus has
162 vectors of 768 dimensions; the isolated Gemini demo has 162 vectors of 1536
dimensions. Original 151-vector local/Gemini spaces and 20 Gemini cache pairs are
unchanged; preservation.json records hashes and database checks.

The public demo requires explicit Gemini deployment/provider settings, a reviewed
model, billing acknowledgement and exact separate database identity. Remote TLS
must verify the hostname; model/version metadata is checked beyond dimension
count. Query and document embeddings use the same named/versioned normalized
space. No recruiter key is accepted or sent to the browser. The final browser
assets were scanned for actual configured credentials.

Privacy checks admit only frozen public chunks and approved one-turn sample
questions. Private uploads/free-form/history and evaluation writes are rejected.
Atomic SQL quota limits remain 2/user/minute, 4/global/minute and 50/application
24-hour window, with two-work admission, 45-second timeout, 1024 output tokens and
zero provider retries. Fresh mocks cover 429/5xx/errors/cancellation/configuration;
STEP 11 live generation, embedding, refusal, citation navigation, quota and
cancellation receipts are historical live evidence, not new STEP 12 API calls.
No new Gemini calls were necessary. Cloud retrieval Recall@5 .96875 is retained
separately from the local .975; neither is a cloud answer-quality guarantee.

## Production, database and CI

Fresh lint/type checks, 218 Python + 242 TypeScript tests, V8 coverage and production
build pass. Source/lockfiles match the measured STEP 11 source: 224/224 historical
hashes and 227/227 final-verifier hashes. The pinned Dockerfile installs the exact
frozen pnpm lockfile and uses Node24.22.1, pnpm11.25.0 and a non-root runtime. No
new installation or upgrade was required solely to duplicate accepted reproducibility.
Fresh local CI command coverage comprises native lint/test/coverage/build and real
Linux migration/session preservation plus retrieval isolation. This is not a claim
that all unit tests were freshly run on hosted Ubuntu. The hosted workflow pins
four action SHAs, runtimes and pgvector image, has read-only repository permission,
no deployment job and no inference credentials. Remote Actions: NOT RUN.

Two actual Drizzle migrations are present; repeatability/session preservation pass
in dedicated docrag_ci. Native and Docker databases remain distinct. No production
schema change or destructive pending migration is introduced. Owned database health
and Docker health/readiness pass. Only the specifically authorized service starts
and DocRAG lifecycle checks occurred. Unrelated text-to-sql container lifecycle
matches the prior checkpoint; it remains exited. Outage causes are unknown.

Render/Neon preparation remains review-only. Official Render Free/Neon pricing
was rechecked; existing plan figures remain accurate. Render's free service is a
hobby/demo candidate with sleep, ephemeral filesystem and suspension risks, not a
production SLA. Neon still requires separate database, verified TLS and region/
account checks at provisioning. Migration/bootstrap runs from this verified local
checkout with the public source and a dedicated empty target; the runtime image
is not an automatic schema/bootstrap runner. Direct DB connections are for those
operations, pooled connections for the app. Backup/restore into a new isolated
database and image rollback are procedures, not claims that cloud recovery was run.
No public URL exists. Actual remote TLS, eligibility, cold starts and deployed
streaming remain future authorized deployment checks.

## Performance and quality interpretation

STEP 10 historical 5/20/50-user queue p95 values are about 5.067/14.559/74.737s.
HTTP timing begins after client model admission; queue latency is separate and
must not be hidden by quoting HTTP latency alone. All 50 virtual users can queue,
but only two model calls run concurrently. STEP 12 reran the existing bounded
5-second ramp/15-second hold suite only because fresh scripts coverage required it.
It is not a new endurance/capacity claim or a Gemini benchmark. All 18 stages
passed: 6,786 requests, 2,567 HTTP429 responses, zero unexpected failures. Quota
rejections are failures from a client perspective, not successful responses; the
artifact retains error rates and successful throughput separately. Queue p95 at50
users remains73.204s. No evidence justified a concurrency/security change.

The 100-question STEP12 evaluation has100 fresh answers and query embeddings,
37 fresh/63 cached judge results. Recall@5 .975 and faithfulness1.000 are unchanged;
correctness .985 fell from .990, traced to postgresql-031's incomplete transaction
example. All265 cited occurrences were judged supported, versus264 previously.
These are calibrated automated metrics with the recorded rubric, not human review
of every answer. Existing .02 gates pass; no threshold or baseline was replaced.
See evaluation-summary.json for the discrepancy and provenance, raw results beside
the promoted result for all answers/judgments.

## Residual risks and evidence limits

Two moderate JS advisories remain under the established reviewed policy; raw audit
exit1 is retained. Fresh production traces exclude the affected esbuild loader;
minimatch10.2.5 is dev-only. The docs incorrectly grouped3.1.5 into this specific
advisory; that wording is corrected. Upstream major-version replacements are not
assumed safe for old loader/lint APIs. No risky upgrade was made. See dependency-audit.json
and SECURITY.md, including official advisory links. Python/reranker audits exit0.

Coverage is74.38% (1269/1706 scripts statements, no exclusions), exceeding70%.
Unit-only Python coverage remains much lower and is not presented as integration
coverage. TypeScript statements65.36%, branches64.12%, functions58.28%, lines67.53%;
there is no invented TypeScript70% acceptance threshold. Earlier58.21% interim
failure, upload500 during service outage, launcher import error, and review-only
secret pattern findings remain recorded in verification-summary.json.

Log hashes are in log-manifest.json. Logs stay ignored on this Mac; public receipts,
source hashes, evaluation and load artifacts are versioned. The long-running load
session expired before its process exit was polled; its completed PASS receipt and
all18 stages were inspected. No unobserved exit code is invented. Container final,
coverage gate, preservation and same-config regression exits were observed as0.
