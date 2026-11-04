# Authentication and security

DocRAG uses **Better Auth 1.7.15**, its Drizzle PostgreSQL adapter and its established
scrypt password hashing. This is free, works with Next.js 16.4.4/React 19 and does
not require a hosted identity service. Compatibility was checked against the
installed package's peer dependencies and [official Next.js integration](https://better-auth.com/docs/integrations/next).
The operator creates accounts; public signup and unused auth endpoints are closed.
No email verification or password reset service is implied.

A session is a server-stored record that proves a previous successful sign-in.
The browser holds its signed opaque cookie, marked HttpOnly and SameSite=Lax.
HTTPS uses Secure cookies. The server checks the database on each request, rather
than trusting a user ID supplied by the browser. Sessions expire after eight hours
and do not slide forward on activity. Sign-out deletes the session; replaying that
cookie no longer grants private access. Session JSON intentionally omits tokens.

## Local configuration and accounts

Work in Terminal in the existing `RAG-Agent` folder. Keep secrets only in ignored
`.env`, with permissions 0600. `.env.example` contains placeholders.

Set `BETTER_AUTH_SECRET` to at least 32 random characters, `DOCRAG_APP_ORIGIN` to
the exact browser origin (including port), and `DOCRAG_LOCAL_HTTP=true` only for
local HTTP. The current local default is `http://localhost:8000`. Visiting
`127.0.0.1` instead is a different origin; configure and visit the same one.
Online operation must use an HTTPS origin and `DOCRAG_LOCAL_HTTP=false`.

After the selected database has its migration, create an account privately:

```sh
.venv/bin/python -m scripts.create_account
make run-api
```

The account helper uses the normal application database configured in `.env`.
The existing application default is Gemini; the security tests and full benchmark
explicitly use free local Ollama in isolated databases. Do not point personal
uploads at a frozen evaluation database. No real Gemini inference was needed for
Step 7 verification. Enter a display name,
email and a new 12–128 character password. Password entry is hidden and is sent to
the Node helper through standard input, never command-line arguments or logs.
Success says `Account created`. Open the configured origin, choose **Sign in**, and
use that account. Public documents can be browsed without an account; uploads and
the evaluation page require sign-in. Sign-out clears the application's browser
state through a full navigation.

Common setup problems:

- **Sign-in service unavailable:** confirm PostgreSQL is running, the selected
  database has the security migration and the auth secret is not a placeholder.
- **Request origin is not allowed:** the browser host/port must exactly match
  `DOCRAG_APP_ORIGIN`; restart Next.js after changing `.env`.
- **Account could not be created:** check password length, matching confirmation,
  database selection and whether the email already exists. Do not paste secrets
  into chat or commit them to Git.

Changing the auth secret invalidates signed cookies; do so only intentionally.
Never reuse the isolated test credentials for a real deployment.

## Ownership and migration

The additive Drizzle migration lives in `db/security-migrations`. It adds auth
tables, `document_access`, `evaluation_access`, `document_files` and
`request_limits`. It does not replace existing document/chunk tables, vectors,
IDs, timestamps, golden questions or evaluation history.

Missing ownership rows quarantine legacy records. Only exact matches to the
previously verified public document/chunk manifest receive public access rows.
Matching titles or public-looking prose are insufficient. Existing rows with
access decisions are never reassigned by repeat migrations. New upload ownership
comes exclusively from the authenticated session and commits with the original
PDF and chunks in one transaction. Unknown legacy evaluations remain hidden.

The fresh test database copies the 162 selected chunks without altering the source,
applies the generated migration repeatedly, and creates two random test accounts.
Its database name/ownership marker and credentials are under ignored `.local`.
Migrations to existing databases require a successful isolated migration receipt.
See the command contract for exact commands. No production cleanup is automated.

Recovery: stop the application if migration fails; retain the database and inspect
the failure. Additive migration application is transactional and repeatable. Take
a protected PostgreSQL backup before applying to another database. Recover into a
new isolated database and validate before switching connections. Do not drop auth
or ownership tables to roll back, and do not serve private uploads with pre-auth
application code. Reverting to an older unprotected application is unsafe even
when old tables themselves are unchanged.

## Access, requests and uploads

The detailed route matrix and threat assumptions are in `SECURITY_MODEL.md`.
Public documents are readable and queryable; they are not deletable by ordinary
users. Private originals, chunks, vectors, citations and comparisons are visible
only to their owner. Vector and keyword WHERE clauses filter ownership **before**
ranking or limiting. RRF combines only those candidates, and the optional reranker
receives only those candidates. No client-selected model, generation budget, user
ID, SQL expression or arbitrary source selector is accepted.

Limits: JSON 64 KiB (auth 4 KiB); at most 20 messages, 8,000 characters per message,
32,000 total conversation characters; question 8,000 characters; positive 32-bit
document IDs; listing at most 100 documents per page. Body reads time out after
15 seconds. Inputs use strict Zod schemas; malformed requests get safe errors.

PDFs: 15 MiB file limit, 64 KiB multipart allowance, one file, PDF MIME/extension
and signature, safe filename, at most 100 pages, 500,000 extracted characters,
500 chunks. Parsing runs in a child with a 10-second deadline, 192 MiB V8 heap
limit, bounded output and no inherited provider credentials. This is not an OS
sandbox or a total native-memory cap. Files are stored as bytea, downloaded as an
attachment with `nosniff`, and never executed or published as HTML. Extraction or
embedding failure leaves no partial document rows.

## Quotas and browser protections

PostgreSQL atomically counts requests, including across server instances.
Authenticated users have separate buckets. Anonymous authentication and public
access use shared buckets; spoofing forwarded IP headers cannot reset a quota.
Limits return 429 with Retry-After and recover after the window expires.

| Operation | Window |
|---|---|
| Authentication | 30 / 5 minutes, anonymous global |
| Upload | 5 / 5 minutes per user |
| Chat | 30 / minute per user |
| Anonymous public chat | 60 / minute, global |
| Evaluation | 5 / 5 minutes per user |
| Reads | 120 / minute per user or anonymous global |

Two expensive-work slots and one PDF parser slot are process-local, not distributed
capacity limits. Exact Origin/Host checks protect mutations alongside framework
CSRF controls. No wildcard credentialed CORS is enabled. Authentication failures
are generic for absent accounts and incorrect passwords. No session token is kept
in localStorage. Private bodies/credentials are not application log fields.

## Cache and RAG preservation

The response cache remains **off by default**, public-only when enabled, and bound
to the existing manifest/question/context/model hashes. Private uploads and
conversation history always bypass it. Authorization happens before any cached
answer or citation is delivered. Both negative `[-1]` regressions and existing
closed-code parsing remain covered. Invalid historical entries are rejected.

The selected prompt remains `step5-v1`; reranking remains disabled by default.
Structural citation validity is not factual verification. The historical automated
scores are not independent human validation; the known savepoint and foreign-key
limitations remain. Step 7 does not promise perfect answers.

## Dependency audit

Exact package versions, IDs, severity supplied by the audit, dependency paths and
available fixes are recorded in `security/dependency-audit.json`. Raw receipts are
kept under ignored `.local/step7-*-audit*.json` and dependency JSON files.

The initial JavaScript audit reported 97 findings (9 critical, 36 high, 45 moderate,
7 low). Security upgrades include Next.js/eslint-config-next 16.4.4, Vitest 5.1.0,
PostCSS 8.5.32 and pinned transitive fixes. The unused shadcn CLI was removed; its
already-used CSS and MIT license were preserved locally. Python fixes include
pip 26.2, pytest 9.0.3, python-dotenv 1.2.2 and sqlparse 0.6.0. Audit tooling and
its dependency closure are pinned in `requirements-dev.txt`.

After fixes, Python app/tooling and the separately pinned reranker requirements
both report no known vulnerabilities (exit 0). JavaScript still returns exit 1:
**two moderate tooling advisories**, zero critical/high/low. This is a
completed audit with disclosed residual findings, not a zero-findings result.

- [esbuild GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99):
  transitive 0.18.20 through Drizzle's legacy loader. Better Auth's optional
  `drizzle-kit` peer makes pnpm label this path non-dev; it is absent from the
  actual production server dependency traces. The affected esbuild HTTP
  development-server feature is not invoked by DocRAG's migrations or Next.js
  application. Fixed upstream at 0.25.0. Do not expose an esbuild serve process;
  prefer a maintained Drizzle loader update over an untested API-major override.
- [minimatch GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249):
  ESLint/tooling transitive versions 3.1.5 and 10.2.5. Fixed at 11.0.1. The advisory
  describes attacker-controlled glob preprocessing; DocRAG HTTP input never reaches
  lint glob configuration. Replacing every old callable API with the new major
  would risk breaking tooling. Treat repository/lint configuration as trusted.

These reachability conclusions apply to this repository's current paths. They
are not claims that the upstream packages are fixed. Re-audit before deployment
and when tool usage or dependencies change. No audit output is suppressed.

## Verification and remaining deployment work

`tests/security.test.ts` covers boundary failures; `scripts/security_http.py`
exercises the production server, actual accounts/sessions and isolated database;
`scripts/security_retrieval.ts` executes actual pgvector/keyword SQL and concurrent
quota calls. Old tests remain, including Gemini provider semantics and cancellation.
The security evaluation gate permits only declared security/dependency file
changes, requires identical retrieved evidence for all 100 questions and calls the
unchanged numerical regression check. Old prompting gates and negative controls
are retained separately.

See the Step 7 report for actual final results; unfinished checks must not be
interpreted as passes. This step does not deploy the project or make local Ollama
available to recruiters online. HTTPS hosting and durable services require a later
deployment decision, while preserving these ownership checks and test coverage.
