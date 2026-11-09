# STEP 10 load protocol (in progress)

STEP 10 is not complete. STEP 11 is not authorized. No push or deployment.

## Prerequisite audit

The existing feat/production-rag checkout was clean at bb493dc. Independently
recomputed 210/210 STEP 9 source hashes matched, and all 27 saved final-e command
receipts had exit 0. Those are historical executions, not newly rerun tests.
Live owned native database identity (docrag_dev, checkout data directory,55433),
Ollama0.40.9, both frozen API model digests, and Docker-to-host connectivity passed.
DocRAG containers and the unrelated text-to-sql container were healthy. Remote
Actions remains NOT RUN — NO PUSH AUTHORIZED. STEP 9 audit did not restart services.

## Reproduction and isolation

Use existing Node24.22.1, pnpm11.25.0 and Python environment; no new dependencies.
From the repository root:

```sh
make load RUN_ID=step10-UNIQUE
```

Each invocation requires an unused run ID and creates a new owner-marked native
fixture database,50 operator-created random accounts, and a production Next server
on loopback8011. It copies only public documents and162 selected chunks into a new
empty database, applies existing migrations, and preserves that fixture database.
The ordinary app, Docker app/database and unrelated containers are never restarted.
The existing public fixture PDF generator supplies uploads. No real private account
or upload is used. Logs and database ownership markers remain ignored under .local.
Results contain only timings, response codes, random request IDs and resource data.

The app explicitly selects local Ollama, fixed step5-v1 prompt, disabled reranker,
and an enabled *test-process-only* public response cache. Production defaults stay
off. The golden question is warmed and replay-verified before each cached stage; non-manifest
questions measure BYPASS. No query labels, model settings, weights or thresholds
are changed. Real sign-in obtains every fixture cookie; the 30/300s global auth
quota is respected with Retry-After rather than resetting counters or bypassing
access controls. Fixture setup/warm-up are excluded from measured traffic.

## Workload and safety bounds

For5,20,50 virtual users, separately measure authenticated document listing,
session validation, cached chat, uncached streaming, cancellation after the first
SSE event, and public-text PDF uploads. Current VUs repeat requests with1s think
time, arrive over5s, and run through a15s hold followed by bounded drain. The
original step10-a used one operation per VU and remains historical burst evidence.
Neither protocol certifies endurance or maximum capacity. All users may be active/queued; at most two client model/upload/cancellation
requests are admitted simultaneously. Report this cap alongside user counts.
Client waiting time is measured separately from HTTP latency. There is a60s socket
operation timeout and180s client admission timeout. The window includes drain and
idle observation time, so throughput must use the reported elapsed duration.

Unexpected request failures, missing telemetry, cache-mode mismatch or cancellation
accounting failure stop further stages. HTTP429 responses remain visible errors
and are not relabeled successful throughput. App RSS above2GiB or a resource-probe
failure stops admission. Only the owned temporary app process is terminated at exit.
The script never unloads models, disables quotas, drops databases, prunes Docker or
modifies another project's resources. Two concurrent local inference operations
still consume shared host CPU/GPU; this is not hardware-level resource isolation.

## Measurements and interpretation

Reports include all request status/latency/queue samples; throughput and successful
throughput; p50/p95/p99 with linear interpolation; errors and rate-limited counts.
The full server stream must finish without an error frame to count as successful.
Existing request telemetry supplies retrieval-stage timings, first-token latency
and model-generation duration. Cancellation must yield no rateable answer receipt.

CPU percentages and RSS are sampled once per second for the temporary app, owned
native PostgreSQL process tree and Ollama process tree. PostgreSQL connections are
scoped to the fixture database; the monitoring connection is included. CPU readings
come from macOS ps and are not isolated per-request usage; RSS may double-count
shared pages and does not establish GPU memory use. Host load averages are context,
not causal attribution. Co-resident projects can affect timing. Small-sample tail
percentiles are descriptive only, especially at5 users.

Detailed results, bottleneck analysis, regression evidence and final confirmations
will be added only after actual verification. Earlier failed attempts must remain.

## Existing performance evidence

The inventory receipt lists preserved cache HTTP, paired model-cold/warm, and
retrieval profile measurements. Cache HTTP was sequential matched public traffic;
first miss meant empty application cache, not cold GPU/OS. Cold/warm used six
questions and explicit model unloading; it did not flush OS caches. Retrieval
profiles used the frozen development/holdout selection. None establishes concurrent
5/20/50-user throughput, so none is treated as a before/after optimization baseline.
The STEP 8 instrumentation overhead sample also ran with concurrent evaluation and
was observational rather than a controlled causal comparison. No Locust or other
load framework is installed; standard-library HTTP/concurrency avoids adding one.

## Resume prerequisite failure — 8 November 2026

The initial18 burst stages completed450 requests with zero errors; raw evidence is
loadtest/step10-a.json and derived metrics are docs/step10/burst-summary.json.
The subsequent full step10-final-a verifier completed27/27 groups before the
interruption. These are saved executions, not fresh checks on resume.

On resume, Ollama's version API returned0.40.14 (required0.40.9); native database
status failed with make exit2, pg_ctl reporting no server running. Docker app/DB
and the unrelated database were healthy. No services were modified. Further work
stopped as required. Sustained lightweight-user measurements and final acceptance
remain pending; the burst alone is not sufficient for STEP10 completion.

## Sustained protocol, step10-b

Commit19da816 replaces the single-operation VU with repeated closed-loop requests.
All VUs arrive over5s and remain active until the end of an additional15s hold;
think time is1s after each request. At least one operation per VU is attempted.
Requests admitted/queued before the end can drain afterward; every observed wait
and failure is retained. Per-stage duration therefore includes actual drain time.
This is a short sustained test, not an endurance or maximum-capacity certification.
The same model cap2, socket timeout60s, admission timeout180s and RSS guard remain.
Model identities are now verified inside the harness before setup as well as by
independent pre/post checks. No production application optimization was made.

The initial burst is retained as a separate protocol, not a before/after speedup
claim. Its69.2s p95 client wait was imposed by admitting50 arrivals over5s to two
model slots; server generation itself took seconds, while cached/read stages took
milliseconds. Raising shared Ollama parallelism or weakening quotas is not justified
by these capped measurements. Sustained runs will expose the existing quota effects
without resetting counters. Authentication means session validation in the workload;
real sign-in/setup remains separately quota-paced and excluded from its latency.

## Failed sustained run and correction

Run step10-b stopped at stage15/18: the50-user cached stage saw489 HITs, one MISS
and one BYPASS_BUSY among successful responses. The unchanged five-minute cache
TTL had elapsed since initial warm-up. Its strict cache assertion correctly failed;
no resource abort or non429 HTTP failure occurred. Raw data remain immutable in
loadtest/step10-b.json, with summary in docs/step10/sustained-b-rejection.json.
Commit af5bea3 warms and verifies the entry immediately before each cached stage,
outside measurement. It changes only test setup, not caching policy or assertions.
The new run step10-c uses a new database and result path.

HTTP429 includes both quotas and the existing global two-work-item admission
limit shared by chat and uploads. The historical JSON key rate_limited counts all
429s; it does not distinguish causes. Server authorization timing on a rejected
chat indicates rejection after quota/authorization and is evidence for the work
limit. Error bodies were deliberately not saved, so an exact per-cause breakdown
is unavailable. Successful throughput excludes every429; latency distributions
include them unless explicitly labeled success-only. Accounts and quota windows
carry across stages; stage order and warm model state confound cross-user-count
comparisons. Do not describe burst-to-sustained differences as an optimization.

## Scope of the measurements

Authentication load is GET session validation with real authenticated cookies,
not a password-hashing/login capacity test. Login during setup obeys its global
quota and is excluded from stage throughput. Upload uses one small synthetic PDF;
large-document capacity is not established. Cancellation closes after the first
SSE event, while the mandatory regression suite covers later cancellation stages.
Retrieval latency is observed inside actual chat requests, not an unprotected
standalone retrieval endpoint. Cached-stage retrieval still computes the eligible
context and its hashes before replay. These scopes keep ownership and existing
cache eligibility intact. No production latency SLO or maximum-capacity target was
supplied; completion of the measurement task must not be advertised as zero-error
service at50 concurrent model generations.

The session-validation route calls consumeLimit('read', null) before checking the
session, so it shares the anonymous-global120/minute bucket even for the isolated
authenticated accounts. Its high20/50-user rejection rate is an explicit policy
constraint, not evidence that database authentication is slow. Per-user uploads
allow5/300s and chat30/60s. Chat acquires one of two expensive-work slots after
authorization and before retrieval/cache lookup; eligible cache hits can therefore
receive busy429s too. The measurement preserves all of these controls. Changing
identity accounting, admission placement or model concurrency would need separate
security/capacity design evidence; none is justified as a safe STEP10 optimization.

## Latest acceptance checkpoint — 9 November 2026

SustainedC exited0 and passed18/18 stage validations. See step10/measurements.md
and step10-c-summary.json for all6,819 requests,2,474 HTTP429 errors, timings and
resources. All reported non-successes were429; this is not zero-error capacity.
The corrected cache setup passed; rejectedB remains preserved.

Fresh final-b passed27/27 contract groups,201 Python and221 TypeScript tests,
35 focused gate negative controls,66 security HTTP checks,27 SQL/quota checks and
138 observability assertions. Full100-question SQL retrieval reran, with100 cached
answers/judgments and no fresh evaluation generation. Recall@5 .975, faithfulness
.995, correctness .985 and260/260 citations; unchanged .02 gate passed. Load streams
were actual local model calls, separate from the cached evaluation.

make cov exited0:unit scripts356/1695=21.00%, TS statements66.17%. Independent
integration coverage1131/1695=66.73% failed unchanged70% (make exit2). Container
coverage was not yet collected. The container suite then exited1 on its first
read-only SQL identity check because the Docker daemon socket was missing; no
container restart or mutation occurred in that attempt. A host-level check also
found native PG stopped and Ollama refusing connections. The cause is unknown.
Earlier successful recovery and bounded isolation receipts do not establish current
health. STEP10 is NOT COMPLETE; current model confirmation, container verification,
coverage and final acceptance remain. Shared Docker Desktop startup permission is
pending; native/Ollama recovery was previously authorized with safety conditions.

Raw JS audit exit1 with the two moderate esbuild/minimatch advisories; audit policy,
main Python and optional reranker checks exited0. Remote Actions NOT RUN, no push.
Saved detailed command receipts and source hashes are in step10/final-b-verification.json
and step10/final-b-source-hashes.json; private logs remain under.local.
