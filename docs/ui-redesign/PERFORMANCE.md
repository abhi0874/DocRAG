# MONO / GLASS — measured interaction performance

Final local measurements, 16 November 2026 (Asia/Kolkata). Raw observations are
in [performance-final.json](performance-final.json). These are actual browser
`requestAnimationFrame` samples, not inferred FPS from animation durations.

## Environment and scope

Chromium 157 in the macOS in-app browser, local **development** UI lab, pinned
Node 24.22.1. The lab renders the same liquid selector, appearance, chat and source
components with synthetic public PostgreSQL passages. It makes no model calls.
Most runs use a 1440×900 CSS viewport; mobile runs use 375px width. Per-run browser
identity, viewport, duration, input samples and frame percentiles are retained.

The observed median frame interval was approximately **8.3ms / 120Hz**. This
does not certify the panel's maximum refresh rate. **165Hz hardware was not
available for verification**; no 165 FPS, 144Hz, 90Hz or physical-mobile claim is
made. Spring tests exercise elapsed-time behavior without a fixed 16ms step.

## Results

| Intensity | Runs | Frame intervals | Estimated drops | Per-run p95 interval | Input-to-next-frame p95 | Observed long tasks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Low | 11 | 5,748 | 3 | 8.6–9.3ms | 10.2ms | 0 |
| Balanced | 10 | 3,736 | 6 | 8.8–9.3ms | 7.7ms | 0 |
| High | 10 | 3,689 | 2 | 8.8–9.3ms | 8.0ms | 0 |
| Total | 31 | **13,173** | **11** | **8.6–9.3ms** | Not pooled across levels | **0** |

Input p95 is pooled within each intensity. The largest input sample was **27ms**
in Low long-chat. Runs lasted **0.611–11.532s**; they are short interaction probes,
not a sustained production soak. Estimated drops are relative to each run's
median interval, not hardware/GPU counters. The long-task API was supported and
recorded no tasks in these windows; this does not establish zero long tasks under
all real workloads. Differences between intensity levels are not causal speedup
claims: interaction sequences and recording durations differ.

All three intensities covered adjacent and non-adjacent movement, rapid repeated
switching **and** mid-animation reversal, theme changes, intensity updates, source
selection, evidence-pane collapse/resize, long chat, synthetic streaming while
scrolling, and mobile selector use. The two rapid-switching requirements share
the `rapid-reversal` scenario, giving ten IDs for eleven requested interactions.
`sidebar` refers to the evidence pane; no separate left-library collapse feature
is implied. Actual mobile workspace navigation is verified separately.

The first Low stream/scroll run used a short fixture and remains retained. A
subsequent Low run and Balanced/High runs used streaming appended to forty prior
messages. [mobile-scroll-final.json](mobile-scroll-final.json) additionally proves
that a 375px conversation has a bounded scrolling region, shows Jump to latest
after scrolling away, and returns to within 0.5px of its bottom.

## Engineering decisions and fixes

The controller uses an analytical damped spring, elapsed time and one closed SVG
path. Geometry is measured on mount, resize and font change, not every frame.
Only the indicator's geometry changes continuously; labels and hit targets stay
semantic and separate. Animation stops at rest, retains velocity when interrupted,
and snaps safely after long background gaps or under reduced motion. No animation
library or new dependency was added.

Optics are bounded to signature surfaces. Low disables blur; High uses at most
12px surface blur and displacement scale 18 on public decorative artwork. There
is no private-content screenshotting, full-screen animated displacement or fluid
solver. The real Chromium build initially dropped its standard backdrop-filter
declaration because the minifier retained the prefixed equivalent. Reordering
declarations fixed the compiled result. High `blur(12px)` and Low `none` were
then verified before the final measurements; see `compiled-glass-fix.json`.

Earlier `performance-browser.json` measurements precede that optics repair and
are not final High-cost evidence. `performance-interrupted-tool.json` includes
an interrupted automation interval and is rejected. Both remain preserved.
No before/after speedup is claimed from these non-equivalent samples.

The mobile conversation originally scrolled at page level. Giving its reading
region a bounded flexible height restored independent scrolling and reachable
composer controls. Stable source identity also prevents incoming stream objects
from repeatedly moving keyboard focus after a citation is selected. Final focus
and scroll receipts cover those changes.

## Reproduction and limits

Follow [BROWSER_PROTOCOL](BROWSER_PROTOCOL.md), using the existing private local
environment and a fresh evidence filename. Open development-only `/ui-lab`, choose
each intensity and scenario, start recording, perform the indicated interactions,
finish, and save the visible JSON. Leave failed or interrupted samples identifiable.
Do not use this presentation harness as evidence of model throughput.

Final production build, native workflow tests and Safari 27.3 appearance smoke
are separate passing checks. Production `/ui-lab` returns 404. Safari has no
frame benchmark here; Firefox, physical touch/virtual keyboard, battery/thermal
stress, GPU paint traces and actual 165Hz hardware remain unmeasured. Reduced
motion, opaque materials and Low effects provide explicit simpler modes without
claiming a universal performance guarantee.
