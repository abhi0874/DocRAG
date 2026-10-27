# Step 3 chunking experiments (in progress)

## Previous-step audit

On 2026-10-26, existing checkout abhi0874/DocRAG, branch feat/production-rag,
HEAD 05a21a6 was clean. All four reported Step 2 commits remain in history.
Automated calibration verification, both 100-record result validations, positive
regression gate, and both deliberately degraded negative gates passed. Dataset
validation confirmed 100 unchanged questions and the original corpus hash.
Ollama tags/list confirmed both exact frozen model digests. Gemini preservation
confirmed 20 saved pairs and all 151 original vectors unchanged.
Lint, 98 Python tests, 29 TypeScript tests, and production build passed.
Sandbox network restrictions initially blocked Ollama and Google Fonts; the full
applicable audit sequence was repeated successfully with network access, without
code changes. This was an execution-permission adaptation, not a skipped check.

## Control and source interpretation

The original chunker uses 1000 UTF-16 code units with 200 code units overlap. It
collapses all whitespace, prefers the last period-space in its final 200-character
window, and discards chunks at most 20 characters long. It preserves page numbers
and consecutive chunk indexes but loses paragraph/heading boundaries and can
begin overlap mid-word. Its exact implementation is retained as legacy-v1.
PDF extraction uses unpdf extractText with mergePages:false. Only plain page text
is available: no reliable font/layout heading information. Heading-v1 detects
explicit Markdown, numbered, all-caps and trailing heading-marker lines, records
these as heuristics, and falls back to paragraph/sentence/word windows. It retains
short sections, normalizes whitespace and soft-hyphen/zero-width extraction
artifacts, preserves order and avoids splitting surrogate pairs. It does not infer
missing PDF page numbers, repair arbitrary hyphens or promise reliable OCR.

The corpus is the unchanged 12 saved HTML-derived public pages in two documents;
virtual page numbers are not physical PDF pages. Relevance remains source-page
IDs at original chunk ranks, without rank compression. Chunk IDs may change;
each chunk maps to the exact original source page and content hash. Section IDs
are deterministic within a source/configuration, not cross-configuration labels.

## Frozen experiment design

A: legacy-v1, 1000/200. B: heading-v1, 1000/200.
C: heading-v1, 700/140. D: heading-v1, 1400/280.
E: heading-v1, 1000/100. Sizes/overlaps are UTF-16 code units.

A deterministic seed-42 split is stratified by document and question type:
60 development questions and 40 held-out questions. Development chooses the
configuration by Recall@5, MRR, then multi-hop Recall@5, with the unchanged control
preferred on ties and fewer chunks as the next tie-breaker. Source checks are
mandatory. Unanswerable questions have no retrieval recall; their actual rankings
are retained and final refusal quality is evaluated end-to-end.
Selection is frozen before evaluating holdout for control and selected candidate.
All 100 questions were used in Step 2: this is not a new unbiased benchmark.

Each configuration has a separate owned native database with 768-dimensional
vectors. Control reproduces every original text and copies original local vectors.
The original Gemini and Ollama indexes remain untouched. All retrieval uses the
existing hybridSearch SQL, 12 candidates per method, RRF k=60, top 10 diagnostic
chunks and top 6 answer excerpts. No ranking or generation/judge prompt changes.

## Metadata and reversibility

Nullable JSON metadata is added through the existing idempotent init.sql mechanism.
It records source/section identifiers, detected title, content hash and config ID;
upload also records the actual document ID and filename. Existing rows can remain
null. No vectors are altered. Rollback can restore the legacy default and previous
application code while leaving the unused nullable column in place; no destructive
schema downgrade is necessary. Applying schema changes to deployed databases is
outside this local step.

Production default remains legacy-v1 until experimental evidence justifies a
change. Automated answer quality uses the unchanged approved protocol; its
reference decisions were AI-suggested and personally checked, not independently
blind human validated. Qwen self-judging and coarse source-page relevance remain
limitations.

## Retrieval results and frozen selection

All five development configurations completed. On the 48 answerable development
questions (60 total), measured Recall@5 / MRR were:

- Control 1000/200, 151 chunks: 0.9479166666666666 / 0.9520833333333333.
- Heading 1000/200, 195 chunks: 0.9479166666666666 / 0.9729166666666667.
- Heading 700/140, 261 chunks: 0.9166666666666666 / 0.9826388888888888.
- Heading 1400/280, 162 chunks: 0.9583333333333334 / 0.9756944444444444.
- Heading 1000/100, 189 chunks: 0.9479166666666666 / 0.9652777777777778.

The frozen rule selected 1400/280 before evaluating the held-out subset. It also
improved development multi-hop Recall@5 from 0.7916666666666666 to
0.8333333333333334. Its modest chunk-count increase is 11 chunks (about 7.28%).
The smaller configuration improved first-hit rank but worsened recall and required
261 chunks, so it was not selected. No parameter was tuned after holdout inspection.

On the 32 answerable held-out questions (40 total), control Recall@5 was 0.984375
and selected Recall@5 was 1.0; both had MRR 0.96875. Across the combined 100-question
retrieval measurement, control exactly reproduced original Recall@3/5/10 and MRR.
Selected Recall@3/5/10 = 0.95 / 0.975 / 1.0; MRR = 0.9729166666666667.
These are retrieval measurements, not yet acceptance of the complete answer system.
All original per-question rankings, timings, cache counts and chunk mappings are
saved under eval/results/chunking. Lengths use UTF-16 units. Retrieval latency
includes query embedding and SQL; ingestion time includes adapter startup. Control
embedding time is a vector-copy path, not newly measured inference. Resumed
requests can use cached embeddings, so timings are not a controlled cold benchmark.

## Retained failed attempts

The first control attempt assumed document IDs 1/2, while the preserved documents
use IDs 3/4. Its strict reproduction check rejected that assumption before creating
an index. The harness now reads actual identifiers from the preserved mapping.
A later first attempt at heading-1400-280 stopped after 26 development questions
with RuntimeError around the interrupted turn. Its original logger retained only
the exception type; the precise underlying error cannot now be established. The
server was available on resume. Completed configurations were verified and reused;
the incomplete configuration was rerun before selection. Both failure artifacts
remain saved. The logger now retains sanitized adapter/validation error messages.
An initial syntax error in a new test and formatting/import lint errors were fixed;
the full lint/test sequence passed afterwards, with existing tests preserved.

## Remaining Step 3 work

All-question answer generation/judging, final automated quality acceptance,
production-default decision, HTTP smoke check, comparison report and final task
audit are pending. This file does not declare Step 3 complete.

## Full selected-candidate outcome

The first complete selected run finished all 100 questions with zero cache hits:
100 fresh query embeddings, 100 fresh answers and 100 fresh judgments. Immutable
raw measurements are in chunking-selected-raw.json; chunking-selected.json adds
verified automated-method provenance. The original baseline remains byte-identical.

Baseline versus selected: Recall@3 0.93125 -> 0.95; Recall@5 0.9625 -> 0.975;
Recall@10 0.99375 -> 1.0; MRR 0.95875 -> 0.9729166666666667. Automated faithfulness
0.995 -> 1.0; automated correctness 0.975 -> 0.99; automated citation accuracy
1.0 -> 1.0 (298/298 original versus 268/268 selected citation occurrences).
Recall@5 gained 0.0125, or 1.25 percentage points, about 1.2987% relative.
MRR gained 0.0141666666666667, about 1.4776% relative. The machine comparison
retains full numeric differences and relative percentages, not rounded gate values.

The gate passes with exact decimal decreases -0.0125 in Recall@5 and -0.005 in
faithfulness; both original >0.02 regression limits are unchanged. All other model,
ranking, judge, prompt and metric settings are preserved and explicitly checked.
The selected production default for future PDF uploads is now heading-v1 1400/280.
Existing documents are not re-chunked. Both local application schemas receive only
the nullable metadata column; original vector values and indexes are preserved.
The legacy algorithm and all its existing behavior tests remain intact and explicit.

This improves measured retrieval and automated answer quality, not speed. First-run
pipeline p50/p95 were 5769.012625 / 13034.495908649997 ms. Original baseline aggregate
was 5165.6565835 / 11939.51523895 ms, but mixed 16 cached and 84 fresh answers. Its
84-fresh subset was 5403.9123965 / 12066.28440615 ms. These are observational,
unpaired timing comparisons, excluding judging/startup; background verification
also ran during evaluation. Selected retrieval p50/p95 were 60.2312915 /
66.68716904999998 ms and generation p50/p95 5708.036021 / 12969.903556849997 ms.
Do not interpret cached-repeat timings as a speed improvement.

The automated judge rated 98 answers fully correct and two partially correct:
postgresql-005 omitted that the savepoint remains defined after rollback;
postgresql-037 explained the inner join but did not retrieve enough evidence for
the foreign-key part. The latter was also incomplete in the baseline. The former
is a new partial answer. Earlier fastapi-033, fastapi-035 and postgresql-038 received
full correctness scores in this run. All 20 unanswerable cases scored 1 for
faithfulness/correctness. These are model judgments, not guarantees or independent
human validation. No answer or score was manually raised, and the rubric was not
changed. The original imperfect baseline and all candidate outputs are retained.
