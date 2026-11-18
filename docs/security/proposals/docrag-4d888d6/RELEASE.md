# Minimal runtime release decision

**Independent review and owner approval required.** Candidate `4d888d6a5e876e250f95f20a1850522299b5a80f` changes the Dockerfile only. The accepted application, dependency lockfile, models, migrations, UI and evaluation source retain their original Git objects. No production action has been taken.

## Artifact to review

| Identity | SHA-256 |
|---|---|
| AMD64 runtime manifest to deploy | `45b21f9df2102ab0d5611ceade5a375e999829e09c80de71a6b1b6716b543668` |
| OCI index including build provenance and SPDX | `2f215ce4bc02acc6fc7b212858faecc551cf201ce7e17b9cf8b726be0b5fe300` |
| Local OCI archive | `1f734cbd82c7b9bd92d32e32db6c9651284e9352f564777c5dab927376e937f9` |
| Source context from Git archive | `09fcc9a9e1d3e83d401818fe7cd3d3b339574660b208f59110b0e53825f3774d` |
| Image scan / SPDX attestation | `e8cced5d5544b01e2a089aefb4c35cbcb89988b50126286ee18d2943cdadee65` / `2353dfdab5cc942c297da2058598327fbb20ad271bc3b0a668a7770ad6880af8` |

The build and migration stages still use the approved Node 24.22.1 Bookworm image. The final stage copies its Node binary and upstream license by path into the official distroless C++ runtime with TLS roots and Debian package metadata. A separate distroless Node distribution would introduce a second source of Node patch versions. Only one replacement configuration was built. Cosign 3.1.4 verified the Debian 13 nonroot base index against the Google issuer and Distroless publisher identity, including transparency-log verification. BuildKit provenance binds both pinned base images and the source-context digest. The old and new Node executables have the same SHA-256, `e32e2d16081cf644f88392934288086e7662529d0d43277c34f7aad2207cfafb`. The final application runs as 65532 with a writable Next cache and root-owned code. [Distroless project and verification instructions](https://github.com/GoogleContainerTools/distroless)

## Before and after

Both measurements use the same Trivy 0.76.2 database dated 18 November 2026 and the final linux/amd64 filesystem. Sizes sum compressed runtime layer descriptors. Package counts are Syft SPDX entries, including language packages. Advisory totals below are image-scanner results only.

| Measurement | Previous | Minimal |
|---|---:|---:|
| Compressed layer bytes | 95,857,419 | 71,625,090 |
| SPDX package entries | 320 | 100 |
| Detected Debian packages | 88 | 14 |
| Identified picomatch copies | 2 | 1 |
| Critical / high occurrences | 1 / 46 | 0 / 0 |
| Medium / low / unknown occurrences | 110 / 86 / 6 | 43 / 12 / 5 |
| All occurrences / distinct advisory IDs | 249 / 126 | 60 / 39 |
| Distinct critical or high IDs | 19 | 0 |
| Image secret findings | 0 | 0 |

**Removed:** neither the npm package tree nor its tinyglobby/picomatch 4.0.4 manifest occurs in the new runtime layers. npm, pnpm, yarn, apt, gcc and the shell were absent from the checked executable locations. Removing entire build-tool packages preserved shipped runtime package metadata.

**Remaining:** the Next.js 16.4.5 compiled matcher is unversioned in its manifest and still hashes to `607dc79784c1161c33076903769dba23e63d9d9ccfe3c4695a32ebe3a5ab892d`. CVE-2026-112366 / GHSA-fc5q-39xc-vjpf remains **under investigation**. The source lockfile still resolves picomatch 4.0.7 and 2.3.2. Fresh pnpm audit exited 1 with that high and the previously documented moderate esbuild and minimatch findings. Trivy exited 1. Its 60 remaining findings concern libc6, the GCC runtime family and libssl3t64. No fixed version was reported in those rows. Runtime libraries are materially present. Imported functions and request-level exploitability have not been independently mapped. The five unknown-severity occurrences require explicit review. The image scan's zero high count cannot clear the separate matcher finding.

## Fresh checks

- Buildx exported the runtime and SPDX/SLSA attestations, exit 0. The source Git archive header, OCI descriptor sizes and hashes, runtime platform and attestation-manifest reference were checked. The registry has no verified copy of this candidate yet.
- The sandboxed fixture passed **36/36** checks. It exercised health and database readiness, secure eight-hour sessions, consent, registration/login, two-account isolation, actual PDF extraction/indexing, scoped retrieval, cited guest/personal streams, refusal, quotas, cancellation accounting, owner deletion including SQL cleanup, sign-out, and persistence across replacement of the app instance. Google protocol responses and inference in this fixture were deterministic. Two separate real HTTPS metadata requests from the new image authenticated successfully (200 for both approved models). Production Gemini generation remains untested on this image.
- The migration stage was identical in the preliminary and final Dockerfiles. The actual separate migration entrypoint ran twice against a new disposable database, exit 0 both times. pgvector 0.8.1 and the two-entry migration ledger were verified. No production schema or data was used.
- Node v24.22.1 and non-root UID 65532 passed on AMD64. The inventory found two literal matcher consumers among 1,298 application JavaScript files. The local helper compiled only the constant `**`; no remote patterns were configured. Ordinary static and disabled-optimizer requests returned 200/404 with zero observed matcher compilations. Server, route, middleware and serialized config hashes match the earlier image. Direct inspection and bounded requests do not rule out dynamic or inlined call paths.
- The retained 585 automated tests, 63 workspace checks, 26 container checks and 100-question evaluation remain historical. No measured source or lockfile changed. This run added fresh image-specific evidence.

## Proposed decision for this artifact only

**EX-DOCRAG-4D888D6-01 is unsigned and inactive.** Its sole proposed exception is residual availability risk from CVE-2026-112366 in the reviewed dependency graph and bundled matcher, for the exact source, linux/amd64 manifest and the existing Free Render service `srv-dbrf4l0u01pc73b2dneg`. The previous proposal is ineligible for this digest. Application review found no attacker-controlled compiler pattern. The optimizer is disabled, route patterns are fixed, and PDF processing uses a fixed worker. A reachable expensive match could stall the shared Node event loop. Request quotas alone would not contain that impact.

**One owner request:** designate an independent qualified reviewer and the operator authorized to suspend this Render service. Ask them to review the attached raw scans, scope and package dispositions, attest the exact source/image and intended runtime configuration, and confirm a monitored withdrawal procedure. Capture nonsecret configuration and secret-version references, auth origin, restricted Neon role/TLS and schema readiness, consent, disabled billing, provider quotas, workspace and cache settings before signoff. All unrelated findings retain their own disposition. Missing evidence, new unacceptable findings or an unresolved disposition block promotion.

Only after those conditions are met, the project owner may sign a record stating: “I accept the documented availability risk of CVE-2026-112366 under EX-DOCRAG-4D888D6-01 for source 4d888d6a5e876e250f95f20a1850522299b5a80f, linux/amd64 manifest sha256:45b21f9df2102ab0d5611ceade5a375e999829e09c80de71a6b1b6716b543668 and service srv-dbrf4l0u01pc73b2dneg, configuration [verified fingerprint], evidence [digest], independent review [signed reference], operator [identity], effective [UTC] and expiry [UTC].” The window ends at the earlier of seven days after signature or **25 November 2026 08:00 UTC**, without automatic renewal. No signature is requested against blank fields.

Monitor the advisory daily and service health, latency, timeouts and restarts throughout the window. Revoke on scope drift, credible new reachability, remediation availability, lost monitoring or attestation, an incident, another unaccepted finding, or expiry. Withdraw traffic by suspending only this web service, then verify suspension and external unavailability. Preserve the database. Rolling back to 6458b35 is not a CVE remedy.

Once cleared, enforce the signed scope through an independently validated fail-closed release decision, push the exact candidate normally and verify CI for that SHA. Copy the reviewed OCI index and attestations to GHCR preserving digests, verify anonymous readback, and pin the approved AMD64 manifest on the existing Render service. Saving the source change deploys it. Complete the approved production configuration/schema preflight first. Require real public and two-account synthetic acceptance after promotion, including actual grounded Gemini generation and deletion. The README may then be updated with verified production behavior.

The local reviewer bundle and raw OCI artifact are held under `.local/minimal-4d888d6/`. The bundle contains raw scan outputs, SPDX, provenance, publisher verification, the fixture scripts and receipts. Test certificates, keys and real settings are excluded.
