# Current status — account handoff

Created 6 November 2026, Asia/Kolkata. Repository: abhi0874/DocRAG.
Actual checkout: `/Users/abhisheshramadasshet/Documents/ChatGPT/DocRAG/RAG-Agent`. Branch: `feat/production-rag`.
Pre-handoff HEAD: `df312319d846616588dbde7c08e3066b67c1a811`. The documentation-only handoff commit is its child;
run `git log -1 --format=%H -- AGENTS.md docs/CURRENT_STATUS.md` to resolve that
commit without an impossible self-referential hash. Always inspect current HEAD.

**STEP 9 IN PROGRESS — NOT COMPLETE.** Steps 0–8 are historically complete (Step 1
is user-reported without a separate completion report). Steps 10–12 not started.
No full Step 9 task count is certified; partial task evidence is listed below.

## Preserved working tree

Staged files at inspection: **none**. Existing tracked modifications:

```text
app/evaluate/page.tsx
app/metrics/dashboard/page.tsx
lib/provider-config.ts
next.config.mjs
```

Existing untracked files (all preserved; not included in handoff commit):

```text
.dockerignore
Dockerfile
compose.yaml
docker/migrate.mjs
eval/results/observability/step9-prerequisite-b/evaluation-raw.json
eval/results/observability/step9-prerequisite-b/evaluation.json
tests/container-config.test.ts
```

The four new handoff documents are the only intended commit contents. The final
working tree must remain dirty with the implementation above. Never force it clean.
No prior AGENTS.md or subdirectory AGENTS.md was found in this checkout.

## Live read-only observations

- Node project-local 24.22.1; pnpm 11.25.0; Python .venv 3.14.6;
  Docker 29.9.2; Compose 5.6.1.
- `docrag-step9-app-1`: Up 4 hours, healthy, 127.0.0.1:8010 -> 3000.
- `docrag-step9-db-1`: Up 4 hours, healthy, internal 5432 only.
- `docrag-step9-migrate-1`: exited 0 (expected one-shot job).
- `text-to-sql-db-1`: Up 43 minutes, healthy, 127.0.0.1:55432 -> 5432.
  This belongs to another project. Do not stop/restart or alter it.
- **Native database stopped:** `make db-status` exit 2, `pg_ctl: no server running`,
  followed by `Native database action failed: CalledProcessError.` The fixed module
  entrypoint works; this is service unavailability, not the former import error.
  Native configured identity was previously verified as 127.0.0.1:55433 / docrag_dev;
  no live SQL connection was possible/claimed in this handoff. No service was changed.

## Evidence and blockers

Historical prerequisite: `.local/observability-verify-step9-prerequisite-b/complete.json`
records PASS, 27/27, and commands.json records every exit. Its full evaluator reused
100 embeddings/answers/judgments while rerunning retrieval. This preceded current
Step 9 code; it does not certify those modifications. Later `.local/step9-lint-a.log`
passed lint/typecheck; `.local/step9-test-a.log` records 181 Python and 221 TypeScript
passes (two additional container configuration tests). Full final run remains pending.

Initial coverage `.local/step9-coverage-initial.log`: Python 133/1313 statements,
rounded 10%, denominator scripts only; TS statements 66.09%, branches 64.41%,
functions 59.28%, lines 67.97%. Python target >=70% is NOT met. Do not shrink the
denominator or describe integration helpers as covered without measurement.

Docker first build failed at /evaluate prerender: HTTPS required. force-dynamic
pages fixed build-time auth initialization. Next rebuild was interrupted by missing
Docker daemon; reopening installed Docker allowed `.local/step9-docker-build-c.log`
to finish successfully. These are distinct diagnoses, not three failed repairs.
Compose startup/migration succeeded (`.local/step9-compose-up.log`); image Node
24.22.1, UID 1000 and /sign-in HTTP 200 were observed. This is basic smoke evidence,
not end-to-end authentication. The last independent host Ollama fetch was interrupted;
no PASS may be inferred from the earlier combined shell command's final curl exit.

Current blockers: native PostgreSQL stopped; container Ollama connectivity unverified;
coverage below target. CI workflow, Linux test harness and final verification absent.
No remote GitHub Actions execution has occurred. No Step 9 confirmations pass yet.

## Original 20-task plan and remaining acceptance work

| Task | Current evidence / remaining work |
| --- | --- |
| 1 Test inventory | Existing suites inspected; formal inventory still required |
| 2 Testing matrix | Pending deterministic/DB/API/cancellation/Docker/live-eval/gate/browser matrix |
| 3 Isolation | Prior native guards passed; new container fixture safety needs testing |
| 4 Integration gaps | Two config tests added; container auth/upload/retrieval/telemetry/export pending |
| 5 Coverage | Measured, Python below 70%; meaningful improvements/gate pending |
| 6 Docker availability | Verified installed and running |
| 7 Other-project protection | Dedicated resources created; read-only healthy observation; final comparison pending |
| 8 Dockerfile | Build/non-root/pinned Node verified; image contents/shutdown verification pending |
| 9 pgvector service | Healthy/migration success; direct extension/dimensions/schema checks pending |
| 10 Compose | Configuration/startup passed; full lifecycle validation pending |
| 11 Ollama | Host endpoint opt-in implemented; real connectivity/inference pending |
| 12 MiniLM | Disabled/default and no weights in design; container fallback checks pending |
| 13 Container auth | Sign-in/out, cookie/session persistence/expiry and origin checks pending |
| 14 Container smoke | Basic health only; authenticated upload/hybrid chat/cancel/metrics/feedback pending |
| 15 Restart/recovery | App/DB restart, persistent volume/session continuity, DB loss recovery pending |
| 16 CI workflow | Not created; pin runtimes/actions, least privilege, no secrets/publish |
| 17 CI regression gate | Not implemented; meaningful deterministic retrieval gate + negative controls needed |
| 18 Local CI equivalent | Not run; YAML validation alone insufficient; remote explicitly deferred |
| 19 Final regression | Entire applicable suite, coverage, real Docker, full local evaluation/gate pending |
| 20 Documentation/Git | DOCKER.md, CI.md, TESTING.md, contract updates and final Step9 report pending |

## Exact next actions

1. Read AGENTS, technical handoff and command contract; inspect Git and Docker again.
2. Resolve the native stopped-cluster prerequisite safely before new implementation.
   Use the documented owned-cluster start procedure only in a separately authorized
   continuation. Do not use `make up` blindly: it applies development SQL. Verify
   data_directory, port and database read-only after startup; preserve all data.
3. Rerun the full applicable prerequisite contract with a fresh run ID; never overwrite
   step9-prerequisite-b. It requires the preserved Ollama 0.40.9 benchmark runtime;
   inspect current PIDs and service ownership before any temporary switch, restore it
   afterward. If a prerequisite fails, stop/report before advancing.
4. Diagnose host Ollama from the app container with a standalone command and explicit
   nonzero handling. Do not broaden public network exposure or weaken native guards.
5. Finish the 20-task plan above. Reuse existing security/observability HTTP suites
   where feasible, adapting explicitly for dedicated container fixtures. No production
   keys for ordinary CI. Use read-only SQL and owner-marked fixture scopes.
6. After final code changes run `make lint`, `make test`, `make cov`, `make build-fe`,
   full native contract checks, meaningful container integration/restart checks and
   deterministic CI gate/negative controls. Audit full current provenance and preserve
   .02 thresholds. A changed provider file may require fresh compatible cache entries.
7. Report local CI-equivalent honestly. Remote Actions: NOT RUN — NO PUSH AUTHORIZED.
   Complete docs and local logical commits only after verification; stop at Step 9.

Private `.env`, `.local/step9-compose.env`, auth fixture files and model caches remain
on this same Mac. Do not print them or copy them into handoff docs. Inspect existence
and permissions only. `.local` also contains native database data: never delete it.
For safe inspection: `docker compose --env-file .local/step9-compose.env ps` and
`docker compose --env-file .local/step9-compose.env config --quiet`; avoid plain
`config`, which expands secrets. Do not run migrations during handoff.

Sources: [Step 8 report](STEP8_COMPLETE.md), [command contract](COMMAND_CONTRACT.md),
[technical map](PROJECT_HANDOFF.md), [account guide](ACCOUNT_SWITCH_GUIDE.md).
