# Final workspace UI candidate — publication blocked

Application source `2fc209521af326db308753e9b18525ad022f3a6d`, branch `feat/production-rag`. The six files changed since `bbca2a6` implement the shell control, palette bootstrap and composer. The wider release since production also includes the previously reviewed opt-in authenticated workspace, storage policy, provider fixes, dependency changes and historical evaluation evidence. [Workspace release review](../../WORKSPACE_RELEASE.md) · [Retained RAG decision](../../gemini-repair/TARGETED_RECOVERY.md)

## Product checks

The global sun/moon control uses the existing appearance context, storage key, optical lens, palette and navigation spring. The root shell owns the switch. While the native appearance dialog is modal, a switch using the same state occupies the same viewport coordinates inside its focus boundary. The stored palette is applied by a static same-origin script before paint. The composer now centers a single line and the action in 44 px, expands to a bounded height, and replaces Send with Stop while generating.

| Local verification on the candidate | Result |
|---|---|
| Focused appearance tests, then `make lint`, `pnpm exec next build --webpack`, `make test` | Exit 0. 5 focused tests. 231 Python and 354 TypeScript tests passed. |
| Chrome 157 desktop and mobile emulation | Fixed control at 1280, 390 and 320 px. Guest, authenticated workspace, sign-up/in, evaluation, insights and appearance covered. Matching modal coordinates and pointer target, stable sidebar collapse, keyboard toggle and saved theme at first animation frame with opposite OS palette. |
| Composer | Single line 44 px, four lines 104 px, zero center offset between textarea and Send at all three widths. Shift+Enter inserted a newline. Enter submitted. Stop cancelled and restored the empty disabled Send action. Reduced-motion transition verified. |
| Frame sample | 30 idle headless Chrome frame intervals at 320 px, median 16.7 ms. No physical-device, sustained-animation or 165 FPS measurement. |
| `python -m scripts.workspace_http --run-id final-ui-rc-a` | Exit 0, 63/63, ten fresh local generations and one cancellation. Register, sign in, upload/index, arbitrary guest/personal questions and citations, account isolation, refusal, quota, deletion and sign-out. |
| Dedicated Docker Compose build and `scripts.container_http` | Exit 0, 26/26 on the final image. Ten unrelated container lifecycle snapshots matched before/after. |
| Secret scan | Zero findings across intended files, tracked source, reachable history and generated client assets. |
| Providers and storage | Local Ollama and dedicated Postgres verified. Gemini compatibility retains historical live evidence and fresh automated coverage. No new Gemini calls or production writes. |

Browser receipts and screenshots were taken from local synthetic sessions. Earlier automation attempts mistimed post-reload keyboard input, serialized a DOM element and sent a newline rather than the native Enter character. The final runs checked actual input contents, geometry and state. The desktop sidebar was exercised at its desktop breakpoint. The agent-browser executable and the optional React checklist file were unavailable; verification used the repository's existing local Chrome DevTools workflow and lint/type checks.

[Desktop light](desktop-light.png) · [Desktop dark](desktop-dark.png) · [Mobile light](mobile-light.png) · [Mobile dark](mobile-dark.png) · [Machine-readable receipt](verification.json)

## Quality and security decision

All 42 measured application hashes, including the lockfile, and all 18 evaluator hashes match the verified measurement. The golden set, RAG settings and historical artifacts retain their original bytes. The 100-question measurement at `ddb0e0c` remains applicable: Recall@3/5/10 .950/.975/1.000, MRR .9729, automated correctness .970, faithfulness 1.000, citations 267/267, unanswerable 20/20 and pipeline p50/p95 5.85/10.26 s. The defined numerical gates apply to decreases greater than .02 in Recall@5 and faithfulness. Neither decreased. Correctness .970 is below historical .990 and clears the established numerical policy, which has no separate correctness minimum. [Cross-version procedure](../../gemini-repair/CROSS_VERSION_COMPARISON.md)

Fresh `pnpm audit --json` exited 1 with one high (picomatch) and two moderate (esbuild and minimatch). The high advisory lists no patched version. The upstream issue remains open. The existing hold applies to the bundled framework code. No exception has been granted. [Official advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) · [Upstream issue](https://github.com/micromatch/picomatch/issues/247) · [Security decision](../../gemini-repair/SECURITY_DECISION.md)

A scratch copy using `pnpm update typescript-eslint --depth 3 --lockfile-only --ignore-scripts` resolved typescript-estree 8.73.0 and minimatch 11.0.9, removing 10.2.5. A frozen installation with lifecycle scripts disabled and lint over the copied project source passed. The change touched 170 lockfile lines and would invalidate the measured lockfile hash. It is a viable separate dependency update, pending integration and provenance review. The release candidate retains its measured graph and both moderate disclosures.

## Conditional publication to the existing Render service

1. Resolve the high security gate and repeat the release diff, artifact audit and affected acceptance on the exact release SHA. Obtain separate publication authorization. Capture the current live Render deployment ID, commit and environment for rollback. The last recorded production SHA begins `6458b35`.
2. Push that SHA normally on `feat/production-rag`. Verify the remote SHA and hosted CI for it. Confirm the existing `docrag-demo` Free service uses the repository Dockerfile, manual deployment, approved models and unbilled project.
3. Check the existing origins, production auth secret, restricted Neon runtime principal, TLS hostname validation, public corpus identity, and free-tier limits privately. The last recorded database was `docrag_demo_gemini_v1` with 162 public chunks. Production settings and grants need fresh verification before publication.
4. With schema-owner authorization and recovery point confirmed, inspect the current metadata and apply only the additive table/index in `db/workspace.sql` to that isolated database in a transaction. Verify the runtime role's required table permissions and absence of schema creation rights. Preserve existing documents, vectors and accounts. Confirm the consent, eligibility, retention, account and global quota settings.
5. Set the existing service's `DOCRAG_WORKSPACE_ENABLED=true` with the approved origin and secrets. Deploy the specific CI-verified SHA via Render's manual **Deploy a specific commit**. Check the deployed identity, health/readiness and startup logs. Complete public and two-account acceptance with synthetic, permitted material, including citations, stream cancellation, deletion and logout.
6. If production regresses, restore the prior workspace setting and other changed environment settings and roll back to the recorded previous successful deployment. Recheck health, readiness and the prior public demo. Leave additive metadata and user records intact. Live acceptance remains pending.
