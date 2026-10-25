# STEP 2 human-review checkpoint — 2026-10-25

STEP 2 NOT COMPLETE. Stopped at Task 3 of the latest request, awaiting actual
independent labels. No human receipt or official baseline has been created.
The existing 100-question golden review does not approve these 14 separate cases.

## What was prepared

- HUMAN_REVIEW.md: editable packet, neutral shuffled IDs R01–R14, all 14 saved
  questions/answers/reference answers, 28 exact source excerpts, citation occurrences,
  the established rubric, and six blank fields per case. No proposed scores or
  revealing category names appear in the reviewer packet. All 14 entries remain blank.
- BEGINNER_REVIEW.md: opening/saving instructions and common mistakes, replacing
  the prior guide that exposed proposed labels. Its old version remains in Git.
- review-packet.json: label-free packet; review-packet-map.json: internal mapping to
  the historical case IDs, packet/template hashes and documented evidence changes.
  Reviewers should not open the internal mapping or old case/results files first.
- eval.review_packet: read-only evidence/format/partial-progress check. It never
  writes a human receipt, trusts a plan approval, or automatically approves labels.
- Seven new tests cover pending/uncertain entries, malformed scores/citations,
  missing citations, and exact source evidence. Existing tests/thresholds are unchanged.

The 14 answers are assistant-authored controlled calibration fixtures, not actual
Qwen-generated benchmark answers. The packet explicitly discloses that provenance.
The prior FastAPI excerpt [2] was a paraphrase absent from the saved source. In this
new packet it was replaced with an exact source sentence for all seven FastAPI
cases. Historical cases/results remain byte-for-byte unchanged. Affected calibration
predictions must be recalculated for the new evidence after human labeling; old
agreement cannot validate the revised packet. No answer prompt, judge rubric,
acceptance threshold, retrieval code or benchmark answer was changed.

The old guide exposed proposed labels. The new packet asks whether the reviewer
saw them; prior exposure cannot be erased by hiding labels now. This small set also
helped tune the existing judge prompt and covers only two simple topics. Human
agreement on it can provide a limited check, not broad held-out reliability. If a
broader or fully blind claim is needed, additional independently labeled, unseen
examples will be required; no such claim is currently made.

The legacy calibration tool still compares proposed labels. After genuine review,
it must be adapted to compare the independently recorded labels, preserve any
human disagreement and bind review evidence to the new packet hash. Creating its
legacy confirmation receipt without that work would not satisfy this request.

## Actual checks

All 14 commands in the documented checkpoint sequence exited 0 on the final run.
Both saved runs contain all 100 valid records; exact Recall@5 remains 0.9625 in each.
Actual installed Qwen and embedding model digests match the recorded configuration.
Original Gemini preservation: 20/20 pairs, cache bytes and 151 vectors unchanged.
Historical artifacts and the six prior commits were independently checked unchanged.
No real .env values were found in tracked/untracked deliverables.

make lint: exit 0.
make test: exit 0; 85 Python + 29 TypeScript = 114 passed, 0 failed.
make build-fe: exit 0.
Git diff check: exit 0.
Packet check: exit 0; all 28 source excerpts verified; 0/14 human entries complete.
The exact commands and exit codes are in review-checkpoint-verification.json.

Earlier in this turn the preservation check failed because native PostgreSQL was
stopped (connection refused). Starting the existing owned server with make up
resolved it; no database was deleted or reinstalled. A line-length lint error in
new review_packet.py was corrected. The entire checkpoint list was restarted after
that fix and passed. The nonfatal Node module.register deprecation warning remains.
The positive baseline gate was not run at this mandatory human checkpoint; no
verified baseline exists. Prior negative-gate evidence remains preserved.

## Saved metrics and latency inspection

Retrieval metrics recomputed from both saved outputs: Recall@3 0.93125,
Recall@5 0.9625, Recall@10 0.99375, MRR 0.95875.
No final baseline scores are approved. Historical citation accuracy 1.0,
faithfulness 0.995 and correctness 0.975 remain provisional judge estimates.
Citation accuracy uses per-occurrence semantic-support judgments, not mere bracket
format or presence. All 298 citation occurrences were marked supported by Qwen;
there were no missing-citation penalties in this run. Arithmetic/schema validation
does not independently establish that all 298 claims are supported.

The first saved run has 84 rows with embedding and answer cache misses and no hits.
This uncached subset gives the following observed milliseconds:

| Stage | p50 | p95 |
| --- | --- | --- |
| Retrieval | 35.82189600000001 | 40.918737499999985 |
| Generation | 5367.915 | 12024.044185699999 |
| Retrieval + generation pipeline | 5403.9123965 | 12066.28440615 |

Judging, process startup, ingestion and calibration are excluded. This is a subset
of a resumed run, not a separately sampled cold-start or unconditional end-to-end
benchmark. IDs, selection rule and source hash are saved in
local-review-checkpoint-analysis.json. No extra model calls were made.
Cached reruns do not prove fresh-generation determinism. Paid API charges: ₹0.

## Original 16-task audit at this checkpoint

1. Local API/model identity: verified, original smoke evidence preserved.
2. Hardware/settings: recorded evidence preserved; configuration unchanged.
3. Local embeddings: installed digest verified; 768-dimensional evidence preserved.
4. Index isolation: unchanged; Gemini vectors verified preserved.
5. Corpus reuse: all saved chunk/source mappings pass verification.
6. Optional provider: unchanged; provider tests and build pass.
7. Gemini caches: preservation check passes.
8. Golden dataset: all 100 reviewed records pass saved-result verification.
9. Retrieval: both full runs recomputed and verified.
10. Answers: all 100 saved answers valid; no unnecessary regeneration.
11. Judge validation: PENDING independent human labels and corresponding comparison.
12. Verified baseline: PENDING; diagnostic files remain provisional.
13. Reproducibility: exact stored Recall@5 matches; cache caveat retained.
14. Positive gate: PENDING verified baseline; prior negative tests preserved.
15. Documentation: updated review instructions and command adaptation.
16. Full final verification: PENDING all human-dependent checks; current checkpoint passes.

Active branch: feat/production-rag. Repository: https://github.com/abhi0874/DocRAG.
All changes/commits remain local; no push, PR, merge, deployment, new model download,
paid service, or STEP 3 work occurred. Existing application code was not modified.

Next action: the user fills the six fields for each R01–R14 in HUMAN_REVIEW.md,
records prior exposure, saves, and replies "Review file saved". Partial entries and
uncertainty are preserved. Actual decisions are required; approving the technical
plan or replying "done" alone does not establish independent labels.

STEP 2 NOT COMPLETE
Errors/issues: Independent human review has not occurred; judge/baseline remain unvalidated.
Pending tasks: Human labels, calibration comparison, verified baseline, positive gate and final checks.
DO NOT PROCEED TO NEXT STEP.
