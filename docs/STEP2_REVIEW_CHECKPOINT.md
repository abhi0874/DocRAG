# STEP 2 — mandatory human review checkpoint

Date: 2026-10-21 (Asia/Kolkata). STEP 2 is NOT COMPLETE.
Repository: https://github.com/abhi0874/DocRAG
Branch: feat/production-rag. No push, PR, merge, or deployment occurred.

## Previous-step audit: PASS

Before implementation, git remote -v, git branch --show-current, git status --short,
git log -5 --oneline, and `test -s docs/AUDIT.md && echo ok` all exited 0.
The checkout was clean at 3cdf035. The audit was read and checked against the actual
rag.ts, database schema/pool, chat route and comparison route. It correctly describes
the existing hybrid retrieval, citation prompt, comparison UI, and missing harness.
No earlier implementation was silently repaired.

`make lint`, `make test`, `make build-fe`, `python scripts/check_env.py`, and
`python scripts/db_query.py "SELECT extname FROM pg_extension WHERE extname = 'vector'"`
all exited 0. Python ran from .venv. The prior suite passed 14 Python and 13
TypeScript tests. Gemini returned a real response; database checks passed and the
extension query returned vector. The six earlier commits 4e4fafa, 3765d9a,
02d8d13, 4904ebb, bcadc10 and 3cdf035 remain ancestors of HEAD.

Read-only `git ls-remote origin refs/heads/main refs/heads/feat/production-rag`
exited 0 before implementation and again at this checkpoint. Both showed only
main at 7ccc792669cef1c254d71ebc342fa4ba624584fa, with no development branch.
The eleven listed prior-step command checks passed.

## Work completed and remaining

Tasks 1–3 are complete as candidate preparation: inspected the real application,
created reproducible ingestion, and wrote 100 structurally valid candidates.
Task 4 has a validated review package and awaits explicit human confirmation.
Tasks 5–15 remain incomplete; metrics, judge, runner, regression gate, metric
tests, baseline, repeat evaluation and final methodology are not claimed complete.
The command contract contains only the implemented pre-review adaptations so far.
The existing make eval/eval-gate targets still fail as unimplemented.

The actual application retains 1000-code-unit chunks with 200 overlap, Gemini
embedding-2 at 1536 dimensions, cosine and English keyword candidates limited
to 12 each, RRF k=60, answer top-K=6, gemini-3.5-flash, and its existing citation
and refusal instructions. lib/rag.ts, model config, schema and all API routes are
unchanged. There is no replacement Python retrieval implementation or backend.

The new ingestion adapter calls the real chunkPages and embedChunks. An isolated
database on the checkout-owned native cluster contains 2 documents, 12 public
source pages, 151 chunks and complete source mappings. FastAPI contributes 88
chunks; PostgreSQL contributes 63. The ordinary application database still has
0 chunks. Ingestion inserts no user documents into that application database.

The candidate distribution is 60 easy, 20 multi_hop, 20 unanswerable; 50 questions
belong to each documentation source. All 100 remain AI-generated candidates.
Validation output and hashes are in eval/dataset_validation.json. All answerable
references resolve to saved sources, and all 120 source assignments have matching
evidence locations. No normalized duplicate questions or IDs were found. No
near-duplicate pair exceeded the 0.88 text-similarity review threshold.
Semantic correctness, ambiguity and multi-hop necessity still need human review.

## Checkpoint verification: 12/12 passed

This is the pre-review sequence from COMMAND_CONTRACT.md, not a claim that the
complete STEP 2 A–H verification sequence has run.

| Command/check | Exit | Actual result |
| --- | ---: | --- |
| python scripts/ingest_corpus.py | 0 | Existing 2 documents, 12 sources, 151 chunks verified; no new model calls |
| python scripts/ingest_corpus.py (repeat) | 0 | Same IDs/content/mappings verified; no new model calls |
| python scripts/eval_db_query.py "SELECT count(*) FROM chunks" | 0 | 151 |
| Evaluation source/chunk ownership join from the command contract | 0 | All 12 source IDs present; counts sum to 151 |
| python scripts/db_query.py "SELECT count(*) FROM chunks" | 0 | 0 in the ordinary application database |
| wc -l eval/golden_set.jsonl | 0 | 100 |
| python -m eval.validate_dataset | 0 | All structural checks passed; review explicitly pending |
| make lint | 0 | Ruff, format check, ESLint, TypeScript passed |
| make test | 0 | 36 Python + 13 TypeScript tests passed; 0 failed |
| make build-fe | 0 | Next production compilation, TypeScript and page generation passed |
| git diff --check | 0 | No whitespace errors |
| git status --short | 0 | Only intended STEP 2 files before local commits |

Additional negative check: `python -m eval.validate_dataset --require-review`
exited 1 with “Human review pending: read eval/REVIEW_NEEDED.md”, as required.
The new tests also reject invented human-verification status, invalid evidence,
bad labels, missing fields, duplicates, invalid vectors and nonlocal DB targets.
No baseline.json or human_review.json exists. Ignore checks passed for .env,
local embedding caches, latest.json and the reserved eval cache directory.
Staged content was checked against the actual private key, URL and password
without printing those values. No application source changes were staged.

## Resolved errors and adaptations

Python urllib could not validate the HTTPS certificate chain in this local Python
installation. The snapshot utility uses macOS curl with TLS verification enabled.
It honors robots paths, retains policies and licenses, and refuses to replace an
existing snapshot. Rerun ingestion reads pinned local text and needs no website fetch.

Two ingestion attempts encountered the embedding free-tier request limit (100).
The first saved 88 completed embeddings in an ignored cache. Database writes rolled
back on failure. A later attempt found PostgreSQL stopped; make up restarted only
the existing native cluster without deleting data. Ingestion then reused the 88
cached embeddings and fetched the remaining 63 successfully. Evaluation ingestion
now spaces fresh batches by 61 seconds; SDK retries retain exponential backoff.
No paid upgrade, model substitution or quota bypass was used. All 12 checkpoint
checks were rerun from the top after these fixes and passed.

The project-only tsx dependency is pinned to 4.20.6 with the pnpm lockfile updated.
New evaluation cache ignore coverage and corpus verification commands required
changes to .gitignore and docs/COMMAND_CONTRACT.md, explained before editing.
No global software installation was needed. Native PostgreSQL remains sufficient.

## Baseline status and required confirmation

Recall@3, recall@5, recall@10, MRR, citation accuracy, faithfulness, correctness,
p50/p95 latency, tokens/query and estimated cost/query are all UNAVAILABLE:
no evaluation runner or final evaluation has been executed. Embedding ingestion
success is not an answer-quality result. Two successful ingestion checks are not
two evaluation runs. Evaluation reproducibility and the regression gate are NOT RUN.

CONFIRMATION 1 — DATASET: FAIL (required human review pending).
CONFIRMATION 2 — BASELINE: FAIL (not implemented/run at this checkpoint).
CONFIRMATION 3 — ALL TASKS AND GITHUB SAFETY: FAIL (remaining STEP 2 work pending;
GitHub safety checks themselves passed).

Open eval/REVIEW_NEEDED.md in Codex, review all 100 questions and AI candidate
answers against the linked local sources, and reply with an explicit confirmation
or IDs requiring correction. The exact checklist and troubleshooting instructions
are at the top of that file. Do not approve unread questions. Your STEP 2 Task 4
explicitly requires stopping at this checkpoint until confirmation arrives.

Known limits: this small corpus is not representative of arbitrary PDFs; virtual
pages are documentation pages; source-page relevance is coarser than exact evidence;
AI candidate review is not independent human verification; API quotas remain
account-dependent. The eventual public deployment is outside this step.

STEP 2 NOT COMPLETE. Do not proceed to STEP 3 or push to GitHub.
