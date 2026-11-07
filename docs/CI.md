# Continuous integration

`.github/workflows/ci.yml` defines one bounded Ubuntu 24.04 job for pull requests
and pushes to main/feat/production-rag. It grants only contents:read, disables
persisted checkout credentials, pins four actions by full commit, and uses Node
24.22.1, pnpm 11.25.0 and Python 3.14.6. Its pgvector/PostgreSQL 16 service is pinned
by digest. Disposable CI credentials are not production secrets.

The job runs `make setup`, `make lint`, `make test`, `make cov`, `make build-fe`,
actual migrations twice, real SQL retrieval with fixed vectors, and negative
quality-gate tests. It neither downloads models nor invokes inference APIs,
publishes images, deploys, or commits/pushes code. The real PostgreSQL checks target
only `docrag_ci`; retrieval creates a unique test schema and removes only that
schema on exit. Migration fixtures are retained in the disposable service.

## Three different kinds of evidence

- **Deterministic CI:** fixed three-dimensional test vectors exercise production
  vector, keyword, hybrid/RRF queries and two-user/anonymous isolation against real
  PostgreSQL. Expected results are assertions, not generated model answers.
  Migration repeatability checks preserve a synthetic session and all required
  tables. Existing quality-gate tests reject changed models, contexts, missing
  questions and declines beyond the unchanged .02 thresholds.
- **Full local verification:** the frozen 100-question corpus runs against real
  local models and the selected 768-dimensional corpus. It includes the complete
  security/observability contract and a separate >=70% Python integration-coverage
  gate. Its cache hit/miss counts must be reported. This is mandatory for local
  Step 9 completion and cannot be replaced by the small CI fixture.
- **Remote GitHub Actions:** NOT RUN — NO PUSH AUTHORIZED. YAML and local commands
  are verified here; runner provisioning, hosted networking and remote Actions
  execution remain deferred until explicit publication permission.

`make cov` reports unit-only Python coverage over every Python file in `scripts`
and TypeScript coverage over lib/API/components. Real integration measurement uses
`.coveragerc.integration` and `make cov-integration-gate`; it retains the same Python
scope, includes new scripts, and fails below 70%. Model-dependent integration work
is deliberately not scheduled on ordinary free hosted CI. Unit-only coverage is
not described as meeting the full integration target. See [TESTING](TESTING.md).

## Local equivalents

Use the existing pinned Node/Python environment. Container builds independently
verify a clean frozen pnpm install. `pip check` and exact requirement-version
comparison verify the existing Python installation. The full local contract runs
lint/tests/build; `make cov` separately records unit coverage. Real SQL and actual
Drizzle migrations also run in Linux using the migration image and a separate
`docrag_ci` database, with only selected source files mounted read-only. The 198 Python and 221 TypeScript tests also ran in Linux with networking
disabled. A full Linux sequence subsequently passed with build-time network access
for the existing Next.js Google-font download. No inference keys or model service
are supplied to either test environment.

```sh
make lint
make test
make cov
make build-fe
# In a dedicated CI database with privately supplied CI_DATABASE_URL:
node --import tsx scripts/ci_migrations.ts
node --import tsx scripts/ci_retrieval.ts
.venv/bin/python -m pytest -q tests/test_observability_gate.py tests/test_security_gate.py tests/test_prompting_gate.py
```

Local YAML validation checks triggers, least privilege, one job, service digest,
all runtime pins/action hashes and forbidden publishing/secrets/error suppression.
A separate local negative control removes ownership predicates only in a temporary
copy: the real SQL fixture must exit nonzero. Production sources remain unchanged.
These checks do not certify a hosted run. No global CI emulator is installed.

Clean-checkout preparation fetches full Git history for provenance tests and restores
only the public chunk mapping from the committed control mapping. Review-checker
unit tests create synthetic withheld metadata in temporary directories; actual
private review metadata is neither required nor published. Split tests write only
temporary copies, and Make dry-run assertions suppress GNU directory banners.
A fresh isolated Python environment installed all 37 pinned requirements. Linux
verification also installed those requirements in a disposable Python 3.14.6 image.
Neither action changes globally installed host tools.
