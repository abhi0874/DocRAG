# Gemini grounded-answer repair checkpoint — 18 November 2026

**BLOCKED. Candidate changes are local and uncommitted. Do not publish.**

Source HEAD remains `329ec8c595bbcc2c517188a15a4dd60de8f7201c` on
`feat/production-rag`. This repair started with 40 changed paths; none was
discarded. The opt-in workspace feature remains unreleased. Production was not
modified, and no GitHub, Render, Vercel or Neon write was performed.

## Diagnosis and bounded correction

The historical captures already lacked answer text in the raw SDK stream, before
the evidence parser, citation validator or browser. They omitted finish/token
metadata, so they did not establish truncation. The selected public PostgreSQL
excerpts genuinely explain COMMIT and were included in the request. The same
six historically selected chunks were reused for the paired diagnostic; no new
embedding or retrieval generation was needed for that pair.

Fresh metadata in [verification.json](verification.json) establishes:

| Probe | Finish | Output / reasoning tokens | Answer characters | Result |
| --- | --- | --- | ---: | --- |
| Existing instructions | `STOP` | 161 / 0 | 0 | Provider ended after an invalid assessment; rejected |
| Complete two-part format | `STOP` | 82 / 0 | 143 | Exact evidence quotes, substantive answer and citations pass |

Both used `gemini-3.5-flash-lite`, the existing 1,024-token cap, unchanged public
context hash, no automatic retries, and the same question. The assembled request
contained the question and context, with no stop sequence or JSON-only response
format. This reproduction is **not token exhaustion or frontend text loss**.
The confirmed failure is provider noncompliance with the mixed assessment/answer
contract. The old instructions showed only a header example; a complete two-part
example corrected the measured Gemini cases. This is a bounded observation, not
proof of the model's internal reason for stopping or universal reliability.

A separate deterministic parser defect allowed a header plus newline/whitespace
to finish without an answer. Non-stop finishes and missing finalization could
also escape this guard. `IncompleteGenerationError` now rejects these cases and
the route reports an explicit generation error. It neither invents an answer nor
mislabels provider failure as insufficient evidence. A genuine `support:none`
still returns the approved refusal. Citation and exact-quote validation remain
strict, and incomplete output creates no successful answer receipt.

Only four preexisting paths changed during implementation: `lib/workspace-evidence.ts`,
`app/api/chat/route.ts`, `tests/workspace-chat.test.ts`, and
`scripts/workspace_cloud_http.py`. Two focused test files were added. The cloud
harness now records answer hashes/counts rather than answer text and requires a
successful terminal frame. No model, token cap, quota, retrieval, database schema,
dependency or ownership rule was changed in this repair.

## Fresh checks and preserved failures

Logs are ignored under `.local/gemini-repair/`; no credentials or document text
are included in the committed-candidate metadata. All old receipts remain intact.

| Command/check | Exit | Actual result / evidence |
| --- | ---: | --- |
| Pre-fix completion regression | 1 | Eight missing-behavior failures; `completion-before.log` |
| Initial provider mock | Failed test | Test initially expected the provider-layer usage shape; corrected to the installed SDK's public shape. Original log retained |
| Focused completion/provider/citation suites | 0 | 102 passed before five additional route regressions; `deterministic-b.log` |
| `make lint` with pinned launcher | 0 | Ruff, formatting, ESLint, TypeScript; `lint-final.log` |
| `make test` with pinned launcher | 0 | **218 Python + 334 TypeScript = 552**; `tests-pinned.log` |
| `pnpm exec next build --webpack` | 0 | Production build; `build.log`. Not a fresh Turbopack pass |
| `make cov` | 0 | 552 tests; TS statements **57.01%**, lines **61.18%**; Python unit **377/2199 = 17.14%**. Not full integration coverage |
| `eval.validate_dataset --require-review` | 0 | Frozen 100 questions and review hashes intact |
| Four focused Python gate suites | 0 | **35 tests**, including negative controls; subset of the 218 Python total |
| Two direct Gemini diagnostics | 0 each | First call reproduced the defect; second passed. Process success of the first probe does not mean answer success |
| `scripts.workspace_cloud_http --run-id repair-a` | 0 | **22/22**, four fresh generation requests; `.local/workspace-cloud-repair-a/receipt.json` |
| `scripts.workspace_http --run-id repair-a` | **1** | **38 checks passed**, third fresh local generation failed: `summary: stream error`; `.local/workspace-http-repair-a/receipt.json` |
| Existing dependency-audit policy, separate output directory | **1** | Raw JS audit exit **1**, five advisories; new findings rejected by unchanged policy |
| `git diff --check` | 0 | Whitespace check |
| Final changed-file secret/preservation scan | 0 | **44 paths**, zero configured-secret/pattern matches; all 40 initial paths present; no historical evaluation/model/lockfile changes; nothing staged |

The cloud workflow passed synthetic account creation/login, upload and 1536-vector
indexing, retention tagging, cross-account source/deletion denials, guest denial
of private documents, supported/follow-up answers, unanswerable refusal, and a
non-predefined guest COMMIT question with citations. It deleted only its newly
created fixture and verified the copied 162 public chunks survived. Total new
Gemini answer calls: **six** (two diagnostics plus four workflow requests), with
additional bounded embedding requests for the workflow's upload/retrieval.
No further Gemini calls were made. Existing unbilled-project evidence was reused;
no billing setting, paid model or plan was enabled.

The local Ollama workflow passed direct and paraphrased answers, then its summary
returned a stream error with zero answer characters and no citation-validation
frame. Its safe telemetry category is `model`; it does not establish the precise
raw-output defect. Do not claim the shared prompt passes both providers. The
historical 63/63 native receipt predates this prompt and is not a fresh pass.
Cancellation/error propagation passes deterministic tests; the fresh native run
did not reach its later live cancellation check.

An initial tool wrapper launched pnpm itself under Node 24.22.3 despite the shell
PATH. An ignored task-local launcher now invokes the existing pnpm 11.25.0 module
with preserved Node **24.22.1**. `pnpm exec node --version` confirmed 24.22.1;
lint/tests/build were rerun. No installation or global configuration change.
Previously authorized PostgreSQL/Ollama starts restored only the existing owned
cluster on 55433 and preserved 0.40.9 on loopback with cloud disabled. Both required
model digests matched. No initialization, migration of an existing database,
model download or unrelated service control occurred.

## Mandatory security stop

The audit now reports **four moderate and one high** advisories. The two earlier
tooling findings remain; three additional advisories are outside the existing
review. The unchanged audit deliberately fails. Python/reranker audits later in
that command were **not run**, because it stopped on the JavaScript finding set.

- [Next.js GHSA-mfr8-8qww-v76h](https://github.com/vercel/next.js/security/advisories/GHSA-mfr8-8qww-v76h): moderate; installed 16.4.4, patched 16.4.5. Concerns root-param isolation with `use cache` inside `unstable_cache`.
- [Next.js GHSA-vc7v-qv4w-wrv8](https://github.com/vercel/next.js/security/advisories/GHSA-vc7v-qv4w-wrv8): moderate; installed 16.4.4, patched 16.4.5. Concerns nested Cache Components and delayed metadata.
- [picomatch GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf): high; installed 4.0.7 and tooling 2.3.2. The reviewed advisory lists no patched version.

Read-only triage found no `use cache`, `unstable_cache`, root-param API or Cache
Components configuration in application source. None of 20 generated production
route traces contains standalone picomatch, Vitest, drizzle-kit or esbuild packages.
These observations limit likely exposure; they do not prove all bundled/runtime
paths safe, remove the advisories, or turn the mandatory audit into a pass.
No exploit was run, security exception added, dependency changed or gate weakened.

## Remaining work and release boundary

1. Resolve/review the three new dependency findings with an explicitly reviewed
   approach; preserve raw audit failures and the existing quality/security gates.
2. Diagnose the local summary stream failure using sanitized terminal metadata;
   keep the passing Gemini cases and strict evidence checks intact.
3. Rerun applicable native/cloud verification only after justified fixes. Do not
   repeat Gemini calls just to select a favorable result.
4. Complete fresh full regression, 100-question evaluation, and desktop/mobile
   acceptance. These were **not run** after the mandatory stop, not passed.
   The evaluation verifier also binds source hashes to its recorded Git commit;
   reconcile that required source checkpoint with the instruction to commit only
   after required checks, without editing historical provenance or weakening gates.
5. Finish coverage/security review, repeat the secret scan after further changes,
   and perform exact local staging/commit
   only after required gates pass. Push/deployment remain prohibited.

All 40 initial paths remain present. No new commit or staged file. Production is
unchanged by this execution; production health was not re-measured. Paid usage
was kept at ₹0 under the existing unbilled configuration. This checkpoint is not
release readiness and does not authorize publication.
