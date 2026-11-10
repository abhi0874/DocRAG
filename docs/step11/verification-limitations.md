# STEP 11 evidence boundaries and retained failures

- Initial production build failed on restricted font access (exit 2), then a
  cached Turbopack local-port failure (exit 2). The failed generated build was
  preserved under `.local/step11-failed-build-20261110`; a fresh authorized build
  passed. The final UI build also passed.
- The original full verifier was interrupted after 20 passing groups and 12
  evaluation cases when services became unavailable. The cause is unknown.
  Recovery was explicitly authorized. Source hashes matched before resumption;
  the evaluator reused only its own compatible cache entries, without splicing.
- The resumed evaluation completed 100 fresh answers/query embeddings, 92 fresh
  judgments and eight cached judgments. Cache eligibility did not reuse all
  earlier answer attempts. The completed result is automated, not independently
  human-validated and not a guarantee of correctness.
- Initial mobile inspection failed at 390px (445px content width). The repaired
  production UI passed at 390px and 320px. Historical failure evidence remains.
- Interim Python integration coverage was 57.39%, below the unchanged 70% gate.
  The interrupted verifier did not flush its own coverage. An attempted final combine then failed at20.57% because coverage.py reporting
  consumed parallel inputs and combine replaced the accumulated file. The Make
  target now appends and retains inputs; affected integrations were remeasured.
  Fresh combined coverage passes at71.16% (1214/1706), unchanged on a repeat
  gate run with all18 parallel input files preserved. Unit-only coverage does
  not satisfy it. No historical coverage was relabelled fresh.
- A cloud-retrieval metric summary initially failed when it included `None`
  values for unanswerable cases. The corrected summary uses the unchanged
  evaluator convention: recall over 80 answerable cases, all 100 queries retained.
- Live-probe initial execution failed before API use on top-level await under
  the installed module mode; its main wrapper resolved that failure. A later
  replay guard deliberately exits 1 before calls when the receipt exists.
- Evidence collation initially used the wrong result key `cache` and exited 1;
  it was corrected to the existing `cache_statistics`. Measurements were intact.
- Browser tooling previously hit an account usage limit. Later authorized CUA
  verification succeeded; the unavailable agent-browser CLI was not installed.
- Two moderate JavaScript advisories remain disclosed (raw audit exit 1), accepted
  only under the existing reachability policy. Python/reranker audits exit 0.
- Render/Neon eligibility, public TLS/DNS, actual hosted cold starts and public
  endpoint operation cannot be claimed verified without deployment. No cloud
  resources were created. Remote Actions remains NOT RUN; no push is authorized.
- Historical STEP 10 load results remain unchanged. The STEP 11 load repetition
  is bounded regression/coverage evidence, not an endurance or hosted-Gemini
  capacity claim; all observed HTTP 429 responses remain in its raw results.

- The final sandboxed native `make db-status` reported no server (make exit2,
  helper exit1). Repeating the identical read-only command with authorized host
  process visibility returned exit0 and the owned PostgreSQL PID/data directory.
  No service restart was needed; this was not recorded as a service outage.
- The existing documentation CLI was unavailable for coverage diagnosis; no
  package was installed. Official coverage.py documentation and installed source
  established automatic combining and the append/keep behavior used by the fix.
