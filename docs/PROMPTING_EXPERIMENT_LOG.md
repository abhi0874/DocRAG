# Step 6 experiment log

## Fixed protocol

The previous-step audit passed at `8172c03`. Commit `50a2f17` recorded the audit,
original failure evidence and one-candidate selection policy before implementation.
The existing 60/40 development/holdout split is reused. It is not unseen data.
The original `step5-v1` prompt and the frozen `grounded-v1` candidate use identical
questions, public corpus, selected 162 chunks, hybrid retrieval, model digests,
generation settings and judge rubric. Production response caching is disabled
during both full quality runs. No paid provider is used.

## Implementation and interrupted attempts

- `124cd72`: versioned grounded instructions, structured evidence, citation checks,
  public-only response cache and UI metadata.
- `4583bb2`: controlled prompt comparison and real production HTTP measurements.
- `1e77c8a`: defer cache writes until completed HTTP streams. A partial control
  evaluation was stopped after review found that model completion alone could
  precede HTTP completion. Its log remains `.local/step6-control-evaluation.log`.
- `ecbabe1`: release a cache writer exactly once across cancellation and cleanup.
  The second partial control run was stopped for this correction; its log remains
  `.local/step6-control-final.log`.

Neither partial attempt is reported as a full evaluation. Existing disk caches
are keyed by full prompt/configuration/context identities; changed application
hashes prevent incompatible reuse. Tests cover both partial and late HTTP
cancellation, upstream failure, invalid citations and simultaneous requests.

The completed control run at `ecbabe1` saved
`eval/results/prompting/step5-v1-raw.json`: all 100 answer calls and all 100 judge
calls were fresh. Its observed faithfulness is 0.995, correctness 0.99 and citation
accuracy 1.0. The unsupported foreign-key assertion recurred in `postgresql-037`;
the cited join explanation remained supported. This is not hidden by aggregate
citation accuracy. The original Step 5 baseline remains unchanged.

## November 1 recovery

On resumption, the control result was complete but the candidate log ended after
four questions. No evaluation or Ollama server process remained, and the native
PostgreSQL cluster was stopped. The existing cluster was restarted without reset.
The preserved Ollama 0.40.9 binary's SHA-256 matched
`be4b054f8ebf8b3b185daa30671849a80f22c2b2ef45e064de562f69aba46a96`.
The already paused desktop supervisor was identified before restarting the
benchmark runtime. No models were downloaded or removed.

Lint and 151 Python plus 108 TypeScript tests passed. The first production build
could not fetch the existing Geist fonts under network restrictions. The complete
verification sequence was rerun with the network access needed for those fonts;
no build checks were disabled and no font implementation was changed.

The resumed candidate run must disclose its actual evaluation cache counts.
Cached answer timing is not fresh inference timing. Separate production HTTP
experiments measure cache benefit on a matched six-question sample; the full
100-question quality comparison does not establish cache speedups.

The sections below record the subsequent selection and measurements.

## Final quality selection

Both 100-question runs passed provenance and ranked-evidence verification. The
control had 100 fresh answer calls and 100 fresh judge calls. The candidate
reused five matching answers and four matching judgments. Its fifth cached
answer had finished before the earlier interruption, but its judgment had not.
The exact experiment configuration hashes, question IDs and cache counts are in
the two verified result files under `eval/results/prompting/`.

The 60-question development correctness fell from 0.9833333333333333 to 0.975.
Development faithfulness rose from 0.9916666666666667 to 1.0. All three quality
averages were 1.0 for both prompts on the 40-question holdout. The frozen policy
therefore selected `step5-v1`. Commit `8f531ac` sets that default. Its instructions
are the same ones explicitly tested in the fresh 100-question control. Both
versioned prompts remain available. No question-specific retuning was performed.

Four questions changed faithfulness or correctness:

| Question | Control F/C | Candidate F/C | Evidence review |
| --- | --- | --- | --- |
| fastapi-036 | 1/1 | 1/0.5 | The candidate describes both dependency checks and exceptions, but hedges on connecting them into a direct solution. |
| postgresql-005 | 1/0.5 | 1/1 | The candidate explicitly says the savepoint remains defined after rollback. The selected original prompt omitted this detail. |
| postgresql-031 | 1/1 | 1/0.5 | The six passages support the price constraints but lack transaction instructions. The candidate correctly acknowledges the gap. The control supplies transaction syntax anyway. Its judge rationale uses the broader references to credit the claim. Manual passage inspection identified this additional grounding failure despite the control's automated F=1. |
| postgresql-037 | 0.5/0.5 | 1/0.5 | The candidate explains the join with [3][5] and declines to establish the missing constraint. The control supplies the unsupported foreign-key mechanism before acknowledging the gap. |

Both prompts appropriately declined all 20 deliberately unanswerable questions.
The candidate often listed unrelated background facts from the passages. The
judge marked 17 of its correct refusals as containing substantive background
claims. The refusal summary uses the unchanged correctness and faithfulness
labels for these unanswerable questions. All 20 actual texts were also checked
for an explicit gap. Neither the judge rubric nor the selection rule changed.
There were zero incorrect full refusals among 80 answerable questions for both.
The automated unsupported-answer counts were 1/100 for the control and 0/100 for
the candidate. The control's manually observed unsupported transaction claim
illustrates why the automated count is a lower bound in this run.

Candidate synthetic tests returned automated F/C=1/1 in all six cases. The
answerable, absent, partial and conflict probes addressed the requested facts or
gaps. The direct instruction override did not produce its requested marker. In
the forged-reference probe the candidate answered COMMIT with [1], but also
quoted [999] in an explanation and emitted a closing thinking tag. The structural
validator rejected that output. This is a diagnostic failure of output hygiene,
even though the judge scored its factual answer highly. Counts do not establish
general resistance to injection.

## Final citation check and interpretation of measurements

A separate run of the selected prompt passed the direct instruction-override
test but incorrectly refused the forged-reference question despite an answer
being present. The original selected receipt remains `selected-diagnostics.json`.
The citation fix in `71a0c85` clarifies the assignment of references only when
a passage contains a numeric reference beyond the available evidence. The
original text remains available in full. The final selected probe now answers
COMMIT with [1]. All six final probes pass F/C and structural checks.
The 200/200 effective instruction comparisons in
`final-prompt-equivalence.json` verified compatibility for both full runs.
The guard is based on source formatting, without question IDs or holdout labels.

Control configuration SHA-256:
`e89c59c2577e6278d45e5b31f0cee5776a9d309cdef632458284500f2e793619`.

Candidate configuration SHA-256:
`b8e79808e732f977ccf20d55fcd6a5cd4bd1e9239e50d5a562d294d3dcdc3b38`.

The selected prompt generated 12 real HTTP hits on 18 eligible requests,
avoiding 19,018 reported tokens on the final wire-protocol build. The complete matched-condition table and
measurement limits are in `PROMPTING_AND_CACHING.md`.

## Browser protocol correction

The first browser verification showed two assistant entries for one answer.
Source and cache data reached the React client before it received the assistant
message ID. The initial entry contained only metadata. Both entries showed
the replay label on a hit. Commit `92576e8` emits one start event before data
and disables the nested stream's second start. Both MISS and HIT tests now check
the ID-bearing first event and the single start event. The fix affects the UI
stream envelope. The prompt, retrieval, generated text and judge inputs are
unchanged. Final HTTP, cold/warm and streaming-mode receipts use filenames
beginning with `final-`.

On the final build, all six probes for each prompt passed automated F/C,
structural validation and the marker check. The candidate's corrected forged
reference answer cites [1] and omits [999]. The original negative examples and
the final outputs are both retained. The browser replay and older-message source
checks passed. After the last model check, the benchmark listener was stopped,
the original desktop supervisor was resumed, and its 0.40.11 listener and the
two expected model digests were verified. See `runtime-restoration.json`.
