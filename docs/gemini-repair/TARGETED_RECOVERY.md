# Targeted evidence selection and grounded synthesis

**Decision — no safe improvement.** Both experiments recovered their individual target answer. The selector lost unique evidence on independent documents. The synthesis experiment introduced unsupported or unattached citations. The application remains at the behavior measured at `ddb0e0c27284eef9986983ee211541eaee776209`. Neither candidate entered application code or the full 100-question evaluation. [Public trial records](TARGETED_RESULTS.json) · [Historical comparison procedure](CROSS_VERSION_COMPARISON.md)

## Which change mattered

The previous page-grouping experiment improved the join/aggregate answer, while its FastAPI answer remained incomplete. A single request with explicit clauses recovered neither target. Independent clause generation plus a neighboring passage recovered both. That third trial changed two variables. When its unchanged join-only context was used on the missing-foreign-key control, the judge scored the composite response .5 for faithfulness. Its rationale described incompleteness and identified no invented fact. Concatenation itself duplicated the canonical refusal on two cases and failed application validation. The measurements below separate the two interventions. A single output per configuration cannot establish a general causal effect across model runs. [Original traces](MULTIPASSAGE_REPAIR.md)

| Isolated change | Question | Historical → observed correctness | Faithfulness | Supported citations on target | One answer generation |
|---|---|---:|---:|---:|---:|
| A. Change one of six passages, retain original instructions | FastAPI dependency and HTTP exception, `fastapi-036` | 0 → 1 | 1 | 7/7 | 15.79 s, +129 prompt bytes |
| B. Change instructions, retain all six passages in order | PostgreSQL self-join and aggregate, `postgresql-040` | .5 → 1 | 1 | 6/6 | 9.68 s, +1,078 prompt bytes |
| B. Missing constraint control | PostgreSQL join without foreign-key evidence, `postgresql-037` | .5 → .5 | 1 | 1/1 | 5.79 s, +662 prompt bytes |

The timings are individual local observations, including stream consumption. Historical generation times for the two targets were 8.14 s and 8.70 s. The benchmark p50/p95 cannot be inferred from these trials. Each candidate kept one generation, six available context slots and the original hybrid search. The prototypes reused authorized saved rankings, with zero new retrieval queries or embedding requests. Their observed prompt-size changes ranged from −158 to +409 bytes for A and +507 to +1,082 bytes on active B trials. Neither demonstrated a speedup.

## A. Selection and displacement

The exception passage was available at rank ten. The six exposed passages were complete. Ranks one and two, chunks 93 and 90 on the same page, shared about 62% of the shorter excerpt's distinct word trigrams. The selector replaced a lower-ranked same-page near duplicate with an already retrieved preceding neighbor from a different page of the same document. This admitted chunk 72 alongside 73 and 92. One unchanged generator then explained the resource check and the terminating exception. The historical improvement did not require generating separate answers in this trial.

The rule changed nine of 100 saved windows and removed a previously cited passage in three. Those three fresh answers received full automated correctness and faithfulness, with 17/17 supported citations. The RRF rankings never changed. In a separate calculation using the proposed six followed by the remaining original ranks, only Recall@3 on `fastapi-035` and `fastapi-036` changed, each from .5 to 1. No per-row Recall@5/10 or MRR changed.

Two synthetic fixed rankings exposed the limitation of using shared boilerplate as a substitute for meaning. The rule removed the only sentence exempting sealed return trays from weighing in one, and the only record of a seven-day holding period in another. It replaced each with an adjacent ledger description. Both facts were available to the original selector. These are deterministic losses before generation. A was rejected.

## B. Synthesis, refusals and citation support

The six original passages for the PostgreSQL target already contained the self-join in excerpt 4 and the definition of an aggregate in excerpt 6. The candidate appended two verbatim lines selected separately against the two parts of the question, then requested one answer using the complete excerpts. It described aliasing and aggregation, and distinguished the missing worked example. The control about the missing constraint properly declined to name a foreign key. No trial assembled independently generated text.

The lookup activated on 12/100 reviewed questions. All 12 received a fresh focused answer and retained full automated faithfulness. Only the target improved in automated correctness. Development fixtures covered a valid two-step operation and an unsupported causal link. Six original held-out fixtures covered independent documents, conflicting notices, summaries, partial matches, linked steps and two missing facts. The lookup stayed inactive on those six. Three further held-out cases were verified to activate before inference: a superseded procedure, an unsupported handoff between facilities, and disagreement between current notices. All three received full automated scores in benchmark mode.

Two attribution failures disqualify B:

- **`fastapi-039`, benchmark prompt.** The original answer had six inline citations. A fresh control had four and no footer. The candidate finished its already cited answer and appended a separate paragraph containing only `[1]` and `[5]`. The judge marked 8/8 supported and citation syntax passed. The existing rubric rejects unattached references. Occurrences seven and eight have no attached claim. Both judge output and the independent finding are preserved.
- **Conflicting notices, actual `grounded-v1` workspace prompt.** The candidate cited `[1][2][3]` after saying the copper line's applicable hours were unknown. Excerpt 3 gives only the violet line's June dates. The control used excerpt 3 solely for those dates. Both completed the real evidence-header and exact-quotation validator. The candidate's final assignment still fails the per-claim citation requirement.

The stricter diagnostic screen also flagged a cited answer on a wholly unanswerable synthetic question. The lookup was inactive, its control behaved the same way, and both received full automated correctness. Another missing-facts pair showed the same behavior even with an active lookup. Both grounded workspace runs of that active pair returned one exact canonical refusal. These traces do not establish a new refusal regression.

A separate diagnostic with the benchmark prompt plus the workspace header returned malformed JSON for a superseded notice only under the candidate. The actual route selects `grounded-v1`; on that matched fixture the retained prompt failed JSON framing and the candidate passed. That retained limitation is recorded separately from the actual workspace attribution error. The validators were left intact.

## Verification and provenance

- Source checkout `5427a4477140876acae8c378bc7fe4a3ebd06acf`. Node 24.22.1, pnpm 11.25.0, Ollama 0.40.9, and both configured model digests were verified locally. The corpus contained 162 public chunks on the owned PostgreSQL instance at port 55433. The receipt records both digests and the frozen dataset, corpus, settings and configurations. The generated-answer diagnostics used saved evidence; they do not measure retrieval or HTTP latency.
- 43 completed fresh benchmark-style diagnostic answers. Their 43 unchanged-rubric judgments comprised 34 fresh and nine cache hits. An additional 21 completed diagnostic generations exercised stream/quote checks across two prompt modes. Interrupted probes are excluded from these counts. No full benchmark, Gemini calls or paid calls were made. Historical correctness .970, faithfulness 1.000, support 267/267 and unanswerable correctness 20/20 remain the verified aggregate. Recall@3/5/10 was .950/.975/1.000, MRR .972917. Historical pipeline p50/p95 was 5.85/10.26 s and retrieval p50/p95 40.09/85.18 ms.
- `make lint` and `make test` both exited 0. **231 Python plus 354 TypeScript tests passed**. The new tests replay all 100 stored selections, synthetic displacement, unattached citations, workspace attribution, and refusal behavior, and exercise the cross-version comparison's failure paths. The three-file focused replay also passed 27/27, exit 0. The existing tests retain exact-quote, evidence-only completion, security and cancellation controls.
- `python -m scripts.workspace_http --run-id targeted-recovery-a` exited 0. **63/63** checks on the retained application passed using an isolated synthetic database, including two-account access control, authentication, upload, indexing, public and personal questions, refusal, deletion and one cancellation. Ten fresh local generations were recorded by this separate HTTP suite.
- Both historical comparisons passed their numeric thresholds with unchanged rankings. The generic gate still rejects an incompatible configuration, the deployment gate still rejects undeclared changes, and each original just-over-.02 negative control exited 1. The same-configuration comparison of the verified artifact to itself exited 0. [Comparison details](CROSS_VERSION_COMPARISON.md)
- The application, golden data, selected corpus, original gates and historical measurements are preserved. CVE-2026-112366 remains an independent release hold. The repository, intended files, Git history and existing client assets passed the secret scan. Production was not contacted. The last reported release was `6458b35`. Paid usage ₹0.

Reproduce the offline trials with the pinned environment from the command contract:

```sh
pnpm exec vitest run tests/targeted-evidence.test.ts tests/multipassage-grounding.test.ts tests/workspace-evidence.test.ts
.venv/bin/python -m pytest -q tests/test_cross_version.py
```

The evaluation-only selector and prompt lookup are available in [targeted-evidence.ts](../../eval/diagnostics/targeted-evidence.ts). The evidence file retains exact answers, source assignments, per-occurrence judgments, full synthetic inputs, prompt hashes and timing. The accepted application imports neither experimental function.
