# Account workspace release — in progress

Conditional GitHub/Render publication is now authorized after all release gates
pass. The [fresh publication gate](gemini-repair/PUBLICATION_GATE.md) remains
**BLOCKED** by the high picomatch advisory. No push or deployment attempted.

Latest checkpoint: [readiness remediation](gemini-repair/READINESS_REMEDIATION.md).
The Ollama framing defect is fixed: fresh native workflow 63/63 and 554 unit tests
pass. Next.js 16.4.5 fixes two advisories. The high picomatch finding still blocks
the security gate. **BLOCKED; uncommitted; no publication.** Gemini's live 22/22
result is historical; deterministic compatibility passes. Earlier sections retain
their historical provenance.

This work is NOT released. The user authorized implementation and a conditional
Render release after real security and functional checks. The subsequent cost
clarification makes ₹0 a hard constraint; no billing or paid infrastructure.

Latest product clarification: no predefined questions or suggestion buttons.
Primary flow is account creation, document upload and user-written questions.
Existing Better Auth/PostgreSQL is retained; Firebase is not introduced.

## Fresh prerequisite audit

- Checkout and GitHub `feat/production-rag` both identify
  `329ec8c595bbcc2c517188a15a4dd60de8f7201c`; initial worktree clean.
- Render API reports deployment `dep-dbth6m9srm7s73b9vmag` live at
  `6458b355d28521f7e0ae32f68d1fb710433f6bdd`. Health and readiness both HTTP 200.
  No deployment/configuration/database changes made by this audit.
- Native PostgreSQL was stopped (`make db-status` failed); loopback Ollama was
  unavailable (`curl` exit 7). After checking ownership and both vacant ports,
  restored the previously authorized existing services, without initialization.
  Read-only SQL verified `docrag_dev`, role `docrag`, port 55433 and owned directory.
  Ollama reports 0.40.9; both digests match `lib/local-model-config.json`.
- Historical 491 tests and production 55/55 receipts are historical, not fresh
  acceptance of this work. Full verification is pending.

## Root causes and reuse

1. `lib/auth.ts` disables signup; the auth handler exposes only signin/signout.
   Existing secure eight-hour sessions and server checks can be reused. Existing
   accounts are operator-provisioned; no fresh login failure is established.
2. `app/page.tsx` always renders the sample workspace in hosted mode, even after
   login. Its composer is disabled and its question selector is fixed.
3. `lib/demo-policy.ts` requires a single manifest-hashed question; history and
   arbitrary text are rejected before provider calls.
4. Uploads explicitly reject demo mode. Cloud `embedChunks` also refuses indexing;
   merely hiding the UI restrictions would not enable safe ingestion.
5. PDF extraction, heading-aware chunks, database-backed original bytes, atomic
   document/chunk/access creation, server ownership checks and deletion already
   exist. Render filesystem storage is not needed for durable originals.
6. Chat/retrieval currently accept one document ID. Multi-document selection needs
   explicit authorized scope and source identity preservation.
7. Existing database quotas protect generation (2/user/minute, 4/global/minute,
   50/global/day), but hosted uploads need separate embedding/storage limits.
   Auth is globally limited to 30 attempts per five minutes. There is no configured
   email verification sender. Do not pretend emails were sent or addresses verified.
8. Existing isolated Neon runtime permissions and schema were previously verified;
   fresh write-capability/migration checks are still pending. Do not bootstrap or
   replay initial publication on the populated database.

## Provider restrictions and zero-cost scope

Official [Gemini terms](https://aistudio.google.com/docs/terms), retrieved during
this audit, effective March 23, 2026: unpaid input/output can be used to improve
Google products and reviewed by humans. Personal, sensitive and confidential
information must not be submitted. Client availability in the EEA, Switzerland
and UK requires paid services. Age and professional/business-use restrictions
also apply. A consent checkbox does not override these requirements.

Hosted work must therefore be limited to eligible adult professional users and
non-sensitive documents/questions, with explicit disclosure and consent before
external processing. Personal/confidential information remains local Ollama only.
This is an account-isolated workspace, not a provider-confidential cloud service.
Do not promise unrestricted geographic availability, unlimited use or provider-side
erasure when a local document is deleted. A suitable eligibility mechanism and
actual free quota verification are release gates, not completed checks.

## Release gates still pending

Implementation; registration/session/abuse tests; upload/index/delete; multi-document
and follow-up Q&A; evidence sufficiency; two-account/guest isolation; bounded quotas
and retention; real synthetic local and cloud end-to-end checks; UI/accessibility;
regressions/security/coverage; exact staging and secret scan; hosted CI; approved
Neon preflight; Render release and real production smoke. Keep the known-good
6458b35 release until all gates pass. Vercel stays unchanged; avoid automatic
Vercel builds during any later authorized push. Preserve all historical evidence.

## Fresh implementation checkpoint — 16 November 2026

The opt-in `DOCRAG_WORKSPACE_ENABLED=true` implementation adds signup, the
account-owned `/workspace`, PDF uploads, free-text and multi-document questions.
There are no predefined question buttons in that experience. Existing public
sample behavior is retained only behind the disabled rollout switch until release.
Better Auth and PostgreSQL remain the authentication system; no Firebase added.

Fresh evidence (private raw logs under `.local/workspace-release/`):

- `make test`: 218 Python + 308 TypeScript passed before the additional ingestion
  tests. `make cov`: 218 Python + 314 TypeScript = **532 passed**, exit 0.
  Unit-only Python coverage 377/2091 = 18.03%; TS statements 56.63%, branches
  55.61%, functions 50.88%, lines 61.02%. These are not fresh full integration
  coverage claims; subsequent test-harness additions increase the denominator.
- `pnpm exec next build --webpack`: passes (latest `build-webpack-f.log`).
  The default Turbopack build failed twice on an internal port permission error;
  it is not reported as passing. An actual generated route-type incompatibility
  was fixed with a type-only rest-tuple wrapper; runtime behavior unchanged.
- `make lint`: exit 0 in `lint-final-d.log`; later cloud-harness additions need
  the next final lint. Earlier formatting failures remain saved.
- `python -m scripts.workspace_http --run-id local-e`: **63/63**, exit 0,
  real native database, synthetic accounts/PDFs and local Ollama. Ten fresh
  answers cover facts, paraphrases, summaries, section explanations, follow-up,
  comparison, missing facts, outside knowledge, partial support and guest Q&A.
  Actual cancellation, expiry, owner/guest denials, quota rejection, logout and
  deletion pass. No canned question list was used.
- `scripts/workspace_storage.ts`: **6/6**, exit 0. Real SQL verifies repeatable
  additive migration, capacity, expiry without deleting historical/active data,
  20 concurrent upload admissions allowing exactly two, weighted embedding quota,
  and unchanged public corpus/vectors. This is isolated native SQL, not Neon.
- `pnpm audit --json`: exit 1, same two moderate tooling advisories (esbuild
  GHSA-67mh-4wv8-2f99; minimatch GHSA-g3hv-75wg-m249). Python audit exit 0.
- 241 tracked historical evaluation/model/chunking files remain byte-identical;
  golden set remains 100 questions. Saved numerical regression passes, but the
  old deployment compatibility receipt correctly rejects the new source hashes.
  A fresh evaluation and explicit compatibility review remain mandatory.

### Preserved failures and repairs

- `local-a`: 31 checks before malformed evidence JSON caused a stream error.
  Corrected an invalid JSON example in the prompt.
- `local-b`: the first fact passed; funding was refused because the synthetic
  PDF put its later text outside the page. `local-c` uses wrapped PDF text and
  asserts extraction preserves every word before question tests.
- `local-c`: evidence JSON contained one redundant final closing brace. The
  parser now tolerates precisely that framing defect, then applies the identical
  strict schema, citation index and exact quotation validation. Extra text,
  multiple redundant braces and fabricated quotes remain rejected by tests.
- `local-d`: all ten answers passed, then a Python import name collision stopped
  the cancellation harness. Fixed the import; complete `local-e` passed.
- `workspace-cloud-live-a`: real Gemini indexing, supported answer, follow-up
  and refusal passed. Guest free-form returned a stream error. This is a real
  release blocker under diagnosis, not an insufficient-evidence success.

### Fresh external prerequisites

Signed-in Safari inspection verified project `gen-lang-client-0270320094`
(Default Gemini Project), not the separate Text-to-SQL or DocRAG-named projects.
AI Studio says Free tier/no billing set up. Google Cloud explicitly says this
project has no billing account and is not linked to one. Model limits shown:

| Model | RPM | TPM | RPD |
| --- | ---: | ---: | ---: |
| gemini-3.5-flash-lite | 15 | 250,000 | 500 |
| gemini-embedding-001 | 100 | 30,000 | 1,000 |

These are limits, not the displayed 28-day peak usage. No billing settings changed.
The hosted upload caps and shared generation limits remain below these quotas.

Read-only Neon preflight passes with system CA and full hostname verification:
`docrag_demo_gemini_v1`, restricted `docrag_demo_runtime`, 162 chunks, two public
sources, Gemini embedding 001/1536. Required existing table permissions are present;
CREATE on public schema is absent. The new retention table is absent, as expected.
No Neon migration/data writes occurred. Initial libpq checks failed without its
local CA file; supplying the existing system CA fixed the client check without
weakening TLS or changing the service.

The cloud test copies preserved public vectors into a new native fixture database;
it never re-embeds the 162-chunk corpus or writes to production. The explicit
loopback-only fixture option cannot select a different remote Neon database.

## Stopped checkpoint — 17 November 2026

**BLOCKED; not a release candidate.** No push, production migration or deployment.

- Latest `make test` (`tests-g.log`) exits 0: **218 Python + 315 TypeScript =
  533 tests**. Latest `make lint` (`lint-h.log`) and webpack production build
  (`build-webpack-g.log`) exit 0. Coverage above predates the extra fixture-guard
  test and cloud harness; do not present it as final-source integration coverage.
- Secret scan checked all 40 changed/untracked files against configured secret
  values and credential patterns: PASS, no values printed. No staging/commit yet.
- Cloud `live-b` also stops at guest free-form after 19 checks and four generation
  requests. Supported synthetic upload answers, follow-up and refusal pass, but
  the guest answer fails again. Raw synthetic/public diagnostics are retained.
- The exact-question diagnostic returned an invalid evidence item copied from
  source metadata and no answer. The smaller-output instruction repair preserves
  all schema/quote checks. A later diagnostic (`diagnose-cloud-guest-short.json`)
  returned a valid evidence header **but no answer**. Its `assessment: PASS` means
  header validation only; this is NOT passing answer-generation evidence.
- The bounded cloud workflow remains unreliable. Further provider attempts stop
  at this blocker; do not lower evidence requirements, hide errors, add automatic
  retries or publish the feature to force apparent completion.
- Saved local `63/63` HTTP and `6/6` SQL receipts remain valid for their measured
  source, but the later evidence-prompt change still needs its applicable rerun.
- Browser signup success was observed. The user reported signing in, but the
  test window was closed before independent observation. Browser upload/chat,
  mobile, theme and session-flow acceptance remain **NOT VERIFIED** for this work.
  A later local server log showed a model-stage failed request; no private text
  was read to diagnose it. Do not call that browser flow a pass.
- On resuming, the owned native DB, Ollama and preview were stopped; cause unknown.
  Existing authorized PostgreSQL and preserved Ollama were restored after checking
  ownership and free ports. PostgreSQL identity, Ollama 0.40.9 and both required
  digests passed fresh checks. No initialization, model changes or unrelated
  service controls occurred. The preview was not restarted after that recovery.

### Remaining work in order

1. Resolve the single-generation evidence-header/answer reliability blocker with
   a reviewed approach; retain all rejected receipts and strict grounding checks.
2. Rerun the affected native and cloud workflows including interruption, quotas,
   cancellation, failure distinctions, deletion, ownership and privacy checks.
3. Finish signed-in desktop/mobile browser acceptance, including no predefined
   prompts, upload/selection, free text, sources and appearance preferences.
4. Complete fresh-source 100-question compatibility/numerical verification and
   negative controls without weakening .02 gates or mutating old declarations.
   The old evaluation cannot certify changed source; no fresh 100 run executed.
5. Complete coverage/security review, documentation, exact staging and local
   commits. Preserve the old schema and public 162-chunk index.
6. Only after all local gates pass: prevent unwanted Vercel builds, normal branch
   push, hosted CI, guarded additive Neon policy migration and runtime grant,
   existing Render opt-in release, production acceptance and rollback readiness.

No new paid infrastructure, billing activation, model change or Vercel deployment.
Real cloud probes used only public/synthetic content in the existing unbilled
project. The previous Render release must remain in service while blocked.

Final read-only Render API observation: `dep-dbth6m9srm7s73b9vmag` remains
`live` at `6458b355d28521f7e0ae32f68d1fb710433f6bdd`; prior `b40319c`
deployment remains retained/deactivated. No deployment action was taken.
The final Python HTTP probe returned URLError; the subsequent system-client
probe's process result was lost across session reset. Neither is reported PASS.
Current HTTP health therefore remains unverified at this stopped checkpoint.
Git remains `feat/production-rag` at `329ec8c`, with 40 modified/untracked paths
preserved, no new commit, no push. `git diff --check` passes.
