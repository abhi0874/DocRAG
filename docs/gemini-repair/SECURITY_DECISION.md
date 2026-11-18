# Pre-release security decision — 18 November 2026

Status: **HOLD; no exception granted**. Functional testing may proceed locally.
Publication remains prohibited under the current task and security policy.

The [official GHSA-fc5q-39xc-vjpf advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)
was checked once for this task: CVE-2026-112366 remains high, affected through
4.0.7, with no patched release listed. A fresh registry check returned 4.0.7.
The immediately preceding integrity-verified Next 16.4.6 package inspection found
the same bundled bytes as installed 16.4.5; that evidence is historical, not repeated.

See [PICOMATCH_REMEDIATION](PICOMATCH_REMEDIATION.md) for exact dependency paths,
hashes, call sites and eight bounded boundary tests. The standalone artifact
contains executable bundled code. The reviewed image helpers compile configuration
patterns, not candidate request URLs; image optimization is disabled. Questions,
upload filenames, metadata and document IDs did not reach pattern compilation in
the reviewed application flows. These restrictions reduce observed exploitability;
they do not patch the package or establish complete framework safety.

## Remaining independent-review scope

- Establish authoritative provenance/patch status for Next's unversioned bundle.
- Independently review all bundled parser branches and transitive compiled
  `@vercel/nft` internals; the prior work inventoried build consumers but did not
  prove every branch or dynamic import unreachable in every deployment mode.
- Validate the reviewed restrictions against the actual release image, including
  serialized configuration and supported server entrypoint. Native artifact
  inspection alone is insufficient.
- Treat build/CI configuration and repository patterns as trusted inputs; no
  assurance is made for arbitrary external repositories or attacker-controlled
  build settings. No adversarial availability testing was run on shared services.
- Evaluate configuration drift: enabling image optimization or adding patterns
  requires re-review. Future request-to-pattern APIs invalidate this assessment.

## Bounded controls and options

Existing controls: fixed reviewed configuration; disabled image optimizer;
no public configuration mutation/build trigger; synthetic boundary tests verifying
candidate-versus-pattern separation. Re-run those tests after each framework or
configuration change. Do not describe rate limits or process memory caps as a
complete mitigation for event-loop blocking.

Preferred resolution: official patched picomatch **and** supported patched Next
bundle, followed by frozen installation, image inspection and regression checks.
Alternative: an upstream-supported removal/replacement or independently verified
restriction whose scope meets the release policy. Do not edit compiled vendor
files or substitute unreviewed overrides.

A third option is a separately authorized, explicit, time-bounded risk exception
after independent review, naming owner, expiry, affected hashes/deployments,
enforced restrictions, monitoring and rollback triggers. This is an option for
the decision-maker, **not approval**, not remediation and not implemented here.
The security gate remains unchanged and failing; no advisory is suppressed.

Historical moderate esbuild/minimatch findings remain disclosed with their
tooling-only exposure and conditional policy acceptance in the linked report.
The supported typescript-eslint update candidate does not resolve the high.
