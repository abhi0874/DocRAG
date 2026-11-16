# MONO / GLASS — final local acceptance

**Local redesign complete — 16 November 2026 (Asia/Kolkata).** This is separate
from the completed twelve-step roadmap. The redesign has not been pushed or
deployed. Production remains the previously published `b40319c` version; no
fresh production uptime or hosted-CI claim is made for this change.

## Scope and result

| Area | Final local acceptance |
| --- | --- |
| Identity and routes | PASS: public/native `/`, `/sign-in`, `/evaluate`, `/metrics/dashboard`, error/not-found views and appearance dialog share the MONO / GLASS design. |
| Themes and type | PASS: Obsidian Lime and Pearl Forest; Bricolage Grotesque, DM Sans and IBM Plex Mono through the existing font loader. |
| Optics | PASS within documented scope: real displacement of bounded public SVG artwork, curved rim/reflection shading, limited surface blur and opaque fallback. Reading content and interaction targets are never distorted. |
| Liquid controls | PASS: one continuous rounded path, spring/velocity stretch, restrained neck/recovery, unequal options, rapid switching/reversal, resize retargeting, keyboard and disabled states. |
| Preferences | PASS: continuous 0–100 plus Low/Balanced/High, actual optical changes, theme/system selection, persistence, malformed-storage handling, reduced motion and Escape/focus return. |
| Responsive and accessibility | PASS for the measured/manual checks below; no external WCAG certification or untested hardware claim. |
| Native functionality | PASS: real local authentication, public PDF upload, streaming answer, citation focus, cancellation/follow-up, feedback, evaluation/metrics display, two-user isolation and logout protection. |
| Verification and preservation | PASS: full pre-serializer 27/27 contract run, final 14/14 applicable repeat commands, 491 unique unit tests, unchanged quality gates, data/configuration preservation and final secret/staging review. |

The user requested applicable local acceptance, not unavailable-device
certification. Known measurement limits below remain explicit and are not reported
as passes. No known blocking local defect remains in the verified workflows.

## Browser and visual evidence

Chromium 157 received the detailed interaction and production workflow checks.
Safari **27.3** received a native local production smoke test: light/dark,
Low/High, Quiet/Expressive liquid selection, Escape and saved preferences after
reload. See `safari-compatibility.json`. Firefox was not available and is **not
verified**. The fallback uses ordinary surfaces, borders and selected-state
semantics; advanced optics never carry essential information.

Final native responsive checks passed **14/14** with no horizontal overflow in
both themes, at actual CSS widths **319, 375, 430, 768, 1024, 1440, 1919px**.
The requested 320/1920 endpoints measured one pixel lower due to display scaling.
`responsive-display-scaled.json` retains the earlier raw-viewport observations;
`responsive-final.json` records the corrected requested/actual pairs. Public
workspace layouts and mobile Sources after desktop hiding also passed. Short
viewport composer access was checked; physical mobile keyboards were not.

Manual keyboard/semantic checks cover labels, selected states, focus visibility,
radio navigation, Home/End, dialog trapping/Escape/return, native validation,
reduced motion and citation focus. Numerical contrast passed **12/12** sampled
text/control pairs (4.5:1 text, 3:1 controls). This is not a complete independent
screen-reader or WCAG 2.2 certification. Forced-colors styles are implemented;
an actual forced-colors OS session was not available.

Final screenshot sets include `public-final-{dark,light,mobile}.jpg`,
`native-final-{dark,light,mobile}.jpg`, `evaluation-final.jpg`,
`metrics-final.jpg`, `appearance-final-{low,high}.jpg`, and Safari captures.
Screenshots were reviewed for hierarchy, wrapping, contrast, form reachability
and optical artifacts. `production-baseline.jpg` is the historical comparison;
`capture-a-*` contains rejected stale viewport rasters and is not final evidence.
No private credentials appear in saved captures. Native test screenshots show only
synthetic public passages and fixture activity. Browser console receipt is empty
for the final recorded session, not a promise of zero logs in every environment.

## Functional repairs found during review

1. Restored independent mobile conversation scrolling and Jump to latest.
2. Selecting the already-selected document now returns mobile Library to Ask
   without clearing its conversation.
3. Source focus tracks stable source identity; each explicit citation click can
   focus again, while new streaming objects no longer steal focus repeatedly.
4. Corrected minified backdrop-filter ordering and verified actual High/Low blur.
5. Excluded empty cancelled assistant shells from the outgoing native text
   history, fixing the next request's HTTP 400. Partial answers and citations
   remain. Four new tests exercise the existing server schema. The final browser
   recreated cancellation after source metadata but before answer text, then
   completed a new cited answer successfully.

Final native browser receipt: `native-browser-final.json`. Failed cancellation
evidence remains in `cancel-followup-rejected.jpg` and the ignored original preview
log. Security/observability suites use isolated local fixture databases. The
public-layout preview had blank Gemini keys: it is rendering evidence, not a
fresh Gemini inference run. Existing cloud-provider behavior is unchanged and its
historical evidence is not relabeled fresh.

## Tests, performance and limits

[VERIFICATION](VERIFICATION.md) records exact commands, codes, coverage and all
failed/interrupted attempts. Final **491 tests pass, zero fail** (218 Python,
273 TypeScript). Focused tests and coverage reruns are subsets/repetitions, not
extra unique tests. Lint and production build pass. The full 27-group evaluation
preceded the final UI serializer repair; **14 applicable commands** were rerun
after it, with the unchanged evaluator's result retained transparently.

The 100-question evaluation has **100 fresh answers/query embeddings**, **15 fresh
and 85 cached judgments**, Recall@5 **.975**, faithfulness **1.000**, correctness
**.990**, citations **265/265**. Original .02 gates and negative controls pass.
This does not imply human validation or perfect answer correctness.

Final TS statement coverage is **58.31%**, lower than historical 65.36%; Python
unit-only scripts coverage is **20.17%**. No gate was lowered. The full Python
integration coverage remains **historical 76.46%**, with its original mixed-run
provenance. Docker lifecycle, full load coverage and hosted CI were not rerun for
this frontend-only change; backend, dependency, database and operational code
remain unchanged. See the precise scope rationale in VERIFICATION.md.

[PERFORMANCE](PERFORMANCE.md) records **31 runs / 13,173 frame intervals / 11
estimated drops / zero observed long tasks**, approximately **120Hz**, per-run
p95 **8.6–9.3ms**. Short development fixtures are not sustained production or
model-throughput measurements. **165 FPS: NOT VERIFIED — hardware unavailable.**
Safari FPS, Firefox, physical touch/keyboard and GPU/thermal stress are unmeasured.

The two existing moderate JS tooling advisories remain: esbuild
`GHSA-67mh-4wv8-2f99`, minimatch `GHSA-g3hv-75wg-m249`. Raw JS audit exits 1;
the unchanged reviewed policy passes. Python and optional reranker audits pass.
No new dependency or security exception was added. Golden labels, selected chunks,
historical evaluations, caches, vectors and model digests remain preserved.

## Git, safety and publication boundary

Work stays on `feat/production-rag`, preserving baseline `b40319c` and all history.
Implementation commit is `acddb35`; the containing documentation commit is
resolved as described in [LOCAL_COMMITS](LOCAL_COMMITS.md). Final source fingerprints
and exact staged paths identify the local changes. Secret scans cover intended files, reachable history and built
client assets without displaying private values. No `.env`, `.local`, credential,
private document or unrelated work is included. Rejected evaluation b and accepted
evaluation d are intentionally preserved alongside the UI documentation.

Only already-authorized DocRAG-owned PostgreSQL and preserved loopback/cloud-off
Ollama were restored after identity/port checks. No conflicting process was killed,
unrelated container controlled, database reset, model replaced, paid API invoked,
billing enabled or external deployment changed. Service disappearance/replacement
causes remain unknown. Browser testing closed only its task-created Safari window
and reset temporary viewport overrides.

**Three final local confirmations:**

1. Product, interaction and applicable accessibility checks: **PASS**, within
   the explicit browser/hardware scope above.
2. Functional/security/regression checks and evidence integrity: **PASS**, with
   fresh, reused and historical evidence distinguished.
3. Scope, preservation, documentation and local Git safety: **PASS**; the exact-stage/commit receipts and final clean-status observation
   are recorded through LOCAL_COMMITS.md.

Publishing this redesign requires separate explicit authorization for the normal
GitHub push, hosted CI, Render redeployment and production smoke/rollback checks.
No push, PR, merge, deployment or new roadmap step is part of this task.
