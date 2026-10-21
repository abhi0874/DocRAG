# STEP 0 command contract

Run everything from the actual cloned repository root:
`/Users/abhisheshramadasshet/Documents/ChatGPT/DocRAG/RAG-Agent`.
The parent directory is an unrelated empty Git repository created by the workspace.

Use Python 3.11+, Node >=20.9 (checked against the installed Next package),
and pnpm 11.25.0. This is a Next.js application with TypeScript API routes;
Python is used for setup helpers and evaluation utilities. No Python server exists.

| Command | Actual behavior |
| --- | --- |
| `make setup` | Creates `.venv`, installs pinned Python requirements, runs `pnpm install --frozen-lockfile`. |
| `make lint` | Ruff checks and format check, ESLint, then `tsc --noEmit`. |
| `make test` | `pytest -q` for helpers, then Vitest for TypeScript behavior with mocked external services. |
| `make cov` | Python coverage for `scripts`, V8 coverage for TypeScript application code. Reports under `coverage/`. The planned 70% gate belongs to STEP 9; there is no claimed gate here. |
| `make build-fe` | Builds the actual Next.js application with `pnpm build`. |
| `make run-api` | Runs Next.js with its API routes at `http://127.0.0.1:8000`; Ctrl+C stops it. |
| `make check-env` | Checks private variables, database tables/indexes/vector dimensions and one real Gemini request. |
| `make db-query` | Read-only query verifying the vector extension. |
| `make up` | Initializes/starts the isolated native PostgreSQL 16 cluster and applies additive development schema SQL. Uses installed Postgres.app PostgreSQL 16.15. |
| `make down`, `make stop` | Stop only this checkout’s native database, preserving all data. |
| `make db-status` | Checks whether this checkout’s native server is running. |
| `make eval`, `make eval-gate` | Fail clearly; reserved STEP 2 command lines are printed. |
| `make load` | Fails clearly; reserved for STEP 10. |

Native PostgreSQL was selected by the user. No Docker targets or volume deletion
are used. Both `make stop` and `make down` preserve `.local/postgres`.
The PostgreSQL 16 binaries are expected under `/Applications/Postgres.app/Contents/Versions/16/bin`.
The database listens on 127.0.0.1:55432; private state and credentials are ignored
under `.local/`, and DATABASE_URL is configured privately in `.env`.
Do not remove `.local/`: that would erase development data.

## Required verification order

After every verification fix, restart this entire applicable list from the top.
A missing database/key is a failing check, not permission to claim completion.
Activate the Python environment after setup so `python` resolves correctly.

```sh
git remote -v
git branch --show-current
make setup
source .venv/bin/activate
python scripts/check_env.py
make lint
make test
make build-fe
python scripts/db_query.py "SELECT extname FROM pg_extension WHERE extname = 'vector'"
```

Once a database is configured, start `make run-api` in a separate session and run:

```sh
curl -sf http://localhost:8000/ -o /dev/null -w "%{http_code}\n"
curl -sf http://localhost:8000/api/documents -o /dev/null -w "%{http_code}\n"
```

Both must return 200; then stop the application with Ctrl+C.
Docker-specific checks are NOT APPLICABLE because native PostgreSQL was selected.
After installation run `make up`, `make db-status`, and the database checks above.
Capture table/index/extension counts, run `make stop` then `make up`, and verify
those counts survive. No data deletion is part of this restart check.

Additional audit commands: `git ls-files '.env*'` (only `.env.example`),
`git check-ignore .env`, `git diff --check`, and
`git merge-base --is-ancestor 7ccc792669cef1c254d71ebc342fa4ba624584fa HEAD`.
Check that lockfiles and both documentation files exist.

## Adaptations and boundaries

- pnpm 11 uses `pnpm-workspace.yaml` for overrides and explicit dependency build
  permissions; the existing hono override is preserved.
- Exact dependency versions and the existing pnpm lockfile are retained/updated
  for the new lint and test dependencies. No npm lockfile is introduced.
- `lib/model-config.json` is shared by retrieval and the live Gemini check,
  preserving the original model IDs. The configured chat model passed a live check.
- The AI SDK check uses at most two retries, exponential backoff and a 30-second
  timeout, a 256-token output cap, and minimal reasoning. The original 16-token
  cap returned empty output; the corrected check requires nonempty text.
  It makes no embedding or evaluation requests. STEP 2 caching is not built.
- `db/init.sql` supplies the missing generated `content_tsv` column and indexes;
  it has been applied to the isolated local development database only.
- `.env` is loaded explicitly by Python helpers and automatically by Next.js.
  Only DATABASE_URL and GOOGLE_GENERATIVE_AI_API_KEY are required.
  DATABASE_URL_PROD is an unused placeholder. JWT_SECRET is not used.
- `db_query.py` allows a single SELECT, uses a read-only transaction and a five-second
  timeout, and displays at most 1,000 rows. Use only public development data.

- Native PostgreSQL is an approved alternative to Docker; installation
  permission was granted and Postgres.app 2.9.6 / PostgreSQL 16.15 is installed.
  The native helper only manages a cluster with its checkout ownership
  marker, preserves an existing real DATABASE_URL, and never prints its generated password.

## STEP 2 corpus and mandatory review checkpoint

The commands below are implemented for the pre-review checkpoint. The evaluation
runner and regression targets above remain deliberately unimplemented until the
user confirms review. This is not a completed STEP 2 command contract.

```sh
source .venv/bin/activate
python scripts/ingest_corpus.py
python scripts/ingest_corpus.py
python scripts/eval_db_query.py "SELECT count(*) FROM chunks"
python scripts/eval_db_query.py "SELECT s.source_id, count(c.id) FROM eval_sources s JOIN chunks c ON c.document_id = s.document_id AND c.page_number = s.page_number GROUP BY s.source_id ORDER BY s.source_id"
python scripts/db_query.py "SELECT count(*) FROM chunks"
wc -l eval/golden_set.jsonl
python -m eval.validate_dataset
make lint
make test
make build-fe
git diff --check
git status --short
```

Run the entire checkpoint list after fixing a failed checkpoint check. The second
ingestion must preserve IDs/content and avoid additional model calls. The evaluation
count must be nonzero and match the 12 intended sources. The ordinary db_query
command still addresses the separate application development database; its count
must remain unchanged. `eval_db_query.py` reuses that helper's SELECT validation,
read-only transaction, timeout and secret handling after privately selecting the
owned evaluation database. This is the necessary adaptation of the requested
`SELECT count(*) FROM chunks` check for strict database isolation.

Ingestion creates only `docrag_eval_v1` on this checkout's existing native server.
It verifies server directory and ownership, reuses db/init.sql there, then adds
evaluation metadata tables. It never drops data or modifies .env. Corpus changes
or unrecognized database contents fail for explicit investigation. Source hashes,
stored chunks, dimensions and mappings are verified on rerun. Existing lib/rag.ts
functions are invoked with the pinned project-only tsx 4.20.6 runtime.

Embedding batches remain at most 100, using the actual embedChunks function,
model and provider options. Completed batches are cached under ignored
.local/eval-cache/ingestion with model/text/corpus/configuration hashes. Fresh
batches are separated by at least 61 seconds to respect the observed 100-request
window; SDK exponential retries still apply. Other project activity can consume
quota, and daily quotas still apply. Errors remain failures, not partial success.

`python -m eval.validate_dataset --require-review` must exit 1 while review is
pending. This deliberate negative check is distinct from ordinary structural
validation. Only an explicit human confirmation can justify a hash-bound receipt
in eval/human_review.json; no such receipt is fabricated. After confirmation, the
remaining STEP 2 implementation and complete A–H verification list are required.
