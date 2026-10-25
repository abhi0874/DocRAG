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
