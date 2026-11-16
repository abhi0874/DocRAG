# DocRAG agent instructions

Read [current status](docs/CURRENT_STATUS.md), [technical handoff](docs/PROJECT_HANDOFF.md),
and [command contract](docs/COMMAND_CONTRACT.md) before work. The status file is a
snapshot: inspect actual Git changes and services independently.

DocRAG is a Next.js/React/TypeScript application with TypeScript API handlers,
PostgreSQL/pgvector, Drizzle, Better Auth, Gemini/Ollama, and Python evaluation tools.
`app/` contains routes/pages; `components/` the UI; `lib/` RAG/security/telemetry;
`db/` schemas/migrations; `scripts/` operational helpers; `eval/` frozen evidence;
`tests/` regression tests. Python is not a replacement backend.

- Use this existing checkout, branch `feat/production-rag`. Inspect remote, HEAD,
  status, staged/unstaged diffs and untracked files first. Preserve unfinished work.
- Pin Node **24.22.1**, pnpm **11.25.0**. Never casually upgrade Node: 26.5.0
  reproduced an unhandled Web Streams rejection. Use the command contract.
- Work one step at a time. Audit prerequisites before implementation. If a mandatory
  prerequisite fails, stop and report it. After a justified fix, rerun the applicable
  verification list. Stop after three genuine failed repairs of the same blocker.
- Do not delete/weaken tests, suppress nonzero exits, lower .02 quality gates or
  call cached generations fresh. Report commands, codes and actual counts.
- No push, PR, merge, deployment or publication without explicit user authorization.
  Small logical local commits are allowed. Never reset/clean/reclone/rewrite history
  to discard work. Do not commit unrelated staged or untracked files.
- Never print or commit keys, passwords, connection URLs, cookies or private content.
  Real `.env` and `.local` state remain ignored. Use public fixtures only.
- Preserve golden labels, 162 selected chunks, historical results, embeddings,
  Gemini caches, ownership and all prior citation/security fixes.
- Inspect database identity/ownership before writes. Do not reset data, run blanket
  cleanup, stop other projects, delete volumes or run Docker prune. Ask before
  destructive operations or global installations. Keep paid API charges at ₹0.
- Default reranker and public response cache stay OFF; private/history responses
  bypass cache. Maintain eight-hour auth sessions, server-side ACLs, origin checks,
  cancellation accounting and private feedback export restrictions.
- Use [security](docs/SECURITY.md) and [observability](docs/OBSERVABILITY.md) guidance.
  Full step reports must distinguish verified, historical and pending work.
  Success ends `STEP N COMPLETE`, `No errors found and all tasks completed.`,
  `Can proceed to the next step.` Failure ends `STEP N NOT COMPLETE`, actual
  issues/pending tasks, and `DO NOT PROCEED TO NEXT STEP.` Then stop.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
