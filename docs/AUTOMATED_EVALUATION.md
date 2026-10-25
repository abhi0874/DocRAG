# Automated evaluation

The user authorized this methodology after prioritizing answer reliability over
whether the reviewer is human or AI, and accepted the neutral name "automated
evaluation" with accurate technical disclosure. This replaces the previous
requirement for independently recorded human calibration labels. It does not
change the model, prompts, metric definitions, dataset or numeric thresholds.

## What the evaluation establishes

The baseline contains actual outputs for the same 100 reviewed public-documentation
questions. Retrieval metrics are computed from the saved rankings and source IDs.
Qwen3.8 judges answer faithfulness, correctness and the semantic support of each
citation using the recorded rubric. It is also the answer-generation model.
These are automated judge estimates, not guarantees that every answer is correct.

The 14 calibration reference decisions were suggested by AI and personally checked
against evidence by the user. Their original provenance is preserved in
submitted-review.json; they are not independent or blind human labels. The current
calibration uses the corrected packet's exact saved excerpts, including the repaired
FastAPI sentence. It compares real Qwen judgments with those submitted decisions,
not with silently replaced reference labels. This small set covers two simple
subjects and was influenced by prior prompt development. Passing is a narrow
consistency check, not a held-out accuracy estimate or proof of broad reliability.

The previously prepared fresh blinded set remains 0/14 reviewed and is not used
as a completed human calibration set. Its files and withheld metadata are retained.
The 100-question golden dataset's earlier human review remains separate and valid.

## Acceptance and regression checks

Existing calibration criteria remain: at least 14 cases; exact agreement of at
least 90% for faithfulness, correctness and substantive-claim flags; at least 95%
for per-case citation-support lists; all designated critical cases must match every
label. Failed calibration cannot be promoted. Scores or labels are not changed to
force agreement. The actual report includes per-category results and disagreements.

Recall@5 or faithfulness drops strictly greater than 0.02 fail the regression gate.
Exactly 0.02 is permitted under the existing contract. The gate also rejects
incompatible dataset, corpus, metric definitions, model/configuration or validation
protocol identities. Both degraded-metric CLI tests must fail with a Regression
error. Passing the gate means no measured regression relative to this baseline;
it does not mean absolute correctness.

## Preserve measurements when validating

The two complete diagnostic runs remain unchanged. No 100-question regeneration
is required when the answer/judge prompts and model settings are unchanged.
`eval.promote_local` validates each source run, records its exact SHA-256 and
retains all question rows, metrics, cache statistics, timings and original code
provenance. It changes only the completion status and adds evaluation_validation,
which records the approved method, calibration report hash, protocol hash, validator
revision and code hashes. The verifier rejects any other change to measurements.

The original judge_calibration object remains historical, including its pending
independent-human status. The separate evaluation_validation object declares the
current method and independent_human_validation=false. These are distinct facts,
not a fabricated review receipt. The top-level human_review field concerns only
the golden dataset. An existing baseline cannot be overwritten with another run.

Follow the authorized automated-completion sequence in COMMAND_CONTRACT.md.
For later local runs, run AI_PROVIDER=ollama make eval, make local-validate-results,
then AI_PROVIDER=ollama make eval-gate. Validation retains a hash-named immutable
copy of a new raw run before adding its methodology record. Preserve/commit that
source alongside any published result. The immutable original baseline is retained.
Changed judge settings/rubrics require compatible calibration and rescoring; changed
answers/retrieval require actual measurements rather than editing historical rows.

## Performance and scope limitations

The first complete 100-question run mixed cached and fresh responses. Its p50/p95
pipeline latency excludes judging, process startup and model pacing. The separate
84-question uncached subset is documented in local-review-checkpoint-analysis.json;
it is not a separately sampled cold-start benchmark. The second full run reused
all model responses. Exact retrieval repeatability does not prove fresh-generation
or fresh-judge determinism. Token counts on cache hits describe historical calls;
document ingestion is excluded from the per-query usage total.

Citation accuracy 1.0 means the judge marked all measured citation occurrences
supported, not that independent humans verified every claim. Quality metrics below
1.0 indicate known model-scored limitations; the final report identifies them.
The corpus is only two English documentation documents / 12 source pages, and this
benchmark does not test all possible questions, uploads, prompt injection, or
multi-turn behavior. Improving retrieval or answer handling belongs to subsequent
steps. Online deployment for recruiters is also separate from this local benchmark.

Gemini remains the default application provider. Its earlier 20/100 evaluation is
incomplete and kept separate; no Gemini result is presented as a local-model result.
All inference here is through local Ollama; paid API charges are zero. Electricity
and hardware costs are not claimed to be zero. No GitHub push is authorized.
