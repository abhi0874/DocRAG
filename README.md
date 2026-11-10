# DocRAG — document answers with verifiable sources

DocRAG retrieves relevant passages from documents, streams grounded answers and
links citations back to their sources. It combines vector and PostgreSQL full-text
search with reciprocal rank fusion. Private libraries use authentication and
server-side ownership checks.

**Status:** STEPS 0–11 are locally complete, including deployment preparation.
There is no public deployment. Remote GitHub Actions has not
run. See [current status](docs/CURRENT_STATUS.md) for accepted evidence and blockers.

## Two operating modes

- **Local Ollama:** preserved 0.40.9 runtime, qwen3.8 answers and 768-dimensional
  EmbeddingGemma vectors. Private uploads, authenticated sessions, citations,
  feedback and metrics remain supported.
- **Public Gemini demo (preparation):** reviewed sample questions and public
  documentation only; no recruiter key or local installation. Uses a separate
 1,536-dimensional Gemini embedding database, strict quotas and no paid fallback.
  Private uploads/conversations are blocked in this mode. It is not yet publicly
  available. The local preparation is verified; see [STEP 11](docs/STEP11_COMPLETE.md).

## Work in the existing checkout

Use Node **24.22.1**, pnpm **11.25.0** and the existing Python virtual environment.
Read [AGENTS](AGENTS.md), [handoff](docs/PROJECT_HANDOFF.md) and the
[command contract](docs/COMMAND_CONTRACT.md) before changing or starting services.
For this Mac, the contract selects the project-local Node runtime. Do not blindly
initialize a database or change a port already owned by another project.

```sh
make db-status
make lint
make test
make build-fe
```

Configure secrets privately using [.env.example](.env.example) as a reference.
Never commit a real environment file. Native PostgreSQL and the dedicated Docker
database are separate services; see [Docker instructions](docs/DOCKER.md).

## Architecture and verification

Next.js/React/TypeScript UI and Route Handlers; PostgreSQL/pgvector with Drizzle;
Better Auth; Gemini or Ollama providers. Python handles evaluation and operational
checks, not a replacement web backend. [Architecture](docs/ARCHITECTURE.md) describes
the data paths. [Security](docs/SECURITY.md), [observability](docs/OBSERVABILITY.md)
and [testing](docs/TESTING.md) cover retained controls.

The frozen 100-question evaluation and historical measurements are preserved.
Cached generations are distinguished from fresh calls. STEP 10's50-user queue and
quota rejections are capacity limitations, not a claim of 50 concurrent inference.
See [load testing](docs/LOAD_TESTING.md).

## Deployment

[Deployment preparation](docs/DEPLOYMENT.md) proposes Render Free Docker, Neon Free
and Gemini's standard free tier, subject to verified account/region/quota limits.
A budget of ₹0 is mandatory. The review-only blueprint does not authorize creating
resources or publishing. Push, deployment, billing and STEP 12 require separate
explicit authorization.
