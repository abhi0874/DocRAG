# Test inventory and strategy

The backend is Next.js/TypeScript. Python supplies evaluation and operator tools.
The tests intentionally combine controlled unit tests with real PostgreSQL and
HTTP checks. Test doubles alone do not establish access isolation.

| Layer | Entry point | What it verifies | External requirement |
| --- | --- | --- | --- |
| Python units | `make test` / pytest | Corpus/evaluation gates, provenance, labels, port/ownership guards, redaction, operator failures | None; no API calls |
| TypeScript units | `pnpm test` | Chunking, providers, retrieval/RRF, citations, cache, auth routes, metrics/feedback, cancellation | Fixed test doubles |
| Real SQL CI | `scripts/ci_migrations.ts`, `scripts/ci_retrieval.ts` | Actual Drizzle repeatability, session preservation, pgvector/FTS/RRF and ACL isolation | Dedicated pgvector database |
| Native security | `scripts.security_http`, `scripts.security_retrieval.ts` | Two users, private upload/access/evaluation, SQL isolation, quotas and recovery, cookies/expiry | Isolated owner-marked native database; local model |
| Native telemetry | `scripts.observability_http`, `scripts.feedback_to_eval` | Actual rows, cancellation, bounded write failure, feedback ownership and private export exclusion | Disposable cloned database; production server |
| Cache/citation | Existing cache HTTP/invalidation and permanent TS regressions | Negative sources, triple-backtick bypass, invalid stored replay, public-only eligibility | Public fixtures; reversible recovery receipt |
| Docker HTTP | `scripts.container_http` | Auth, PDF worker, streamed chat, feedback, cancellation, expiry, app/DB restart, outage recovery | Dedicated Compose project; host Ollama |
| Full RAG quality | `scripts.verify_observability` | 100 questions, real ranked evidence, model/cache provenance, unchanged .02 gates, historical preservation/audits | Preserved model runtime and native corpus |
| Browser | Previous Step 8 screenshots/receipt | UI citations, feedback, dashboard, two-user checks | Historical evidence; not a new Step 9 browser pass |

New operational tests cover realistic failures: missing schema/index/dimension,
password mismatch, subprocess exit propagation, secret-safe errors, unowned or
partial native setup, preserved foreign configuration, immutable corpus snapshots
and safe recovery receipts. They do not execute real deletion or inference.

## Isolation and reproducibility

Keep historical golden questions, labels, 162 chunks, embeddings, Gemini caches and
result files unchanged. Every full evaluation uses a fresh output/run ID. Native
migration tests clone the preserved seed into a new owner-verified database and
compare legacy table hashes. Real SQL CI uses a fresh UUID schema. Container tests
use new random accounts and public-text PDF fixtures. Never reset a database to
make a check pass. Do not stop `text-to-sql-db-1` or take its 55432 binding.

Pinned Node 24.22.1 preserves the cancellation fix. Keep its unhandled-rejection
regression active. The full contract checks the source hashes at beginning/end;
do not edit application/test sources while it runs. Inspect each failing log and
rerun the applicable complete sequence after correction. Stop after three genuine
unsuccessful repairs of the same diagnosed blocker.

## Coverage

The historical Python denominator was `scripts` and remains `scripts`; evaluation
modules are tested but are not included in that percentage. No difficult script is
excluded. New container tooling increases the denominator. `make cov` measures the
unit-only suite, while the integration collection adds actual executed HTTP,
SQL/migration, export, audit and orchestration paths. TypeScript V8 coverage measures
lib, API routes and components; unmounted UI/real DB paths remain visible as gaps.

```sh
make cov
export COVERAGE_FILE="$PWD/.local/coverage-step9-UNIQUE/.coverage"
mkdir -p "$(dirname "$COVERAGE_FILE")"
COVERAGE_RCFILE=.coveragerc.integration .venv/bin/python -m coverage run -m pytest -q
COVERAGE_RCFILE=.coveragerc.integration .venv/bin/python -m coverage run -m scripts.container_http
# Inspect native DB and Ollama runtime ownership/version before the next command.
COVERAGE_RCFILE=.coveragerc.integration .venv/bin/python -m coverage run -m scripts.verify_observability --run-id step9-UNIQUE
make cov-integration-gate
```

Coverage patches Python subprocesses and keeps separate data files before merging.
Use a new ignored data directory for an independent measurement; preserve the old
receipts rather than mixing incompatible code revisions. Unit coverage and combined
coverage must be reported separately. The combined report fails below 70%; do not
lower that threshold. `coverage/python-integration.json` records exact totals.

See [COMMAND_CONTRACT](COMMAND_CONTRACT.md), [DOCKER](DOCKER.md) and [CI](CI.md) for
service preparation, scope and the deferred remote verification boundary.
