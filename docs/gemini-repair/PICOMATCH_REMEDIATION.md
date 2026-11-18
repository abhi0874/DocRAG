# Picomatch security gate investigation — BLOCKED

Checked 2026-11-18 (Asia/Kolkata), branch `feat/production-rag`, HEAD
`329ec8c595bbcc2c517188a15a4dd60de8f7201c`. This supplements the historical
`READINESS_REMEDIATION.md` and `PUBLICATION_GATE.md`; it does not replace their
receipts. The 48 pre-existing changed files were fingerprinted before work.

**The high finding remains, and the unchanged release gate fails.** No application,
dependency, lockfile, framework bundle, security policy, database or service change
was made in this task. Two evidence files were added: this report and
`picomatch-boundary.mjs`. No publication is authorized by this result.

## Advisories and current release availability

| Advisory | Verified status | Installed-package consequence |
| --- | --- | --- |
| [CVE-2026-33671 / GHSA-c2c7-rcm5-vvqj](https://github.com/micromatch/picomatch/security/advisories/GHSA-c2c7-rcm5-vvqj) | Fixes published at 2.3.2, 3.0.2 and 4.0.4 | Installed standalone 2.3.2 and 4.0.7 include those version-level fixes. This does **not** establish the separately bundled copy's version or patch status. |
| [CVE-2026-112366 / GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) | High; affected <=4.0.7; no patched version listed. Advisory updated November 17. Single-branch repeated extglob patterns can cause excessive backtracking. | Both installed standalone versions remain affected. The registry's latest release is still 4.0.7. |

Read-only registry checks also found **Next.js / eslint-config-next 16.4.6**, newer
than the checkout's 16.4.5. The official
[16.4.6 tarball](https://registry.npmjs.org/next/-/next-16.4.6.tgz) was inspected
without installation or executing package scripts; its SHA512 matched registry
integrity metadata. Its compiled picomatch is **byte-identical** to the installed
16.4.5 bundle. Upgrading Next to this release does not remove this blocker.

### Dependency paths

Picomatch is not a direct DocRAG dependency. Fresh `pnpm why picomatch --json` and
`pnpm audit --json` establish these families:

- `eslint-config-next@16.4.5 → @next/eslint-plugin-next → fast-glob@3.3.1 →
  micromatch@4.0.8 → picomatch@2.3.2` (development tooling).
- `eslint-config-next → typescript-eslint / import resolver → tinyglobby@0.2.17
  / fdir@6.5.0 → picomatch@4.0.7` (development tooling).
- `vitest@5.1.0 / @vitest/coverage-v8 → vite@7.3.7 / tinyglobby / fdir →
  picomatch@4.0.7`, plus Vitest's direct picomatch dependency.
- `better-auth@1.7.15 → optional Vitest peer →` the same tooling tree. This peer
  makes some audit paths **non-dev**; it is not evidence that request handling
  invokes Vitest. Its separate optional Drizzle CLI peer has the analogous
  classification issue for esbuild.
- Independently, `next@16.4.5/dist/compiled/picomatch` is precompiled vendor code
  shipped inside Next, outside pnpm's independently resolved picomatch packages.

## Actual artifact and bundled version evidence

The installed and existing `.next/standalone` copies both have:

```text
file: next/dist/compiled/picomatch/index.js
size: 23909 bytes
SHA256: 607dc79784c1161c33076903769dba23e63d9d9ccfe3c4695a32ebe3a5ab892d
SHA1: fa62f925abc1224279051796522f91e7e6added8
bundled package.json: no version field
```

The [Next 16.4.5 source manifest](https://github.com/vercel/next.js/blob/v16.4.5/packages/next/package.json)
declares picomatch 4.0.1 as a development dependency. That is a provenance clue,
**not proof of the compiled file's exact semantic version**. The bundle has the
legacy `windows===null` marker and no literal `analyzeRepeatedExtglob` symbol;
these are fingerprints, not an exploit demonstration or a complete patch test.
Its hash differs from the 4.0.3 bundle reported in
[Next issue 92950](https://github.com/vercel/next.js/issues/92950), so that issue's
version cannot simply be assigned here. Treat this unversioned legacy copy as
affected/unresolved; no fixed-bundle provenance was established for either CVE.

All **42** existing Next trace manifests were inspected, including
`.next/next-server.js.nft.json`, which includes the bundled JS and manifest.
The bundled file is physically present in the standalone artifact and **callable**
(safe deterministic check below). Standalone `picomatch@*`, Vite, Vitest,
`minimatch@*`, esbuild and drizzle-kit packages are absent from that artifact and
from its traced dependencies. This distinction matters: the ordinary dependency
graph does not accurately describe the final runtime filesystem.

`Dockerfile` copies `.next/standalone` into the final non-root Node 24.22.1 image;
therefore a build retaining these traces also retains the bundled copy. The full
dependency and migration stages are separate from the final runtime stage.
**Actual current container/image inspection was unavailable:** read-only Docker
inventory exited 1 because the Desktop daemon socket was absent. No daemon or
container was started. Local artifact evidence is not a fresh Linux image result
and does not establish the deployed Render image's contents.

An ordinary pnpm override would change resolved standalone packages, not the bytes
of `next/dist/compiled/picomatch`. That limitation applies here: the runtime imports
that explicit path, and the separately inspected latest Next package retains the
same bytes. No override was added as a substitute for a bundled fix.

## Trust-boundary tracing

### Production runtime

The inspected CJS and ESM runtime consumers are Next's image-pattern helpers:

- `dist/shared/lib/match-local-pattern.js:30` compiles **configured**
  `pattern.pathname`, then tests the URL pathname.
- `dist/shared/lib/match-remote-pattern.js:38,48` compiles **configured** hostname
  and pathname patterns; request URL fields are matching candidates.
- `dist/server/image-optimizer.js:235,259` uses those helpers during image parameter
  validation.
- `dist/server/next-server.js:193` returns a 404 for `images.unoptimized` **before**
  parameter validation. `next.config.mjs` and the serialized built configuration
  both set this to true. Built remote patterns/domains are empty; the built local
  default is the fixed `{pathname:'**', search:''}`.

The image-optimizer module is required **before** this unoptimized branch. Removing
its transitive bundled module with tracing exclusions would risk a module-load
failure even for an image request that should return 404. Package presence is thus
real and executable, while untrusted pattern compilation is not demonstrated.

### Application inputs

| Input | Reviewed path | Glob compilation reachability |
| --- | --- | --- |
| Question text, follow-ups, guest questions | `app/api/chat/route.ts` schema, ACL, `selectContext`, retrieval and `startRagAnswer` | Text is a retrieval/provider input; no glob API or framework configuration write. Guest access uses the same scoped flow. |
| Uploaded filename | `lib/security/pdf.ts:16`; `app/api/documents/route.ts:60–68` | Bounded filename rejects controls, path separators and `..`; then used as DB title/filename/source metadata. It never selects a filesystem/glob path. |
| PDF bytes and extracted content | `readPdf`, `parsePdf`, `embedChunks` | Bytes go through the fixed PDF worker over stdin, then embeddings/SQL storage. No attacker-selected worker filename or glob. |
| Document ID, file/download path | Numeric ID validation and ownership checks; `app/api/documents/[id]/download/route.ts` | Reads DB bytes under ACL and returns a fixed numeric-ID filename. No filesystem discovery. |
| Metadata and citations | Stored chunk metadata, evidence selection and citation validation | Data values, not configuration patterns. No glob imports found in application code. |
| Image URL/API query | Next helpers above | Request strings are candidates; compilation takes trusted configuration. Image optimization is disabled before validation. |

Filename validation is **not** claimed to reject every extglob. The relevant
boundary is that filenames are not compiled as patterns. A blanket question or
filename character blacklist would change product behavior without addressing an
observed vulnerable call site.

### Build/tooling

Other compiled-picomatch consumers are `build/collect-build-traces.js` (fixed
ignore patterns and checked-in tracing includes/excludes),
`build/webpack/plugins/next-trace-entrypoints-plugin.js`, middleware configuration
validation / `unstable_allowDynamic`, `build/index.js` image-manifest construction,
and build tracing's compiled `@vercel/nft`. These use repository configuration or
build paths, not DocRAG HTTP request data. No public endpoint triggers a build,
lint run, test runner, or modifies Next configuration. Untrusted repository/build
configuration remains a separate tooling risk; these packages are not safe for
arbitrary attacker-selected glob inputs.

**Conclusion:** no attacker-controlled glob-pattern input was found in the reviewed
application/runtime paths. This is a scoped source and boundary assessment, not a
claim that the dependency is patched, every framework path is proved safe, or that
an absence of observed attacks establishes safety.

## Deterministic evidence and checks

`picomatch-boundary.mjs` loads the **actual standalone** bundle and image helpers.
It checks the built image restrictions, installed/artifact byte equality, a benign
fixed-pattern compilation, candidate-vs-pattern separation, query rejection, and
empty remote allowlists. Its temporary test-process spy only records arguments;
it restores the original function after every case. It is not an application
patch. No repeated-extglob attack payload was executed.

The check ran with an empty environment except safe HOME/TMPDIR/LANG/NODE_ENV,
macOS sandbox denial of network, all filesystem writes and process forks, 64 MB
Node heap, 5-second CPU limit, 15-second parent timeout, zero file-size limit,
128 descriptors and a 64-process limit. The first nested-sandbox attempt exited
71 (`sandbox_apply: Operation not permitted`); the approved outer execution retry
retained the same restrictive sandbox and passed. Exact invocation/limits and
output are saved under `.local/picomatch-remediation/boundary-command.json` and
`boundary.log`.

| Check / command | Fresh result |
| --- | --- |
| Registry `pnpm view` and `pnpm why picomatch --json` | Exit 0; versions/paths recorded above |
| `pnpm audit --json` | Exit 1: **one high, two moderate**, zero critical |
| `.venv/bin/python -m scripts.security_audit` | **Exit 1**, `Unreviewed dependency findings`; unchanged policy rejects the added high. Python/reranker stages are not reached, not reported PASS. Prior receipts copied before running. |
| `pnpm install --offline --frozen-lockfile --ignore-scripts` | Exit 0, already up to date; package/lock bytes unchanged |
| Sandboxed `node --max-old-space-size=64 docs/gemini-repair/picomatch-boundary.mjs` | **8/8 passed**, exit 0 |
| `pnpm exec vitest run tests/security.test.ts tests/citations.test.ts tests/chat-cancellation-stages.test.ts tests/workspace-*.test.ts` | **129/129 passed across 9 files**, exit 0; provider/DB mocks, no live calls |
| `pnpm lint` | Exit 0 |
| Production build | **Historical PASS**, not rerun: no application/dependency/config change in this task; existing built artifact inspected. Previous receipt `.local/readiness-repair/build-network.log`. |
| Docker image/container inspection | Unavailable, exit 1; daemon absent; no service modification |

The historical full suite remains **554** tests, local workflow **63/63**, Gemini
workflow **22/22**. These are not fresh results from this task. Fresh focused tests
cover grounded-answer framing, strict evidence/citation checks, Gemini options,
Ollama literal separator handling, consent, ACLs, uploads and cancellation. Their
expected synthetic failure-path logs are not live production errors. No full
evaluation, coverage collection or cloud generation was run.

Read-only official-package inspection initially failed because Python's local TLS
trust store could not verify the registry certificate. The system HTTPS client
succeeded with certificate verification still enabled; package integrity was then
verified. No certificate/security setting was changed.

## Historical moderate findings reassessed

| Finding | Path / actual runtime exposure | Fix availability and policy |
| --- | --- | --- |
| [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99), esbuild **0.18.20** | Drizzle kit → legacy `@esbuild-kit/esm-loader` → core-utils → esbuild; optional Better Auth CLI peer yields non-dev classification. Absent final standalone/traces. DocRAG does not invoke esbuild's affected development HTTP server. | Fixed >=0.25.0. Latest Drizzle kit remains 0.31.11 and still declares the legacy loader; its separate direct esbuild ^0.25.4 does not replace the loader's copy. Historical tooling restriction accepted by existing policy, **not fixed**. |
| [CVE-2026-118764 / GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), minimatch **10.2.5** | ESLint → typescript-eslint / parser → typescript-estree; all audit paths dev. No final artifact/traces, no HTTP-controlled lint patterns. | Fixed >=11.0.1. **New finding in this review:** official typescript-estree 8.73.0 declares ^11.0.1; installed 8.71.2 declares ^10.2.2. A coordinated supported typescript-eslint update is now a candidate, preferable to a forced major override. Not applied because it does not resolve the focused high blocker; compatibility/lint validation would be required. Current residual remains conditionally accepted by unchanged policy, **not fixed**. |

No moderate advisory is hidden. Their previous acceptance does not authorize a
high-severity exception, and the overall gate remains FAIL.

## Remediation decision and release hold

1. **Official patch:** no patched picomatch release listed; latest Next 16.4.6 has
   the same bundle. Neither is an established repair for this finding.
2. **Removal:** standalone tooling copies are already absent from the runtime
   artifact. Removing Next's retained bundle can break its image-module imports.
3. **Replacement:** no supported Next configuration substitutes this internal
   implementation. A vendor edit, fork or import interception is not justified.
4. **Input restriction:** existing fixed configuration and disabled image optimizer
   protect the reviewed request boundary; eight tests document that behavior.
   This does not erase the advisory or satisfy a policy that rejects this high.
5. **Isolation:** current image helper code runs in the server process. CPU/heap
   limits alone would not prove availability under repeated adversarial inputs;
   speculative worker surgery inside Next is not a minimal maintainable fix.

No failed repair was repeatedly attempted. The honest outcome is **BLOCKED** on an
unpatched high finding and unresolved bundled-copy disposition, with a separate
pending actual-container verification. Do not modify the gate to accept the high
merely because no public pattern-input path was found.

Next: obtain and verify an official patched dependency/framework bundle or a
supported, reviewed mitigation satisfying the existing release policy; rerun the
gate and artifact/container checks after that change. Then complete the pending
full release regression, fresh 100-question evaluation, coverage and browser/mobile
acceptance. This investigation does not authorize deployment.

All 48 original changed paths remain byte-identical. No staging, commit, push,
branch operation, production request, Render/Vercel change, Neon write, model
change or paid call was performed. Production is unchanged by this task; its
health was not re-probed. Added evidence receives the final preservation and
secret-pattern scan saved in `.local/picomatch-remediation/final-checks.json`.
Paid usage in this task: **₹0**. Publication authorization: **NOT YET**.
