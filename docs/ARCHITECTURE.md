# Architecture

The existing Next.js application serves React pages and TypeScript Route Handlers.
Better Auth validates database sessions. SQL access predicates enforce document
ownership before vector/keyword retrieval and before returning citations or files.
Drizzle manages schema changes; PostgreSQL persists documents, vectors, private
file bytes, sessions, telemetry and feedback. Python scripts evaluate and verify
these paths; they are not an application backend.

## Local path

The preserved Ollama runtime supplies qwen3.8 answers and EmbeddingGemma768 query
and document vectors. Hybrid search combines vector and keyword ranks using RRF.
The shared answer pipeline streams through observability and citation validation.
Invalid answers cannot enter the existing optional public cache; private/history
responses bypass it. Reranking and public caching default OFF.

## Public cloud preparation

`DOCRAG_DEPLOYMENT=recruiter-demo` selects the stricter profile. Provider/model and
database configuration are validated. The profile requires explicit Gemini,
a reviewed model, server-only key, verified billing acknowledgement, a dedicated
versioned database and separate 1,536-dimensional Gemini vectors. The database
metadata must match before retrieval. Cloud code never redirects to local Ollama
or a paid model as a fallback.

The server validates public-document hashes and approved one-message questions
before allocating provider quota. Browser-supplied metadata cannot opt private
content into public processing. Upload/evaluation POSTs are blocked in this profile.
The UI exposes only reviewed questions, source citations, cancellation and safe
errors. Better Auth and private ownership remain intact for local operation;
public demo access does not grant administrative permissions.

Quota counters live in PostgreSQL across workers. Generation uses the existing
SDK stream and validation stages, bounded context/output/time and zero retries.
The small server connection pool is separate from the provider request budget.
The source public corpus and Ollama vectors remain unchanged; new cloud vectors
are stored only in `docrag_demo_gemini_v1`. The bootstrap does not create remote
resources or overwrite nonempty databases.

Gemini Live's WebSocket session model is deferred; it is unnecessary for the
current text/citation interface. Deployment remains unperformed. See DEPLOYMENT.md
for limits, privacy, environment, persistence, recovery and remaining verification.
