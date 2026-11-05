# Step 8 prerequisite audit — PASS

The full Step 7 verification runner completed all 24 groups with exit 0 before
Step 8 implementation. Run ID: `step8-prerequisite-a`. All 345 tests passed,
66 real HTTP checks and 27 SQL checks passed, and a fresh 100-question evaluation
passed the unchanged regression gate. Every answer and judge call was a cache miss.
The raw JavaScript audit remains exit 1 with the same two reviewed moderate findings;
both installed Python environment audits returned exit 0.

## Database isolation

The previous private DATABASE_URL targeted port 55432. Read-only process inventory
identified `text-to-sql-db-1` owning that port through Docker. Port 55433 was free.
The existing DocRAG cluster was started on 55433; `SHOW data_directory`, `SHOW port`
and `current_database()` confirmed this checkout's `.local/postgres`, 55433 and
`docrag_dev`. No Docker container was stopped or changed for Step 8.

Local commit c58f5f2 adds explicit `DOCRAG_POSTGRES_PORT` configuration (default
55432) and requires matching connection URLs. It retains loopback-only and database
name restrictions. The migration setup also checks the actual server data directory
before any DDL. The private `.env` now selects 55433. Its credentials were neither
printed nor committed. The old initialized databases are reused, never reset.

The first formatting check reported that native_db.py needed Ruff formatting.
That was corrected before the full verification restarted from lint. No security
assertion or test was removed. The expanded suite has 345 tests (162 Python and
183 TypeScript); the new case tests the explicit-port boundary.

## Citation-count reconciliation

The authoritative files are `eval/results/prompting/step5-v1.json` (273/273) and
`eval/results/security/step7-final-b/evaluation.json` (261/261).

37 generated answer texts differ. Twelve questions have different citation
occurrence counts, summing to a net change of -12. The metric implementation hash,
metric definitions and all 100 ranked evidence sequences are identical. Effective
rendered prompts passed 200/200 byte-equivalence checks against the measured Step 6
implementation. Model settings and all other configuration fields are unchanged;
`application_file_hashes` is the sole differing top-level configuration field.

The local evaluation cache key in `eval/local_adapter.ts` includes the complete
configuration, including application file hashes. Step 7 implementation changes
therefore use a distinct cache namespace. Saved generation timestamps show new
answer generations. Both old and new text hashes/timestamps were matched to the
actual local cache files for every changed answer. Step 7's final repeat reused
its newer answer versions, not the old Step 6 generations. Equal aggregate support
percentages do not mean the responses or their citation counts were identical.

The per-question comparison is saved separately without altering either baseline.
This establishes answer-version differences; it does not prove perfect factual
support or the precise hardware/numerical cause of generation variability.

## Existing instrumentation inventory

Retrieval already reports embedding, vector, keyword, database-wall, fusion and
selection timings to an optional observer. Evaluation already saves token usage,
latency, configuration hashes and cached-generation provenance. The Ollama adapter
provides prompt_eval_count/eval_count; the SDK surfaces finish usage. These should
be reused, not duplicated or treated as measured zeros when unavailable.

Application routes do not yet have structured logs, server request correlation,
a request_metrics table, a feedback table or a protected metrics dashboard. The
SDK supplies assistant message IDs, but there is no server-owned persisted answer
receipt for feedback authorization. Existing errors are deliberately generic and
Better Auth's logger is disabled. Existing auth, upload and SQL guards remain.

The root layout includes Vercel Analytics in production. Step 8 must remove this
existing remote analytics integration to satisfy the local-only telemetry rule.

## Dependency review

The two saved moderate advisories were independently checked against GitHub's
current advisory pages on 4 November 2026:

- esbuild 0.18.20: GHSA-67mh-4wv8-2f99; fixed at 0.25.0. The affected API is
  esbuild's development HTTP server, which DocRAG does not start. The optional
  Drizzle CLI dependency must remain absent from production server traces.
- minimatch 3.1.5 and 10.2.5: GHSA-g3hv-75wg-m249; fixed at 11.0.1. The affected
  surface is attacker-controlled glob preprocessing; HTTP input does not reach
  the repository's lint glob patterns.

Sources: https://github.com/advisories/GHSA-67mh-4wv8-2f99 and
https://github.com/advisories/GHSA-g3hv-75wg-m249. Fresh audits and production-trace
checks passed the existing disclosed risk policy in the prerequisite runner. Raw JavaScript exit 1 must remain
reported as two residual findings, not a zero-findings audit.

Fresh evaluation metrics:

```json
{
  "recall@3": 0.95,
  "recall@5": 0.975,
  "recall@10": 1.0,
  "mrr": 0.9729166666666667,
  "citation_accuracy": 1.0,
  "citation_supported": 262,
  "citation_denominator": 262,
  "faithfulness": 0.995,
  "correctness": 0.985,
  "p50_latency_ms": 5952.969167,
  "p95_latency_ms": 12032.964230949998,
  "answerable_count": 80,
  "unanswerable_count": 20,
  "tokens_per_query": 6687.07,
  "tokens_unavailable_reason": null,
  "estimated_cost_per_query_usd": 0,
  "cost_unavailable_reason": null,
  "answer_tokens_per_query": 1717.23,
  "judge_tokens_per_query": 4941.9,
  "retrieval_p50_latency_ms": 41.03281299999995,
  "retrieval_p95_latency_ms": 43.98281810000003,
  "generation_p50_latency_ms": 5905.7120415,
  "generation_p95_latency_ms": 11989.416950299998
}
```
