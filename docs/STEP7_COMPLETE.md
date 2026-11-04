# Step 7 verification report

Status: **STEP 7 COMPLETE**. Tasks: **20/20**. Automated verification groups: **24/24**. Browser checks: **12/12**. Tests: **344 passed, 0 failed**.

Repository: https://github.com/abhi0874/DocRAG
Branch: `feat/production-rag`
Scope: authentication and security only; no Step 8 or publication.

DocRAG now verifies identity with database-backed sessions before private access.
Each new document belongs to its uploader, and both searches restrict candidates
before ranking. Upload and request limits constrain expensive or malformed work.
The public benchmark, repaired citations and optional public cache retain their
previous behavior. All inference used for this step is local and costs ₹0.

## Implementation and task evidence

| Task | Implementation / evidence |
|---|---|
| 1 Route audit | `SECURITY_MODEL.md` inventories actual routes, unsupported operations, tables and limits. |
| 2 Threat model | Trust boundaries and testable invariants in `SECURITY_MODEL.md`. |
| 3 Framework | Better Auth 1.7.15, Drizzle adapter and standard scrypt; no external identity subscription. |
| 4 Sessions | Fixed eight-hour database sessions, server validation, token-free JSON, sign-in/out UI. |
| 5 Ownership | Additive generated Drizzle migration; repeated isolated migration before existing databases. |
| 6 APIs | Session-derived ownership for originals, reads, downloads, deletion and evaluations. |
| 7 Retrieval | SQL ownership predicates before vector/keyword ORDER/LIMIT; RRF and reranker inherit scope. |
| 8 Public corpus | Exact historical manifest classification; 162 selected chunks and 100 questions retained. |
| 9 Cache | Public-only and off by default; private documents/history bypass; repaired validator retained. |
| 10 PDF | Size, MIME, signature, path, corruption, pages, extraction and child-process limits. |
| 11 Requests | Strict schemas, bounded bodies and conversations, parameterized SQL and safe errors. |
| 12 Limits | Atomic PostgreSQL quotas, 429/Retry-After, recovery and separate-user/concurrency tests. |
| 13 Browser security | Actual HTTPS framework cookie test, fixed expiration, origin checks and no credentialed wildcard CORS. |
| 14 Isolation | Independent A/B accounts with public sample content in an isolated test database. |
| 15 Regression tests | Existing 311 tests retained; meaningful security tests and negative gate controls added. |
| 16 Audits | Real JavaScript, Python and installed optional-reranker audits; residual findings disclosed below. |
| 17 HTTP/browser | Production Next.js HTTP checks plus manual browser flow; final evidence recorded below. |
| 18 Evaluation | Full 100-question local run, unchanged numerical gate, identical evidence requirement. |
| 19 Documentation | `SECURITY.md`, `SECURITY_MODEL.md`, command contract and placeholder-only `.env.example`. |
| 20 Final verification | All command-contract groups plus browser, Git and preservation checks recorded below. |

## Authentication and ownership

The browser holds a signed opaque HttpOnly, SameSite=Lax cookie. HTTPS adds Secure;
path is `/` and no Domain broadening is configured. Every protected request checks
its session in PostgreSQL. Sessions do not refresh their eight-hour lifetime;
client `rememberMe` overrides are rejected. Logout removes the database session.
Unknown account and wrong password responses are equivalent. Accounts are issued
by the local operator; unused public signup and other auth endpoints are closed.

`document_access` and `evaluation_access` enforce ownership; chunks inherit their
document's access. Missing access rows quarantine old unknown-owner data. Only
exactly verified public-corpus records are classified public. Original files are
private `document_files` bytea rows. No legacy owner was invented or reassigned.
Public documents cannot be deleted by ordinary users. Replacement/update routes
are not implemented and do not provide an alternate access path.

## Dependency findings and interpretation

The initial JavaScript audit found 97 vulnerabilities: 9 critical, 36 high,
45 moderate and 7 low. Version-pinned updates and removal of an unused CLI resolved
the high/critical findings. CSS previously imported from that CLI was preserved
with its MIT license. Python package fixes and the optional reranker environment's
pip upgrade were made locally, without global installation or model changes.

The final raw JavaScript audit returns **exit 1**, with **two moderate findings**:

- esbuild 0.18.20, GHSA-67mh-4wv8-2f99, fixed in 0.25.0. This comes through
  Drizzle's legacy loader. pnpm marks it non-dev through Better Auth's optional
  CLI peer, but it is absent from all production server dependency traces.
  DocRAG does not invoke the affected esbuild HTTP server.
- minimatch 3.1.5/10.2.5, GHSA-g3hv-75wg-m249, fixed in 11.0.1. These are ESLint
  tooling paths; HTTP input does not control lint glob patterns. A global major
  override would break older callable APIs.

The audit wrapper's success means the exact disclosed risk policy passed; it does
not convert raw exit 1 into a zero-vulnerability claim. These are reviewed tooling
risks, not patched upstream packages. Exact initial/final versions, advisories,
fixes, reachability and authoritative links are in `security/dependency-audit.json`.
Python application/tooling and the actual Python 3.14 optional-reranker environment
must each have zero known findings and raw exit 0 in the final receipt.

## Adaptations and corrected failures

- Actual Next.js requests normalize the internal URL; origin checks compare the
  configured origin with the incoming Host and Origin, and reject mismatches.
- Test transports now send the required Origin. Old prompt-only gate fixtures use
  their saved prompt-only configuration rather than the later security config.
- The security gate permits only declared auth/dependency changes and exact hashes
  of the four completed Step 6 repairs. Arbitrary changes to those repair files
  are rejected. Numerical thresholds, parser grammar and prompts were not relaxed.
- The standard app database remains separate from frozen evaluation databases.
- The optional reranker lives in Python 3.14, not 3.12. An empty-path audit was
  rejected; the actual installed packages were audited and pip was patched.
- A precommit measurement failed provenance validation and was retained separately;
  the committed implementation was evaluated again. Alternate runtime-port and
  interrupted-service attempts were also not counted as successful verification.
- Better Auth's `rememberMe=false` default could extend sessions to 24 hours;
  that unsupported client option is now rejected and the eight-hour lifetime is
  checked against the actual HTTPS framework response.
- Final run A saved measurements under `.local`; the unchanged validator correctly
  rejected that location. Run B saves them under `eval/results/security/<run-id>`.
  Run A's failure logs remain intact. The complete list was restarted after this
  harness fix, without weakening provenance validation.

## Known limitations

Automated faithfulness/correctness and citation support are not independent human
validation or a guarantee of factual accuracy. Structural citation validation does
not establish factual support; invalid generated text may appear before streaming
finishes. The UI must not turn invalid references into valid clickable sources.
The known `postgresql-005` savepoint omission and `postgresql-037` missing final
foreign-key evidence remain. The experimental grounded-v1 historical result still
has its known postgresql-042 missing-reference case; it is not the selected prompt.

The deployment remains local. Gemini data and provider tests are preserved, but
no paid/live Gemini call was made and its earlier partial 20/100 benchmark remains
partial. No claim is made that recruiters can access this local instance online.

PostgreSQL quotas work across instances, but expensive-work slots are per process.
Anonymous shared quotas can be exhausted by another caller. PDF child limits are
not an OS sandbox or a total native-memory limit. A trusted server/database operator
can access stored data. Already-delivered stream data cannot be retracted; access
is checked at request boundaries. MFA, self-service recovery, online deployment
and distributed denial-of-service protection are not delivered in this step.

## Checks you can perform

1. Follow `SECURITY.md` to create your own local account privately, run
   `make run-api`, visit the configured `http://localhost:8000`, and sign in.
2. Upload a PDF containing public documentation. Ask a question and open a source
   citation; it should show evidence from a document you can access.
3. Sign out. Private documents should disappear; protected upload/evaluation
   operations should require sign-in. A second account should not see the upload.

Do not use the isolated test credentials for deployment. Never upload personal
information into the public benchmark or paste credentials into chat.

## Final automated verification — 4 November 2026

All 24 command groups passed with unchanged source hashes throughout the run.
Python: 162 passed, 0 failed. TypeScript: 182 passed, 0 failed. Total: **344**.
The separately repeated gate suite passed 23 tests (already included in that total).
Real production HTTP: 66 checks. Actual SQL retrieval/concurrent quotas: 27 checks.
Actual framework HTTPS cookie/session check: PASS.

| Exact command | Exit | Log |
|---|---:|---|
| `make lint` | 0 | [log](security/verification-step7-final-b/00.log) |
| `make test` | 0 | [log](security/verification-step7-final-b/01.log) |
| `make build-fe` | 0 | [log](security/verification-step7-final-b/02.log) |
| `.venv/bin/python -m scripts.security_setup --fresh-test` | 0 | [log](security/verification-step7-final-b/03.log) |
| `.venv/bin/python -m scripts.security_setup --apply-selected` | 0 | [log](security/verification-step7-final-b/04.log) |
| `.venv/bin/python -m scripts.security_setup --apply-configured` | 0 | [log](security/verification-step7-final-b/05.log) |
| `.venv/bin/python -m scripts.security_http` | 0 | [log](security/verification-step7-final-b/06.log) |
| `.venv/bin/python -m eval.validate_dataset --require-review` | 0 | [log](security/verification-step7-final-b/07.log) |
| `.venv/bin/python -m eval.prompting_gate --baseline eval/results/reranking-selected.json --candidate eval/results/prompting/step5-v1.json` | 0 | [log](security/verification-step7-final-b/08.log) |
| `.venv/bin/python -m eval.prompting_gate --baseline eval/results/reranking-selected.json --candidate eval/results/prompting/grounded-v1.json` | 0 | [log](security/verification-step7-final-b/09.log) |
| `.venv/bin/python -m pytest -q tests/test_prompting_gate.py tests/test_prompting_report.py tests/test_security_gate.py` | 0 | [log](security/verification-step7-final-b/10.log) |
| `.venv/bin/python -m eval.prompt_bytes` | 0 | [log](security/verification-step7-final-b/11.log) |
| `node --import tsx eval/recheck_citations.ts` | 0 | [log](security/verification-step7-final-b/12.log) |
| `.venv/bin/python -m eval.citation_cache_http` | 0 | [log](security/verification-step7-final-b/13.log) |
| `.venv/bin/python -m eval.cache_http --prompt-version step5-v1 --out .local/security-verify-step7-final-b/cache-http.json` | 0 | [log](security/verification-step7-final-b/14.log) |
| `.venv/bin/python -m eval.reranking_smoke --out .local/security-verify-step7-final-b/streaming.json` | 0 | [log](security/verification-step7-final-b/15.log) |
| `.venv/bin/python -m scripts.security_invalidation --prompt-version step5-v1 --out .local/security-verify-step7-final-b/invalidation.json` | 0 | [log](security/verification-step7-final-b/16.log) |
| `.venv/bin/python -m eval.run_eval --golden eval/golden_set.jsonl --prompting-experiment step5-v1 --out eval/results/security/step7-final-b/evaluation-raw.json` | 0 | [log](security/verification-step7-final-b/17.log) |
| `.venv/bin/python -m eval.promote_local --source eval/results/security/step7-final-b/evaluation-raw.json --out eval/results/security/step7-final-b/evaluation.json` | 0 | [log](security/verification-step7-final-b/18.log) |
| `.venv/bin/python -m eval.security_gate --baseline eval/results/prompting/step5-v1.json --candidate eval/results/security/step7-final-b/evaluation.json` | 0 | [log](security/verification-step7-final-b/19.log) |
| `.venv/bin/python -m eval.reranking_integrity --out .local/security-verify-step7-final-b/preservation.json` | 0 | [log](security/verification-step7-final-b/20.log) |
| `.venv/bin/python -m eval.prompting_report --out .local/security-verify-step7-final-b/historical-report.json` | 0 | [log](security/verification-step7-final-b/21.log) |
| `.venv/bin/python -m scripts.security_audit` | 0 | [log](security/verification-step7-final-b/22.log) |
| `git diff --check` | 0 | [log](security/verification-step7-final-b/23.log) |

Raw audit subcommands are recorded separately; JavaScript exit 1 is not hidden:

- `pnpm audit --json` — raw exit 1; Two disclosed moderate tooling findings; see docs/SECURITY.md. Raw audit exit remains 1.
- `.venv/bin/python -m pip_audit --format json` — raw exit 0; No known vulnerabilities in installed environment
- `.venv/bin/python -m pip_audit --path .local/reranker-minilm/env/lib/python3.14/site-packages --format json` — raw exit 0; No known vulnerabilities in installed environment

## Final evaluation

100/100 questions: 80 answerable, 20 deliberately unanswerable.

| Metric | Full-precision value |
|---|---:|
| recall@3 | 0.95 |
| recall@5 | 0.975 |
| recall@10 | 1.0 |
| mrr | 0.9729166666666667 |
| faithfulness | 0.995 |
| correctness | 0.99 |
| citation_accuracy | 1.0 |
| citation_supported | 261 |
| citation_denominator | 261 |

Regression gate: PASS. Recall@5 and faithfulness drops: 0.000 each;
thresholds unchanged. Ranked chunk IDs, order and content match for all 100.
The final repeat had 100 embedding, answer and judge cache hits each, with zero
misses; real SQL retrieval ran again for every question. Earlier fresh generation
and live HTTP streaming are retained separately. Cached timing is not fresh model
latency. Full raw and validated measurements live in
`eval/results/security/step7-final-b/`; earlier valid Step 7 results are retained.

Citation replay: all 100 selected answers validated (80 cited, 20 legitimate
uncited refusals). Basic/single-backtick/triple-backtick negative attributions,
closed fences and historical invalid replay remain covered. Real scripted cache
checks show invalid MISS→MISS and valid/refusal MISS→HIT. Real public cache checks
show 6 MISS, 12 HIT and 12 uncached BYPASS requests. All four reranker streaming
modes passed: disabled, enabled, missing-model fallback and timeout fallback.
Reversible document invalidation restored the original data.

## Final browser and preservation results

Browser checks on the final production build: **12/12 PASS**. Sign-in/out,
owned library, private streaming, source citation, follow-up without duplicated
messages, PDF upload, second-user isolation, guessed-ID rejection and valid public
cache replay all passed. Screenshots and the observed check list are under
`security/verification-step7-final-b/`. Session expiry, invalid sessions, upload
rejections, HTTP 429 and CORS behavior were verified by the real HTTP suite.

The chat interruption stopped local services after automated completion. An
unrelated Docker database then occupied port 55432. A browser-only attempt at
55433 was rejected by the existing isolated-database guard, which was preserved.
With explicit user approval, `text-to-sql-db-1` was temporarily stopped, DocRAG was
returned to its verified port and the browser checks passed. The other container
was then restarted and verified running. Temporary DocRAG servers were stopped,
and the previously paused desktop Ollama app was resumed. No database or model
was deleted. Before a future local run, resolve this port conflict deliberately;
do not point DocRAG credentials at the other project's database.

Preservation: **PASS**. Gemini cache: 20 pairs; Gemini vectors: 151; original local
vectors: 151; selected evaluation chunks: 162. Historical file hashes and golden
questions unchanged. Public static assets and tracked/nonignored files passed
secret scans. The final 179 source hashes match the completed verification run.
New text evidence was checked for actual private environment values and test
passwords before commit. No credentials are included in screenshots.

STEP 6 prerequisite audit: **PASS**, before authentication/schema implementation.
The original repaired chat-handler cases, selected answer replay, lint, 311-test
suite, build, gates, browser and preservation checks passed in that audit. Final
verification repeats their applicable coverage with the expanded security suite.
All eight required repair commits remain ancestors of the current branch.

| Final confirmation | Result |
|---|---|
| 1 — Authentication and isolation | PASS |
| 2 — Security controls and dependency risk review | PASS |
| 3 — Full verification and GitHub restrictions | PASS |

No required task remains. No unresolved verification errors. The two moderate
JavaScript advisories remain disclosed residual risks; this is not a zero-findings
audit. No paid API calls, no GitHub push, no PR, no deployment and no Step 8 work.
`git ls-remote --heads origin feat/production-rag` returned no branch (exit 0).

## Files and local commits

Implementation commits:

- `f27507a` chore(security): update audited dependencies and preserve UI styles
- `bd2bfba` feat(security): enforce database sessions and ownership before retrieval
- `2026396` test(security): verify sessions, isolation, audits and preserved RAG contracts
- `62bad06` docs(security): keep application uploads separate from frozen benchmarks
- `fca3a9d` fix(auth): reject client overrides of the fixed session lifetime
- `9b62919` test(eval): pin completed Step 6 repairs in the security gate
- `9aa54a9` fix(verify): save evaluation runs in the validated results directory

The final report/evidence commit follows these implementation commits.

Changed implementation and documentation files relative to completed Step 6:

- `.env.example`
- `app/api/auth/[...all]/route.ts`
- `app/api/chat/route.ts`
- `app/api/documents/[id]/download/route.ts`
- `app/api/documents/[id]/route.ts`
- `app/api/documents/route.ts`
- `app/api/evaluations/route.ts`
- `app/evaluate/page.tsx`
- `app/globals.css`
- `app/sign-in/page.tsx`
- `app/vendor/shadcn-LICENSE.md`
- `app/vendor/shadcn.css`
- `components/app-header.tsx`
- `components/auth-status.tsx`
- `components/document-panel.tsx`
- `components/workspace.tsx`
- `db/security-migrations/0000_authentication_and_access.sql`
- `db/security-migrations/meta/0000_snapshot.json`
- `db/security-migrations/meta/_journal.json`
- `docs/COMMAND_CONTRACT.md`
- `docs/SECURITY.md`
- `docs/SECURITY_MODEL.md`
- `docs/security/dependency-audit.json`
- `drizzle.config.ts`
- `eval/cache_http.py`
- `eval/reranking_integrity.py`
- `eval/reranking_smoke.py`
- `eval/security_gate.py`
- `lib/auth.ts`
- `lib/db/index.ts`
- `lib/db/security-schema.ts`
- `lib/evidence.ts`
- `lib/provider-config.ts`
- `lib/public-cache-policy.ts`
- `lib/rag.ts`
- `lib/retrieval.ts`
- `lib/security/access.ts`
- `lib/security/http.ts`
- `lib/security/limits.ts`
- `lib/security/pdf.ts`
- `lib/security/work.ts`
- `lib/select-context.ts`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `requirements-dev.txt`
- `scripts/create_account.py`
- `scripts/create_account.ts`
- `scripts/pdf-worker.mjs`
- `scripts/security-migrate.ts`
- `scripts/security_audit.py`
- `scripts/security_http.py`
- `scripts/security_invalidation.py`
- `scripts/security_retrieval.ts`
- `scripts/security_session.ts`
- `scripts/security_setup.py`
- `scripts/verify_security.py`
- `tests/cache-api.test.ts`
- `tests/chunking-upload.test.ts`
- `tests/closed-code-attribution.test.ts`
- `tests/evaluation-provider.test.ts`
- `tests/reranker-api.test.ts`
- `tests/response-cache.test.ts`
- `tests/routes.test.ts`
- `tests/security-route-fixture.ts`
- `tests/security.test.ts`
- `tests/select-context.test.ts`
- `tests/test_prompting_gate.py`
- `tests/test_security_gate.py`

Additional final artifacts: this report, `docs/security/verification-step7-final-b/`
and `eval/results/security/`. Final `git diff --check` passed. The final local
commit records these artifacts; the handoff confirms the clean working tree.

Exported command logs normalize terminal carriage returns and trailing blank
lines for Git whitespace checks. Original byte-for-byte logs remain in the ignored
`.local/security-verify-step7-final-b/` run directory. This documentation-only
formatting correction leaves all 179 verified source hashes unchanged.
