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
| `make eval` | Runs the reviewed 100-question evaluator against the isolated corpus; writes ignored eval/results/latest.json. |
| `make eval-gate` | Compares baseline.json with latest.json; rejects incompatible data or recall@5/faithfulness drops greater than 0.02. |
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
  It makes no embedding or evaluation requests. Evaluation caches are separate from this probe.
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

## STEP 2 evaluation commands

The review checkpoint was completed by explicit user confirmation. The receipt in
eval/human_review.json covers the unchanged 100-question dataset and corpus hashes.
The original checkpoint commands remain useful for corpus verification:

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

`python -m eval.validate_dataset --require-review` now exits 0 with the actual
confirmed receipt. It must fail when the receipt is absent, invalid or stale;
tests cover that boundary. Candidate JSON retains its original authoring status;
the validated hash-bound receipt supplies the effective human-reviewed status.


### Complete STEP 2 verification (A–H)

Use the same repository root and activated .venv. Every command must actually run.
The evaluator uses real provider calls on misses; ignored caches make repeats cheap.
Run only one evaluator at a time. If a failure needs a fix, restart the full list.
Keep the original successful baseline; do not replace it with a faster cached rerun.

```sh
# A: independently calculated metric examples and regression boundaries
pytest tests/test_metrics.py -q
# B: real ingestion and strict evaluation ownership
python scripts/ingest_corpus.py
python scripts/eval_db_query.py "SELECT count(*) FROM chunks"
python scripts/eval_db_query.py "SELECT s.source_id, count(c.id) FROM eval_sources s JOIN chunks c ON c.document_id = s.document_id AND c.page_number = s.page_number GROUP BY s.source_id ORDER BY s.source_id"
python scripts/db_query.py "SELECT count(*) FROM chunks"
# C: all lines, source mappings and effective human review
wc -l eval/golden_set.jsonl
python -m eval.validate_dataset --require-review
# D: run once, preserve the actual first complete result, then run again
make eval
# First baseline recording only: validate this run before copying it.
python -m eval.verify_results --baseline eval/results/latest.json --current eval/results/latest.json
# Execute these copies only if baseline.json has not yet been recorded:
cp eval/results/latest.json .local/eval-first.json
cp eval/results/latest.json eval/results/baseline.json
make eval
# E: compatible rerun, full-precision recall, real gate and synthetic rejection
make eval-gate
python -m eval.verify_results --out eval/results/reproducibility.json
# F: application regressions
make lint
make test
make build-fe
# G: independently recompute aggregates and verify implementation provenance
python -m eval.verify_results
# H: Git safety (stage/commit the verified baseline locally, then inspect again)
git branch --show-current
git status --short
git diff --check
git log -5 --oneline
```

The synthetic rejection is expected to exit 1 internally; verify_results.py fails
unless the CLI reports an actual regression. It does not suppress a failed positive
check. The regression gate compares full serialized decimal values, not formatted
percentages. Provenance covers dataset/corpus/configuration, metric definitions,
model names, code hashes, actual Git revision, timestamp and cache statistics.

When a live baseline is blocked by provider quota, the same negative CLI check can
be exercised independently with an explicitly synthetic fixture. Run this from the
repository with .venv activated. It must report exit_code 1 and a Regression message;
the wrapper itself fails if rejection does not occur. This checks gate behavior,
not application performance, and does not replace the full A–H sequence:

```sh
python - <<'PY'
from eval.metrics import DEFINITIONS
from eval.corpus import canonical, sha256
from eval.verify_results import negative_gate

fixture = {
    "fixture_kind": "SYNTHETIC_ONLY_NOT_EVALUATION",
    "config": {"provider": "synthetic", "model": "fixture"},
    "config_sha256": sha256(canonical({"provider": "synthetic", "model": "fixture"})),
    "status": "complete",
    "human_review": "confirmed",
    "dataset_sha256": "0" * 64,
    "corpus_hash": "1" * 64,
    "metric_definitions": DEFINITIONS,
    "metrics": {"recall@5": 0.9, "faithfulness": 1.0},
}
print(negative_gate(fixture))
PY
```

The evaluator now calls the same shared generation function as the chat route.
Extracting that function required a narrowly scoped edit to the completed chat
route; its original prompt, model, converted messages and SDK defaults are covered
by a contract test. Retrieval/chunking/embedding code and configuration are unchanged.

Evaluation generation requests are spaced by at least 13 seconds, including each
HTTP attempt inside SDK retries, after an observed five-request short-window limit.
This evaluation-only pacing is recorded and excluded from pipeline latency.
Changing only pacing preserves valid cached responses: legacy seven-second cache
entries are accepted only when all other model/prompt/corpus/configuration inputs
match. Tests check the five-per-minute boundary across retries and adapters and
verify cache reuse without weakening semantic invalidation. This does not increase
daily quota or affect the production chat route.

Task 15's database SELECT is deliberately routed through eval_db_query.py for the
nonzero evaluation count. The original db_query.py command additionally verifies
that the separate application database remains unchanged. No credentials or URLs
are printed. No Docker, new backend, global installation or production data is used.

## STEP 2 FIX: local Ollama verification

The user explicitly selected a separate local baseline. Gemini's 20 cached pairs
remain incomplete and separate. Ollama was already installed; only the missing
embeddinggemma:300m download was approved. Do not reinstall Qwen/Ollama.

These are the provider-specific adaptations to the original A–H contract. Use the
existing repository root and `.venv`. Keep Ollama running. After a fix, restart
this whole applicable sequence; a human-review failure remains a real blocker.

```sh
git remote -v
git branch --show-current
git status --short
git log -5 --oneline
ollama --version
ollama list
ollama show qwen3.8:latest
curl --fail http://localhost:11434/api/tags
make up
make local-check
make local-ingest
make local-ingest
python -m eval.validate_dataset --require-review
pytest tests/test_metrics.py -q
make local-calibrate
# Human calibration labels are mandatory for VERIFIED baseline metrics:
python -m eval.local_calibration --verify
AI_PROVIDER=ollama make eval
python -m eval.verify_results --baseline eval/results/latest-local-ollama.json --current eval/results/latest-local-ollama.json
# Only after complete verified results, and only if no local baseline exists:
cp eval/results/latest-local-ollama.json .local/eval-first-local.json
cp eval/results/latest-local-ollama.json eval/results/baseline-local-ollama.json
AI_PROVIDER=ollama make eval
AI_PROVIDER=ollama make eval-gate
python -m eval.verify_results --baseline eval/results/baseline-local-ollama.json --current eval/results/latest-local-ollama.json --out eval/results/reproducibility-local.json
make lint
make test
make build-fe
git diff --check
git status --short
git log -5 --oneline
```

Before human calibration is confirmed, local evaluation may be run independently
for explicitly provisional diagnostics. It does not satisfy the full sequence,
create a valid baseline, or permit STEP 3. The gate rejects provisional results.
The 100-question dataset review is already confirmed; only the new calibration
labels lack human validation. No AI-authored receipt may substitute for that.

`make local-check` performs real local generation and embedding, checks model
digests/settings, records dimensions and hardware/loaded models, and validates
original source mapping. `make local-ingest` creates/verifies only the separately
owned native local index with the actual dimensions. Both use the existing
TypeScript runtime, not a Python search/generation implementation.
The gate now also rejects missing/mismatched configuration hashes; unit tests
cover both precision thresholds, missing provenance, providers and judge review.

For the explicitly provisional diagnostic path (these do not satisfy the verified
baseline gate), preserve the first complete diagnostic result and compare it with
the second run using the diagnostic flag:

```sh
AI_PROVIDER=ollama make eval
# Only if this first-diagnostic file does not already exist:
cp eval/results/latest-local-ollama.json eval/results/diagnostic-local-ollama-first.json
python -m eval.verify_results --diagnostic --baseline eval/results/diagnostic-local-ollama-first.json --current eval/results/latest-local-ollama.json
AI_PROVIDER=ollama make eval
python -m eval.verify_results --diagnostic --baseline eval/results/diagnostic-local-ollama-first.json --current eval/results/latest-local-ollama.json --out eval/results/reproducibility-local-diagnostic.json
python -m eval.preservation
```

The diagnostic verifier recomputes scores, checks source/code provenance and tests
full-precision retrieval reproducibility. It explicitly reports DIAGNOSTIC ONLY;
it does not grant human approval or pass the positive baseline regression gate.
The ordinary gate must reject these provisional files with a nonzero exit code.
Independent synthetic CLI tests exercised recall@5 and faithfulness drops of
0.020000000001; both exited 1 with the matching Regression error. Actual outputs
are retained in eval/results/local-negative-gate-checks.json. These synthetic
numbers are never baseline performance measurements.
