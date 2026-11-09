# DocRAG technical handoff

Read [CURRENT_STATUS](CURRENT_STATUS.md) first. This reference is based on source,
saved results and read-only inspection on 6 November 2026 (Asia/Kolkata).
Steps 0–8 are complete. Step 9 implementation and saved verification are present,
and final documentation/evidence reconciliation passed on 7 November.
CURRENT_STATUS.md is authoritative; STEP9_COMPLETE.md records fresh final-e acceptance. No online deployment
is established. STEP 10 is authorized and in progress; Steps 11–12 are not started.
See LOAD_TESTING.md and CURRENT_STATUS.md for recovery and load evidence.
The root README is still a starter template; use these documents and the
[command contract](COMMAND_CONTRACT.md) for actual operation.

## Architecture and source map

The UI is Next.js 16.4.4, React 19.2.4, TypeScript and Tailwind. `app/page.tsx`
and workspace/chat components implement document selection, upload, streaming
answers and source inspection. `app/evaluate/` compares answers; `app/metrics/`
shows owned telemetry. The backend is `app/api/` route handlers, not Python.
`lib/rag.ts`, `lib/rag-answer.ts`, `lib/ollama.ts` and `lib/provider-config.ts`
select the Gemini SDK or local Ollama adapter. Normal provider default is Gemini;
local benchmarks and container development explicitly select Ollama.

`lib/db/schema.ts` defines documents, chunks and evaluations; `db/init.sql` adds
pgvector, generated full-text search and indexes. Native Gemini schema uses 1536
embedding dimensions; the selected Ollama corpus uses 768. Do not mix them.
Drizzle security migration 0000 adds Better Auth tables, document/evaluation
access, private originals and request limits. Migration 0001 adds request metrics,
answer receipts and feedback. See `lib/db/security-schema.ts` and
`lib/db/observability-schema.ts`. Migration repeatability is separately tested;
never initialize a historical database to reproduce a clean test environment.

PDF input passes size/structure checks in `lib/security/pdf.ts`, extraction via
unpdf, heading-aware splitting in `lib/chunking.ts`, embedding and transactional
storage with authenticated ownership. `lib/retrieval.ts` performs authorized vector
and PostgreSQL full-text searches, `lib/rank-fusion.ts` combines ranks, and
`lib/select-context.ts` prepares evidence. ACLs apply to both search branches,
fusion candidates, citations and direct document access, not merely UI filtering.

`lib/auth.ts` uses Better Auth 1.7.15 and Drizzle, operator-created accounts,
fixed eight-hour sessions, disabled sliding refresh, server database validation,
HttpOnly/SameSite cookies and Secure on HTTPS. Local HTTP requires explicit
loopback origin configuration. Private uploads and metrics belong to session users;
client-supplied ownership is never trusted. See [SECURITY](SECURITY.md) and
[SECURITY_MODEL](SECURITY_MODEL.md) for quotas, origin/CSRF checks and upload rules.

## Selected RAG behavior

Verified source configuration: `lib/local-model-config.json`,
`lib/chunking-default.json`, `lib/retrieval-default.json`, prompt/cache modules.

| Setting | Value |
| --- | --- |
| Answer/judge | qwen3.8:latest |
| Qwen digest | 47951e4a666180bc2aedfc93c169472f2de783696fe196efbf063f5730ecf163 |
| Embedding | embeddinggemma:300m, 768 dimensions |
| Embedding digest | 85462619ee721b466c5927d109d4cb765861907d5417b9109caebc4e614679f1 |
| Chunking | heading-v1, size 1400, overlap 280 |
| Retrieval | 12 vector + 12 keyword candidates, RRF k=60 |
| Prompt | step5-v1 selected; grounded-v1 comparison |
| Reranking | Optional MiniLM; default false |
| Response cache | Optional public-only; default false; history/private bypass |

MiniLM is a separate local Python worker, not a backend. Its configured absolute
`DOCRAG_RERANKER_HOME` avoids Next build traversal of local environments. The
container does not bundle it or model weights; disabled/fallback verification is
still required. See [RERANKING](RERANKING.md) for model locations and removal.

The shared generation function passes retrieved evidence and cancellation signals
to the AI SDK. The chat route propagates abort, settles owned work and prevents
partial cache writes. Telemetry distinguishes completed/cancelled/failed independently
of HTTP status. Terminal fields are frozen before asynchronous persistence.
`lib/citations.ts` and `lib/validated-stream.ts` reject invalid attribution; preserve
negative `[-1]` and triple-backtick regressions (`tests/cache-api.test.ts`,
`tests/closed-code-attribution.test.ts`). Invalid stored responses cannot replay.
Public caching additionally requires exact corpus/document/question hashes and
single-turn eligibility (`lib/public-cache-policy.ts`, `lib/response-cache.ts`).

`lib/observability/` implements server UUIDs, allowlisted JSON, monotonic durations,
actual provider usage and bounded PostgreSQL writes. Missing usage is null.
`app/api/metrics` filters by session owner. Feedback references a real completed
server-owned receipt and upserts one vote. `scripts/feedback_to_eval.py` exports
only manifest-verified public negatives into ignored review candidates; it never
promotes private content or modifies golden labels. See [OBSERVABILITY](OBSERVABILITY.md).

## Testing and evaluation

`tests/` contains pytest helper/evaluator tests and Vitest application tests.
`vitest.config.ts` measures lib/API/component coverage. `make cov` measures Python
`scripts` only, not every Python module; do not claim whole-project coverage.
Native HTTP suites (`scripts.security_http`, `scripts.observability_http`) use a
production server, isolated fixture DB, real SQL and local model service. Browser
screenshots in `docs/security/step8-browser/` are historical manual evidence.
Tests include cancellation stages, auth, ownership, PDF validation, quotas,
metrics, feedback, citation/cache regressions and negative quality controls.

The golden set is `eval/golden_set.jsonl`: 100 questions, 80 answerable/20 deliberate
refusals. The selected public corpus contains 162 chunks. Saved model results are
not guaranteed truth; automated judgments are not independent human validation.
Gate limits remain Recall@5 decline <= .02 and faithfulness decline <= .02.

| Saved result under eval/results/observability/ | Provenance |
| --- | --- |
| step8-final-a/evaluation.json | 100 fresh answers/judges; zero cache hits |
| step8-command-repair-a/evaluation.json | 100 compatible cached answers/judges; retrieval rerun |
| step9-prerequisite-b/evaluation.json | Same cached mode; 27-group prerequisite passed |

All three record Recall@3 .95, Recall@5 .975, Recall@10 1.0,
MRR .9729166666666667, automated faithfulness 1.0, correctness .99 and citation
support 264/264. Cache replay timings are not fresh generation timings.
Historical baselines must never be overwritten. Benchmark runtime is preserved
Ollama 0.40.9; desktop 0.40.14 was restored after prior runs. Inspect actual running
runtime before a benchmark, never silently replace it or download models again.

## Runtime, Docker and CI

Node 24.22.1 is pinned by `.nvmrc`, `.node-version`, package engines and Dockerfile;
pnpm is 11.25.0. Existing Python environment is 3.14.6 with pinned requirements.
Native PostgreSQL uses owned `.local/postgres` at 127.0.0.1:55433, `docrag_dev`.
The other project's Docker database owns loopback 55432. See current service state
in [CURRENT_STATUS](CURRENT_STATUS.md); the cluster was stopped at the original
handoff and was safely restored during the authorized Step 9 continuation.

The verified Docker implementation uses a digest-pinned Node bookworm image and
pgvector 0.8.1/PostgreSQL 16 image. `.dockerignore` allowlists build inputs and
excludes environment files, evaluations, virtualenvs and weights. Multi-stage
Dockerfile builds standalone Next output, copies static/public assets, and runs
as user node (UID 1000). A separate migration target runs `docker/migrate.mjs`.
Compose project `docrag-step9` owns its own network and volume, app loopback 8010,
internal-only database, and health/completion dependencies. Migration initializes
768-dimensional schema only in `docrag_container`; review idempotency thoroughly.
The app's runtime opt-in allows only `db:5432/docrag_container` and
`host.docker.internal:11434` for its container routes. Saved real SQL, HTTP and lifecycle checks passed. Native guards remain.

Protected pages were marked force-dynamic after a clean image build attempted
build-time authentication without runtime secrets. The PDF extraction worker is
explicitly traced into standalone output. Image build, host Ollama connectivity,
26 container checks and lifecycle tests have saved passing evidence. `.github/workflows/ci.yml` now
exists, and clean local macOS/Linux equivalents pass. See CI.md for the scope.
Remote GitHub Actions: NOT RUN — NO PUSH AUTHORIZED. Production cloud inference
and hosting are future design work; do not expose host Ollama publicly.

## History and authoritative reports

Steps 0–1: setup/initial application foundation; [STEP0_AUDIT](STEP0_AUDIT.md)
and command contract exist, but no separate Step 1 completion report was found.
The user reports Step 1 complete; do not fabricate a missing report.
Step 2: corpus/evaluation and local-provider work ([STEP2_COMPLETE](STEP2_COMPLETE.md)).
Step 3: chunking ([STEP3_COMPLETE](STEP3_COMPLETE.md)); Step 4: hybrid retrieval
([STEP4_COMPLETE](STEP4_COMPLETE.md)); Step 5: optional reranking
([STEP5_COMPLETE](STEP5_COMPLETE.md)); Step 6: prompts/cache and citation repairs
([STEP6_COMPLETE](STEP6_COMPLETE.md)); Step 7: auth/ownership/security
([STEP7_COMPLETE](STEP7_COMPLETE.md)); Step 8: telemetry/feedback and cancellation
([STEP8_COMPLETE](STEP8_COMPLETE.md)). These are historical completion records,
not claims that stopped services currently pass their connectivity checks.

Important local commits: c58f5f2 isolated native port; 10b4611 prerequisite/citation
reconciliation; 0ade2d1 Node Web Streams pin; aaf77ed observability; bf8b833 terminal
cancellation race; f7bd670 Step 8 evidence formatting; df31231 module-entrypoint fix.
`make db-status` must invoke `.venv/bin/python -m scripts.native_db status` from
repo root. Direct file execution formerly failed to import `scripts.common`.
The original handoff stopped-server failure was different; do not undo the
import correction. The authorized continuation restored that owned server.

Step 6 273/273 versus Step 7 261/261 citations reflected changed generated answers
under changed application-hash cache namespaces, not identical answers. See
[reconciliation](security/step8-citation-reconciliation.json).
Two moderate esbuild/minimatch tooling findings remain disclosed; raw JS audit
exit 1 was accepted only under reviewed reachability policy, not zero findings.
The original handoff did not rerun audits. Step 9 subsequently reran them;
the same reviewed tooling findings remain, with Python audits passing.

## Continuation boundaries

Step 9 testing, container lifecycle and local CI have saved passing evidence;
fresh final-e verification and final local acceptance passed. Python scripts coverage is 70.80% including successful real integrations;
unit-only coverage is 20.46%. The final 100-question run reused compatible caches,
with automated faithfulness .995, correctness .985 and citation support 260/260.
See STEP9_COMPLETE.md and CURRENT_STATUS for exact results and scope. Step 10 load/concurrency,
Step 11 deployment and Step 12 finalization remain user-provided future roadmap;
obtain their detailed instructions before implementing them. No future step is
scaffolded here. Preserve all local state, run prerequisite checks, use only public
fixtures, keep costs zero and never push without explicit publication permission.
