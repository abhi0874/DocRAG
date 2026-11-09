# STEP 10 COMPLETE — local acceptance, 9 November 2026

12/12 tasks complete. Mandatory local acceptance passed at implementation revision
f2497ff. No STEP11, GitHub push, PR, merge, deployment or paid API call occurred.
Completion covers reproducible measurement and verification; it does not certify
acceptable50-way generation latency, zero policy rejections or endurance capacity.

## Tasks and evidence

| Task | Result |
| --- | --- |
| 1 Audit | STEP9 saved27-group/source audit and live ownership/model checks; historical timing inventory retained |
| 2 Harness | Standard-library HTTP/concurrency tool; repeatable run IDs, private isolated accounts/public fixtures |
| 3 Sustained5/20/50 | Fresh step10-d18/18 stages;5s ramp,15s hold,1s think, bounded drain |
| 4 Measurements | RPS, successful RPS, p50/p95/p99, queue, errors, CPU/RSS, DB connections, retrieval/generation/first token |
| 5 Workloads | Separate read, session validation, cached, uncached streaming, early cancellation and small PDF upload |
| 6 Safety | Client model cap2, timeouts/RSS guard, new owned database; unrelated stopped container preserved |
| 7 Local inference | Ollama0.40.9, cloud off, loopback11434; host/container connectivity and both digests verified |
| 8 Bottlenecks | Model queue and admission/quota limits measured; no unjustified production optimization |
| 9 Preservation | App/lib/db/config/defaults unchanged; authentication, ownership, citations, cache, metrics and feedback checks pass |
| 10 Verification |27/27 groups,429 unit tests,26 container checks,70% coverage gate,100-question evaluation and unchanged regression gates |
| 11 Documentation | Reproducible commands, actual observations, failures and limitations retained in LOAD_TESTING.md and step10/ |
| 12 Local acceptance | Secret scan, exact staging/source checks and local evidence commit; no publication |

## Final measurements

Fresh loadD:6,795 requests,4,315 successful,2,480 HTTP429 errors (36.50%). No other
request failures. All18 stage validation groups passed, including cache mode,
telemetry completeness and cancellation without answer receipts.

| Users | Streaming successful RPS | HTTP p50/p95/p99 seconds | Queue p95 seconds |
| --- | ---: | --- | ---: |
| 5 |1.643 |0.293 /4.852 /5.257 |5.067 |
| 20 |1.179 |1.659 /2.943 /3.361 |14.559 |
| 50 |0.658 |2.995 /4.959 /5.520 |74.737 |

All streaming requests succeeded. Other workload429s remain errors, not successes.
The50-user stage drained for94.24s. Peak fixture DB connections8 (including monitor),
peak app RSS477.92MiB. Complete workload/resource/server distributions are in
[measurements-d](step10/measurements-d.md) and step10-d-summary.json; raw data are
loadtest/step10-d.json. Host:Apple M5 Pro,18 CPUs,48GiB RAM,macOS27.3; pinned
Node24.22.1, pnpm11.25.0, Python3.14.6 and Ollama0.40.9.

Queueing remains a capacity limitation: the earlier burst p95 was69.19s and
sustainedC75.22s. There is no claimed production speedup. The client two-slot
bound, server two-work-item bound and existing quotas were retained. Session
validation has a global120/minute quota; uploads5/300s per user. No evidence
justified weakening these controls or changing model/RAG configuration.

## Verification and evaluation

Fresh final-c:27/27 command groups, exit0;208 Python +221 TypeScript tests.
Also passed:35 focused gate negative controls,66 real HTTP security checks,
27 actual SQL/quota checks,138 observability assertions,26 container lifecycle
checks, lint/typecheck/build, citation/cache/streaming/cancellation/invalidation,
feedback privacy, golden/corpus/history preservation and dependency audit policy.
Seven new isolation tests are included in the208 Python total, not added twice.

Integration coverage1266/1703=74.34%, exit0, unchanged>=70% gate and no excluded
statements. Unit-only Python377/1703=22.14%; TypeScript statements66.17%,
branches64.82%, functions59.28%, lines68.05%. make cov exited0. Fresh coverage
collection includes container/load/full integration work at the final source layout.

The100-question evaluation reran SQL retrieval and reused100 compatible cached
embeddings, answers and judgments, with zero misses. These are not fresh evaluation
generations. Actual load streams called local Ollama separately. Recall@5 .975,
faithfulness .995, correctness .985, supported citations260/260. Both the original
compatibility gate and an extra STEP9-final-e comparison passed, with identical
evidence for all100 questions and unchanged .02 decline thresholds.

Detailed commands, individual exit codes, coverage, source hashes and audit receipts
are in step10/final-c-verification.json and related files. Private logs remain
.local/observability-verify-step10-final-c and .local/step10-*.

## Recovery, failures and safety

Earlier services became unavailable; cause remains unknown. User-authorized normal
Docker startup restored DocRAG under its existing policies. The unrelated database
remained stopped; it was never explicitly started/stopped/reconfigured. Native
owned PostgreSQL started via pg_ctl only, with no initialization/migration during
recovery. No existing Ollama process required termination; the preserved verified
binary started on loopback with cloud disabled and existing unchanged models.

Container test f2497ff removes an invalid requirement to start the unrelated DB.
It instead preserves the observed stopped or healthy-running state and compares
more lifecycle/configuration fields. All26 lifecycle tests passed; final bounded
comparison confirms the unrelated service remained unchanged. This does not
attribute or erase historical start-time discrepancies.

Rejected loadB is preserved: cache TTL expired before the50-user cache stage.
af5bea3 warms/replay-verifies each cached stage without changing TTL or assertions.
The earlier66.73% coverage gate failure and Docker-unavailable suite attempt are
also retained. They are not relabeled as passes; freshD/final-c supersede them.

## Limitations and confirmations

These short closed-loop trials are not endurance or maximum-capacity guarantees.
Only two model requests are admitted concurrently; all50 VUs may be queued.
Session validation is not login/password-hashing capacity; uploads use a small
public fixture; early cancellation is supplemented by later-stage regression tests.
Quota history, stage order and model warmth confound cross-stage comparisons.
Process CPU/RSS is observational; RSS is not GPU memory. No latency SLO was supplied.

Raw JavaScript audit exits1 for two reviewed moderate tooling advisories:
esbuild GHSA-67mh-4wv8-2f99 and minimatch GHSA-g3hv-75wg-m249. Audit policy passed;
Python and installed optional reranker audits exited0. Not a zero-vulnerability claim.
Remote GitHub Actions NOT RUN—NO PUSH AUTHORIZED. Linux CI remains historical
STEP9 evidence; workflow/production sources are unchanged. Browser evidence is
historical. No hosting/deployment claim is made.

CONFIRMATION1—TESTING:PASS.
CONFIRMATION2—DOCKER AND OTHER-PROJECT ISOLATION:PASS.
CONFIRMATION3—CI/GITHUB SAFETY:PASS locally; remote Actions deferred, no push.

Local implementation commits:1f8eaa4,19da816,af5bea3,f2497ff. Checkpoint86748d1
preserves rejected and partial work. Resolve the final evidence commit with
`git log -1 --format=%H -- docs/STEP10_COMPLETE.md`; post-commit Git status is
reported in the final response. Golden100, selected162 chunks, models, historical
results and all prior commits remain preserved. No mandatory local work remains.

STEP 10 COMPLETE
No errors found and all tasks completed.
Can proceed to the next step.

These confirmations concern mandatory local verification; measured capacity limits
and disclosed advisories remain above. STEP11 requires explicit authorization and
was not begun.
