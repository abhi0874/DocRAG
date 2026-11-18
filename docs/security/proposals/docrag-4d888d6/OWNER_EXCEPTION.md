# Owner decision for the DocRAG recruiter workspace

**Proposal EX-DOCRAG-4D888D6-02 · awaiting explicit owner approval.** Prepared 18 November 2026. Independent review has not occurred. The original proposal and scanner outputs remain historical evidence. An earlier approval in chat predates this decision.

## Authority and scope

The two-person signoff originates in the project's security decision and release proposal. The repository and public provider terms examined identify no external requirement for a second signer for this particular release. The owner must have authority over this personal project and know of no separate customer, employer or other obligation requiring that review. Provider terms and privacy duties continue to apply. [Project security decision](../../../gemini-repair/SECURITY_DECISION.md) · [Original release proposal](RELEASE.md) · [Render responsibilities](https://render.com/docs/shared-responsibility-model) · [Gemini terms](https://ai.google.dev/gemini-api/terms) · [Neon terms](https://neon.com/platform-terms) · [GitHub terms](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service)

Owner approval substitutes an accountable owner/operator decision for the independent signature **only** for this exception. It applies solely to CVE-2026-112366 / GHSA-fc5q-39xc-vjpf in the recorded source dependency graph and bundled Next.js matcher, on the existing Free Render recruiter demo.

| Binding | Approved scope if the owner accepts |
|---|---|
| Git source | `4d888d6a5e876e250f95f20a1850522299b5a80f` |
| Linux AMD64 manifest | `sha256:45b21f9df2102ab0d5611ceade5a375e999829e09c80de71a6b1b6716b543668` |
| OCI index | `sha256:2f215ce4bc02acc6fc7b212858faecc551cf201ce7e17b9cf8b726be0b5fe300` |
| Retained evidence archive SHA-256 | `67a45835e180971bc7637294bd8dc3000572a3ae153759c38384ff0bee912072` |
| Service and origin | `srv-dbrf4l0u01pc73b2dneg` at `https://docrag-demo.onrender.com` |
| Duration | From explicit acceptance until the earlier of seven days later or 25 November 2026 at 08:00 UTC (13:30 IST). No automatic renewal. |

## Risk and decision rules

An expensive match could stall Node’s shared event loop, interrupting service for every active recruiter. Existing evidence found fixed patterns, disabled image optimization and no identified user-controlled pattern. It does not eliminate indirect reachability. Quotas limit ordinary use but cannot interrupt synchronous work already running. Operator detection and withdrawal limit exposure after a problem is observed. They cannot guarantee uninterrupted service.

Keep both raw audit exits (1), the bundled matcher finding, 43 medium, 12 low and five unknown image occurrences, and the two previously documented moderate JavaScript findings visible. The existing strict audit rejects the high finding and must retain that result. Record an explicit release decision alongside that result. Do not edit allowlists, mark the audit green, ignore unknowns or accept any unrelated finding under this exception. Check unrelated findings against their dispositions before promotion. An unresolved unrelated disposition, changed artifact, failed hosted CI or failed privacy/security control blocks promotion.

Verify production settings against this scope before opening traffic. Require non-root Node 24.22.1, HTTPS and the matching Better Auth origin, eight-hour sessions, ownership and origin checks, consent and eligible users/regions, synthetic or otherwise permitted non-confidential inputs, restricted TLS Neon role in `docrag_demo_gemini_v1`, approved additive workspace schema and grants, disabled reranker and public response cache, existing unbilled Gemini models, and enforced free-tier quotas. Record effective nonsecret settings and secret version references privately. Never include secret values. Verify the owner can receive service alerts and reach the existing Suspend control before promotion.

The owner monitors health, latency, timeouts and restarts while active and checks the advisory daily. Withdraw immediately on credible reachability, a related incident, loss of monitoring, scope drift, a supported fix or expiry. Suspend only this Render web service and verify suspended status and external unavailability. Preserve the Neon database and record the trigger and withdrawal time. If monitoring or prompt suspension cannot be maintained, do not open traffic.

## Single owner approval

Replying **“I approve EX-DOCRAG-4D888D6-02 as owner and Render operator”** accepts the scope, authority statement, one-release policy revision, unresolved availability risk, controls, expiry and withdrawal duties above. Record the attributable reply and timestamp separately. Approval authorizes the requested normal GitHub push, exact-SHA CI, zero-cost digest-preserving publication, additive migration, existing Render deployment and bounded live acceptance **subject to those checks**. Preserve Vercel and verify the actual two-account upload, indexing, Gemini generation, citations, follow-up, refusal, isolation, deletion and sign-out workflow before updating the public README.
