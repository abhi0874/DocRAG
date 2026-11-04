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

## Final STEP 2 human-review checkpoint (2026-10-25)

Stop at the actual human review before baseline promotion. Do not rerun 100 answer
calls for this checkpoint. Start the existing native server with `make up` if the
preservation check reports connection refused, then restart this checkpoint list:

```sh
git remote -v
git branch --show-current
git status --short
git log -5 --oneline
make up
ollama list
curl --fail --silent --show-error http://localhost:11434/api/tags
.venv/bin/python -m eval.preservation
.venv/bin/python -m eval.verify_results --diagnostic --baseline eval/results/diagnostic-local-ollama-first.json --current eval/results/diagnostic-local-ollama-second.json
.venv/bin/python -m eval.review_packet
make lint
make test
make build-fe
git diff --check
```

`eval.review_packet` checks all 28 exact excerpts against saved source hashes/line
ranges, protects the packet content, and identifies missing/invalid human entries.
It never writes a human-review receipt or approves labels. Partial valid entries
remain pending; invalid entries fail. HUMAN_REVIEW.md uses neutral shuffled IDs
and no AI labels. The internal mapping preserves the original 14 case identities.
One FastAPI paraphrase was replaced in this new packet with an exact source sentence;
historical cases/results remain unchanged. The new packet therefore needs matching
judge predictions after real human review; old agreement is not its validation.

After human entries arrive, compare against those independent labels rather than
rubber-stamping `proposed_labels`. The current legacy calibration tool still reads
proposed labels and must be adapted before it can certify this new packet. Preserve
both sets and bind actual review evidence to the packet hash. Prior exposure to
proposed labels must be disclosed; the original 14 cases alone cannot establish
broad held-out judge reliability. Do not fabricate a review receipt or merely flip
result status. The original full verified sequence remains required after review.

## Fresh independent review checkpoint (2026-10-25)

The user requested 14 new cases after disclosing AI suggestions for the previous
submission. Preserve that submission as AI-assisted; do not reuse its labels.
Run the following checkpoint sequence from the repository root. It performs no
answer-generation or judge calls. If a technical fix is needed, restart the list.

```sh
git remote -v
git branch --show-current
git status --short
git log -5 --oneline
make up
ollama --version
ollama list
curl --fail --silent --show-error http://localhost:11434/api/tags
.venv/bin/python -m eval.preservation
.venv/bin/python -m eval.verify_results --diagnostic --baseline eval/results/diagnostic-local-ollama-first.json --current eval/results/diagnostic-local-ollama-second.json
.venv/bin/python -m eval.fresh_review
make lint
make test
make build-fe
git diff --check
```

Then `.venv/bin/python -m eval.fresh_review --show-next` displays only the next
pending neutral case, never categories/reference answers or predictions. Present
that case to the user, record actual decisions, and stop for input. Partial entries
remain pending. The read-only checker verifies source offsets/hashes and frozen
packet/rubric/criteria; it never performs inference or grants human approval.

Fresh files are in eval/calibration/fresh-v1. Withheld category/reference metadata
is preserved under .local/fresh-calibration-internal.json with its hash committed
before review. No expected labels are supplied there. After all human decisions,
compare predictions against those labels under the frozen criteria and then follow
the full verified-baseline workflow. Do not run that workflow prematurely.

## Authorized automated evaluation completion (2026-10-25)

The user changed the independent-label requirement and accepted the name automated
 evaluation with accurate technical disclosure. Numeric calibration acceptance,
metric definitions and the >0.02 regression limits are unchanged. This is a
methodology change, not a claim of independent human validation. The recorded
14 reference decisions were suggested by AI and checked against evidence by the
user. The fresh blinded set remains 0/14 and is not claimed as completed review.

This sequence supersedes the pending human-only completion path for the authorized
protocol. Preserve the earlier reports. `local-calibrate-automated` judges the
corrected 14-example packet using the existing rubric and model settings, checks
unchanged criteria, and saves a separate report. It reuses an existing valid report
without rewriting its identity; changed inputs fail. Do not force a failing report
to pass. Commit validator implementation before promotion so its code hashes can
be checked against the recorded Git revision.

```sh
git remote -v
git branch --show-current
git status --short
git log -5 --oneline
make up
ollama --version
ollama list
ollama show qwen3.8:latest
curl --fail --silent --show-error http://localhost:11434/api/tags
make local-check
make local-ingest
make local-ingest
.venv/bin/python -m eval.preservation
.venv/bin/python -m eval.validate_dataset --require-review
.venv/bin/python -m pytest tests/test_metrics.py -q
make local-calibrate-automated
.venv/bin/python -m eval.automated_validation --verify
.venv/bin/python -m eval.verify_results --diagnostic --baseline eval/results/diagnostic-local-ollama-first.json --current eval/results/diagnostic-local-ollama-second.json
.venv/bin/python -m eval.promote_local --source eval/results/diagnostic-local-ollama-first.json --out eval/results/baseline-local-ollama.json
.venv/bin/python -m eval.promote_local --source eval/results/diagnostic-local-ollama-second.json --out eval/results/latest-local-ollama.json
cp eval/results/latest-local-ollama.json eval/results/validated-local-ollama-second.json
AI_PROVIDER=ollama make eval-gate
.venv/bin/python -m eval.verify_results --baseline eval/results/baseline-local-ollama.json --current eval/results/validated-local-ollama-second.json --out eval/results/reproducibility-local.json
make lint
make test
make build-fe
.venv/bin/python -m eval.preservation
git diff --check
git status --short
git log -5 --oneline
```

Reuse the two completed full runs rather than regenerating 100 answers: their
question rows, metrics, timings, cache counts and original Git provenance are
preserved exactly. Promotion only adds explicit methodology/validation provenance
and a complete-under-that-protocol status. The verifier compares the result with
the hash-bound original artifact and rejects changed measurements. The historical
judge_calibration field remains the original pending-human diagnostic, while the
new evaluation_validation field records the current authorized method separately.
The top-level human_review field still refers only to the 100-question golden set.

The regression gate checks compatible evaluation and validation identities and
retains exact decimal >0.02 limits. verify_results invokes both recall@5 and
faithfulness negative CLI tests; each must exit 1 and report an actual Regression.
Old provisional files without a valid protocol record still fail the gate.

For future actual local runs: `AI_PROVIDER=ollama make eval`, then
`make local-validate-results`, then `AI_PROVIDER=ollama make eval-gate`. The
validation target retains an immutable hash-named copy of the raw run before
attaching methodology. It never overwrites an existing baseline with a different
run. Unchanged cached inference is reused; SQL retrieval is rerun by make eval.
Changing the answer/judge settings or rubric requires compatible recalibration,
not relabeling historical scores. Full human-independent validation is not claimed.

## Step 3 isolated chunking experiments

After the mandatory Step 2 audit passes, the frozen matrix uses only the existing
local models and separate owned native databases. Run from the same checkout:

```sh
.venv/bin/python -m eval.chunking_experiments --matrix
```

The command records development retrieval for all five configurations, freezes
selection, then measures control/selected holdout. An existing selection prevents
accidental retuning. The source dataset and original baseline are never rewritten.
If interrupted before selection, caches retain only successful model responses;
failed attempts are saved and must remain documented. Runtime network access to
loopback and build-time access to existing Google Fonts may require leaving the
sandbox; do not change model URLs or remove checks to bypass permissions.

The frozen selected configuration is heading-1400-280. Its all-question run uses:

```sh
AI_PROVIDER=ollama .venv/bin/python -m eval.run_eval --golden eval/golden_set.jsonl --out eval/results/chunking-selected-raw.json --chunking-experiment heading-1400-280
.venv/bin/python -m eval.promote_local --source eval/results/chunking-selected-raw.json --out eval/results/chunking-selected.json
.venv/bin/python -m eval.chunking_gate --baseline eval/results/baseline-local-ollama.json --candidate eval/results/chunking-selected.json
.venv/bin/python -m eval.chunking_report
make lint
make test
make build-fe
.venv/bin/python -m eval.chunking_smoke
.venv/bin/python -m eval.preservation
.venv/bin/python -m eval.validate_dataset --require-review
.venv/bin/python -m eval.verify_results --baseline eval/results/baseline-local-ollama.json --current eval/results/validated-local-ollama-second.json
AI_PROVIDER=ollama make eval-gate
git diff --check
git status --short
```

Commit evaluator/validator code before generating or promoting results so recorded
Git revisions can verify code hashes. Keep raw candidate measurements immutable.
The explicit chunking gate checks every unchanged config field and byte-identical
retrieval/embedding/prompt code, allowing only declared chunk settings, the exact
isolated database selector, and nullable metadata. The ordinary gate remains strict.
The report verifies frozen development/holdout IDs, source hashes, chunk mapping,
selection rule and per-row metrics. Full evaluation runs must not be concurrent.
The smoke command starts a temporary production-built loopback HTTP server against
the selected experiment database, tests real documents/chat routes, then stops it.
It uses installed Ollama models, never Gemini inference.

The final read-only preservation and private-value check is:

```sh
.venv/bin/python -m eval.chunking_integrity
```

It compares the original baseline/dataset bytes, original Gemini cache/vectors,
and original local vectors against the exact control copy, records application
row counts, and scans tracked content in memory without printing private values.

For final cached reproducibility, preserve the first run and use a separate output:

```sh
AI_PROVIDER=ollama .venv/bin/python -m eval.run_eval --golden eval/golden_set.jsonl --out eval/results/chunking-repeat-raw.json --chunking-experiment heading-1400-280
.venv/bin/python -m eval.verify_results --diagnostic --baseline eval/results/chunking-selected-raw.json --current eval/results/chunking-repeat-raw.json
```

The diagnostic flag here verifies the original unannotated measurement artifacts;
the validated selected result must separately pass chunking_gate. It never grants
baseline status or bypasses the quality gate. Repeated SQL retrieval still runs;
only exact compatible context/model/prompt/config caches can be reused.

## Step 4 retrieval profiling and selection

Only after the independent Step 3 audit passes:

```sh
.venv/bin/python -m eval.retrieval_experiments schema
.venv/bin/python -m eval.retrieval_experiments plans
.venv/bin/python -m eval.retrieval_experiments matrix
```

These use the unchanged Step 3 selected index and models. Profiling bypasses the
evaluation query-embedding cache, reuses SQL connections within each batch, and
records three repetitions. EXPLAIN ANALYZE is restricted to internally constructed
parameterized SELECTs inside read-only transactions. Full-text maintenance tests
use a temporary fixture and rollback. No application read-only helper is weakened.
The selection rule/split are frozen before holdout; saved experiments and previous
baselines must not be overwritten. Independent model benchmarks must not overlap.

The frozen winner is `control`. Preserve historical output names; use these new
Step 4 artifacts. Commit evaluator code before running or validating measurements.
If the existing native server has stopped, use `make up` followed by
`make db-status`; this restarts the owned cluster without resetting data.

```sh
AI_PROVIDER=ollama .venv/bin/python -m eval.run_eval --golden eval/golden_set.jsonl --out eval/results/retrieval-selected-raw.json --retrieval-experiment control
AI_PROVIDER=ollama .venv/bin/python -m eval.run_eval --golden eval/golden_set.jsonl --out eval/results/retrieval-repeat-raw.json --retrieval-experiment control
.venv/bin/python -m eval.verify_results --diagnostic --baseline eval/results/retrieval-selected-raw.json --current eval/results/retrieval-repeat-raw.json
.venv/bin/python -m eval.promote_local --source eval/results/retrieval-selected-raw.json --out eval/results/retrieval-selected.json
.venv/bin/python -m eval.retrieval_gate --baseline eval/results/chunking-selected.json --candidate eval/results/retrieval-selected.json
.venv/bin/python -m eval.retrieval_report --profiles-only
.venv/bin/python -m eval.retrieval_report
make lint
make test
make build-fe
make db-status
.venv/bin/python -m eval.retrieval_sql_checks
.venv/bin/python -m eval.retrieval_smoke
.venv/bin/python -m eval.retrieval_integrity
.venv/bin/python -m eval.preservation
.venv/bin/python -m eval.validate_dataset --require-review
.venv/bin/python -m eval.verify_results --diagnostic --baseline eval/results/chunking-selected-raw.json --current eval/results/chunking-repeat-raw.json
.venv/bin/python -m eval.chunking_gate --baseline eval/results/baseline-local-ollama.json --candidate eval/results/chunking-selected.json
AI_PROVIDER=ollama make eval-gate
git branch --show-current
git diff --check
git status --short
git log -5 --oneline
```

`retrieval_report` verifies all experiment source/metric/code hashes, the frozen
selection and holdout, and executes negative Recall@5 and faithfulness gates.
`retrieval_sql_checks` tests exact technical terms, punctuation and document
isolation against the actual selected index through the TypeScript keyword path,
without model inference. `retrieval_smoke` starts a temporary production HTTP
server and checks streaming answers and source provenance, writing a new Step 4
receipt. Run smoke/model checks after the measured evaluation, not concurrently.
`retrieval_integrity` preserves all prior result, corpus and calibration files,
Gemini cache/vectors and original local vectors, and checks tracked plus nonignored
untracked files for private values without printing them. It creates only a new
Step 4 preservation receipt. `make eval-gate` remains the unchanged strict legacy
gate; the explicit retrieval gate above compares Step 4 against Step 3.

### Reproduce Step 4 after the installed Ollama app updates

On 2026-10-28, the installed app client reported 0.40.11, while the completed
Step 2/3/4 measurements used 0.40.9. Both servers were stopped between sessions.
Keep the measured version for exact comparisons. A verified 0.40.9 runtime is
stored in the ignored project directory; the installed app and model files were
not replaced. Start it only when port 11434 is unused:

```sh
OLLAMA_HOST=127.0.0.1:11434 OLLAMA_NO_CLOUD=1 .local/ollama-runtime-0.40.9/ollama serve
```

Leave that process running for the Step 4 verification commands; Ctrl+C stops it.
Do not launch a competing desktop Ollama server. `eval/results/retrieval/runtime-reproducibility.json` records the official archive hash, executable hash, server
version and verified model digests. To reconstruct the project-local runtime:

```sh
mkdir -p .local/ollama-runtime-0.40.9
curl --fail --location https://github.com/ollama/ollama/releases/download/v0.40.9/ollama-darwin.tgz --output .local/ollama-runtime-0.40.9/runtime.tgz
shasum -a 256 .local/ollama-runtime-0.40.9/runtime.tgz
```

Before extraction, require SHA-256 exactly
`cdfaee591d3ba7753e1bb4ae28be228ef7488199f263b7f202e0eddc900c08f4`, as published
in the official GitHub release asset metadata. Stop on a mismatch. Extract only
into this project directory, then start the command above. The executor used
Python `tarfile.extractall(..., filter='data')` after verifying the hash.

Python's system certificate store could not verify the GitHub certificate during
metadata retrieval. System curl completed the same request with TLS verification
intact; certificate checks were never disabled. No global installation occurred.

When this historical benchmark runtime is no longer needed, stop its server,
open Finder → Go → Go to Folder, enter `/Users/abhisheshramadasshet/Documents/ChatGPT/DocRAG/RAG-Agent/.local`,
and move only `ollama-runtime-0.40.9` to Trash. This removes the extra runtime/archive, not the
installed app or shared models. Model uninstall instructions remain in LOCAL_OLLAMA.md.

## Step 5 approved optional reranker setup

The Step 4 audit must pass first. The user approved the model download subject to
complete local removability. The setup places its separate environment, weights,
caches and temporary files under `.local/reranker-minilm`; no global installation
or modification of the existing core virtual environment is needed.

```sh
.venv/bin/python -m scripts.reranker_setup
```

The model revision/weight hash is pinned in `lib/reranker-model.json`, and Python
packages are pinned in `requirements-reranker.txt`. See RERANKING.md for exact
paths and the explicitly user-invoked cleanup command. Never remove all `.local`.

Step 5 checks and controlled measurements (CPU inference is sandbox-compatible;
MPS probing requires macOS GPU access):

```sh
.venv/bin/python -m scripts.reranker_probe
make lint
make test
make build-fe
.venv/bin/python -m eval.reranking_experiments matrix
AI_PROVIDER=ollama .venv/bin/python -m eval.run_eval --golden eval/golden_set.jsonl --out eval/results/reranking-selected-raw.json --reranking-experiment control
.venv/bin/python -m eval.promote_local --source eval/results/reranking-selected-raw.json --out eval/results/reranking-selected.json
.venv/bin/python -m eval.reranking_gate --baseline eval/results/retrieval-selected.json --candidate eval/results/reranking-selected.json
```

Use the frozen `reranking/selection.json` configuration in the full-run command;
`control` is a placeholder until selection. Completed experiment files are never
overwritten. The probe records one cold and five warm inferences per device.
No cloud inference or extra model downloads occur. Installation uses a separate
project environment; ESLint/TypeScript exclude its third-party dependency files,
while continuing to check all project source files.

### Step 5 recovery: host runtime configuration

The optional runtime is explicitly configured when starting the Next.js server:

```sh
DOCRAG_RERANKER_HOME="$PWD/.local/reranker-minilm" RERANKER_ENABLED=true pnpm start --hostname 127.0.0.1 --port 8003
```

The path must be absolute. Missing installation/configuration uses the documented
hybrid fallback. Never put this variable in `next.config` or a public build-time
variable. The evaluator supplies the same absolute path privately to its local
adapter. No environment relocation, weight deletion or global install is required.
Run `make lint`, `make test`, `make build-fe` after the correction.

Recovery verification uses separate outputs, preserving the preliminary matrix:

```sh
.venv/bin/python -m scripts.reranker_probe --out eval/results/reranking-final/device-probe.json
.venv/bin/python -m eval.reranking_smoke
.venv/bin/python -m eval.reranking_experiments matrix
```

The final matrix writes `eval/results/reranking-final/`, with unchanged split and
selection rule. Commit measured source first; the runner checks hashes before and
after measurement. Run model tests sequentially, without simultaneous builds.
The production smoke starts/stops owned servers on loopback port8003 and verifies
home/documents/chat, enabled/disabled modes, missing runtime, timeout fallback,
source provenance, citations and worker shutdown. No files are removed to simulate
unavailability. It uses launch configuration only, and no Gemini inference.

The clean recovery matrix retained `control`. The selected all100 command above
therefore uses `--reranking-experiment control`. Afterward:

```sh
.venv/bin/python -m eval.reranking_cases
.venv/bin/python -m eval.reranking_integrity
```

Case diagnostics cover the two incomplete answers and one deliberately
unanswerable question per document, under all three configurations. They are
separate automated diagnostics, never selection tuning or all100 candidate scores.
The integrity command compares every Step2–4 result, corpus and annotation to
commit4ba666c, verifies preserved Gemini/local vectors and scans tracked plus
nonignored files for private values without printing them. It writes only a new
Step5 receipt.

Final evidence verification and compatible cached replay:

```sh
.venv/bin/python -m eval.reranking_report --profiles-only
.venv/bin/python -m eval.reranking_report
AI_PROVIDER=ollama .venv/bin/python -m eval.run_eval --golden eval/golden_set.jsonl --out eval/results/reranking-repeat-raw.json --reranking-experiment control
.venv/bin/python -m eval.verify_results --diagnostic --baseline eval/results/reranking-selected-raw.json --current eval/results/reranking-repeat-raw.json
```

The report recomputes source/ranking metrics, checks committed code and exact
split coverage, verifies selection chronology, and compares all disabled-mode
ranked passages with Step4. The replay uses identical configuration/context cache
keys; cached timings are not fresh inference timings. If an interrupted run is
resumed, retain its private log and report cache counts and fresh-only latency
separately. Do not compare a mixed-cache total directly as an optimization gain.

If desktop Ollama automatically restarts its newer server, stop only verified
owned processes with explicit user authorization. In the2026-10-29 recovery the
user authorized stopping the desktop server; its app supervisor was temporarily
paused to prevent relaunch. The benchmark server uses the checksum-verified0.40.9
binary. After all model checks, stop only that benchmark process and resume the
same verified desktop supervisor. This is temporary process control, not a model
or global application installation change. Never blindly reuse recorded PIDs.

Final production smoke can preserve the first recovery receipt using:

```sh
.venv/bin/python -m eval.reranking_smoke --out eval/results/reranking-final/api-smoke-final.json
```

The cleanup unit tests use only pytest-created temporary folders, including dummy
model/cache files and a sibling preservation marker. The real Python environment,
model weights and database are never deleted for testing.

## Step 6 grounded answers and public response cache

Use the same checkout and pinned local runtime. The Step 5 audit passed before
implementation. No Step 2–5 artifacts may be overwritten. The optional reranker
remains disabled. Candidate evaluation explicitly selects a prompt version:

```sh
make lint
make test
make build-fe
AI_PROVIDER=ollama .venv/bin/python -m eval.run_eval --golden eval/golden_set.jsonl --out eval/results/prompting/step5-v1-raw.json --prompting-experiment step5-v1
.venv/bin/python -m eval.promote_local --source eval/results/prompting/step5-v1-raw.json --out eval/results/prompting/step5-v1.json
AI_PROVIDER=ollama .venv/bin/python -m eval.run_eval --golden eval/golden_set.jsonl --out eval/results/prompting/grounded-v1-raw.json --prompting-experiment grounded-v1
.venv/bin/python -m eval.promote_local --source eval/results/prompting/grounded-v1-raw.json --out eval/results/prompting/grounded-v1.json
```

The original `step5-v1` prompt is retained byte-for-byte. Historical evaluator
commands explicitly select it, so old cache identities cannot return a different
prompt's answers. The new experiment fingerprints the prompt, metadata, citation,
stream and cache code; production response caching is off during quality runs.
Existing evaluation caches can resume interruptions with full prompt/configuration
identity; cache conditions must still be disclosed. All generation uses local
models. Do not enable Gemini billing or run live Gemini evaluations here.

For an eligible production experiment, launch with `RESPONSE_CACHE_ENABLED=true`
and the existing heading-1400-280 public evaluation database environment. Eligibility
is checked against server-owned hashes of both public documents AND public questions.
Unrecognized documents, arbitrary questions and multi-turn histories always bypass
storage. The switch defaults off. `RAG_PROMPT_VERSION=step5-v1|grounded-v1` selects
one of the two declared prompts. These are server-launch settings, never client
access permissions. A restart clears the in-process cache.

Step 6 additional checks (outputs are preserved):

```sh
.venv/bin/python -m eval.cache_http --out eval/results/prompting/cache-http.json
.venv/bin/python -m eval.prompting_gate --baseline eval/results/reranking-selected.json --candidate eval/results/prompting/step5-v1.json
.venv/bin/python -m eval.prompting_gate --baseline eval/results/reranking-selected.json --candidate eval/results/prompting/grounded-v1.json
```

The cache smoke variant uses `--smoke --out .local/step6-cache-smoke.json`.
The HTTP experiment owns only its loopback Next.js process on port 8004. Cache
measurements are sequential and must not overlap evaluation inference or builds.
An older answer's citation now selects that message's own saved evidence, so its
source number cannot silently target the most recent answer's source list.

Additional Step 6 evidence and safety checks:

```sh
.venv/bin/python -m eval.grounding_diagnostics
.venv/bin/python -m eval.cache_invalidation
```

The diagnostics use six fixed public synthetic evidence cases with the actual
shared generation function and unchanged automated judge. The invalidation check
first stores a public answer, temporarily updates one public fixture chunk, checks
that the next request bypasses the cache, and restores the exact original content
in `finally`. It saves an ignored recovery receipt before mutation. No original
row is deleted. Run preservation checks immediately afterward. Do not run this
mutation test concurrently with quality or latency measurements.

Matched model-cold and model-warm measurements run after all other model work:

```sh
.venv/bin/python -m eval.cache_cold
.venv/bin/python -m eval.prompting_report
```

The cold check unloads only the already installed generation model from memory
using the preserved Ollama CLI; no model file is deleted. It verifies absence
from `/api/ps`, makes one uncached request, then repeats it while resident.
It does not claim cold filesystem caches. The report recomputes both complete
100-question runs and subset rates, checks exact ranked evidence, applies the
frozen selection rule and unchanged gates, and compares historical artifacts
byte-for-byte against Step 5 commit 8172c03.

Final compatibility and preservation checks reuse the existing tools, with a new
output location for the production reranker smoke test:

```sh
.venv/bin/python -m eval.validate_dataset --require-review
.venv/bin/python -m eval.reranking_smoke --out eval/results/prompting/final-reranker-api.json
.venv/bin/python -m eval.reranking_integrity
.venv/bin/python -m pytest -q tests/test_prompting_gate.py tests/test_prompting_report.py
git diff --check
```

`eval.reranking_integrity` recomputes the existing deterministic Step 5 receipt;
its bytes must remain identical, verified afterward by `eval.prompting_report`.
It checks the preserved Gemini cache/vector data, original local vectors, selected
162 chunks, historical files, and tracked/nonignored files for private values.
The Step 6 gate tests exercise both exact 0.02 decreases and excessive decreases,
plus rejected model/runtime/rubric/evidence changes. The report also runs negative
checks against the established gate; neither thresholds nor rubrics are relaxed.

Do not start a second evaluation while the first is running. For interrupted
runs, inspect the owned processes and existing outputs before restarting. Keep
the prior log, use a new ignored log, and disclose actual cache hit/miss counts.
The November 1 candidate continuation log is
`.local/step6-candidate-resumed-nov01.log`. Starting the existing database uses
`make up`; it does not reset the cluster. Builds need access to the existing
Google Fonts downloads. A network-denied font fetch is not repaired by disabling
type checking or build validation.

The selection policy retained `step5-v1`. The following commands measure that
prompt explicitly and preserve the separate candidate measurements.

```sh
.venv/bin/python -m eval.cache_http --prompt-version step5-v1 --out eval/results/prompting/selected-cache-http.json
.venv/bin/python -m eval.cache_cold --prompt-version step5-v1 --out eval/results/prompting/selected-cold-warm.json
.venv/bin/python -m eval.grounding_diagnostics --prompt-version step5-v1 --out eval/results/prompting/selected-diagnostics.json
```

When reproducing a measurement, supply a new output path to preserve the
existing receipt. Run measurements sequentially on the pinned local runtime.

The final source-reference check was added after the frozen comparison. Reuse
the comparison code from its verified commit and the current public snapshots.

```sh
.venv/bin/python -m eval.prompt_bytes
.venv/bin/python -m eval.grounding_diagnostics --prompt-version step5-v1 --out eval/results/prompting/selected-final-diagnostics.json
.venv/bin/python -m eval.cache_invalidation --prompt-version step5-v1 --out eval/results/prompting/selected-invalidation.json
.venv/bin/python -m eval.reranking_smoke --out eval/results/prompting/final-reranker-verified.json
```

Final HTTP receipts after the browser protocol correction:

```sh
.venv/bin/python -m eval.cache_http --prompt-version step5-v1 --out eval/results/prompting/final-cache-http.json
.venv/bin/python -m eval.cache_cold --prompt-version step5-v1 --out eval/results/prompting/final-cold-warm.json
.venv/bin/python -m eval.reranking_smoke --out eval/results/prompting/final-streaming-modes.json
```

### Step 6 citation repair and prerequisite re-audit

From the repository root, run the normal lint, test and build targets first.
The following commands use public data. Use fresh output paths for each run.

```sh
make lint
make test
make build-fe
pnpm exec vitest run tests/citations.test.ts tests/cache-api.test.ts tests/response-cache.test.ts tests/validated-stream.test.ts
.venv/bin/python -m eval.validate_dataset --require-review
.venv/bin/python -m eval.prompting_gate --baseline eval/results/reranking-selected.json --candidate eval/results/prompting/step5-v1.json
.venv/bin/python -m eval.prompting_gate --baseline eval/results/reranking-selected.json --candidate eval/results/prompting/grounded-v1.json
.venv/bin/python -m pytest -q tests/test_prompting_gate.py tests/test_prompting_report.py
.venv/bin/python -m eval.prompting_report --out .local/citation-repair-report.json
.venv/bin/python -m eval.prompt_bytes
node --import tsx eval/recheck_citations.ts
.venv/bin/python -m eval.citation_cache_http
.venv/bin/python -m eval.cache_http --prompt-version step5-v1 --out .local/citation-repair-live.json
.venv/bin/python -m eval.reranking_smoke --out .local/citation-repair-streaming.json
.venv/bin/python -m eval.cache_invalidation --prompt-version step5-v1 --out .local/citation-repair-invalidation.json
.venv/bin/python -m eval.reranking_integrity
git diff --exit-code a2f2328 -- eval/results eval/corpus eval/golden_set.jsonl db
git diff --check
```

The HTTP fixture starts a loopback model adapter and the production Next.js server.
It forwards model identity and embedding requests to the installed local Ollama.
Only its chat response is scripted, so invalid, valid and refusal outputs are
reproducible. The separate cache and streaming smoke runs use actual Ollama chat.
Run the three server-based probes sequentially. To repeat invalidation, first
inspect the previous backup in .local, confirm restored is true, verify its
content hash against the current public row, and archive the restored receipt
at a new path. Stop if recovery is incomplete. Never overwrite a recovery file.

For the browser check, select the FastAPI document, ask the first golden question,
then reload, reselect and repeat. Verify one assistant answer in each chat, one
replay label on the hit, and a working source button. The repair also tested a
scripted negative source in that UI and observed one warning and zero citation
buttons. The historical generation and judging pipeline runs with response caching
off. Recheck both saved sets of 100 final answers and their six diagnostics each
using the production validator. Retain the original answer quality, timestamps,
runtime identity, judge results and evidence hashes.

The cold/warm check also passed in this repair:
`.venv/bin/python -m eval.cache_cold --prompt-version step5-v1 --out .local/citation-repair-cold-warm.json`.
This exercises six pairs without overwriting the earlier benchmark.

### Second citation repair: Markdown delimiters

Use the same citation-repair sequence above with fresh `.local/markdown-repair-*.json`
outputs. Add `tests/closed-code-attribution.test.ts` to the focused Vitest command;
this is the exact saved two-case prerequisite reproduction, copied unchanged.
Compare it with `cmp .local/step7-closed-code-attribution.test.txt tests/closed-code-attribution.test.ts`.
The original single negative-source reproduction can be run temporarily from
`tests/` and removed afterward; its behavior is also covered permanently by
`tests/cache-api.test.ts`. Never edit saved reproductions to obtain a pass.

The HTTP fixture now covers five answers, including the exact inline triple-tick
failure split across model frames and a valid Python block with an index literal.
The browser probe must check both of these, a repeated invalid request, a valid
MISS/HIT pair, one assistant message per chat, no button for the negative literal,
and a working positive source button. Source [1] before the invalid attribution
remains clickable; the invalid answer receives a final warning and no replay label.

If services were stopped between sessions, first run `make db-status` and check
Ollama's loopback `/api/version`. For this schema-frozen repair, start the already
owned cluster without rerunning setup SQL:

```sh
.venv/bin/python - <<'PY'
from scripts.native_db import owned_cluster, run, DATA, STATE, SOCKET, PORT
owned_cluster()
run('pg_ctl', '-D', DATA, '-l', STATE / 'postgres.log', '-o',
    f'-h 127.0.0.1 -p {PORT} -k {SOCKET}', '-w', 'start')
PY
```

Only run that start command when status reports the existing server is stopped.
The already preserved `.local/ollama-runtime-0.40.9/ollama serve` can supply the
local model service when port 11434 is unused. It does not install or pull models.
Confirm both pinned digests before model checks. Do not run live Gemini calls.
The Gemini contract tests and `eval.reranking_integrity` cover its preservation.
The historical-artifact diff for this second repair uses `8e3e8f9` as its anchor.

## Step 7 — authentication and security

Use the existing checkout and `feat/production-rag`. No push or deployment.
The Step 6 prerequisite audit ran first; the new commands below use its repaired
citation parser and frozen corpus. Python is `.venv/bin/python`, Node is the
existing local toolchain, and pnpm is pinned to 11.25.0. Use the same pnpm binary
for installation and execution: a different sandbox PATH can trigger pnpm's
module-layout migration prompt. Do not delete dependencies to bypass that prompt.

### Schema and local accounts

```sh
pnpm exec drizzle-kit generate --name authentication_and_access
.venv/bin/python -m scripts.security_setup --fresh-test
.venv/bin/python -m scripts.security_setup --apply-selected
.venv/bin/python -m scripts.security_setup --apply-configured
.venv/bin/python -m scripts.create_account
make run-api
```

The checked-in generated migration is applied by `security_setup`; generation
should report no schema changes after it is checked in. `--fresh-test` creates a
new guarded database, copies the selected public corpus, applies the migration
three times and creates two random accounts in ignored mode-0600 storage. It never
reuses or deletes an existing test database. `--apply-selected` targets only the
owned selected local corpus. `--apply-configured` targets only the configured
native `docrag_dev` application database. Both require the successful isolated
receipt and verify that all existing application rows are unchanged. Unknown
legacy ownership stays inaccessible; only manifest-proven public data is exposed.

The account helper targets the configured application database and asks for a
password privately; do not pass it on the command line. Keep personal uploads
out of all frozen evaluation databases. The normal app retains its original
Gemini default; all Step 7 inference tests explicitly use local Ollama and the
isolated test/public-corpus databases. The server requires `BETTER_AUTH_SECRET` and the exact origin configuration
from `SECURITY.md`. No test-auth bypass exists. No real account is automatically
created for the owner; use the private helper when ready.

### Automated security and existing regression verification

```sh
make lint
make test
make build-fe
.venv/bin/python -m scripts.security_http
.venv/bin/python -m scripts.security_audit
.venv/bin/python -m eval.validate_dataset --require-review
.venv/bin/python -m eval.prompting_gate --baseline eval/results/reranking-selected.json --candidate eval/results/prompting/step5-v1.json
.venv/bin/python -m eval.prompting_gate --baseline eval/results/reranking-selected.json --candidate eval/results/prompting/grounded-v1.json
.venv/bin/python -m pytest -q tests/test_prompting_gate.py tests/test_prompting_report.py tests/test_security_gate.py
.venv/bin/python -m eval.prompt_bytes
node --import tsx eval/recheck_citations.ts
.venv/bin/python -m eval.citation_cache_http
.venv/bin/python -m eval.cache_http --prompt-version step5-v1 --out .local/step7-cache-http-new.json
.venv/bin/python -m eval.reranking_smoke --out .local/step7-streaming-new.json
.venv/bin/python -m scripts.security_invalidation --prompt-version step5-v1 --out .local/step7-invalidation-new.json
.venv/bin/python -m eval.reranking_integrity --out .local/step7-preservation-new.json
.venv/bin/python -m eval.prompting_report --out .local/step7-historical-new.json
```

`security_http` starts production Next.js on loopback port 8005 using only the
latest isolated test database and existing local model server. It invokes real
SQL retrieval/concurrent quotas and actual HTTPS cookie generation in Node.
Tests use public sample text. It verifies atomic invalid-upload failure, owner
read/download/delete/evaluations, two-user denials, private-cache bypass, session
expiry/logout replay, validation, SQL-injection strings and HTTP 429/recovery.
It stops the test server on exit; no original user documents are deleted.

The HTTP cache/reranker helpers now supply the exact Origin and local HTTP config
required by the application. This changes their request envelope, not prompts,
models or assertions. `security_invalidation` archives only a verified restored
old receipt before the existing reversible public-content probe. Run it after
other evaluations finish, because the probe temporarily changes a public chunk
and restores it in `finally`.

### Full 100-question evaluation and security declaration

Use the preserved Ollama 0.40.9 runtime on its original port 11434; a different
port is correctly rejected by the frozen benchmark. Neither model digest changes.

```sh
AI_PROVIDER=ollama .venv/bin/python -m eval.run_eval --golden eval/golden_set.jsonl --out eval/results/security/step7-raw.json --prompting-experiment step5-v1
.venv/bin/python -m eval.promote_local --source eval/results/security/step7-raw.json --out eval/results/security/step7.json
.venv/bin/python -m eval.security_gate --baseline eval/results/prompting/step5-v1.json --candidate eval/results/security/step7.json
```

Use a new output path for another completed measurement; never overwrite a
historical result. Partial interrupted generations are reused only through the
existing model/prompt cache. SQL retrieval always runs again. The Step 7 gate
permits an explicit list of necessary security/dependency implementation changes,
requires unchanged configuration and identical ranked evidence for all 100 cases,
and calls the unchanged 0.02 regression threshold. Four prior Step 6 repairs are
accepted only at their exact `8dfa483` file hashes; arbitrary parser, cache or
prompt edits still fail. Prompt-only Step 6 gates still
run against the saved Step 6 artifacts. Their test fixture now explicitly uses
that frozen candidate rather than misclassifying current auth changes as a
prompt-only change. New negative controls reject model, prompt, evidence,
partial-dataset and just-over-threshold changes.

### Audit commands and interpretation

```sh
pnpm audit --json
.venv/bin/python -m pip_audit --format json
.venv/bin/python -m pip_audit -r requirements-reranker.txt --no-deps --disable-pip --format json
.venv/bin/python -m pip_audit --path .local/reranker-minilm/env/lib/python3.14/site-packages --format json
```

The last command covers the actual installed reranker tools, including pip, not
only model requirements. Verify that this directory exists and that at least 30
packages were scanned; an empty path can misleadingly return exit 0. This
checkout's reranker environment is Python 3.14.6. Its pip installer was separately
patched with its own `env/bin/python -m pip install pip==26.2`; the frozen model
requirements and model digest were not modified. Repeat that installer update
after recreating the optional environment with an older bundled pip.

JavaScript raw audit currently exits 1 for two reviewed moderate tooling
advisories. It is not suppressed or called zero-findings. The audit wrapper records
raw codes, fails on any new finding/error, checks installed Python package counts,
and verifies that the optional Drizzle CLI/esbuild peer is absent from the actual
production server traces. See `SECURITY.md` and `security/dependency-audit.json`.

### Complete repeatable verification

```sh
.venv/bin/python -m scripts.verify_security --run-id step7-final-UNIQUE
```

Choose a new alphanumeric/hyphen run name. This runs all 24 command groups above,
including a fresh database, entire unit suite, real HTTP tests, old citation/cache
regressions, reversible invalidation, another full 100-question evaluation,
unchanged gates, preservation and dependency audits. It writes each command,
actual exit code and log under `.local/security-verify-<run-id>`, stops on failure,
and never overwrites another run. After a fix, run from the beginning with a new
name. Browser verification is separate and must be performed on the actual build:
A sign-in/upload/chat/citation/follow-up/sign-out, B isolated library/direct-ID
denial, public valid cache replay and final sign-out. The screenshots and receipt
are `.local/step7-browser-*.png` and `.local/step7-browser-receipt.json`.

Finally run the existing Git provenance/secret-preservation checks, create only
local logical commits, inspect the final diff/status and verify no branch push.
Do not proceed to Step 8 until the final Step 7 report is complete.
