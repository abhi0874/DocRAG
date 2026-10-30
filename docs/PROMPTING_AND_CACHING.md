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

## Planned cache boundary

Default off. Only single-turn requests over a server-maintained, exact content-hash allowlist of the public evaluation corpus and its 100 public question hashes are eligible. Arbitrary questions bypass caching even on those documents, preventing user-provided private question text from entering shared answers. Client flags cannot declare a document public. Private uploads, conversation history and providers without a verified immutable model digest bypass storage. A bounded in-process TTL/LRU cache avoids external services. Document snapshots and selected evidence are rechecked; completed valid streams only. Source-ID validity does not prove semantic citation support. Authentication and private cache ownership integration remain Step 7 work.

Implementation and final measurements are pending. No Step 7 work or GitHub push.

## Implementation checkpoint

The first smoke test produced one genuine MISS and two HITs with identical answers
and source IDs. A static review then found that committing at model completion
could precede HTTP stream completion. The initial control evaluation was stopped
after a partial run; its private log and evaluation caches are retained. Cache
commit now waits for HTTP-body EOF with a fresh document snapshot, and a late
cancellation regression test covers this edge. No incomplete run is reported as
a completed benchmark. The changed application hash intentionally prevents reuse
of the old partial-run cache under the new configuration.
