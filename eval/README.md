# Measuring DocRAG

Evaluation means measuring a fixed set of questions against known evidence. The
golden set contains 100 AI-authored candidates confirmed by the user in chat:
60 easy, 20 multi-hop and 20 deliberately unanswerable questions. Each website
contributes 50. The receipt in human_review.json binds that confirmation to the
exact dataset bytes and corpus hash. The candidate review_status fields preserve
their original authorship state; their effective reviewed status comes from the
validated receipt. Editing the questions or corpus invalidates the receipt.

## Public corpus and review

corpus/manifest.json pins six FastAPI and six PostgreSQL 16 documentation pages,
their source URLs, titles, retrieval timestamps, hashes and virtual page numbers.
Each website becomes one document because the application searches within one
selected document. Stable source IDs name documentation pages, such as
fastapi.path-params. Stable chunk IDs combine that source ID and the application
chunk index. Local numeric database IDs are not portable and are mapped separately.
See corpus/ATTRIBUTION.md and both retained licenses for provenance.

The real chunkPages function produced 151 chunks (88 FastAPI, 63 PostgreSQL).
scripts/ingest_corpus.py invokes the real embedChunks function through a TypeScript
adapter and stores the corpus in a separate owned native PostgreSQL database.
It verifies the full persisted mapping on reruns, leaves application data alone,
and refuses unexpected ownership/configuration. A source page is a virtual page,
not a PDF page. HTML text extraction is explicitly different from PDF extraction;
this baseline does not measure PDF parsing or scanned-document OCR.

Questions were drafted from these saved articles. Support locations point to
headings or phrases for inspection; they are not machine proof of entailment.
Mechanical validation checks every JSON line, field, ID, type, reference, evidence
location, and normalized question uniqueness. Similar text is flagged for review.
REVIEW_NEEDED.md contains the readable review package. The user confirmed all 100
and authorized keeping the original corpus scope after supplying outside answers.

Unanswerable means unsupported by these selected pages, not unknowable in general.
Outside documentation or general model knowledge must not supply an answer to these
cases. In particular, external claims about pgvector recall are not project metrics.
The correct behavior is an explicit refusal without inventing missing information.

## Run commands

From the actual repository root, after `make setup`, `make up`, and private key setup:

```sh
source .venv/bin/activate
python scripts/ingest_corpus.py
python -m eval.validate_dataset --require-review
make eval
make eval-gate
```

make eval uses `python -m eval.run_eval --golden eval/golden_set.jsonl --out
eval/results/latest.json`. It requires a valid human receipt, verifies corpus
ingestion, and writes a result only after every question and judgment succeeds.
Errors exit nonzero; cached successful calls remain available to resume cheaply.
Never confuse a leftover latest.json from an earlier run with a failed run's output.
The result timestamp identifies the successful run. Use the complete verification
sequence in docs/COMMAND_CONTRACT.md before declaring the step complete.

## Actual retrieval and answers

runtime_adapter.ts calls hybridSearch directly. Query embeddings, cosine SQL,
English keyword SQL, candidate limits of 12 per list and RRF k=60 are unchanged.
Requesting topK=10 exposes a longer slice of the same fused ranking for recall@10.
Only the first 6 chunks become answer context, exactly as in chat. No Python
search algorithm, reranker, chunk optimization, or production cache was introduced.

The chat route and adapter both call lib/rag-answer.ts. This function is the
original streamText call extracted without changing model, instructions, message
conversion or SDK defaults. A contract test checks its original literal prompt
and options. Each evaluation is a single user turn, with no conversational history.
The adapter consumes the answer stream and its actual provider token usage.
It also observes stream errors: underlying provider errors are reported through
the redacted error handler instead of being masked by the SDK's generic missing
output error. Text from a stream that emitted an error is not cached or scored.

## Retrieval metrics

Relevance is measured at the source-page level, at actual retrieved CHUNK ranks.
Repeated pages/chunks occupy their original ranks. They never increase the recall
numerator, and ranks are not compressed by deduplication.

Recall@k = distinct relevant source IDs among the first k chunks / distinct relevant
source IDs required by the question. A multi-hop question requiring two pages
scores 0.5 if one page is found and 1 if both are found. Recall@3, @5 and @10 are
macro averages: each answerable question contributes equally.

MRR (mean reciprocal rank) averages 1/rank of the first relevant chunk in the top
10; no relevant chunk scores zero. A relevant hit at rank 2 contributes 0.5.
The 20 unanswerable questions are excluded from all recall/MRR denominators and
reported separately. An answerable record with no relevance labels is an error.
Page-level relevance is coarse: retrieving the right page does not guarantee
retrieving its answer-bearing passage. Faithfulness/correctness use actual text.

## Citation accuracy and model judging

Each bracketed numeric citation occurrence is judged against its exact numbered
excerpt and attached claim. Correct syntax, a matching topic, or a relevant page
does not prove support. Repeated numbers are separate occurrences. Out-of-range
citations cannot pass. Missing citations on an answer count as one incorrect
attempt. Correct unanswerable refusals with no factual answer claims and no
citations are excluded from citation accuracy. Other uncited replies score zero.

Aggregate citation accuracy = supported citation occurrences / attempted
occurrences, including those missing-citation penalties. This measures citation
precision with a missing-all penalty, not full coverage of every uncited claim in
an otherwise cited answer. All occurrence-level judgments and reasons are retained.

Faithfulness asks whether the answer follows the retrieved excerpts. Correctness
asks whether it answers all requested points accurately against the reviewed
reference and supporting full source pages. Both use 0, 0.5 and 1:

| Score | Faithfulness | Correctness |
| --- | --- | --- |
| 1 | All material claims supported; appropriate refusal when context lacks evidence | Accurate, complete answer; or proper unanswerable refusal |
| 0.5 | Partly supported with a material unsupported claim | Partly correct but materially incomplete; or refusal mixed with speculation |
| 0 | Mostly unsupported/contradictory; refuses despite adequate retrieved evidence | Wrong, irrelevant, or refusing an answerable question |

The complete rubric is in eval/judge.py. The configured answer model is also used
as judge, with temperature 0, minimal reasoning and a 4096 output-token budget.
The SDK requests JSON response mode so Markdown fences are not treated as scores;
the full schema and citation checks still run before any judgment is accepted.
This is model-assisted scoring, not objective ground truth. Self-judging can be
biased, prompts can be misinterpreted, human labels can be wrong, and temperature
0 does not guarantee repeatability. The model must return strict validated JSON;
missing scores, invalid types, unknown citation indices or invalid outputs fail.
There are up to three validation attempts with 2/4-second backoff. Provider errors
use the SDK's two retries; Python does not multiply provider/quota retries.

## Timings, tokens, costs and caches

Per question, monotonic wall clocks measure retrieval, generation and the combined
adapter pipeline in milliseconds. Pipeline timings exclude the separate judge,
the 13-second minimum generation-request spacing, and Python/Node process startup.
Judge time and deliberate pacing are recorded separately. p50 and p95 use linear
interpolation over sorted observed pipeline latencies. They are local harness
timings, not browser latency, hosted latency, throughput, or a production SLA.

Query-embedding HTTP responses are cached in .local/eval-cache/runtime; keys include
the actual model request path, full body, and corpus/application configuration.
Only successful responses are stored, without credentials or response headers.
SQL searches execute again on every question in every run. Answers are cached by
model, exact instructions/context, converted-input messages and configuration.
Judge caches include actual model, full prompt, generated answer, retrieved text,
reference documents and judge settings. Ingestion caches include text, model,
dimensions, task type, corpus hash, code and lockfile hashes. All caches are ignored.
Runtime cache execution is sequential; simultaneous evaluator processes are not
supported by the pacing/cache design.
Pacing is applied to each generation HTTP attempt, including SDK retries, to
respect the observed five-request short-window limit. The actual interval remains
in result configuration, but scheduling alone is excluded from cache identities.
Legacy seven-second cache keys are reused only when every other input still
matches; stored responses and judgments are retained without new model calls.
Changing models, prompts, evidence or scoring configuration still invalidates keys.

Every result reports hit/miss counts. A cache hit's observed time is cache-read time,
not fresh model latency. Original generation time/date and provider usage are
retained separately. A rerun with cache hits can be faster without any improvement
to production code. Do not report that difference as a project optimization.
Fresh-call judge variability has not been established by matching cached judgments.

Answer and judge token usage comes from SDK provider responses. Original usage on
cache hits is not newly consumed/billed usage. Invalid judge-attempt usage is also
recorded separately. The installed Google embedding adapter exposes no token usage,
so complete tokens/query is unavailable; known answer/judge averages are separate.
Account-specific billed prices/usage were not verified, so cost/query is unavailable.
No zero-cost assumption, invented token estimate, or fabricated performance number
fills these gaps. Quotas can vary and other calls in the same project consume them.

## Baseline and regression gate

baseline.json must be copied from a real complete reviewed evaluation and committed
locally. Preserve the first run; make eval again writes ignored latest.json.
verify_results.py recomputes every aggregate from per-question results, checks
dataset/corpus/configuration and source-code hashes against the recorded Git
revision, and compares full-precision recall@5. A difference is a failure to
investigate, never permission to round away the discrepancy or cache SQL ranking.

make eval-gate rejects a recall@5 or faithfulness decrease greater than 0.02. Exactly
0.02 passes; a larger drop fails. It compares serialized decimal values without
rounding or tolerance, rejects missing/non-numeric/non-finite metrics and rejects
incompatible dataset, corpus or metric definitions. Different application configs
are recorded for deliberate future comparisons; two-run reproducibility additionally
requires the exact same config. A separate synthetic degraded-result check exercises
the CLI's nonzero exit. Synthetic values never replace baseline measurements.

Remaining limits include a small English documentation corpus, only 20 synthesized
multi-hop questions, no adversarial prompt-injection suite, no multi-turn benchmark,
unversioned provider aliases, local database query plans and network variability.
Public deployment and later improvements are outside STEP 2. Nothing is pushed.

## Optional local Ollama baseline (STEP 2 FIX)

The user chose a separate local benchmark to avoid additional Gemini quota usage.
Gemini remains the production default, and its existing 20 completed pairs are
preserved separately. `AI_PROVIDER=ollama make eval` uses the same reviewed set,
chunk texts, retrieval function, ranking, prompt and metrics, with recorded local
Qwen generation and EmbeddingGemma vectors. Local embeddings live in an isolated
vector(768) database; existing vector(1536) data is never overwritten or mixed.

See docs/LOCAL_OLLAMA.md and the local command-contract sequence for exact model
digests, settings, API endpoints, calibration methodology and uninstall
instructions. Local output/baseline names have the `-local-ollama` suffix. The
local runtime rejects nonloopback model requests, checks installed digests even
on cache hits, and writes only successful complete generations to its own cache.

Local judge calibration is separate from the existing dataset review. The current
user-authorized method is **automated evaluation**, documented in
docs/AUTOMATED_EVALUATION.md. It uses the submitted reference decisions with their
actual provenance and does not claim independent human validation. The earlier
human-only diagnostic reports and fresh uncompleted review are preserved as history.
After compatible calibration passes unchanged criteria, `eval.promote_local`
attaches an explicit validation record to a copy of the immutable measurements.
The raw diagnostic files remain provisional. New complete artifacts are verified
under the automated protocol, not asserted to be error-free or human-independent.

The gate now requires identical valid configuration hashes as well as identical
dataset, corpus and metric definitions. A deliberate future configuration change
must establish compatibility explicitly; it cannot silently compare unrelated
providers or models. Thresholds remain strictly greater than 0.02, at full precision.
Local provider usage includes query embedding, answer and judge attempts where
reported. Cached counts describe original calls, not newly consumed inference.
Paid API inference charges are zero for this loopback-only path; electricity and
hardware costs are not included. Timings remain observed current-run timings,
with original generation durations separately retained. Cached repeatability is
not fresh-generation determinism. Self-judging and the small corpus remain limits.
