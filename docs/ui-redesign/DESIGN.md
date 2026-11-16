# MONO / GLASS — local redesign specification

Scope: existing DocRAG frontend on `feat/production-rag`, beginning at
`b40319ccce62390edd4f8acd6573abc836671f53`. This is a separate local redesign,
not another roadmap step or publication authorization. The existing Render/Neon
deployment remains unchanged. No new packages, model changes or migrations are
introduced by the UI implementation.

## Audit and information architecture

The prior interface uses a compact dark header, a full-width question selector,
an empty chat region and a source column. `production-baseline.jpg` captures that
unchanged public interface after its free service woke up. The prior interface
does not expose a light-theme selector; no fabricated light baseline is supplied.
The supplied Threads/Pinterest references could not be retrieved through the
available web reader. They were not represented as visually inspected.

The new identity is an editorial document studio: library, conversation, evidence.
Desktop keeps these relationships visible; at 900px and below an accessible
liquid selector switches Library / Ask / Sources. Citation activation reveals the
relevant source, selects its exact message-specific passage and moves focus to it.
The public edition retains all 100 approved questions across the two public
documents. Private uploads remain a native-workspace feature. The demo sends only
its last approved question through the existing transport.

Routes: `/` (public and native workspaces), `/sign-in`, `/evaluate`, and
`/metrics/dashboard`, plus consistent not-found/error views and appearance settings.
Existing server guards and API authorization remain authoritative. There is no
new public signup, password-reset flow or UI-only authorization mechanism.

## Foundations

| Token | Obsidian Lime | Pearl Forest |
| --- | --- | --- |
| Canvas | #0b0c0e | #f5f5f2 |
| Reading surface | #17191c | #ffffff |
| Text | #f2f3f3 | #171819 |
| Secondary text | #a5a7aa | #626661 |
| Accent | #c7ff5e | #276749 |

Bricolage Grotesque supplies display type; DM Sans supplies controls and prose;
IBM Plex Mono supplies small labels and measurements. Next's existing font loader
self-hosts generated font assets. The three families replace the previous type
configuration; no runtime font service or new dependency is introduced.

Spacing uses an approximately 4px rhythm, 44–48px principal controls, 12–28px card
radii, restrained separators and large, plain reading surfaces. Secondary text
and form boundaries were checked numerically; see `contrast.json`. Decorative
borders are not claimed to be accessible form boundaries.

## Optical system and limits

`OpticalMark` displaces a bounded, public SVG line pattern using `feDisplacementMap`
and an embedded red/green normal field. The field changes most strongly near the
edge, producing a curved-lens impression. A static radial highlight, rim strokes
and an asymmetric specular streak provide depth. This is real raster displacement
of decorative SVG artwork, **not** physical ray tracing or refraction of arbitrary
live page content. Interactive text is never filtered or copied into a texture.

Glass surfaces combine limited backdrop blur, opacity, inset reflection and
border depth. Unsupported backdrop filters use opaque card material. Low removes
surface blur. Forced colors hides decorative optics and retains selection outlines.
The liquid pill itself uses one deforming SVG contour with theme-aware gradients;
it does not claim to refract the text beneath it.

Intensity is continuous 0–100, default 55; presets are 0 / 55 / 100. It changes
displacement (0–18), blur (2–12px; disabled on Low surfaces), reflection strength
(.12–.4) and opacity (.96–.8). Preferences persist locally, survive theme changes
and handle malformed/unavailable storage. System color and reduced-motion
preferences are respected; an explicit Reduce motion option is also available.

## Liquid selection

`LiquidPillGroup` uses one closed SVG path behind native radio buttons. Center and
width follow the exact solution of an underdamped spring (frequency 22, damping
.86). Velocity introduces bounded leading-edge stretch and a small central neck.
The contour recovers to its final capsule; interruptions retain velocity instead
of restarting an unrelated animation. It is an inspired surface-tension model,
not a fluid solver. The maximum additional stretch is 26px.

Geometry reads occur on mount, resize and font changes, never per frame. Animation
uses elapsed time, stops at rest, and settles after large background gaps. Dynamic
options, unequal labels, keyboard wrapping, Home/End, disabled choices and resize
retargeting are covered by deterministic tests. A selected underline and semantic
checked state remain understandable without the optical indicator.

## Reading, safety and accessibility

The answer renderer supports headings, emphasis, lists, quotes and fenced code.
Unknown Markdown remains readable literal text. HTML, remote images and model-
generated links are inert. Citation positions come from the original full-answer
validator, including its code/literal/link rules; they are never recomputed from
isolated Markdown fragments. Source passages are fully readable, with retrieval
details available on demand.

Chat follows new output only while the reader stays near the bottom; Jump to
latest restores following. Streaming has a concise status announcement rather
than reading every token. Stop controls, feedback, form errors, focus outlines,
native dialog trapping/Escape and reduced motion remain accessible.

## Performance verification

`/ui-lab` is a development-only, public-fixture presentation harness. Production
returns 404. It uses the real chat, source, appearance and liquid components;
model throughput and authentication are verified separately through real local
HTTP checks. The harness never submits the fixture to an API. Its opt-in recorder
samples actual browser frames, input-to-next-frame delay and supported long tasks.
It is idle when recording is off.

Raw measurements and screenshots are under this directory. Synthetic fixture
streaming is explicitly distinct from model generation. Refresh cadence observed
in a browser is not certification of a panel's maximum refresh rate. No 165 FPS
claim is made. Production publication needs separate permission after local
acceptance; no push or deployment is part of this work.
