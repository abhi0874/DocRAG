# Liquid Glass workspace candidate

Pearl Titanium uses a jade accent and Obsidian uses lime. The shared optical surface, photographic folio, moving pill highlight and reversible spring are used across the guest and personal studios, authentication, consent, evaluation, insights and appearance controls. The top-right theme switch persists across navigation and reload. The document library, conversation and source passage each have a mobile view.

The before/after images in this directory use public or synthetic content. The browser review covered six routes, both themes and six widths from 320 to 1920 pixels. All 72 layouts fit the viewport. The composer stayed centered. Keyboard navigation, reduced motion, reduced transparency and saved dark mode before first paint passed. Native WebKit also retained dark mode and high intensity on reload.

Chromium accessibility scans found zero definite violations across 15 screens. Some gradient contrast checks required manual review. Twelve sampled text locations on the consent screens ranged from 5.8:1 to 16.13:1. These observations do not establish full WCAG conformance.

Across 240 measured frames, p50/p95/p99 frame intervals were 16.7/16.8/16.8 ms. Click-to-next-frame p95 was 16.9 ms, with zero measured layout shift and zero long tasks. These are local measurements without physical mobile or high-refresh hardware validation.

The focused suite passed 94 tests and the production frontend build passed. A signed-in local Ollama run extracted and indexed a synthetic PDF, answered the question, opened its matching citation, deleted the document and signed out. This run used no Gemini generation.

The UI-only linux/amd64 manifest was `sha256:508a109be9fb90ac415f7f548ff822437ba7901629ea6cc2ac9c1fe05b612d8b`. All 30 blobs were verified. The container user was 65532:65532. The local scanner reported 0 critical, 0 high, 43 medium, 12 low and 5 unknown occurrences. This identity predates the Google sign-in changes. The production exception applies only to its documented release artifact.

## Registration and Google sign-in follow-up

The guest and sign-in pages now link directly to account creation. Both the email and Google registration paths follow hosted processing consent. The [mobile screenshot](auth-entry-mobile.jpg) shows the configured sign-in screen. [Operator setup and session behavior](../../SECURITY.md#optional-google-sign-in) describes the credentials and callback.

The pinned tests passed with 231 Python and 363 TypeScript tests, including eight new Google authentication regressions. Those regressions exercised the installed Better Auth handlers with an in-memory adapter and a simulated Google identity exchange. They covered signup, returning users, session expiry and sign-out, consent, quotas, browser-bound state, and isolation from an email/password account with a matching address.

On the built app, Chrome 157 verified account creation links at 320, 390 and 1440 pixels. One new synthetic reader completed email registration, sign-in to the private workspace and sign-out against the owned local PostgreSQL test database. Chrome also verified the Google discovery button, PKCE redirect and exact callback using synthetic OAuth client settings. The navigation was intercepted before leaving the machine. With both Google settings absent, email continued to work. Real Google credentials and a live provider round trip remain pending.

Lint and type checking passed on the exact staged source. The direct macOS Turbopack build hit a worker socket permission error. The normal `pnpm build` inside the production Dockerfile passed, including static generation and type checking. The resulting local linux/amd64 manifest is `sha256:0c4d7101938a0cedf56731a55b8d870d03df3d525a439f0941bbbe427bfcf3c4`. All 30 blobs matched their digest and the runtime user is 65532:65532. The offline scanner reported 0 critical, 0 high, 43 medium, 12 low and 5 unknown occurrences. Release approval for this artifact and production OAuth validation are outstanding.
