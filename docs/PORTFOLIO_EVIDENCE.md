# DocRAG — evidence for a portfolio or resume

Suggested summary:

Built a document Q&A system with Next.js/TypeScript, PostgreSQL/pgvector, hybrid
vector/keyword retrieval and reciprocal rank fusion, streamed answers with source
citations, and authenticated private-document isolation. Maintained separate local
Ollama and privacy-restricted Gemini demo paths, with Docker packaging and local
CI-equivalent verification.

Evidence-backed details (use only with their scope):

- Frozen100-question local evaluation: Recall@5 **0.975**, faithfulness **1.000**,
  correctness **0.985**, supported citations **265/265**. STEP12 has100 fresh answers/
  query embeddings and37 fresh/63 cached automated judgments. These are calibrated
  automated results, not100 independent human judgments.
- **460 unit tests** (218 Python,242 TypeScript), **27 verification groups**,
  **26 container checks**, real two-user HTTP/SQL isolation and negative citation/
  cache controls. Python integration coverage **74.38%**; TypeScript statements
  **65.36%**.
- Separate Gemini public-corpus retrieval: **162 chunks**,1536-dimensional vectors,
  historical Recall@5 **0.96875**. Local vectors are768-dimensional. Cloud retrieval
  is a distinct measurement, not the local answer benchmark.
- Bounded5/20/50-user local tests retain request errors and queue time. STEP12:
  **6,786 requests**,**2,567 quota rejections**,zero unexpected failures;50-user
  model queue p95 **73.204s**. Model concurrency is capped at2. Do not describe this
  as efficiently serving50 simultaneous generations.

Sources: [STEP12 review](step12/review.md), [evaluation](step12/evaluation-summary.json),
[verification](step12/verification-summary.json), [load](step12/load-summary.json),
[cloud retrieval](step11/cloud-retrieval-summary-a.json), [deployment](DEPLOYMENT.md).

Do not claim public deployment, hosted GitHub Actions success, zero vulnerabilities,
unlimited capacity or a production SLA. Two reviewed moderate JS tooling advisories
remain. Render/Neon are prepared candidates; no public URL or cloud resources exist.
Future publication/deployment requires explicit authorization.
