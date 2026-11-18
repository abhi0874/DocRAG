# Focused readiness remediation — 18 November 2026

**BLOCKED: high-severity dependency review remains unsatisfied. No release or commit.**

This checkpoint follows the separate security/Ollama remediation authorization.
All 44 preexisting changed paths remain preserved; HEAD is still `329ec8c`.
The Gemini prompt, models, quotas, privacy controls and historical results are unchanged.

## Ollama diagnosis and fix

Read-only checks found the existing owned PostgreSQL cluster on 55433 and Ollama
0.40.9 running. Both configured model digests match. No shared service was started,
stopped, restarted or reconfigured. The previous 38 passing assertions included
registration, login, access denials, upload/indexing and two cited answers; the
third summary failed before delivering text.

The exact synthetic fixture was read from the preserved isolated test database.
Two bounded raw diagnostics returned STOP, 703 input tokens, 133 output tokens,
zero reasoning tokens, and no provider errors. The answer existed after a literal
backslash-n separator, not a newline. The parser therefore attempted to decode the
assessment and answer together as JSON. This was a framing defect, not unavailable
Ollama, missing evidence, truncation, cancellation or missing answer text.

The focused correction recognizes literal backslash-n only after a complete outer
JSON object, outside quoted strings. It then applies the unchanged strict schema,
exact-quote check, nonempty answer requirement, finish check and citation pipeline.
It never rewrites escapes inside a quote or accepts unseparated prose. No model
prompt/options change. Two new tests cover split separator chunks, empty output,
quote escapes and missing separators. The same live summary passes the corrected
guard. Raw pre-normalization JSON still fails by design; this is not a relaxed
schema. Three fresh local diagnostics total; no Gemini calls in this task.

The first diagnostic failed on an incorrect diagnostic-only owner-column name
before any generation. It was corrected to the actual schema; no DB write occurred.

## Five-advisory review

| ID | Package / installed before → after | Severity / affected | Dependency / exposure | Fix / decision |
| --- | --- | --- | --- | --- |
| GHSA-mfr8-8qww-v76h | next 16.4.4 → 16.4.5 | Moderate; >=16.3.0 <=16.4.4 | Direct production. No application `use cache`/`unstable_cache`/root-param usage found | Fixed at 16.4.5; matching eslint-config-next patch applied |
| GHSA-vc7v-qv4w-wrv8 | next 16.4.4 → 16.4.5 | Moderate; >=16.2.0 <=16.4.4 | Direct production. Cache Components not enabled; no nested cache functions found | Fixed at 16.4.5 |
| GHSA-fc5q-39xc-vjpf | picomatch 4.0.7 and 2.3.2, unchanged | High; <=4.0.7 | Transitive Vite/Vitest/ESLint; Better Auth optional peer marks some paths non-dev. Next also bundles picomatch in server output | Registry latest remains 4.0.7; advisory says no published patch. BLOCKED, not waived |
| GHSA-67mh-4wv8-2f99 | esbuild 0.18.20, unchanged | Moderate; <=0.24.2 | Historical Drizzle loader transitive, optional auth peer marks non-dev. Absent from fresh production traces; no esbuild serve invocation | Fixed upstream >=0.25.0; forcing legacy loader onto a different pre-1.0 API is not established safe. Historical reviewed restriction retained |
| GHSA-g3hv-75wg-m249 | minimatch 10.2.5, unchanged | Moderate; >=7 <11.0.1 | Historical ESLint-only transitive; no request-controlled lint patterns; absent production traces | Fixed >=11.0.1, major change to tooling; historical trusted-config restriction retained |

Sources: [Next advisory 1](https://github.com/vercel/next.js/security/advisories/GHSA-mfr8-8qww-v76h),
[Next advisory 2](https://github.com/vercel/next.js/security/advisories/GHSA-vc7v-qv4w-wrv8),
[picomatch](https://github.com/advisories/GHSA-fc5q-39xc-vjpf),
[esbuild](https://github.com/advisories/GHSA-67mh-4wv8-2f99),
[minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249).
The first three are newly reported relative to the old approved audit; the last
two remain historical findings, not fixed packages.

Fresh trace inspection includes the **Next server trace**, not just route traces.
Of 42 trace manifests, the server trace includes Next's bundled picomatch; standalone
picomatch appears in no route trace. Inspected consumers include build tracing,
middleware configuration and image pattern matching. Image patterns are taken
from configuration and image optimization is disabled in this application. No
application import or attacker-controlled glob entry point was found. This narrows
observed exposure but is not a complete proof covering bundled implementations.
The bundled version/reachability needs a supported mitigation or reviewed disposition.
Do not run malicious patterns in the shared process or silently whitelist the high
finding. No scanner/gate changes were made. Audit still exits 1 (two moderate,
one high), so the release security policy remains FAIL.

## Verification and lockfile review

Evidence is under ignored `.local/readiness-repair/`, preserving earlier logs.
Commands use Node 24.22.1 and pnpm 11.25.0 via the previously verified local launcher.

- `pnpm update next@16.4.5 eslint-config-next@16.4.5 --ignore-scripts`: exit 0.
  Only two direct pins changed. Lockfile changes cover corresponding Next env/SWC/
  lint packages and peer-resolution labels; an unused caniuse-lite entry was removed.
  No React, AI SDK, auth or model upgrade. Package scripts were not run on install.
- `pnpm install --offline --frozen-lockfile --ignore-scripts`: exit 0.
- Focused provider/evidence/route tests: **36 passed**, exit 0.
- `make lint`: exit 0.
- `make test`: **218 Python + 336 TypeScript = 554 passed**, exit 0.
- `pnpm exec next build --webpack`: initial restricted-network exit 1 fetching the
  existing Google Font; authorized network retry exit 0. UI/font configuration unchanged.
- `pnpm audit --json`: exit 1; both Next advisories absent, three findings remain.
- Direct synthetic summary: corrected parser PASS.
- `scripts.workspace_http --run-id readiness-a`: exit 0, **63/63**, ten fresh local
  generations. Summary, direct facts, paraphrase, section explanation, follow-up,
  comparison, missing evidence, partial support and guest free-form pass. Actual
  streaming cancellation, quota rejection, two-account isolation, session expiry,
  logout and fixture deletion pass. Original databases and public corpus preserved.
  Receipt: `.local/workspace-http-readiness-a/receipt.json`.

Gemini compatibility is deterministic only in this task; prior 22/22 live workflow
remains historical. No unnecessary live Gemini request was made. Full regression,
fresh 100-question evaluation, browser/mobile checks and release commit are held
behind the unresolved security gate. No fresh recall/correctness/faithfulness or
latency benchmark is claimed. Golden labels and thresholds remain unchanged.

Production, Neon, Render and Vercel are unchanged by this execution. No push,
publication, billing activation, global install or paid API use. Paid usage ₹0.
