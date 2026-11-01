# Step 6 — work in progress

## Previous-step audit and original behavior

Step 5 independently passed at 8172c03 before implementation: 138 Python + 70 TypeScript tests, lint, production build, saved full-100 provenance and regression verification, dataset/preservation checks, real production HTTP enabled/disabled/fallback modes, and real CPU/MPS inference. Receipts: eval/results/prompting/previous-*.json. Both pinned model digests match. The desktop runtime is 0.40.11; the historical benchmark runtime is 0.40.9 and is used for controlled comparisons. No remote feat/production-rag branch was returned by git ls-remote.

The original prompt lives in lib/rag.ts (preserved as step5-v1). It requires numbered citations, concise answers and refusal when context lacks an answer. Context is the unchanged hybrid top six, in rank order, with excerpt number and page. The model receives conversation history and that context through startRagAnswer. Gemini and Ollama share the same call. There is no production response cache or structural citation validator; only evaluation caches keyed by prompt, settings, configuration and context. Maximum context is six retrieved chunks; local context budget is 32768 tokens and answer budget 2048. No prompt truncation is added.

Original failures are saved with their evidence in eval/results/prompting/original-failures.json:
- postgresql-005: category A. Chunk 106 includes the savepoint remaining defined, but generation omits it.
- postgresql-037: category B. Foreign-key passages are in the broader pool but absent from final six. Prompt changes cannot fix missing retrieval evidence.
- The separate postgresql-037 control diagnostic: categories C/E. It answers the constraint from outside final evidence; automated faithfulness 0.5. Existing cited join claims are supported, but citation accuracy does not cover the uncited assertion.

## Predeclared experiment and selection policy

Compare step5-v1 and one grounded-v1 candidate with the same 100 questions, pinned runtime/models, 162 chunks, hybrid ranks, six passages and unchanged judge rubric. Freeze the candidate before full evaluation. The existing 60/40 split is reused, not unseen data. Select on the 60 development questions: no loss of faithfulness, citation support or correctness, no increase in incorrect refusals or unsupported claims, and inspect known failures. The 40 holdout questions provide a final check; do not retune against them. If the candidate has a clear quality regression, retain step5-v1. Evaluate public-cache behavior separately through real HTTP; never credit caching with better answer quality.

## Implemented cache boundary

Default off. Only single-turn requests over a server-maintained, exact content-hash allowlist of the public evaluation corpus and its 100 public question hashes are eligible. Arbitrary questions bypass caching even on those documents, preventing user-provided private question text from entering shared answers. Client flags cannot declare a document public. Private uploads, conversation history and providers without a verified immutable model digest bypass storage. A bounded in-process TTL/LRU cache avoids external services. Document snapshots and selected evidence are rechecked; completed valid streams only. Source-ID validity does not prove semantic citation support. Authentication and private cache ownership integration remain Step 7 work.

Final comparative measurements are pending. No Step 7 work or GitHub push.

## Prompt, evidence and citation contract

`lib/rag-prompt.ts` retains `step5-v1` and adds the frozen `grounded-v1`
candidate. The candidate requires explicit treatment of subquestions, conditions,
exceptions and unchanged facts. Missing evidence calls for an explicit gap;
conflicting passages call for an explanation of the disagreement. Retrieved text
and conversation history are treated as untrusted data. Prompt instructions alone
do not guarantee resistance to every injection or unsupported claim.

The candidate serializes the same six passages as ordered JSON. Each includes
its citation number, document ID, chunk ID, title, section, source identifier,
page, URL when present, and text. Metadata comes from the selected document's
database snapshot. Missing values remain absent/null; no links or page numbers
are fabricated. Retrieval ordering, chunking and embedding configuration are
unchanged. JSON escaping preserves data boundaries but is not a security proof.

`lib/citations.ts` checks numeric references against the actual context, rejects
empty responses and redundant adjacent citations, and explicitly reports
`semanticSupport: not-verified`. Semantic support is measured separately by the
unchanged automated judge. A response with valid reference numbers can still
contain an unsupported claim. Live answers display a notice for invalid citation
structure and are not cached; the application does not claim to automatically
block every semantically incorrect answer.

The chat stream carries the actual source metadata. Clicking an older message's
citation selects that message's saved sources rather than the newest answer's
sources. A cache hit is labelled “Previously generated answer.”

## Cache implementation and streaming lifecycle

`lib/response-cache.ts` implements an in-process least-recently-used cache:
128 entries, an approximate 8 MiB payload bound, and a five-minute lifetime.
It has no persistent store or additional service. Entries expire on reads and
writes; restarting a server clears its cache. Multiple server processes have
independent caches.

The SHA-256 key covers the trimmed question, full relevant history, public scope,
document ID and content snapshot hash, selected context and its order, retrieval
and reranker settings, verified model digests and runtime, generation parameters,
and prompt version plus actual instructions. Case and punctuation are preserved.
Every request still performs retrieval and document checks. Hits avoid answer
generation, not query embedding or database work.

Only a successfully completed model stream with valid citation structure becomes
eligible for storage. Storage occurs after the HTTP body reaches its end and a
fresh document snapshot still matches. Failed, truncated, cancelled or invalid
responses are excluded. Cancellation aborts generation and drains terminal SDK
frames without treating them as a completed answer. An idempotent release prevents
cleanup from releasing another request's cache-writer slot. Concurrent duplicate
requests may generate separately, but only one owns the cache write; they are not
advertised as coalesced requests.

A changed public fixture no longer matches the server allowlist, so requests
bypass caching. Deletion explicitly invalidates that document's entries, while
subsequent lookup returns not found. A private upload is ineligible from creation.
There is no new document-replacement API; a content change is covered by the
snapshot hash and the real database mutation check. Prompt, model, context and
settings changes create different keys.

`RESPONSE_CACHE_ENABLED` defaults to false. Even when true, private documents,
unrecognized public questions, multi-turn requests and unverified providers do
not enter this shared cache. This verifies exclusion from the cache, not general
application authorization. Before any broader deployment, Step 7 must establish
server-verified ownership/access scopes and enforce them consistently for both
document retrieval and caching. That authentication work is not implemented here.

## Implementation checkpoint

The first smoke test produced one genuine MISS and two HITs with identical answers
and source IDs. A static review then found that committing at model completion
could precede HTTP stream completion. The initial control evaluation was stopped
after a partial run; its private log and evaluation caches are retained. Cache
commit now waits for HTTP-body EOF with a fresh document snapshot, and a late
cancellation regression test covers this edge. No incomplete run is reported as
a completed benchmark. The changed application hash intentionally prevents reuse
of the old partial-run cache under the new configuration.
