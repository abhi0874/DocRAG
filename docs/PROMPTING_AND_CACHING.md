# Step 6 — grounded answers, citations and public response caching

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

The selected prompt is `step5-v1`. The complete measurements and remaining limitations appear below.

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

## Completed original-prompt control

The fresh Step 6 control is saved as `eval/results/prompting/step5-v1-raw.json`
and its verified derivative `step5-v1.json`. It used 100 fresh answers and 100
fresh judgments, with no production response caching. The historical Step 5 run
used 17 cached answers and 16 cached judgments; its timing is not a matched
uncached control.

| Measurement | Historical Step 5 | Fresh `step5-v1` control |
| --- | ---: | ---: |
| Recall@3 | 0.95 | 0.95 |
| Recall@5 | 0.975 | 0.975 |
| Recall@10 | 1.0 | 1.0 |
| MRR | 0.9729166666666667 | 0.9729166666666667 |
| Automated citation accuracy | 1.0 (269/269) | 1.0 (273/273) |
| Automated faithfulness | 1.0 | 0.995 |
| Automated correctness | 0.99 | 0.99 |

The fresh control's 20 unanswerable questions all received appropriate full
refusals under the unchanged automated labels. None of the 80 answerable
questions received an incorrect full refusal. One of 100 answers included an
unsupported substantive claim. Answerable-only faithfulness is 0.99375 and
correctness is 0.9875. Unanswerable-only faithfulness and correctness are both
1.0; citation accuracy is undefined because these correct uncited refusals
contribute zero attempted citations. These are automated measurements, not
independently human-validated accuracy.

`postgresql-005` again omitted that the savepoint remains defined (F=1, C=0.5).
`postgresql-037` explained the inner join correctly but supplied a foreign-key
constraint from outside the six retrieved passages, then acknowledged that the
excerpts did not establish it (F=0.5, C=0.5). Acknowledging a missing source after
making the unsupported claim does not make that claim grounded. This reproduces
the earlier unsupported-claim diagnostic, despite all attempted citations being
judged supported.

The unchanged regression gate passes for this control: Recall@5 decrease 0.000,
faithfulness decrease 0.005. The full candidate comparison and selection appear below.

## Final quality results

| Metric | Step 5 historical | Step 6 selected `step5-v1` | Candidate `grounded-v1` |
| --- | ---: | ---: | ---: |
| Recall@3 / @5 / @10 | 0.95 / 0.975 / 1.0 | 0.95 / 0.975 / 1.0 | 0.95 / 0.975 / 1.0 |
| MRR | 0.9729166666666667 | 0.9729166666666667 | 0.9729166666666667 |
| Citation support | 269/269 | 273/273 | 674/674 |
| Faithfulness | 1.0 | 0.995 | 1.0 |
| Correctness | 0.99 | 0.99 | 0.985 |

The frozen development rule retained the original prompt because candidate
correctness fell from 0.9833333333333333 to 0.975 across 60 development
questions. Both prompts scored 1.0 on the three automated quality measures on
the 40-question holdout. The candidate fixed the savepoint omission and
declined the missing constraint on the join question. It also hedged on the
FastAPI dependency check and declined an unsupported transaction subquestion.
The original control supplied details absent from the retrieved passages on
both `postgresql-031` and `postgresql-037`. The judge flagged only the latter.
The four paired answers, their judgments, and all rates are recorded in
`eval/results/prompting/verified-report.json` and `PROMPTING_EXPERIMENT_LOG.md`.

On the 80 answerable questions the selected prompt scored 0.99375 faithfulness
and 0.9875 correctness. The candidate scored 1.0 and 0.98125 respectively.
Both prompts correctly refused all 20 unanswerable questions, with no incorrect
full refusals among the 80 answerable questions. The automated unsupported-answer
rates were 1/100 and 0/100 respectively. Both unanswerable subsets scored 1.0 on
faithfulness and correctness. The candidate often explained unrelated background
facts, which added citations and length without making its refusals more useful.

## Source-local reference ambiguity

Before the final citation fix, the selected prompt ignored an embedded request
to change the answer to an attacker-selected marker. In a separate forged
citation probe it also ignored the request to cite [999], but refused to state
the plainly supplied COMMIT fact. The candidate answered the fact but repeated
[999] in its explanation. Its structural validation failed even though the judge
accepted the semantic answer. Both original diagnostic receipts are preserved.

The shared instruction builder now distinguishes document-local bracket numbers
from assigned evidence citations when the passage text contains numbers outside
the assigned range. It retains the full original passage. Exact instructions
are part of the cache key. All six final selected-prompt probes scored F=1/C=1,
passed structural validation and omitted the requested override marker.
The repaired forged-citation answer was “The COMMIT command commits a transaction
[1].” The six synthetic cases exercise specific behaviors. They do not establish
comprehensive injection resistance.

The byte equivalence check loaded the measured function from commit `ecbabe1`,
verified each public document snapshot, and compared all 100 rendered prompts for
each version with the current function. All 200 matched exactly. The final
instructions therefore preserve the two measured golden runs while fixing the
separate source-reference case. The per-question hashes are recorded in
`eval/results/prompting/final-prompt-equivalence.json`.

## Selected public-cache measurements

Six distinct public questions were sent three times each to the real Next.js API.
The first six requests missed. All twelve repeats hit and replayed identical
answer text and source IDs. The eligible hit rate was 12/18 (66.67%). Hits
avoided 12 answer generations and 19,018 model-reported tokens. Each hit still
performed retrieval. Arbitrary questions bypassed the cache. Paid API charges
were ₹0.

| HTTP condition | Requests | p50 | p95 |
| --- | ---: | ---: | ---: |
| Generation model unloaded before request, cache off | 6 | 6,617.72 ms | 8,805.35 ms |
| Same question repeated with model resident, cache off | 6 | 1,045.23 ms | 3,068.35 ms |
| Eligible first request, empty response cache | 6 | 4,124.18 ms | 6,334.43 ms |
| Eligible cached repeats, pooled | 12 | 32.36 ms | 35.35 ms |

The cold/warm pairs used one production server. Each cold call verified Qwen
was absent from the runtime before generation, then immediately repeated the
question while Qwen was resident. OS page caches were left intact. Ollama
reported 18,544,479,960 bytes resident for Qwen and 685,642,874 for the embedding
model after the first cold call. These are model residency snapshots. They
do not measure peak process memory, energy consumption or a monetary saving.
The separate HTTP sequence and its two warm groups are in `final-cache-http.json`.
The selected prompt's cold/warm rows are in `final-cold-warm.json`.
Both artifacts live under `eval/results/prompting/`. The corresponding original
candidate receipts are preserved separately. The measured sample is six public
questions on one Mac and one server process.


Browser verification used the real production chat. A fresh FastAPI question
produced one assistant entry and no replay label. Its repeat produced one entry,
one “Previously generated answer” label, and the same six sources. A follow-up
produced different sources. Clicking the original citation restored its original
six passages, including page 1 / chunk #2 for the integer conversion. See
`eval/results/prompting/browser-cache-hit.jpg`.

A final rerun of the optional candidate also passed all six diagnostic
correctness, faithfulness and structural checks. Its corrected forged-reference
answer cites only [1]. `candidate-final-diagnostics.json` retains that run.

## Step 6 citation and replay correction

The audit supplied one retrieved passage and scripted the model to say
“The value is 3, according to source [-1].” The former parser collected only
digit-only markers. It recorded zero citations, marked the text valid and stored it.
The second identical request returned a HIT. The old read path streamed the entry
before reporting its validation result.

The UI and validator now share one parser. A source number uses an ASCII positive
integer in square brackets, from [1] through the number of passages sent to the
model. Separate adjacent markers such as [1][2] are supported. Adjacent repeats
such as [1] [1], signs, zero, leading zeroes, decimals, ranges and lists inside
one marker are invalid. One valid marker cannot cancel another invalid one.
Numeric-looking bracketed tokens are examined even without the word “source”.
An explicit attribution such as “source []” or “source [unknown]” is an invalid
attempt. Empty markers after claims also fail, while ordinary empty-array and
assignment literals stay text. Ordinary bracket labels, numeric inline Markdown links, fenced and
backtick code, and explicitly labeled quoted literals stay text in the UI.
The chat renders plain text and citation buttons, not a general Markdown viewer.

A citation-free answer is eligible only for a narrow whole-answer refusal such
as “I could not find this in the document” or “I cannot determine that from the
supplied documents.” Additional uncited factual sentences do not qualify. Other
free-form refusals can also fall outside this conservative rule. They are still
shown and may require a fresh generation on retry. Structural validation does
not establish that a cited passage supports every claim.

The stream validates its accumulated final text. A write requires a completed,
valid, uninterrupted answer and the same eligible public snapshot at HTTP EOF.
On lookup the server validates the cached text against this request’s retrieved
source count before sending headers or text. Failure removes only that key and
runs ordinary miss handling. The process-local public cache remains off by
default. Evaluation caches, private uploads and conversation histories are
outside this repair. Streaming clients can see invalid text before the final
warning. The answer is neither rewritten nor silently cached.

### Code-boundary repair

The second audit found that a line such as `` ```x = 3``` `` was incorrectly
treated as an opening fence. The former regular expression searched only later
lines for a closing fence, then skipped to the end of the answer if none existed.
That hid a subsequent `According to source [-1]` even when [1] appeared earlier.

`lib/citation-code.ts` now separates code from prose before reference extraction.
It follows the relevant [CommonMark code rules](https://spec.commonmark.org/0.31.2/):
inline spans close with an exactly matching backtick run; fences are line-oriented,
indented at most three spaces relative to their container, and close with the same
character and at least the opening length. A backtick fence's info string cannot
contain backticks. Tilde fences, trailing closing whitespace, indented code,
ordinary list-item code and LF/CRLF/CR line endings are covered. Matching code is
masked with equal-length placeholders, preserving source-button offsets in the
unaltered answer. Explicit prose attribution such as `source \`[-1]\`` is still
validated, while `items[-1]` inside genuine code remains a literal.

Unclosed or mismatched delimiters return `ambiguous-code`, which is invalid for
storage and replay even if an earlier [1] is valid. This is intentionally stricter
than CommonMark's literal fallback for unmatched inline delimiters. The scanner
is a bounded citation policy, not a complete Markdown renderer: exotic nested
containers and block quotes may conservatively lose cache eligibility. The UI
continues to display code delimiters as plain text. Both UI and server share the
same code masking; only valid references become buttons. No new dependency,
answer rewrite, prompt change or cache namespace reset is needed. Existing
read-time validation evicts each invalid historical entry individually.
