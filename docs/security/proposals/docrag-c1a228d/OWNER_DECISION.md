# Owner decision for the DocRAG redesign

The owner and Render operator explicitly approved EX-DOCRAG-C1A228D-01. The approval was recorded at 2026-11-18T16:04:42.615327+00:00.

| Scope | Value |
|---|---|
| Source commit | `c1a228d0c231652c567f48b1ac588422f542f7c0` |
| Linux AMD64 runtime | `sha256:01994616d75f66806f7bdddfbe60d22a77ebf45149b01dd067c042cb36ce39ea` |
| OCI index | `sha256:f086d4b7cebb6780995d59a19c94167d2d85c3b43bbf5a0192d4dd29fc2a18e1` |
| Archive SHA-256 | `29d0f6e75dc2e3165ef52ff9649280683cec94985327883db171fab4d47e3c98` |
| Destination | Existing Render Free service `srv-dbrf4l0u01pc73b2dneg` |
| Deadline | 25 November 2026 at 13:30 IST (08:00 UTC), with earlier withdrawal as below |

This single decision covers the project's one-release owner/operator exception for the bundled Next.js picomatch availability advisory CVE-2026-112366 and the separate residual glibc risks CVE-2026-100290 and CVE-2026-115819. Slow matching could interrupt all sessions. Indirect native calls could cause a crash or memory corruption. Independent review has not taken place. The previous release records explain the findings and the other system library dispositions. Unrelated findings retain their separate dispositions.

The candidate's npm audit returned exit 1 with one high and two moderate advisories. Trivy found zero critical/high, 43 medium, 12 low and five unknown image occurrences. Every advisory/package/version/severity/fixed-version occurrence matches the prior runtime scan. The release operator retained the raw outputs and verified image identity locally. The production build passed. Both theme assets in the image match Git. The OCI attestation manifest references the exact AMD64 runtime and contains SBOM and provenance records.

Approval is conditional on exact-source hosted CI, digest-preserving registry publication and readback, matching production origin and secure eight-hour sessions, isolated Neon access, public-input and consent restrictions, tenant ownership enforcement and free-tier quotas. Google OAuth must remain off unless the approved production client, callback and login flow are verified. New code, provider credentials, migrations and additional findings receive no automatic exception. The database schema is identical to the previous release.

The owner/operator monitors availability, latency, memory, timeouts, and restarts and retains the ability to suspend the service. Withdraw on a supported fix, credible reachability, incident, loss of monitoring, scope drift or expiry. Preserve Neon. The previous manifest is a rollback target only while its own exception is valid and the rollback is safe. If a shared risk requires withdrawal of both images, suspend the service. Verify health and readiness after a rollback and external unavailability after suspension.

GitHub withdrew the picomatch advisory on 18 November 2026 at 15:38 UTC. The npm registry still returned the high finding during preflight. Both records are retained. The owner approved the residual operational risk and the strict audit keeps its original exit status. [GitHub advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)
