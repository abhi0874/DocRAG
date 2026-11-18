# Grounding and citation repair

Source revision `ddb0e0c27284eef9986983ee211541eaee776209` on `feat/production-rag`. Production remains at the pre-existing release. The historical dependency decision continues to block publication. [Security decision](SECURITY_DECISION.md)

## FastAPI guest question

“How does FastAPI validate request data?” reproduced the earlier browser failure with one fresh local generation against the approved public FastAPI document. Both runs selected chunks 32, 78, 82, 4, 84 and 43 in that order. Their contents and order were identical. A guest principal selected those passages, the evidence snapshot matched each chunk, and the grounded prompt serialized the original text as JSON. The independent runs used Ollama 0.40.9, the pinned models, no conversation history and no response cache.

Both selected quotations crossed a line boundary. Excerpt 1 contains “Validate the data.” followed by a newline before “If the data is invalid”. Excerpt 4 contains “FastAPI gives you data validation.” followed by a newline before “Notice that the error”. The model inserted spaces at both boundaries. It finished normally, produced a substantive answer and repeated one final JSON brace. Existing framing logic handled the extra brace. The exact-substring check then correctly rejected both quotes before releasing answer text.

The repair asks for a short phrase within a single original line. The exact validator still accepts an authentic multiline quotation and rejects either flattened quotation. On the same inputs the model selected “Validate the data.” from excerpt 1 and “FastAPI gives you data validation.” from excerpt 4. Both quotes passed. The source viewer showed the original cited excerpt during mobile browser QA. The internal assessment stays out of the user-visible answer. Sanitized before/after responses, exact characters and passage fingerprints are in [the case evidence](GROUNDING_CASES.json).

## PostgreSQL citations

In the provisional benchmark, `postgresql-037` asked why an inner join omits an unknown city and which constraint prevents nonexistent city references. The model received six numbered passages on joins. The passage about foreign keys ranked tenth and was unavailable to the answer model. The automated judge incorrectly described excerpt 6 as discussing constraints. Its actual content covers self-join aliases and implementation details. The judge and scoring definitions were preserved.

The first sentence correctly used [3] and [5] for the unmatched-row explanation. The answer then named a foreign key from outside the six passages. The four rejected citation occurrences appeared together at the end of the following sentence, which combined a statement about missing constraints with a description of joins. Each number referred to a real passage. Their problems differ in what each passage can support.

| Occurrence in answer | Cited passage | Evidence and verdict |
|---|---|---|
| 3, [1] | Chunk 160 | Explains how a left outer join retains unmatched rows using nulls. Supports the outer-join clause only. It cannot establish the proposed constraint or a claim about all excerpts. |
| 4, [2] | Chunk 159 | Compares join syntax and introduces an outer join for recovering Hayward rows. Again supports only part of the compound sentence. |
| 5, [3] | Chunk 158 | Explicitly explains the missing Hayward row in an inner join. Correct for the first sentence. Its second use supplies neither constraint evidence nor the proposed outer-join solution. |
| 6, [5] | Chunk 157 | Explains matching pairs and the omitted Hayward row. It supports the earlier join claim only. |

The generation instructions now require independently checking every part of a question and acknowledging a missing fact without giving a plausible answer from memory or citing unrelated passages for its absence. A fresh focused generation on the same six passages answered the supported part with [3][5] and acknowledged the missing constraint. Both remaining citations match the join claim on manual review. This diagnostic gives 2/2 supported occurrences for that answer, compared with 2/6 in the provisional row. Corpus-wide scores come only from the full benchmark.

## Source and privacy review

The pre-repair inventory recorded 54 paths. We preserved all 54, including the provisional benchmark, prior failed receipts and security decision. Forty-nine initial files remained byte-identical. Five received focused additions or edits for this repair. The audit covered the upload and account routes, ownership filters, retention SQL, frontend, provider handling, workspace tests and operational helpers, the dependency lockfile, and previously uncommitted evidence. Exact-stage checks compared each Git blob with the reviewed workspace copy.

The public-cache key now covers the actual generation instructions, including the evidence protocol. An explicit guest request uses a public-only retrieval principal even when the visitor has a session. Public feedback export requires every supplied passage to belong to the allowlisted document. A mixed-source answer cannot inherit export permission from its first public document. The feature flag, provider settings, frozen corpus, model digests, golden labels, scoring and threshold are preserved.

The original historical prompt replay compares the frozen **base** prompt on 200 contexts. The grounding guidance intentionally changes the final instructions sent to the model. The base replay alone therefore cannot certify the new generation behavior. Exact source commits, the live workspace tests and the fresh benchmark supply the additional evidence.

Local commits: `ad08be3` preserves historical evidence, `3f9a595` records the already-reviewed dependency difference, and `ddb0e0c` records the workspace implementation, privacy changes and tests. No hosted deployment, new infrastructure, remote push or billing change occurred.

## Fresh functional verification

| Check | Observed result |
|---|---|
| Pinned runtime | Node 24.22.1, pnpm 11.25.0, Ollama 0.40.9 on loopback with cloud disabled. Both model digests matched. The owned benchmark database contained 162 chunks on port 55433. |
| Static and unit | `make lint`, `make test` and `pnpm exec next build --webpack` exited 0. 218 Python and 340 TypeScript tests passed. Coverage collection repeated those unit tests. TypeScript statement coverage was 57.55%, branch 57.26%, function 51.36%, line 61.54%. |
| Native workflow | `python -m scripts.workspace_http --run-id grounding-repair-a` exited 0 with 63 checks, ten fresh local generations and one cancelled request. Covered registration, session behavior, PDF upload, indexing, direct and paraphrased questions, summary, follow-up, comparison, refusals, partial answers, guest query, two-account isolation, quotas, deletion and logout. A second, instrumented run on a separate fixture also passed all 63. |
| Guest access | A signed-in test owner in Guest Demo received 404 for their own private document. The public library listed only the two approved documents. At its configured limit the anonymous guest received 429 and a positive retry interval. No generation was needed for these checks. |
| SQL, auth and observability | Security suite passed 66 checks including real HTTPS cookie flags and expiry. Its SQL suite passed 27 checks. Observability passed 138 assertions over 33 identified HTTP requests. Feedback export preserved the golden set and excluded private data. |
| Local container and CI database | Rebuilt only the existing DocRAG app image for runtime verification. The container suite exited 0 with 26 checks, including auth, cancellation, restart persistence and database outage/recovery. Ten unrelated containers retained their IDs, state, timestamps and restart counts. Linux CI migration and retrieval scripts exited 0 against the dedicated `docrag_ci` database. Retrieval passed ten checks using fixed vectors. |
| Existing controls | Reviewed dataset validation, two frozen prompting gates, public base-prompt comparison, historical citation replay, HTTP citation/cache tests, cold/warm cache checks, reranking streaming checks, historical report and integrity verification all exited 0. The integrity check preserved the 162 selected chunks, the original vectors and the twenty historical Gemini cache pairs. |
| Dependency audit | The unmodified `scripts.security_audit` exited 1. The report contains high picomatch and moderate esbuild/minimatch findings. No exception was granted. Live Gemini calls made for this task: zero. |

### Mobile browser acceptance

Chrome 157 ran the real production build on loopback using a separate test profile at 390×844 with touch emulation. The test selected the public FastAPI document, submitted the original guest question, followed a citation to the matching source line and verified the canonical refusal for missing information. The composer fit within the viewport. It switched to light mode, used a keyboard arrow to select dark mode, selected high glass and reduced motion, and checked persistence after reload.

The same browser journey registered a synthetic account, signed in, uploaded a synthetic PDF through the file input, selected the indexed document, answered its “twelve seats” question, followed the citation and answered the Tuesday opening-time follow-up. The session and document survived reload. A harness condition initially tried to transfer the delete control itself across the browser connection. It timed out before clicking. A corrected boolean check in the same isolated browser profile verified the sole filename and the exact delete control. Deletion emptied the private library, and sign-out returned to sign-in. Both browser receipts reported zero uncaught JavaScript exceptions. This was viewport and touch emulation. A physical phone was not tested.

The first measured Python integration aggregate covered 41.75% of 2,199 statements. Instrumenting the real workspace workflow brought coverage to 51.48%. Both measurements used the unmodified 70% gate. No historical coverage was merged into these results. Detailed local receipts use the `.local/grounding-repair-a/` directory. Rejected and incomplete attempts remain available.

### Reproducing the benchmark

Use a clean copy of the measured revision in the existing DocRAG environment with its verified, owned native database and preserved local models. The evaluator expects the reviewed corpus, mappings and automated validation receipt. Use a new output directory for each run. The local command used the following settings.

```sh
export PATH="$PWD/.local/gemini-repair/bin:$PWD/.local/node-v24.22.1-darwin-arm64/bin:$PWD/.venv/bin:$PATH"
export AI_PROVIDER=ollama DOCRAG_DEPLOYMENT=local DOCRAG_WORKSPACE_ENABLED=false
export DOCRAG_POSTGRES_PORT=55433 RERANKER_ENABLED=false RESPONSE_CACHE_ENABLED=false
unset GEMINI_API_KEY GOOGLE_GENERATIVE_AI_API_KEY
.venv/bin/python -m eval.run_eval --golden eval/golden_set.jsonl \
  --prompting-experiment step5-v1 --out "$new_dir/evaluation-raw.json"
.venv/bin/python -m eval.promote_local --source "$new_dir/evaluation-raw.json" \
  --out "$new_dir/evaluation.json"
```

Set `new_dir` to an unused directory under `eval/results/observability/` first. Subsequent same-configuration runs can reuse valid cache entries. Read the per-run counters before describing any answer or judgment as fresh. The benchmark uses the existing six-excerpt, single-document engine contract. The opt-in workspace evidence header is exercised separately by native HTTP and browser workflows. Some local HTTP and browser requests shared Ollama during the first part of the run, which limits latency comparisons.

The independent environment audits completed with exit 0 for all 38 Python packages and all 42 packages in the offline reranker environment.

## Fresh evaluation and historical comparison

`eval.run_eval` completed all 100 reviewed questions on clean source `ddb0e0c27284eef9986983ee211541eaee776209`. Each query embedding, answer and judgment was fresh. The repository’s automated provenance validator exited 0 and tied the measured application and evaluator bytes to Git. The validated artifact retains the original answer texts and measurements. The scores are automated, and the answer model and judge use the same local model. [Raw measurements](../../eval/results/observability/grounding-repair-a/evaluation-raw.json) · [Validated result](../../eval/results/observability/grounding-repair-a/evaluation.json) · [Hashes, negative controls and diagnostic responses](GROUNDING_RESULTS.json)

| Metric | Historical UI baseline | Provisional pre-repair | Fresh verified source |
|---|---:|---:|---:|
| Recall@3 / @5 / @10 | .950 / .975 / 1.000 | .950 / .975 / 1.000 | .950 / .975 / 1.000 |
| MRR | .972917 | .972917 | .972917 |
| Correctness | .990 | .990 | **.970** |
| Faithfulness | 1.000 | .995 | **1.000** |
| Supported citation occurrences | 265/265 | 265/269 | **267/267** |
| Pipeline p50 / p95, ms | 5,879 / 12,483 | 5,802 / 12,718 | 5,852 / 10,263 |
| Retrieval p50 / p95, ms | 40.48 / 44.57 | 43.05 / 83.68 | 40.09 / 85.18 |

All 20 unanswerable questions received full correctness and faithfulness. All 100 questions retained the historical top-ten passages, in order and byte-for-byte. The fresh `postgresql-037` answer scored 2/2 for citations, 1.0 for faithfulness and .5 for correctness. Its unresolved half concerns a constraint outside the six passages. The separate reversible cache probe ran after the benchmark and verified restoration of the original public chunk. A read-only check also verified the original 151-chunk corpus, native database identity, passage bytes, vector dimensions and source mapping.

Three rows account for the entire .020 correctness decrease from the UI baseline.

| Question | Historical → fresh | Explanation checked against the six passages |
|---|---:|---|
| `fastapi-036` | 1 → 0 | Excerpts 1, 2 and 6 describe reusable dependencies. Excerpt 5 describes stopping a request with an HTTP exception. The answer identified both facts but declined to combine them without a worked example. |
| `postgresql-031` | 1 → .5 | All six excerpts cover constraints. The answer supported its price checks and declined to supply transaction semantics. The selected context omitted the evidence needed for the second part. |
| `postgresql-040` | 1 → .5 | Excerpt 4 demonstrates aliased self-joins and excerpt 6 describes aggregation. The answer treated the absence of a combined example as a reason to withhold the final step. |

`postgresql-005` and `postgresql-037` also received partial correctness, unchanged from the UI baseline. The former omitted that the savepoint remains defined. The latter correctly withheld a foreign-key answer from a join-only context. Passing every citation means the cited claims had support. It does not establish answer completeness.

Three bounded, uncommitted instruction alternatives were tested against the two synthesis failures and the two missing-evidence controls with their original passages. Each generated all four answers. The first still refused the supported FastAPI combination. The second gave the unsupported foreign-key answer and attached a block of join citations. The third still refused supported combinations and named a foreign key in a caveat. Each alternative failed the joint requirement. The application retains the measured instructions. The exact diagnostic texts are preserved in the results file and excluded from the benchmark scores.

### Regression gates

The frozen generic historical comparison exited 1 with `Missing or incompatible config_sha256`. The earlier deployment comparison exited 1 with `Undeclared implementation change`. The UI baseline and candidate have 12 distinct measured application or lockfile hashes and otherwise identical configuration fields. The deployment comparator accepts only its original declared changes. Both artifacts independently verify. The historical numerical differences are zero for Recall@5 and faithfulness. Neither comparator accepted the cross-revision comparison. Both threshold negative controls correctly exited 1 for a decrease of .020000000001. Golden labels, model digests, thresholds, score definitions and historical gates were preserved.

The offline citation replay checks each occurrence against its assigned chunk in both saved join answers. In particular, the original second uses of chunks 158 and 157 remain failures even though the first uses passed. The replay supplements the focused generation and streaming tests.

After adding the two replay cases, `make test` exited 0 with 220 Python and 340 TypeScript tests. The first lint run flagged import ordering in the new test. After formatting that file, `make lint` and the focused replay exited 0. This evidence-only test was added after the benchmark. The measured application bytes still match `ddb0e0c`. Both the baseline and candidate then passed an independent repeat of `verify` and `verify_derivation` on the saved artifacts.

The dependency gate remains blocked by CVE-2026-112366. An offline replay of the actual audit response independently confirmed that the unchanged policy rejects the high finding. Safety checks also confirmed that the publication smoke command refuses to run without live authorization, the frozen corpus cannot be overwritten by its snapshot command, and invalid cloud-workspace and observability run IDs are rejected before verification starts.

### Final integration coverage

`make cov-integration-gate` exited 0 at **72.67%** (1,598/2,199 Python statements, threshold 70%). Collection used only this task’s runs. It included unit tests, two-account workspace QA, HTTP/SQL and container work, read-only corpus verification, the real offline reranker, and the local workload. Additional offline controls exercised the scripts’ refusal paths. Two early attempts to instrument the isolated reranker interpreter could not find the coverage module. The successful run used the project’s existing coverage installation with the existing offline worker.

The workload ran all 18 stages on a new synthetic local database at 5, 20 and 50 users. Of 6,751 requests, 4,221 succeeded and 2,530 received the configured HTTP 429 response. No other request failed. All stage assertions passed. These figures include rate-limited requests and are evidence about the coverage run, not a capacity claim. The compact receipt includes the per-stage status counts and the hash of the raw local trace. [Verification results](GROUNDING_RESULTS.json)

**Decision.** The original guest quote defect and four unsupported citation occurrences are repaired on the measured source. Answer completeness and historical cross-revision compatibility remain open. The high-severity dependency finding independently blocks publication. The 54 original paths were preserved. No GitHub push, production database access, deployment, live Gemini call or billing change occurred. Paid usage was ₹0.

The precommit secret scan found zero matches across 848 tracked and intended files, 128 reachable commits, and 65 built client assets. Only the reviewed public receipts, two benchmark artifacts and offline replay test were selected for the evidence commit.
