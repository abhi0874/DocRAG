# Final sustained load measurement — 9 November 2026

Source:loadtest/step10-d.json; derived distributions:step10-d-summary.json.
Source revision:f2497ff. Command exit0;18/18 stage validation groups passed.
Requests:6795; HTTP429 errors:2480 (36.50%); no other request failures.
Protocol:5s ramp,15s hold,1s think, two client model/stream/cancel/upload slots,
60s socket timeout,180s client admission timeout, bounded drain included.
These are short sustained closed-loop observations, not endurance or maximum-capacity certification.
Hardware/runtime:host-d.json. Existing public fixtures,50 isolated accounts and a new owned test DB.

| Users | Mode | Requests | Total RPS | Successful RPS | HTTP p50 / p95 / p99 ms | Error % | Queue p95 ms |
| --- | --- | ---: | ---: | ---: | --- | ---: | ---: |
| 5 | read | 90 | 4.499 | 4.499 | 13.40 / 17.11 / 21.70 | 0.00 | 0.00 |
| 5 | authentication | 90 | 4.487 | 4.487 | 10.57 / 14.82 / 16.06 | 0.00 | 0.01 |
| 5 | cached | 90 | 4.499 | 3.199 | 32.23 / 60.96 / 66.68 | 28.89 | 0.00 |
| 5 | streaming | 33 | 1.643 | 1.643 | 292.73 / 4852.16 / 5256.99 | 0.00 | 5067.33 |
| 5 | cancellation | 90 | 4.499 | 2.149 | 12.64 / 47.09 / 50.88 | 52.22 | 21.65 |
| 5 | upload | 90 | 4.499 | 1.100 | 6.67 / 111.12 / 118.78 | 75.56 | 0.05 |
| 20 | read | 360 | 17.996 | 17.996 | 10.87 / 14.15 / 18.14 | 0.00 | 0.00 |
| 20 | authentication | 360 | 17.994 | 5.998 | 6.70 / 10.20 / 11.00 | 66.67 | 0.00 |
| 20 | cached | 349 | 17.444 | 14.145 | 32.94 / 55.21 / 58.29 | 18.91 | 0.00 |
| 20 | streaming | 39 | 1.179 | 1.179 | 1659.31 / 2942.94 / 3361.07 | 0.00 | 14559.48 |
| 20 | cancellation | 350 | 17.494 | 17.494 | 24.67 / 44.74 / 47.56 | 0.00 | 22.20 |
| 20 | upload | 355 | 17.745 | 2.849 | 5.74 / 90.42 / 104.81 | 83.94 | 2.49 |
| 50 | read | 895 | 44.700 | 44.700 | 7.48 / 12.53 / 14.41 | 0.00 | 0.00 |
| 50 | authentication | 895 | 44.704 | 5.994 | 4.61 / 8.84 / 9.78 | 86.59 | 0.00 |
| 50 | cached | 877 | 43.790 | 36.100 | 30.46 / 36.74 / 40.59 | 17.56 | 0.00 |
| 50 | streaming | 62 | 0.658 | 0.658 | 2994.67 / 4959.41 / 5520.19 | 0.00 | 74736.79 |
| 50 | cancellation | 880 | 43.976 | 43.976 | 21.52 / 25.77 / 30.03 | 0.00 | 1.28 |
| 50 | upload | 890 | 44.485 | 4.199 | 3.36 / 82.23 / 89.28 | 90.56 | 5.74 |

All-response HTTP latency includes cheap429s and excludes client queueing.
The JSON also reports success-only HTTP latency, end-to-end latency and queue p50/p95/p99.
Its server distributions include retrieval, generation and first-token latency. Missing fields remain null.

| Users | Mode | Retrieval p95 ms | Generation p95 ms | First token p95 ms | Peak DB connections | App RSS MiB | App CPU % |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 5 | read | N/A | N/A | N/A | 8 | 202.22 | 6.6 |
| 5 | authentication | N/A | N/A | N/A | 8 | 173.89 | 12.0 |
| 5 | cached | 40.04 | N/A | N/A | 8 | 215.64 | 20.8 |
| 5 | streaming | 68.34 | 4778.38 | 4734.46 | 5 | 215.48 | 10.5 |
| 5 | cancellation | 38.12 | N/A | N/A | 6 | 201.22 | 9.7 |
| 5 | upload | N/A | N/A | N/A | 5 | 220.70 | 12.4 |
| 20 | read | N/A | N/A | N/A | 8 | 228.72 | 8.8 |
| 20 | authentication | N/A | N/A | N/A | 8 | 276.69 | 6.1 |
| 20 | cached | 36.19 | N/A | N/A | 8 | 288.38 | 21.1 |
| 20 | streaming | 62.17 | 2900.46 | 2847.54 | 5 | 285.95 | 11.5 |
| 20 | cancellation | 35.96 | N/A | N/A | 5 | 289.14 | 14.4 |
| 20 | upload | N/A | N/A | N/A | 6 | 289.23 | 9.7 |
| 50 | read | N/A | N/A | N/A | 8 | 288.47 | 33.0 |
| 50 | authentication | N/A | N/A | N/A | 8 | 289.17 | 16.1 |
| 50 | cached | 24.94 | N/A | N/A | 7 | 282.73 | 34.6 |
| 50 | streaming | 62.52 | 4897.86 | 4853.98 | 7 | 281.88 | 13.1 |
| 50 | cancellation | 22.66 | N/A | N/A | 5 | 472.94 | 25.0 |
| 50 | upload | N/A | N/A | N/A | 6 | 477.92 | 17.9 |

Resource samples are1s macOS ps process CPU/RSS, not per-request CPU or GPU-memory measurements.
Connections include the monitor and are scoped to the fixture database. Process-tree RSS may double-count shared pages.
- app: peak sampled summed RSS 477.92 MiB; peak CPU 34.6%.
- postgres: peak sampled summed RSS 199.31 MiB; peak CPU 10.6%.
- model_or_child: peak sampled summed RSS 2726.22 MiB; peak CPU 188.5%.

## Interpretation and retained failures

The50-user streaming stage drained for94.24s; HTTP p95 was4.96s, queue p95 was74.74s,
successful throughput0.658RPS and error rate0%. Existing two-slot client admission queues
users behind seconds-long generation. The server independently allows two expensive work items.
Cached requests also enter server admission before retrieval. Session validation shares120/minute
globally; uploads allow5/300s per user. Those controls explain policy pressure; they were not weakened.

Compared with sustainedC queue p95 75.22s and initial burstA69.19s, D does not establish a
production improvement. Protocol/state differences prevent a causal burst comparison. No application
optimization was justified without changing security/model limits or adding capacity. The measured
bottleneck remains. The harness fixes improved test validity, not production throughput.

B was correctly rejected when its single warm-up outlived the300s cache TTL. Per-stage warm-up
fixed the measurement setup; all assertions and TTL remain unchanged. Raw A/B/C/D evidence remains.
The first coverage gate failed66.73%; container coverage had been blocked by missing Docker.
Restoration and the stopped-service guard correction are documented separately; never relabel
that failed gate or unavailable-service checks as passes.

Authentication workload means real session validation, not password-hashing capacity. Uploads use
a small public PDF, not large-file throughput. Cancellation closes after the first SSE event; later
stages remain covered by regression tests. Accounts/quotas and warm-model state carry between
stages, so per-user-count comparisons are descriptive. See LOAD_TESTING.md for reproduction.
