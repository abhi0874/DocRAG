# Local Ollama evaluation

This is an optional local provider for the existing Next.js/TypeScript application.
Gemini remains the default. No Python backend or replacement retrieval algorithm
is introduced. Local evaluation makes no Google model requests and has zero new
paid inference/API/subscription charges; hardware and electricity still have costs.
The incomplete Gemini benchmark remains separate at 20/100.

## Installed and measured environment

Ollama was already installed; it was not reinstalled. The inspected version is
0.40.9. The Mac reports Apple M5 Pro, 48 GiB unified memory and approximately
764 GiB free on its 1 TB SSD at setup. Qwen was already downloaded and generated
LOCAL_OK through /api/chat. The loaded-model report showed 100% GPU, MLX runner.
The small smoke test is not a representative throughput benchmark.

Qwen tag: qwen3.8:latest
Digest: 47951e4a666180bc2aedfc93c169472f2de783696fe196efbf063f5730ecf163
Size reported by /api/tags: 18,174,721,847 bytes. Quantization: nvfp4.
The detailed /api/show metadata reports 27,781,081,984 parameters (27.8B).
The tag listing itself omits parameter count; this value comes from /api/show.

Embedding model: embeddinggemma:300m, downloaded with explicit user approval.
Digest: 85462619ee721b466c5927d109d4cb765861907d5417b9109caebc4e614679f1
Size: 621,875,917 bytes. Reported quantization: BF16. Runner: ggml.
Both document and query examples returned finite vectors with 768 dimensions.
Neither those vectors nor the Gemini vectors are padded or truncated.

Exact benchmark settings live in lib/local-model-config.json. Model digests are
checked before calls and even before cache reuse. A changed latest tag is a failure,
not an unrecorded model update. Temperature 0, seed 42, thinking false, context
32768 and maximum output 2048 are fixed requested settings. Seed/temperature do
not prove fresh-generation determinism. The context allocation allows full judge
reference pages; requests fail if reported input plus reserved output exceeds it.
Ollama's actual loaded state and token usage are retained in local-environment.json.

## Starting the already installed server

Keep Ollama running during evaluation. Closing/quitting the app can stop its API.
For terminal-only operation, run the existing binary in Terminal:

```sh
OLLAMA_HOST=127.0.0.1:11434 OLLAMA_NO_CLOUD=1 ollama serve
```

Keep that terminal open; Ctrl+C stops this server. If it reports address already
in use, the desktop server is probably already running: inspect `ollama ps` and
`curl http://localhost:11434/api/version`. Do not start competing servers.
No login, cloud inference or billing is needed for these downloaded models.
If the API is unavailable, start Ollama rather than reinstalling or re-downloading.

## Provider and database isolation

AI_PROVIDER defaults to gemini. For local mode set AI_PROVIDER=ollama and use
OLLAMA_BASE_URL=http://localhost:11434, OLLAMA_MODEL=qwen3.8:latest and
OLLAMA_EMBEDDING_MODEL=embeddinggemma:300m. The benchmark rejects overrides that
differ from its recorded configuration. Only loopback HTTP endpoints are accepted;
redirects are rejected. The evaluator also rejects every nonlocal fetch.

Local application mode requires a private OLLAMA_DATABASE_URL pointing to the owned
native docrag_ollama_v1 database. The evaluator derives it privately from the
existing native development credentials; it never changes or prints .env values.
The application refuses to use docrag_dev or docrag_eval_v1 for local embeddings.
The local schema has vector(768), English tsvector/GIN, HNSW cosine and document ID
indexes. Existing Gemini vector(1536) tables remain untouched.

Local ingestion copies the verified 151 existing chunk texts and stable numeric/
source mappings from the isolated Gemini corpus. It generates only new local
vectors. It does not re-fetch articles, re-chunk text or alter references. It
verifies corpus/model identity and all rows on repeat runs. Unknown pre-existing
databases or mismatched model/corpus metadata fail without destructive changes.
Transactions roll back an incomplete ingestion; completed embedding batches are
cached to avoid repeated inference. Do not delete .local to troubleshoot.

Local retrieval calls the existing hybridSearch: 12 vector candidates, 12 keyword
candidates, RRF k=60, 10 diagnostic results and first 6 excerpts for the answer.
The shared application prompt/citation logic is unchanged. The local adapter
supports text generation and real streamed text through /api/chat; the document
and query vectors use /api/embed. No tool or vision workflow is added.
EmbeddingGemma input prefixes follow the publisher's instructions:
`title: none | text: ` for documents, `task: search result | query: ` for questions.
Sources: https://docs.ollama.com/api/chat, https://docs.ollama.com/api/embed,
https://huggingface.co/google/embeddinggemma-300m#prompt-instructions.

## Repeatable commands

Run from the existing RAG-Agent repository; activate .venv or use make targets.
Follow the complete ordered command list in docs/COMMAND_CONTRACT.md.

```sh
make up
make local-check
make local-ingest
make local-calibrate
AI_PROVIDER=ollama make eval
AI_PROVIDER=ollama make eval-gate
```

make eval selects the provider explicitly: local output is
`eval/results/latest-local-ollama.json` and the intended baseline is
`eval/results/baseline-local-ollama.json`. Gemini names remain latest.json and
baseline.json. Never copy a provisional result into either baseline.
Preserve the first complete validated local run, then run the evaluator again.
SQL retrieval is always rerun. Cached model responses do not prove that fresh
local generations or independent judges would be identical.

Caches are separate: `.local/ollama-cache` versus `.local/eval-cache` for Gemini.
Keys bind provider, model digest/settings, exact prompt/context and relevant
corpus/dataset/configuration. Completed responses only are stored atomically.
Empty, interrupted, malformed or output-limit responses fail. Retryable HTTP
errors use bounded exponential delays; schema-invalid judge responses use three
attempts, as before. Do not run simultaneous benchmark processes.

## Judge calibration and human review

Faithfulness means support from retrieved excerpts. Correctness means agreement
with the reviewed reference and its source pages. Citation support means that the
specific cited excerpt supports the attached claim. Existing STEP 2 rubrics and
metric definitions remain unchanged, including missing-citation penalties.

The 14 cases in eval/calibration/REVIEW.md cover correct and partial answers,
unsupported answers, wrong/missing citations, incorrect refusals and proper
refusals. Proposed labels were authored independently of Qwen's measured judgments,
but were authored by an AI assistant. They are NOT human labels. The user said they
did not understand the labels and delegated the technical choice; that is not a
human confirmation of the labels. No human receipt has been invented.

Acceptance criteria are fixed before measurement in acceptance.json: at least
90% exact agreement for faithfulness, correctness and substantive-claim flags;
95% for per-case citation-label lists; all critical unsupported/citation/refusal
cases must match every label. Results retain all disagreements. These small
synthetic cases diagnose judge behavior; they cannot establish broad reliability.
Until a human has confirmed/corrected these evidence-based labels, 100-question
local results remain explicitly provisional and the baseline gate refuses them.
The existing 100-question human review remains valid and need not be repeated.

Qwen is both answer model and judge; self-preference remains a limitation even
if calibration passes. No independently downloaded judge is implied. Additional
large downloads require approval. Failed calibration is not permission to alter
labels or thresholds. Review structured output and reasoning before changing a
judge prompt, and preserve each previous diagnostic result.

## Removing Ollama later (do not perform during this step)

1. Stop loaded models with `ollama stop qwen3.8:latest` and
   `ollama stop embeddinggemma:300m`. Stop a terminal server with Ctrl+C.
2. When those downloads are no longer needed, `ollama rm embeddinggemma:300m`
   removes the embedding model; `ollama rm qwen3.8:latest` removes Qwen. These
   delete downloads and require downloading again to repeat the benchmark.
3. Quit the Ollama desktop application from its menu.
4. If no longer needed, remove Ollama.app from Applications using Finder.
5. Review Ollama-specific locations such as `~/.ollama/models`, `~/.ollama/logs`
   and app support/cache directories. Verify ownership and contents first.
6. Delete leftover files only after explicit approval. Never delete the DocRAG
   repository, PostgreSQL data, Gemini caches or benchmark results as part of
   Ollama removal. No uninstallation or model deletion was performed here.

Future online deployment is outside this step. A local benchmark does not make
the recruiter-facing application available when this Mac is offline.

## Calibration diagnosis recorded during integration

The initial Qwen diagnostic agreed on correctness/citations/claim flags in all 14
cases, but faithfulness agreement was 12/14 (0.8571428571428571), below the frozen
0.90 requirement. Both disagreements conflated a wrong citation with factual
support from another retrieved excerpt. The local-only judge prompt now explicitly
separates those dimensions, preserving the existing rubric. Gemini's judge prompt,
proposed labels and acceptance thresholds are unchanged. The failed result remains
in local-calibration-attempt1.json. The corrected diagnostic matched all 14 cases.
The same small set was used to diagnose the prompt and retest; it is not a held-out
accuracy estimate, and it still lacks independently established human labels.
