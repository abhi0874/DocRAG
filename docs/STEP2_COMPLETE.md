# STEP 2 complete — automated evaluation

Completed under the user's revised automated-evaluation methodology. This report
supersedes the earlier pending-review checkpoints without rewriting their history.
It does not certify perfect answers or independent human validation. No STEP 3
changes, push, PR, merge, deployment or paid service were performed.

Repository: https://github.com/abhi0874/DocRAG
Branch: feat/production-rag
Previous STEP 0/1 audit: preserved; current tests/build and data checks pass.
Original task groups: 16/16 complete under the authorized methodology revision.
Verification: 30/30 commands exited 0, plus both negative regression tests correctly
exited 1. Tests: 98 Python + 29 TypeScript = 127 passed, 0 failed.
The focused 30 metric tests are included in the 98, not counted again.

## What changed

The new automated protocol checks the recorded reference decisions against actual
Qwen judgments on the corrected 14-case source packet. The prompt, models, dataset,
reference decisions, numeric acceptance and regression thresholds are unchanged.
The reference decisions were AI-suggested and personally checked against evidence
by the user; they are not independent/blind human labels. The user accepted automated
 evaluation with accurate technical disclosure in place of the earlier requirement.
The unused fresh blinded packet remains preserved with zero completed labels.

Original 100-question outputs remain untouched. New validated result files retain
every original row, score, timing, cache count and generation-code hash. Only an
explicit evaluation_validation record and complete-under-that-protocol status are
added. The validator checks the source hash, exact unchanged measurement content,
recorded code revisions, active calibration identity and compatible model settings.
No human-review receipt was fabricated. No 100-question model calls were repeated.

## Calibration evidence

14/14 cases completed with actual local Qwen judging of the corrected packet.
All four dimensions matched the submitted reference decisions exactly: faithfulness,
correctness, citation-support lists and substantive-claim flags each had agreement
1.0. Every critical case passed; no disagreements were observed. Against those
reference labels, citation false positives and false negatives were both zero.
All seven categories had 2/2 cases matching every label. The existing criteria
remain at least 90% for F/C/claim flags, 95% for citation lists, and every critical
case matching all labels. These thresholds were not relaxed.

The sample is small, covers two simple topics, and includes prior prompt-development
influence. Qwen judges its own generated answers. This narrow consistency check
cannot establish broad accuracy or eliminate correlated mistakes. The technical
method and source-label provenance are in AUTOMATED_EVALUATION.md and the protocol.

## Baseline metrics

100/100 answers and retrieval evaluations; retrieval aggregates use 80 answerable
questions. Twenty intentionally unanswerable questions assess refusal behavior.

| Metric | Measured value |
| --- | --- |
| recall@3 | 0.93125 |
| recall@5 | 0.9625 |
| recall@10 | 0.99375 |
| mrr | 0.95875 |
| citation_accuracy | 1.0 |
| citation_supported | 298 |
| citation_denominator | 298 |
| faithfulness | 0.995 |
| correctness | 0.975 |
| p50_latency_ms | 5165.6565835 |
| p95_latency_ms | 11939.51523895 |
| answerable_count | 80 |
| unanswerable_count | 20 |
| tokens_per_query | 6443.79 |
| tokens_unavailable_reason | None |
| estimated_cost_per_query_usd | 0 |
| cost_unavailable_reason | None |
| answer_tokens_per_query | 1592.21 |
| judge_tokens_per_query | 4823.64 |
| retrieval_p50_latency_ms | 31.57474949999998 |
| retrieval_p95_latency_ms | 40.85333749999998 |
| generation_p50_latency_ms | 5130.316666499999 |
| generation_p95_latency_ms | 11899.3349521 |

Faithfulness, correctness and citation accuracy are automated judge estimates.
Correctness 0.975 is a mean rubric score, not a claim that 97.5% of answers were
fully correct: the judge assigned 1 to 96 answers, 0.5 to three, and 0 to one.
Faithfulness was 1 for 99 answers and 0.5 for one. All 298 citation occurrences were
marked supported by the judge; this does not independently verify every citation.

Known measured weaknesses, preserved for later improvement:
- fastapi-033: incomplete handling of a nonexistent item / HTTP error.
- fastapi-035: confused the dependency example's default limit with the Query
  Parameters tutorial's different default; correctness 0.
- postgresql-037: omitted the foreign-key solution when retrieved passages focused
  on joins.
- postgresql-038: incomplete treatment of savepoints and grouped filtering.

There is also a judge limitation in postgresql-038: its rationale appears to mix
full-reference information into the faithfulness assessment, although faithfulness
should use retrieved excerpts only. It says HAVING was not explicitly stated even
though the answer mentions HAVING. This is retained as an observed scoring concern;
no score was manually raised or silently corrected. Automated quality estimates
must not be presented as independently verified truth. The 14-case agreement did
not reveal this more complex multi-source issue.

## Latency, usage and reproducibility

The baseline's first complete run mixed cached and fresh responses: 16 embedding
hits / 84 misses; 16 answer hits / 84 misses; 15 judge hits / 85 misses. Pipeline
latency excludes judging, startup, ingestion and pacing. It is not unconditional
fresh end-to-end latency. The second run had 100 hits and zero misses for each model
operation; SQL retrieval was rerun. Both exact Recall@5 values are 0.9625.
Cached repeatability does not prove fresh-generation or fresh-judge determinism.

Separately measured from the existing 84 rows with no embedding/answer cache hits:
- retrieval p50/p95: 35.82189600000001 / 40.918737499999985 ms;
- generation p50/p95: 5367.915 / 12024.044185699999 ms;
- pipeline p50/p95: 5403.9123965 / 12066.28440615 ms.
This is a subset of a resumed run, not a separately sampled cold-start experiment.
Provider token usage on cache hits is historical. Per-query totals include query
embedding, answer and judging attempts, but exclude document ingestion. The legacy
raw token-caveat phrase "amortized separately" does not supply an ingestion total.
Paid API charges: ₹0; electricity and hardware costs are not asserted to be zero.

## Provenance

Ollama 0.40.9; qwen3.8:latest, nvfp4, MLX, fixed context 32768, output cap 2048,
temperature 0 and requested seed 42. Full options are in the baseline configuration.
Qwen digest: 47951e4a666180bc2aedfc93c169472f2de783696fe196efbf063f5730ecf163
EmbeddingGemma: embeddinggemma:300m, 768-dimensional vectors.
Embedding digest: 85462619ee721b466c5927d109d4cb765861907d5417b9109caebc4e614679f1
Fresh actual local chat and embedding checks passed; Qwen reported 100% GPU.
Corpus: 2 documents, 12 source pages, 151 original chunks in an isolated local index.
Dataset SHA-256: 1867147d2667a2745d6cf0b2139225395f2599a1b68803fb37356964febab78b
Corpus SHA-256: d496bb83aa5750d540b25a4395657e2c238d237e2e187e9ec192c7246a7f579c
Measurement implementation revision: 326210ce69d6a2fad4f8335eb8741dee69ab637c.
Validation implementation revision: b76eaaf (full revision/code hashes in results).
Original dirty-at-generation-start flag is retained, not rewritten as clean.

Original Gemini preservation passed after all work: 20/20 answer/judge pairs,
recorded cache bytes, and all 151 original vectors unchanged. Gemini remains the
application default and its provider/route tests and production build pass. No
new Gemini live inference was needed; historical real checks remain preserved.

## Verification commands

| Actual command | Exit |
| --- | --- |
| git remote -v | 0 |
| git branch --show-current | 0 |
| git status --short | 0 |
| git log -5 --oneline | 0 |
| make up | 0 |
| ollama --version | 0 |
| ollama list | 0 |
| ollama show qwen3.8:latest | 0 |
| curl --fail --silent --show-error http://localhost:11434/api/tags | 0 |
| make local-check | 0 |
| make local-ingest | 0 |
| make local-ingest | 0 |
| .venv/bin/python -m eval.preservation | 0 |
| .venv/bin/python -m eval.validate_dataset --require-review | 0 |
| .venv/bin/python -m pytest tests/test_metrics.py -q | 0 |
| make local-calibrate-automated | 0 |
| .venv/bin/python -m eval.automated_validation --verify | 0 |
| .venv/bin/python -m eval.verify_results --diagnostic --baseline eval/results/diagnostic-local-ollama-first.json --current eval/results/diagnostic-local-ollama-second.json | 0 |
| .venv/bin/python -m eval.promote_local --source eval/results/diagnostic-local-ollama-first.json --out eval/results/baseline-local-ollama.json | 0 |
| .venv/bin/python -m eval.promote_local --source eval/results/diagnostic-local-ollama-second.json --out eval/results/latest-local-ollama.json | 0 |
| cp eval/results/latest-local-ollama.json eval/results/validated-local-ollama-second.json | 0 |
| env AI_PROVIDER=ollama make eval-gate | 0 |
| .venv/bin/python -m eval.verify_results --baseline eval/results/baseline-local-ollama.json --current eval/results/validated-local-ollama-second.json --out eval/results/reproducibility-local.json | 0 |
| make lint | 0 |
| make test | 0 |
| make build-fe | 0 |
| .venv/bin/python -m eval.preservation | 0 |
| git diff --check | 0 |
| git status --short | 0 |
| git log -5 --oneline | 0 |

The positive gate returned zero decreases for Recall@5 and faithfulness. Both
synthetic decreases of 0.020000000001 were rejected by the actual CLI with exit 1
and the appropriate Regression message. Synthetic scores are not baseline scores.
A line-length lint issue in the new code was fixed before the complete sequence;
the full final sequence passed. Node emitted a nonfatal module.register deprecation.
The missing tracked review Markdown was restored from its committed copy; saved
submitted labels were never changed.

## Original 16-group completion audit

1. Installed local Ollama API/digest/chat: passed.
2. Hardware, acceleration and fixed runtime settings: recorded and preserved.
3. Approved embedding installation, actual finite 768-dimensional output: verified.
4. Separate native index: verified; Gemini vectors preserved.
5. Existing corpus/source IDs: verified without rechunking or reference edits.
6. Optional TypeScript provider: preserved; Gemini default; tests/build pass.
7. Twenty Gemini records/caches: integrity verified before/after.
8. Existing 100-question human-reviewed dataset: valid, unchanged.
9. Retrieval metrics: all 100 results recomputed/validated; answerable aggregate defined.
10. Qwen answers: 100 complete saved outputs, cached safely and preserved.
11. Judge calibration: passed under the explicitly revised automated protocol;
    independent-human validation is NOT claimed.
12. Complete local baseline: saved with original measurement and new validation provenance.
13. Two completed runs: preserved and verified with exact matching Recall@5.
14. Positive gate and both negative regression checks: passed with original thresholds.
15. Workflow/method/limitations/uninstallation documentation: available and updated.
16. Full applicable revised verification: all 30 commands passed; no push or STEP 3.

All three original confirmation groups pass under the revised methodology, not
under the superseded independent-human requirement. There are no unresolved
verification blockers. Model-quality limitations remain and are explicitly listed.

The completed local benchmark measures DocRAG with Ollama using the recorded local
models and evaluation configuration. The earlier Gemini-specific evaluation remains
incomplete at 20/100 and has been preserved separately. No Gemini benchmark results
have been fabricated or represented as local-model results.

STEP 2 COMPLETE
No errors found and all tasks completed.
Can proceed to the next step.
