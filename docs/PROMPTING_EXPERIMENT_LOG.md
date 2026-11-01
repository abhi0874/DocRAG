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

Final selection, measurements, restoration and completion audit remain pending.
