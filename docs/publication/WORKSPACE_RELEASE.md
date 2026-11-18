# Personal document workspace on Render

## Live release on 18 November 2026

Render promoted application `c1a228d0c231652c567f48b1ac588422f542f7c0` at 16:12 UTC. Deployment `dep-dbussqgm7kps73dd70n0` serves the existing Free service, using AMD64 manifest `sha256:01994616d75f66806f7bdddfbe60d22a77ebf45149b01dd067c042cb36ce39ea`. Anonymous GHCR reads matched both that manifest and the approved OCI index. The release retained the previous image for rollback and used the existing restricted Neon role and schema. [Source CI](https://github.com/abhi0874/DocRAG/actions/runs/44343150740) · [Image publisher](https://github.com/abhi0874/DocRAG/actions/runs/44343937157) · [Owner decision and withdrawal conditions](../security/proposals/docrag-c1a228d/OWNER_DECISION.md)

| Live verification | Result |
|---|---|
| Health and readiness | Both returned HTTP 200. Local tests passed on the release branch (231 Python, 363 TypeScript). |
| Email and ownership | Two synthetic accounts registered, signed in and signed out. The second account could neither read, download nor delete the first account's PDF. Anonymous reads returned 404. Both sessions were revoked. |
| Upload and grounding | The PDF was indexed and its authorized download matched the original bytes. The generated answer correctly cited page 1 for 19 March 2025. A follow-up correctly reported 17 sensors. A question about the unnamed funder produced an explicit insufficient-evidence response. |
| Provider and cancellation | Telemetry recorded three uncached completions from `gemini-3.5-flash-lite` and one cancelled request. The cancelled answer had no feedback receipt. The test PDF was deleted. The production HTTP suite passed 45 checks. |
| Appearance | Both served WebP files matched the committed assets byte for byte. Dark mode and glass intensity 100 persisted on reload. The 390 px mobile sign-in page fit the viewport and the Sign Up pill opened the registration and consent form. |
| Google sign-in | The production OAuth client ID and secret were absent. The live sign-in page disabled the Google control and offered email. |
| Logs | One successful auth GET returned 200 but its telemetry write failed. The log omitted the underlying database error. The other two error-level records in the verification window belonged to the intentional cancellation. |

The source audit preserved its one high and two moderate results. The image scan reported zero critical/high, 43 medium, 12 low and five unknown occurrences. The owner exception expires on 25 November 2026 at 13:30 IST or on an earlier withdrawal trigger. [Advisory status](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)

## Previous live release `4d888d6`

The existing [live workspace](https://docrag-demo.onrender.com/workspace) passed the ten recruiter acceptance steps on 18 November 2026. The tested application source is `4d888d6a5e876e250f95f20a1850522299b5a80f`. Render deployment `dep-dbuouru8bjmc739gubv0` reported live on the existing Free service with AMD64 manifest `sha256:45b21f9df2102ab0d5611ceade5a375e999829e09c80de71a6b1b6716b543668`. Health and database readiness both returned 200.

## What recruiters can use

| Live check | Observation |
|---|---|
| Registration and sign-in | Two synthetic accounts registered and signed in with secure HTTP-only sessions. |
| Personal upload | The owner uploaded a synthetic PDF after consent. Upload returned 201. |
| Extraction and indexing | The indexed page contained the fixture text. The authorized download matched the original bytes. |
| Arbitrary question and real generation | A question written for the synthetic Alder Harbor trial returned its correct launch date from the server-side Gemini integration. |
| Citation | Each cited source matched a chunk from the owned PDF. In a separate browser session, selecting source 1 opened page 1 of the uploaded Blue Lantern fixture with the exact supporting passage. |
| Follow-up | A conversational follow-up returned the correct sensor count with valid citations. |
| Insufficient evidence | The funding question returned the application's explicit refusal, with valid uncited-refusal status and a completed stream. |
| Two-account isolation | The second account received 404 for read, original download and attempted deletion. Anonymous direct access also returned 404. |
| Deletion | Owners deleted both synthetic fixtures. The first returned 404 after deletion. The browser library showed empty after the second. |
| Sign-out | Both test sessions were revoked. Browser sign-out returned to the sign-in page. |

The hosted MONO / GLASS workspace switched between dark and light. At 1280 px desktop and 390 × 844 mobile the composer input and action were centered to the same vertical coordinate without overlap or horizontal page overflow. Mobile Library, Ask and citation-to-Sources navigation worked. These were Chromium viewport checks.

## Publication and operational evidence

- The exact application SHA passed [hosted CI](https://github.com/abhi0874/DocRAG/actions/runs/44291485453). Publication metadata is separate from the runtime source. The first feature push's Vercel preview was canceled. The release branch now disables Git deployments only for `feat/production-rag` through `vercel.json`. The Vercel project default was restored to Automatic.
- The package publisher copied the retained OCI archive and verified both manifest digests. Anonymous readback reproduced the SHA-256 of the AMD64 manifest and the multi-platform-format OCI index, `sha256:2f215ce4bc02acc6fc7b212858faecc551cf201ce7e17b9cf8b726be0b5fe300`. The index contains the AMD64 runtime and build attestations. An offline copy verified all 35 blobs. An initial job could not read a draft asset (403). The successful job used an expiring single-asset URL with read-only Actions access and package write permission. The temporary Actions secret was removed. [Publisher receipt](https://github.com/abhi0874/DocRAG/actions/runs/44292415537)
- The additive Neon migration created the policy table and expiry index in the isolated demo database. The restricted runtime role received SELECT and INSERT on the new table. TLS 1.3 runtime readback confirmed the schema, both public documents and 162 public chunks. The original corpus stayed intact.
- Nine nonsecret Render settings matched their targets, including the origin, Gemini model, billing acknowledgement, disabled reranker/cache and workspace switch. Render failure notifications and the operator suspend control were available. Google Cloud showed no linked billing account. The API key stayed server-side.
- The preserved raw audit exits remain 1. The runtime scanner found zero critical/high occurrences. See the [owner approval](../security/proposals/docrag-4d888d6/OWNER_ACCEPTANCE.json) and [five system-library dispositions](../security/proposals/docrag-4d888d6/SYSTEM_LIBRARIES.md). The exception expires 25 November 2026 at 08:00 UTC (13:30 IST). The owner monitors and withdraws the service on expiry or any earlier revocation trigger.
- The first Python health request failed local CA validation. Full verification succeeded with the installed CA bundle. A QA assertion missed the wording of a valid refusal. Comparing the retained response with the exact committed refusal verified the result. A browser upload using a relative file path failed, then the absolute-path upload succeeded. One optional guest browser stream showed an error. The same public question subsequently returned a valid cited answer over the live API. The authenticated browser and personal API flows passed.
