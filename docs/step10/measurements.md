# STEP 10 sustained measurements — 9 November 2026

Source: `loadtest/step10-c.json`; derived distributions/resources: `step10-c-summary.json`.
Harness revision `af5bea3`; load command exit0.18/18 stages passed validation.
6,819 requests:4,345 successful and2,474 HTTP429 errors (36.28%); no other request failures.
PASS means protocol, cache/telemetry/cancellation and safety assertions passed.
It does not mean zero errors, acceptable production latency or50-way generation capacity.

Each stage:5s arrival ramp,15s hold,1s think; bounded drain included in duration.
Model/stream/cancel/upload client concurrency2; cached/read/session requests are uncapped by that semaphore.
All VUs remain active or waiting;50-stream stage drained to96.56s. These are short sustained
closed-loop measurements, not an endurance test. Rejected runB and original burstA remain intact.

| VUs | Workload | Requests | Successful RPS | HTTP p50/p95/p99 ms (all responses) | Error % | Queue p95 ms |
| --- | --- | ---: | ---: | --- | ---: | ---: |
| 5 | read | 90 | 4.488 | 12.39 / 16.01 / 17.02 | 0.00 | 0.00 |
| 5 | authentication | 90 | 4.499 | 12.70 / 15.30 / 15.92 | 0.00 | 0.01 |
| 5 | cached | 90 | 3.349 | 33.78 / 60.61 / 68.65 | 25.56 | 0.00 |
| 5 | streaming | 50 | 2.489 | 301.74 / 2413.76 / 3033.14 | 0.00 | 1816.71 |
| 5 | cancellation | 90 | 1.400 | 7.55 / 47.06 / 49.86 | 68.89 | 0.05 |
| 5 | upload | 90 | 1.100 | 7.35 / 112.65 / 117.23 | 75.56 | 6.39 |
| 20 | read | 360 | 17.981 | 8.47 / 14.29 / 17.29 | 0.00 | 0.00 |
| 20 | authentication | 360 | 5.998 | 6.43 / 10.63 / 11.91 | 66.67 | 0.00 |
| 20 | cached | 349 | 14.595 | 34.98 / 52.86 / 60.44 | 16.33 | 0.00 |
| 20 | streaming | 53 | 1.649 | 1014.40 / 2133.68 / 2438.15 | 0.00 | 11802.65 |
| 20 | cancellation | 350 | 17.495 | 24.82 / 45.48 / 48.49 | 0.00 | 23.46 |
| 20 | upload | 353 | 3.449 | 7.06 / 88.20 / 94.47 | 80.45 | 3.04 |
| 50 | read | 895 | 44.737 | 7.02 / 12.88 / 13.95 | 0.00 | 0.00 |
| 50 | authentication | 895 | 5.994 | 4.75 / 9.41 / 11.62 | 86.59 | 0.00 |
| 50 | cached | 877 | 35.523 | 30.56 / 39.08 / 47.24 | 18.93 | 0.00 |
| 50 | streaming | 63 | 0.652 | 3086.69 / 4991.88 / 5357.96 | 0.00 | 75216.48 |
| 50 | cancellation | 878 | 43.839 | 21.92 / 30.44 / 35.55 | 0.00 | 11.92 |
| 50 | upload | 886 | 4.348 | 3.64 / 81.36 / 90.60 | 90.18 | 2.95 |

HTTP latency excludes client admission queue; end-to-end distributions are in the summary JSON.
All-response latency includes cheap429s, which can lower percentiles. Success-only latency and
successful throughput are separately retained; do not count rejections as productive capacity.

## Resource and server timing evidence

| VUs | Workload | Retrieval p95 ms | Generation p95 ms | Peak fixture DB connections | App peak RSS MiB | App peak CPU % |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 5 | read | N/A | N/A | 8 | 205.52 | 7.0 |
| 5 | authentication | N/A | N/A | 8 | 177.55 | 4.4 |
| 5 | cached | 39.03 | N/A | 8 | 217.16 | 20.3 |
| 5 | streaming | 46.67 | 2362.50 | 6 | 218.16 | 9.4 |
| 5 | cancellation | 37.45 | N/A | 6 | 214.48 | 15.0 |
| 5 | upload | N/A | N/A | 5 | 219.06 | 6.7 |
| 20 | read | N/A | N/A | 8 | 248.80 | 14.6 |
| 20 | authentication | N/A | N/A | 8 | 274.91 | 22.4 |
| 20 | cached | 35.49 | N/A | 8 | 285.30 | 19.2 |
| 20 | streaming | 56.32 | 2081.67 | 6 | 284.55 | 3.1 |
| 20 | cancellation | 36.64 | N/A | 5 | 285.89 | 26.4 |
| 20 | upload | N/A | N/A | 6 | 285.23 | 8.6 |
| 50 | read | N/A | N/A | 8 | 286.12 | 30.0 |
| 50 | authentication | N/A | N/A | 8 | 288.41 | 13.8 |
| 50 | cached | 27.16 | N/A | 8 | 292.73 | 31.8 |
| 50 | streaming | 62.49 | 4917.27 | 7 | 286.95 | 7.7 |
| 50 | cancellation | 26.65 | N/A | 5 | 438.08 | 33.1 |
| 50 | upload | N/A | N/A | 5 | 450.83 | 27.1 |

Peak sampled app RSS450.83MiB; owned PostgreSQL tree202.55MiB; model tree10427.47MiB.
Peak fixture connections8, including the read-only monitoring connection. JSON contains all
process-group CPU/RSS peaks and raw1s samples. macOS ps CPU is an observational process
measurement; RSS can double-count shared pages and is not GPU memory or a leak guarantee.

## Bottlenecks and decisions

The original50-user burst queue p95 was69.19s. SustainedC queue p95 was75.22s, while
HTTP p95 was4.99s and successful throughput0.652RPS. The client two-slot bound queues arrivals
behind seconds-long model work. There is no measured improvement in this bottleneck.
The server independently limits expensive work to two slots, including cached requests
before retrieval. Session validation has a global120/minute quota; uploads5/300s per user.
These explain policy/admission rejection pressure. Database connection counts stayed bounded;
the measurements do not establish a database bottleneck.

No production optimization was applied: changing model concurrency, quality, quotas or security
would not be justified by this shared-host short trial. The verified improvement is to the test
protocol: burst-only coverage became repeated VUs, and per-stage warm-up repaired TTL contamination.
Do not claim a production before/after speedup across different protocols, prompt/model warmth,
stage order or quota history. Cache and reranker defaults remain OFF; architecture is unchanged.

Full correctness/security/evaluation acceptance is recorded separately after final verification.
