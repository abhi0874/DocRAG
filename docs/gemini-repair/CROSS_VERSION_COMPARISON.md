# Comparing historical DocRAG measurements

Use the cross-version command to compare the quality of two committed, validated 100-question local Ollama measurements whose application code differs. Provide the two real artifact paths. The command reads both results and their original provisional measurements, checks their bytes against Git, and invokes the existing result verifier on each. Run from the repository root with the verified local corpus mapping available.

```sh
.venv/bin/python -m eval.cross_version \
  --baseline eval/results/observability/ui-redesign-d/evaluation.json \
  --candidate eval/results/observability/grounding-repair-a/evaluation.json
```

The output identifies both measured commits, cleanliness at the start, file and configuration hashes, raw measurement hashes, identical dataset and corpus, calibration protocol, judge rubric, model digests and options, and fresh/cache counts checked against every question. It lists each changed measured application hash and the number of identical ranked-evidence rows. The verifier independently recomputes per-row and aggregate scores and checks source hashes against the recorded revisions.

The procedure requires the same evaluation and validator implementations, ordinary configuration, reviewed labels, and scoring definitions. One historical instrumentation change is recognized by its two exact evaluator file hashes and its exact five newly inventoried application paths. Its repository diff added those paths to the measurement inventory. Other evaluator differences or unexplained inventory changes stop the comparison. Cache hits retain the provenance of the recorded run and do not constitute fresh model calls. For a dirty historical checkout, Git validates only the measured files covered by its hashes.

Exit 0 means the two numerical thresholds passed. An exact decimal drop greater than .02 in Recall@5 or faithfulness returns exit 1. Incompatible or unverifiable evidence also returns exit 1 with a diagnostic. Correctness and citation accuracy are reported separately. This command cannot certify a release or a candidate's full acceptance criteria.

## Historical results

| Measurement | Source | Fresh embeddings / answers / judges | Correctness | Faithfulness | Citations |
|---|---|---:|---:|---:|---:|
| STEP 9 prerequisite | `df312319`, clean | 0 / 0 / 0 | .990 | 1.000 | 264/264 |
| UI redesign | `b40319cc`, dirty at measurement start | 100 / 100 / 15 | .990 | 1.000 | 265/265 |
| Grounding repair | `ddb0e0c2`, clean | 100 / 100 / 100 | .970 | 1.000 | 267/267 |

The STEP 9 run reused 100 embeddings, 100 answers and 100 judgments. The UI run reused 85 judgments. Both baseline comparisons have identical rankings on all 100 questions, Recall@5 of .975, and zero decrease in either threshold metric. The observed .020 correctness loss remains. The reports measure different releases and do not isolate its cause.

The original same-configuration gate still rejects UI redesign versus grounding repair with exit 1 for incompatible configuration hashes. The original STEP 11 deployment gate still rejects STEP 10 final versus grounding repair with exit 1 for undeclared implementation changes. Its declared transition is narrower than the changes across these releases. The original negative controls reject a decrease of .020000000001 in either threshold metric. All historical artifacts and original gate implementations retain their original bytes.
