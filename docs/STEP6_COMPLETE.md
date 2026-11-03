# Step 6 verification report

Repository: `https://github.com/abhi0874/DocRAG`. Branch: `feat/production-rag`.
The Step 5 audit passed at `8172c03` before implementation. Step 6 retains
`step5-v1` as the default. Public exact-match caching is opt-in and private
uploads bypass it. MiniLM remains optional and disabled by default.

## Audit of all 18 requested tasks

| Task | Result and evidence |
| --- | --- |
| 1. Original generation | Original prompt, six ordered excerpts, limits, providers, streaming and evaluation caches recorded before implementation in `50a2f17`. |
| 2. Reproduce failures | Reference answers, retrieved passages, citations and original diagnostics are saved in `original-failures.json`. |
| 3. Versioned prompt | Both prompt versions run through shared generation. The one candidate was frozen before evaluation. Selection follows the recorded development rule. |
| 4. Structured evidence | Real chat carries document, chunk, title, source, section and page metadata. Available URL values are retained. The byte replay verifies all 200 prompt contexts. |
| 5. Citation contract | Structural checks validate assigned IDs. Automated citation support and actual known-case inspection are reported separately. Invalid responses cannot enter the cache. |
| 6. Refusals and partial answers | Both full runs covered 80 answerable and 20 unanswerable questions. See subset rates and paired answers in `verified-report.json`. |
| 7. Injection probes | The final selected prompt passed direct override and forged-reference tests. The pre-fix over-refusal and repeated forged number remain in the diagnostic history. |
| 8. Cache boundary | Server-side allowlists require a verified public document snapshot, public question and single turn. Private uploads, histories and unverified providers bypass storage. |
| 9. Actual cache | The production API uses bounded in-memory LRU storage, five-minute expiry, stable keys, optional enablement and explicit hit/miss/bypass metadata. |
| 10. Streaming | Storage waits for completed validated generation and HTTP body completion. Single-start replay, cancellation, truncation, error and concurrent-writer behavior passed. |
| 11. Invalidation | Real public document change caused BYPASS after a genuine HIT. The original content was restored. Tests cover delete scope, prompt/model/settings, context, expiry and access mismatch. |
| 12. Controlled A/B/C | Two verified 100-question runs compare prompts with production caching off. Six matched public questions test the selected prompt with caching enabled. |
| 13. Quality | Retrieval metrics match at full precision. The candidate improved faithfulness and regressed in correctness. Four changed cases were reviewed individually. |
| 14. Cache measurements | Final HTTP and model residency receipts record sample sizes, p50/p95, tokens, 12 avoided generations, source identity and cold/warm conditions. |
| 15. Regression | Both prompt gates passed against Step 5. Negative checks reject decreases greater than 0.02. The 0.02 boundary remains accepted. |
| 16. Provider/application | Ollama was exercised live. Gemini and RAG/non-RAG comparison passed through mocks. Upload metadata, deletion, browser citations and four reranker modes passed. |
| 17. Documentation | `PROMPTING_AND_CACHING.md`, `PROMPTING_EXPERIMENT_LOG.md`, `COMMAND_CONTRACT.md` and the evaluation README record reproduction, limitations and selection. |
| 18. Final verification | Commands below passed. Historical data, model digests, desktop runtime and local Git state were checked. |

## Verification groups

All commands below ran from the repository root. Result paths are under
`eval/results/prompting/` unless specified. All thirteen groups passed.

| Group | Actual verification | Result |
| ---: | --- | --- |
| 1 | Previous Step 5 audit, including its gate, CPU/MPS probe and four API modes | PASS. `previous-step-audit.json`, `previous-api.json`, `previous-probe.json`. Prior suite: 138 Python + 70 TypeScript. |
| 2 | `make lint` | Exit 0. Ruff lint and format, ESLint and TypeScript all passed. |
| 3 | `make test` | Exit 0. 152 Python + 110 TypeScript = 262 tests passed, zero failed. |
| 4 | `make build-fe` | Exit 0. Production compilation, type checking, static pages and API routes passed. |
| 5 | `eval.validate_dataset --require-review`, two `eval.run_eval --prompting-experiment` runs, two `eval.promote_local` validations | Exit 0. 100 reviewed records, 100 control and 100 candidate answers. Control fresh 100/100. Candidate fresh 95 answers and 96 judgments. |
| 6 | `eval.prompting_gate` against Step 5 for each prompt, `eval.prompting_report`, focused gate/report pytest | Exit 0. Both positive gates passed. Both excessive-drop negative controls rejected. 13 focused tests passed. |
| 7 | `eval.grounding_diagnostics` and `eval.prompt_bytes` | Exit 0. Six final selected diagnostics passed F/C and structural checks. All 200 exact prompt comparisons passed. Before-fix artifacts remain available. |
| 8 | `eval.cache_http` and `eval.cache_cold`, both run with the selected prompt | Exit 0. Six misses, 12 hits, identical texts/source IDs on replay, 19,018 tokens avoided. Six paired cold/warm questions. |
| 9 | `eval.cache_invalidation`, delete/cancel/concurrency/cache API tests | Exit 0. Real MISS → HIT → BYPASS. Original fixture hash restored. Failed, interrupted and invalid responses excluded. |
| 10 | `eval.reranking_smoke`, provider, upload and comparison tests | Exit 0. Disabled, enabled, missing-runtime and timeout responses passed. Gemini mock tests made no live Gemini calls. |
| 11 | Browser production chat | PASS. Fresh and hit each rendered one assistant entry. The hit label appeared once. Older citations restored the correct source list. Screenshot and `browser-chat.json` retained. |
| 12 | `eval.reranking_integrity` and historical comparison in `eval.prompting_report` | Exit 0. 118 historical files unchanged, 20 Gemini cache pairs, 151 Gemini vectors, 151 original local vectors and 162 selected chunks verified. Secret scan passed. |
| 13 | Git, process and runtime checks | Correct repository/branch, Step 5 ancestor retained, remote development branch absent, diff check passed. Desktop Ollama restored and model digests verified. |

The full command lines and output locations are in `COMMAND_CONTRACT.md`.
The two raw quality results were measured at their recorded Git revisions.
Post-selection changes corrected reference ambiguity and stream ordering.
The compatibility replay verifies exact prompt bytes, and final live HTTP/browser
checks exercise the resulting production behavior. The quality scores are the
two actual measured runs.

## Interpretation and known limits

The historical / selected / candidate automated quality metrics are respectively
1.0 / 0.995 / 1.0 for faithfulness and 0.99 / 0.99 / 0.985 for correctness.
Citation support was 1.0 for each. Recall@3 = 0.95, Recall@5 = 0.975,
Recall@10 = 1.0, and MRR = 0.9729166666666667 across all three.
The selected prompt refused 20/20 unanswerable questions and incorrectly fully
refused 0/80 answerable questions. Its automated unsupported rate was 1/100.
Manual inspection found an additional unsupported transaction claim credited by
the judge. The source passages and changed answers are in the experiment log.

The candidate fixed the omitted savepoint detail and the out-of-context
foreign-key claim. It also gave less complete answers on two other questions.
The selected default therefore still has known omissions and unsupported claims.
Citation validation enforces the structure of references. Semantic support is
an automated measurement. The corpus, six synthetic probes and six latency
samples limit what these numbers establish about other documents and hardware.

Final observed HTTP p50/p95: model cold 6,617.72/8,805.35 ms, model warm
1,045.23/3,068.35 ms, pooled HIT 32.36/35.35 ms. Cache eligibility was 18
requests, of which 12 hit. These measurements avoided model work. Paid API
charges were ₹0. The production cache defaults off and has no private-data
ownership boundary beyond exclusion of private requests.

## Issues resolved during verification

- Incomplete early control runs were stopped when stream review found premature
  writes and repeated writer release. The final control ran after both fixes.
- The production build initially could not fetch its existing fonts under network
  restrictions. The full sequence passed with the necessary network access.
- A reporting line exceeded the lint limit. It was wrapped and the complete
  lint/test/build sequence passed.
- The selected model over-refused a forged citation probe. The reference
  clarification fixed it and the 200-prompt comparison verified the golden
  inputs stayed byte-identical.
- Browser testing found a duplicate assistant entry. Sending the single start
  frame before metadata fixed both the fresh response and the replay. The full
  suite, build, real HTTP conditions, reranker modes and browser passed afterward.

## Confirmations

- Confirmation 1, grounded answers: PASS. Known failures and additional
  evidence gaps are documented with their actual outputs.
- Confirmation 2, caching and measurement: PASS. Real API replay, invalidation,
  access exclusions, matched timings, token counts and the full evaluations passed.
- Confirmation 3, all tasks and safety: PASS. All 18 tasks and 13 verification
  groups completed locally. Step 7 was not started. GitHub push: none.

## Checks you can make yourself

1. Open `PROMPTING_EXPERIMENT_LOG.md` and compare the four changed questions.
2. Open `eval/results/prompting/final-cache-http.json` and compare each
   first-request row with its two matching HIT rows.
3. Open `eval/results/prompting/browser-cache-hit.jpg` to see the replay label
   and the source passage supporting the answer.

## Files and local commits

Application changes are in the chat, evaluation and document routes, the chat
panel and workspace, and the RAG prompt, evidence, citation, cache-policy and
stream modules under `lib/`. Evaluation runners, diagnostics, gates and
measurements live under `eval/`; verification tests live under `tests/`.
The complete file list is available with
`git diff --name-only 8172c03 HEAD`.

Implementation and evidence commits:

```text
50a2f17 Record Step 5 audit and freeze Step 6 comparison policy
124cd72 Add versioned grounded answers and bounded public-only response caching
4583bb2 Add controlled prompt comparisons and production cache measurements
1e77c8a Store cached answers only after completed HTTP streams
ecbabe1 Release each cache writer once across abort and cleanup
5e1e20f Add cold-cache measurements, comparison report and Gemini compatibility check
74f8199 Verify refusal subsets, Gemini selection and deletion scope
8f531ac Select the original prompt and support matched measurements for both versions
71a0c85 Distinguish document footnotes from assigned evidence citations
13033c6 Verify exact prompt bytes against both measured 100-question runs
92576e8 Start the chat message before streaming its cache and source metadata
6f0807b Preserve both full prompt runs, known regressions and grounding diagnostics
dab4dfa Record final real API, browser, cache and runtime verification
```

The closing documentation commit contains this report. Desktop Ollama 0.40.11 owns the local port again. Both model digests match.

## Citation repair and independent re-audit (November 3, 2026)

The November 2 audit reopened Step 6. The saved one-source chat-handler test
was rerun unchanged before and after the repair. Before the repair it exited 1:
the validator found no markers in “according to source [-1]”, returned valid,
and the second request replayed the first generation. After the repair it
exited 0: validation reported an invalid token, both requests missed, both
called the model, and the cache held zero entries. The test used a deterministic
model and did not access private documents.

| Verification | Observed result |
| --- | --- |
| Lint, complete tests, production build | Each exited 0. Ruff, ESLint and TypeScript passed. 152 Python and 135 TypeScript tests passed (287 total, zero failed). An initial lint failure in the citation renderer was corrected before rerunning the full sequence. |
| Focused parser, cache, route and stream suites | Exit 0, 60 passed. These cover malformed, unknown, mixed, duplicate and missing citations, uncited refusals, Markdown/code literals, entry-specific stale eviction, public scope, cancellation, failure and incomplete generation. |
| Production HTTP with scripted chat, real retrieval | Exit 0. Two invalid requests: MISS/MISS, two generations. Valid [1]: MISS/HIT, one generation. Uncited refusal: MISS/HIT, one generation. The script asserted the full final text, validation, source IDs and the terminal event. The one-source route test independently asserted no invalid entry was stored. |
| Browser with the same local fixture | Invalid answer: one assistant message, one warning, zero clickable citation buttons. Valid answer: one assistant message on fresh and replayed requests, one replay label on repeat, working source 1 button. The private local screenshot is .local/citation-repair-browser.png. |
| Real local Ollama chat, public cache | Exit 0, six eligible misses followed by twelve hits, equal answers and source IDs on repeat. Twelve uncached requests bypassed the cache. The run reported 18,964 avoided tokens. This functional run used desktop Ollama 0.40.11 with both pinned model digests. Historical benchmark timings remain from 0.40.9. |
| Changed document and streaming modes | Exit 0. Public fixture MISS → HIT → BYPASS, then original content hash verified. Existing restored backup archived locally. Disabled, enabled, missing-worker and timeout modes all passed the HTTP source and shutdown checks. |
| Local cold/warm check | Exit 0, six paired questions bypassed caching under both model residency conditions. The measurement used the desktop runtime. |
| Golden dataset, prompt replay and gates | Exit 0. 100 reviewed questions. All 200 rendered prompts matched the measured prompt bytes. Both gates passed against Step 5. Selected Recall@5 decrease 0.000, faithfulness decrease 0.005, threshold 0.02. All 13 focused gate/report tests passed, including negative controls. |
| Saved-answer replay | Both 100-record runs checked against their actual final context counts. All selected answers passed: 80 cited and 20 uncited refusals. All twelve saved synthetic diagnostics passed the new structural check. The alternative prompt's postgresql-042 included uncited background statements and would now be excluded from production caching. |
| Preservation | Exit 0. 118 historical files, 20 original Gemini cache pairs, 151 Gemini vectors, 151 original local vectors and 162 selected chunks verified. No differences in the historical results, corpus, golden questions or database schema relative to a2f2328. Secret scan passed. |

The checks use the commands in the citation repair section of COMMAND_CONTRACT.md.
The existing generation, retrieval and judge pipelines ran with production
caching off when the saved quality results were produced. This repair changes
final structural validation and replay eligibility. It does not change the inputs,
ranked passages, model answers or judge scores in those historical runs. Their
metrics remain historical. The validator checks reference structure, and a cited
answer can still contain an unsupported factual claim. A free-form uncited
refusal outside the explicitly recognized forms is shown but bypasses storage.

Implementation commits 3c2202f and e06f957 update lib/citations.ts, lib/response-cache.ts,
lib/types.ts, app/api/chat/route.ts, components/chat-panel.tsx, tests/citations.test.ts
and tests/cache-api.test.ts. Verification commits 975d063 and 8c27ee6 add
eval/citation_cache_http.py and eval/recheck_citations.ts. Documentation changes
are confined to this report, PROMPTING_AND_CACHING.md and COMMAND_CONTRACT.md.
All work is local on feat/production-rag. Step 7 has not started. Paid charges ₹0.

## Second citation repair: Markdown boundaries (November 3, 2026)

The unchanged prerequisite test reproduced the second bug at `8e3e8f9`.
Its exact answer was:

~~~~text
The value is 3 [1].
```x = 3```
According to source [-1], the value is 3.
~~~~

Before repair, the first line supplied [1]. The old scanner classified the next
line's initial three backticks as a fence without validating its info string.
It searched subsequent lines for a closing fence; finding none, it advanced to
end-of-answer and never visited [-1]. Extracted numbers were [1], validity was
true, requests were MISS/HIT, generation count was one, and one entry was stored.
The basic negative case and single-backtick control already passed.

The new line-aware scanner rejects that fence interpretation because its info
string contains backticks. It instead recognizes a complete inline span, resumes
prose scanning afterward, extracts [1,-1], and returns invalid-references. Both
requests now MISS, generation count is two, and stored-entry count is zero.
The exact original test is permanently preserved, byte-for-byte, as
`tests/closed-code-attribution.test.ts`.

The implementation separates code masking from citation grammar. Genuine code
keeps its literal bracket text; masked offsets still point into the unchanged
answer. Fence character, length, indentation, closing whitespace, line endings,
inline delimiter matching and escaping are checked explicitly. Incomplete code
returns ambiguous-code and cannot be stored or replayed. See
`PROMPTING_AND_CACHING.md` for the CommonMark rules and conservative policy.
No Markdown dependency was needed: the UI renders plain text plus source buttons.

Existing whole-stream validation guards writes after HTTP completion. The same
parser validates cache reads before replay; the regression pre-seeds the exact
bad answer, verifies an individual eviction while another key survives, then
verifies normal MISS/HIT behavior for its valid replacement. Existing tests for
cancelled, partial and failed streams, private scope and history bypass remain.
The cache is still optional and defaults OFF. No cache purge or version reset was
used to obtain these results.

The saved selected run passes all 100 answers (80 cited, 20 refusals); all twelve
saved diagnostic answers pass structural replay. The candidate retains its one
previously reported rejection, postgresql-042 (uncited background claims).
There are no additional rejected candidate answers. During development, a
list-indented Python fence in fastapi-039 exposed an overly strict first draft;
relative list indentation corrected it, with a permanent valid-code test.
The frozen quality metrics and answer texts were not changed or remeasured.

Verification initially found both local services stopped. Two prompt replay
attempts exited 1 before that diagnosis; `make db-status` exited 2 and reported
no running server, and the Ollama health request exited 7. The existing owned
PostgreSQL cluster was started directly with pg_ctl, without setup SQL. The
preserved Ollama 0.40.9 runtime was started with the existing Qwen and embedding
models; both digests matched. A whitespace check also found one extra terminal
blank line, which was removed. The entire applicable verification sequence was
then restarted. No test expectation or threshold was weakened.

### Final command results

All commands ran from the existing repository root. The runner receipt and full
logs are ignored under `.local/markdown-verify-*`; these are fresh functional
checks, not a new 100-question quality or latency benchmark.

| Command | Exit |
| --- | ---: |
| `make lint` | 0 |
| `make test` | 0 |
| `make build-fe` | 0 |
| `pnpm exec vitest run tests/closed-code-attribution.test.ts tests/citations.test.ts tests/cache-api.test.ts tests/response-cache.test.ts tests/validated-stream.test.ts` | 0 |
| `.venv/bin/python -m eval.validate_dataset --require-review` | 0 |
| `.venv/bin/python -m eval.prompting_gate --baseline eval/results/reranking-selected.json --candidate eval/results/prompting/step5-v1.json` | 0 |
| `.venv/bin/python -m eval.prompting_gate --baseline eval/results/reranking-selected.json --candidate eval/results/prompting/grounded-v1.json` | 0 |
| `.venv/bin/python -m pytest -q tests/test_prompting_gate.py tests/test_prompting_report.py` | 0 |
| `.venv/bin/python -m eval.prompt_bytes` | 0 |
| `node --import tsx eval/recheck_citations.ts` | 0 |
| `.venv/bin/python -m eval.citation_cache_http` | 0 |
| `.venv/bin/python -m eval.cache_http --prompt-version step5-v1 --out .local/markdown-repair-live.json` | 0 |
| `.venv/bin/python -m eval.reranking_smoke --out .local/markdown-repair-streaming.json` | 0 |
| `PYTHONPATH=. .venv/bin/python .local/markdown-invalidation.py --prompt-version step5-v1 --out .local/markdown-repair-invalidation.json` | 0 |
| `.venv/bin/python -m eval.reranking_integrity` | 0 |
| `.venv/bin/python -m eval.prompting_report --out .local/markdown-repair-report.json` | 0 |
| `pnpm exec vitest run tests/temporary-negative-reproduction.test.ts tests/closed-code-attribution.test.ts` | 0 |
| `cmp .local/step7-closed-code-attribution.test.txt tests/closed-code-attribution.test.ts` | 0 |
| `git diff --exit-code 8e3e8f9 -- eval/results eval/corpus eval/golden_set.jsonl db` | 0 |
| `git diff --check` | 0 |
| `git ls-files '.env*'` and `git check-ignore .env` | 0 |
| `make db-status (after startup)` | 0 |
| `curl --fail --silent http://127.0.0.1:11434/api/version` | 0 |
| `curl --fail --silent http://127.0.0.1:11434/api/tags` | 0 |
| `PYTHONPATH=. .venv/bin/python .local/markdown-browser.py (UI fixture, stopped normally)` | 0 |

| Check | Final result |
| --- | --- |
| Full test suite | 152 Python + 159 TypeScript = 311 passed, zero failed; 24 more permanent TypeScript cases than the prior repair. |
| Focused suites | 84 passed; 37 parser, 22 actual handler, 16 cache, 7 stream, 2 unchanged prerequisite cases. Separate original/basic + two prerequisite replay: 3 passed. |
| Lint and build | Ruff, format, ESLint, TypeScript and production build passed. Existing Node module.register deprecation notices are nonfatal. |
| Scripted production HTTP | Five cases pass: negative and triple-tick answers MISS/MISS with two calls each; plain valid, Python code and refusal MISS/HIT with one call each. Source metadata and exact final text preserved across model frames. |
| Real local-model HTTP | Six MISS, twelve HIT, twelve uncached bypasses, changed-prompt MISS; 18,964 avoided tokens reported by the functional probe. |
| Streaming | Disabled, enabled, missing-model and timeout modes pass, including provenance and worker shutdown. Reranking is enabled only in its isolated test process; application default stays false. |
| Browser | Two invalid requests: one assistant, one [1] button, zero [-1] buttons, one warning, zero replay labels each; fixture confirms two generations. Valid Python MISS then HIT: one assistant, one [1] button, zero warnings, one replay label only on HIT. Source click displays the expected FastAPI integer-conversion excerpt. |
| Public content invalidation | MISS/HIT/BYPASS; original public chunk content restored and hash verified. Prior restored backup archived before the probe. |
| Dataset, gates and prompts | 100 reviewed questions, both saved gates PASS, 13 gate/report tests PASS including negative controls, 200/200 effective prompt bytes identical. |
| Preservation | 118 historical files, 20 Gemini cache pairs, 151 Gemini vectors, 151 original local vectors, 162 selected chunks; private-value scan PASS. Historical artifact/schema diff empty. Gemini integration contract tests PASS without paid provider inference. |

The browser screenshots are `.local/markdown-browser-invalid.png` and
`.local/markdown-browser-replay.png`. Browser assertions used the production UI
with deterministic chat text and actual local embeddings/retrieval. They do not
represent model factual-accuracy measurements. The separate HTTP/streaming runs
used actual local Qwen generation on the preserved 0.40.9 runtime.

Command adaptations: fresh output names preserve earlier receipts; the exact
saved prerequisite was promoted unchanged to a permanent test. The original
basic reproduction used a temporary test path removed after execution. The
invalidation wrapper verifies the previous restored receipt against the live row,
archives it at `.local/step6-invalidation-step5-v1-before-markdown-repair.json`,
then invokes the existing documented invalidation command. No recovery file was
overwritten before restoration was verified. Service startup is documented in
the command contract. Full quality inference and cold/warm timing were not rerun:
this deterministic validation change leaves measured prompts, answers and metrics
unchanged; saved-answer replay and both regression gates were rerun instead.

Known limits: structural citation validity is not factual truth. Invalid streamed
text may be visible before the final warning; it is preserved, not rewritten.
Conservative incomplete-formatting rejection can cause extra model calls, and
exotic Markdown containers are not a complete renderer contract. The UI continues
to show Markdown delimiters literally. No new claim of perfect answer accuracy
or online deployment is made by this repair.

Implementation commit: `3e22982` (scanner, grammar integration, unit/handler tests,
and unchanged prerequisite). HTTP verification commit: `eba3c7f`. Documentation
changes are limited to STEP6_COMPLETE.md, PROMPTING_AND_CACHING.md and
COMMAND_CONTRACT.md. Existing repair commits remain ancestors. No authentication,
schema, selected prompt, model, retrieval, historical label or dependency changes.
No GitHub push; paid API charges ₹0. Step 7 remains unstarted.

Confirmation 1 — Markdown and citations: PASS.
Confirmation 2 — Cache and real API: PASS.
Confirmation 3 — Full verification: PASS.

Optional checks you can make yourself:

1. Open the invalid-answer screenshot: [1] is clickable, [-1] is text, and the
   warning is visible beneath the single assistant answer.
2. Open the replay screenshot: the Python indexing literal stays text, [1] is
   clickable, and only one “Previously generated answer” label appears.
3. Open `tests/closed-code-attribution.test.ts` to compare the unchanged failing
   example with the before/after results above.

Cleanup: the owned browser fixture exited 0. The temporary Ollama server was
stopped by its verified PID and exited 0; `make stop` exited 0 and stopped only
this checkout's PostgreSQL cluster. Both services were stopped before this turn,
so their initial state is restored. All models, database contents, screenshots
and earlier receipts remain on disk. No required repair tasks remain.
