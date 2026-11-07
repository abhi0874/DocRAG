# Rejected provisional run — preserve, do not promote

This attempt completed 100 questions, but promotion rejected its provenance:
`Recorded implementation differs from recorded Git revision`. At collection time,
HEAD still referred to the documentation handoff and the container provider changes
were uncommitted. The validator was not bypassed and this is not a passing baseline.

The original raw artifact remains unchanged. Its model/context-compatible caches
may be reused by the subsequent run against committed implementation, which must
independently pass all provenance and quality gates. Cache reuse is not fresh
answer or judgment generation. See the final Step 9 report for accepted evidence.
