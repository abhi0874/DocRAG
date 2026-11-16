# Reproducing local UI verification

Use pinned Node 24.22.1 and pnpm 11.25.0 from the command contract. Start a
loopback-only development preview with the existing local database; do not point
it at Neon. Use a private local launcher/environment, never credentials in shell
arguments or this document. The public preview used `127.0.0.1:8082`, the existing
local public demo index and blank Gemini keys. No Gemini answer request was made.

1. Visit `/`, `/sign-in`, `/evaluate`, `/metrics/dashboard` and a missing route.
   Test the protected pages with the isolated local test accounts after the HTTP
   suite has finished; do not race its fixture quotas or sessions.
2. Set each theme and Low/Balanced/High intensity. Inspect the decorative line
   pattern inside/outside the lens, selected-pill geometry and ordinary text.
   Reload and confirm both preferences survive. Check slider Home/End/arrows and
   drag, dialog Escape and focus return. Enable Reduce motion and confirm immediate
   selection with no moving indicator; system reduced motion remains additive.
3. Resize to 320, 375, 430, 768, 1024, 1440 and 1920px. Read actual document width
   and scroll width. Allow browser painting to settle before taking screenshots;
   early `capture-a-*` images include stale viewport captures and are retained as
   rejected evidence, not proofs of the dimensions in their names.
4. On desktop hide evidence, then resize to mobile and select Sources. The evidence
   pane must appear. Switch Library / Ask / Sources with keyboard and pointer.
   Keep input and essential actions reachable when the viewport is short.
5. Open `/ui-lab` in the development preview. This page contains only synthetic
   public PostgreSQL text. Production must return 404 for this route.
6. Select a scenario, Start measurement, perform repeated interactions, then
   Finish measurement. Save the visible JSON without rounding away failures.
   Test adjacent/non-adjacent travel, repeated reversals, resizing, dynamic options,
   theme changes, source-pane changes, a 40-message fixture, scrolling while its
   synthetic answer streams and mobile navigation at all intensity presets.
7. Verify only one indicator, `pointer-events:none` on its SVG, the correct final
   selected option, no stranded animation and no new console/hydration errors.
   Code spans/fences must not activate example citations. Genuine citation clicks
   must focus and reveal the exact supporting passage.

`performance-final.json` retains per-run browser identity, viewport, scenario,
actual frame sample counts, percentiles, input delays and long-task observations.
Dropped-frame counts are estimates relative to each run's median frame interval,
not hardware counters. These short development measurements do not establish a
production benchmark, mobile-device certification or 165Hz capability.

Fresh local functional verification uses the unchanged command-contract verifier
with a new run ID. The first redesign attempt accidentally set `AI_PROVIDER` for
the entire process; one unit suite correctly rejected the missing isolated URL.
The corrected run lets the verifier choose local inference per command. Preserve
both receipts. Do not describe cached evaluation generations as fresh answers.

Final production browser runs used native Ollama at `127.0.0.1:8084` and a
public-layout preview at `127.0.0.1:8085`. The latter had blank Gemini keys and
was used for rendering only, not live cloud inference. Exact final outcomes and
limitations are in ACCEPTANCE.md and PERFORMANCE.md. Temporary viewport overrides
were reset and only the task-created Safari test window was closed afterward.
