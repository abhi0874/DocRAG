# DocRAG — document answers with verifiable sources

DocRAG retrieves relevant passages from documents, streams grounded answers and
links citations back to their sources. It combines vector and PostgreSQL full-text
search with reciprocal rank fusion. Private libraries use authentication and
server-side ownership checks.

**Live demo:** [docrag-demo.onrender.com](https://docrag-demo.onrender.com/).
Choose a public sample question, read the streamed answer, and open its citation.
No account, API key or local installation is needed. The free service sleeps after
inactivity and can take about a minute to wake; strict shared quotas also apply.

**Status:** STEPS 0–12 are locally complete. The separately authorized Render/Neon
deployment passed 53 production checks. Hosted GitHub Actions passed for the
deployed baseline; [current branch CI](https://github.com/abhi0874/DocRAG/actions/workflows/ci.yml?query=branch%3Afeat%2Fproduction-rag)
shows subsequent commit results. See [publication evidence](docs/PUBLICATION_STATUS.md)
and [STEP 12 evidence](docs/STEP12_COMPLETE.md) for precise scope and provenance.

## Two operating modes

- **Local Ollama:** preserved 0.40.9 runtime, qwen3.8 answers and 768-dimensional
  EmbeddingGemma vectors. Private uploads, authenticated sessions, citations,
  feedback and metrics remain supported.
- **Public Gemini demo:** reviewed sample questions and public
  documentation only; no recruiter key or local installation. Uses a separate
 1,536-dimensional Gemini embedding database, strict quotas and no paid fallback.
  Private uploads/conversations are blocked in this mode. Render Free hosts the
  application; Neon Free stores the separate public index and application state.

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
There are **460 unit tests**. Saved local Ollama Recall@5 is **0.975**, automated
faithfulness **1.000**, correctness **0.985**, and citations **265/265**. Separate
Gemini retrieval Recall@5 is **0.96875** over 80 answerable questions; this is not
a cloud answer-quality benchmark. Two reviewed moderate JavaScript tooling
advisories remain disclosed in [security](docs/SECURITY.md).
Cached generations are distinguished from fresh calls. STEP 10's50-user queue and
quota rejections are capacity limitations, not a claim of 50 concurrent inference.
See [load testing](docs/LOAD_TESTING.md).

## Deployment

[Deployment operations](docs/DEPLOYMENT.md) describes Render Free Docker, Neon Free
and Gemini's standard free tier, with no linked Gemini billing account or paid
fallback. The paid-cost target is ₹0. Production uses HTTPS, secure eight-hour
sessions, server-side ownership checks, bounded requests and cancellation accounting.
The demo exposes only the verified public corpus; unpaid Gemini privacy terms are
disclosed in the interface. Free quotas, cold starts and lack of an availability
SLA remain limitations. Future resource or billing changes require authorization.
