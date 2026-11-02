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
