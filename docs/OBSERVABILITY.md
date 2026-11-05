# Observability and feedback

DocRAG records what happened to a request without recording private questions,
answers, document titles, passwords, session cookies or API keys in application
logs. All telemetry stays in the local application and PostgreSQL; the previous
remote analytics component is removed. Verification status is recorded separately
in `STEP8_STATUS.md`; implementation alone does not establish a passing result.

## Request lifecycle and logging

`lib/observability/http.ts` wraps API handlers. Each request receives a fresh
server-generated UUID, returned in `X-Request-ID`. Incoming IDs are not trusted.
AsyncLocalStorage propagates the same trace through authentication, validation,
authorization, retrieval and model setup. The chat SDK's assistant message ID is
the same server UUID, allowing feedback to reference the actual completed answer.

JSON events are allowlisted: `request.started`, `stage.finished`,
`request.finished`, `metrics.written`, and `metrics.failed`. Fields contain fixed
route templates, method, safe categories, durations, provider and cache status.
They omit request/response objects, raw exceptions, user IDs, headers and content.
Persistent metric-write failures have a counter and diagnostic event; they do not
replace a successful application response with a database exception. Idle pool
errors emit `metrics.pool_failed` without connection details.

The final outcome is `completed`, `failed` or `cancelled`. HTTP status and outcome
are independent: a stream can deliver status 200 and then disconnect. Such a
stream is cancelled, has no rateable answer receipt and cannot enter the cache.
A cancellation racing the bounded metric write updates the same UUID row rather
than inserting another request. Terminal logging occurs once. Cancellation after
a completely consumed response no longer changes its outcome.

Before retrieval and after awaiting retrieval, the route checks the request
signal. Database retrieval already underway is awaited; it is not abandoned or
represented as immediately cancelled server work. Generation receives the
combined request/disconnect signal. On disconnect, inference is aborted and SDK
terminal frames are drained for cleanup. Only an error associated with that
aborted signal is handled as expected teardown; unrelated errors remain failures.

## Node runtime correction

The exact original error was `AbortError: This operation was aborted` from chat
cancellation, with 51 passing assertions but Vitest exit 1. A diagnostic
`async_hooks` observer identified the rejected promise as the result of
`writableStreamDefaultWriterWrite` at Node's internal
`PipeToReadableStreamReadRequest[kChunk]` (readablestream line 1733). Node 26.5.0
marks the already-rejected promise handled internally without attaching a real
reaction, leaving its rejection notification pending. The public pipe rejection
can be caught while this extra notification still fails the process.

The same issue is documented upstream at
<https://github.com/nodejs/node/issues/64561>. An independent two-chunk stream
reproduction exits 1 on Node 26.5.0 and 0 on Node 24.22.1. The unchanged 51-test
focused suite also exits 0 on 24.22.1. The project pins that runtime rather than
suppressing rejections or weakening cancellation. `tests/node-stream-runtime.test.ts`
runs the standalone failure in a child process under normal rejection rules.
The diagnostic observer is ignored local evidence, not application/test setup.
No global rejection handlers or test-runner suppression flags were added.

See `COMMAND_CONTRACT.md` for the checksum-verified project-local installation,
PATH selection and removal instructions. The system Node installation is untouched.

## Measurements

Wall-clock UTC timestamps identify events. `performance.now()` measures durations.
Stored `latency_ms` ends when the response producer reaches EOF/cancellation,
before the metrics write; `metrics.written.duration_ms` measures that write.
The final JSON log's elapsed time also includes persistence. Neither claims to
measure when the remote browser painted the last token. HTTP EOF is delayed by
the bounded write, so feedback is available when the client observes completion.

Available retrieval timings include query embedding, vector and keyword searches,
database wall time and fusion. Concurrent search durations are not summed as
sequential elapsed time. Model setup and generation are separate. Time to first
text token is measured from request start; it is unavailable when no token arrives.
Reranking stays disabled by default. Cached answers still perform authorized
retrieval and cache validation; their faster response is not faster generation.

Only SDK-reported integer input/output/total token counts are retained. Missing
usage is null, not zero. The evaluation comparison route sums its two model calls
only when both report the corresponding count. Ollama calls have estimated paid
API charge ₹0; unpriced Gemini usage is unknown, not fabricated. Token count is
not a money calculation. For public cache hits, generation is skipped, one model
call is avoided and prior reported tokens are labelled `tokens_avoided`; current
model usage remains null. Embedding token usage is not included in answer-token
totals. Failed/partial requests can have unknown usage, and the dashboard does
not present known token totals as comprehensive spending.

## Database and ownership

The existing Drizzle workflow adds three tables:

- `request_metrics`: primary key request UUID, nullable authenticated owner,
  timestamp, route, status, outcome, latency, provider/model, token counts and safe
  stage details. An owner/time index serves the protected dashboard.
- `answer_receipts`: primary/foreign key request UUID, verified owner and document,
  document/answer hashes, prompt/model identifiers and evidence chunk IDs. Private
  text is not retained. Only a single-turn allowlisted public benchmark question
  can retain a bounded public answer and question hash for export.
- `answer_feedback`: one row per receipt, authenticated owner, `up`/`down`, created
  and updated timestamps. Repeated votes update the same row.

Foreign keys remove receipts/feedback when their request or document is deleted.
Deleting a user cascades their telemetry; existing document ownership restrictions
still apply. Ordinary account management was not redesigned. Metrics contain an
internal owner ID needed for access control, but logs and export omit it.

Writes use a separate pool of at most two connections, at most 32 pending writes,
a 500 ms connection/statement timeout and 600 ms query timeout. There is no
unbounded retry queue. Several bounded statements can contribute to total write
latency. A database outage can lose telemetry; the safe failure event makes that
visible. Retention is manual: operators should review counts and age distributions
before authorizing deletion. No scheduled purge or legacy-data deletion is added.

The migration verifier creates a new database from an immutable Step 7 test seed,
adds a synthetic session there, then applies migrations twice. It compares hashes
and counts for all 11 legacy tables, including embeddings, users and private file
bytes. Application databases are migrated only after this isolated test passes,
and their security rows are independently compared. DocRAG uses its owned native
cluster on configured port 55433; the other project's port 55432 is untouched.

For rollback, first stop this project's server, retain a database backup and
review the application commit to revert locally. Leave the additive tables in
place; an old application ignores them. Do not delete auth/document tables or
rewrite migration history. Dropping telemetry tables would delete feedback and
requires a separate explicit decision and backup; no destructive rollback is
executed by this step.

## Dashboard and feedback

`/metrics/dashboard` requires a server-validated Better Auth session.
`GET /api/metrics?hours=1|24|168` always filters by that session's user ID; extra
owner/admin parameters are rejected. Results include counts, mean/median/p95,
cache hit/miss rate, reported tokens, providers, errors, hourly counts and recent
safe route summaries. Reads use one read-only repeatable-read transaction and
exclude dashboard requests from the displayed aggregates. Missing values display
as unavailable. There is no public/global metrics endpoint or invented admin role.
A trusted local operator may use read-only SQL for system-wide diagnostics.

Completed assistant messages show accessible thumbs-up/down controls. Feedback
reads/writes require a real completed receipt, the same authenticated owner and
current document access. POST additionally enforces origin, strict UUID/value
schema, a 4 KiB body limit, atomic upsert and 60/minute quota. Cancellation or a
removed document makes the receipt unavailable. No client owner is accepted.
Full sign-in/sign-out navigations clear private client state. Stop response calls
the existing chat SDK's cancellation API without changing message/citation parsing.

## Review candidates

`scripts/feedback_to_eval.py` uses the owned local test database marker and read-only
SQL. It exports negative public feedback only after verifying the saved public
manifest, current complete document snapshot, known question hash, answer hash
and evidence IDs. Private feedback is excluded even when negative. It creates a
new mode-0600 JSONL file under ignored `.local/feedback-review`; existing outputs
and other destinations are rejected. Every candidate has provenance,
`review_status: review_needed`, and `ground_truth: false`. Export never edits the
100-question golden set and does not establish human review or factual accuracy.
The current command intentionally does not accept arbitrary remote database URLs.

## Verification and limitations

The sequential command-contract runner includes existing security, citation,
cache, reranker and preservation checks, new real HTTP feedback/metrics tests,
the full 100-question evaluation and unchanged regression thresholds. Browser
checks are separate. Final observed counts and latency measurements belong in
the final report after execution. The pre-instrumentation latency sample was
collected under a different concurrent workload; a before/after difference is
observational and must not be claimed as a controlled causal overhead estimate.
Metric-write durations provide a direct measurement of persistence cost.

Automated faithfulness/correctness and citation-support scores are not a guarantee
of perfect answers. Existing prompt/retrieval limitations remain unchanged.
The prior JavaScript audit disclosed moderate tooling advisories in esbuild and
minimatch. Raw audit exit 1 must remain visible even if production reachability
is absent. Consult the final current audit evidence before claiming acceptance.
