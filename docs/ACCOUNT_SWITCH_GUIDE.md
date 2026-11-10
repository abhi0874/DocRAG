> Latest checkpoint: 10 November 2026. STEP 11 local preparation and verification
> are locally complete; STEP 12 and publication are not authorized.
> Read CURRENT_STATUS.md first. STEP10_COMPLETE.md preserves the accepted
> historical baseline; remote Actions remains NOT RUN.

# Continue on another Codex account — same Mac

The repository, Git history and project files remain on this Mac. Do not expect
the other account to inherit previous chats or account memory. These documents
carry the project context; a new agent must still inspect real files and services.
Account access/available features depend on that account. This guide does not
promise subscription transfer or verify the user's reported 9 November expiry.

1. Open Codex Desktop. Use its account/profile control to sign out, then sign in
   with the other account. Exact menu labels can vary; do not delete app data or
   authentication files to force a switch. This handoff does not sign you out.
2. Open/add the **existing local folder** `/Users/abhisheshramadasshet/Documents/ChatGPT/DocRAG/RAG-Agent`. Select local work, not a new clone
   or empty cloud environment. The parent DocRAG directory is a separate empty Git
   repository and is not the checkout. Success: package.json, app/, docs/ and the
   Dockerfile are visible.
3. Ask Codex to read [AGENTS](../AGENTS.md), [PROJECT_HANDOFF](PROJECT_HANDOFF.md),
   [CURRENT_STATUS](CURRENT_STATUS.md), then [COMMAND_CONTRACT](COMMAND_CONTRACT.md).
4. Have it run `git branch --show-current`, `git status --short`, `git log -3 --oneline`.
   Branch must be feat/production-rag. Step 10 implementation is committed locally; inspect and
   preserve any later changes. Never clean/reset the project.
5. Verify Node using `.local/node-v24.22.1-darwin-arm64/bin/node --version`.
   For direct pnpm commands, from this checkout set
   `export PATH="$PWD/.local/node-v24.22.1-darwin-arm64/bin:$PATH"` in that terminal.
   Then `pnpm --version` should show 11.25.0 and `.venv/bin/python --version` 3.14.6.
   Do not reinstall dependencies or upgrade runtimes merely because a different
   account has different shell defaults.
6. Inspect Docker using `docker ps -a` without environment dumps.
   Native `make db-status` previously passed on port 55433. Reinspect
   ownership and live status before restoring a stopped service. Do not touch the
   other project's port 55432 or database. No database reset.
7. Read the final Step 10 report, current STEP 11 evidence and current status.
   STEP 11 is complete locally; await the next explicit task and do not begin STEP 12 or publish.

Common problems: wrong branch/files usually means the parent folder was opened;
reopen RAG-Agent without recloning. Wrong Node means the local PATH selection is
missing. Docker unavailable means inspect whether the installed app is running;
do not reinstall or prune. Missing private configuration must be entered privately,
never pasted into chat. Stop and diagnose a failed prerequisite rather than bypass it.

Official [project/folder documentation](https://learn.chatgpt.com/docs/projects)
explains that the primary project folder supplies Git operations and AGENTS discovery.
The exact account-switch UI was not exercised here; follow the controls offered by
your installed app. Local folders are the continuity mechanism, not chat migration.

## Ready-to-copy inspection prompt

```text
Inspect my existing DocRAG project in the current local RAG-Agent checkout.
Read AGENTS.md, docs/PROJECT_HANDOFF.md, docs/CURRENT_STATUS.md,
docs/STEP10_COMPLETE.md and docs/COMMAND_CONTRACT.md first.
Step 10 is locally complete; remote Actions remains unrun. Inspect Git status/history and live service state;
preserve every modified/untracked file and all previous commits. Confirm the
accepted step10-final-c evaluation and its cached-generation provenance.
Do not reset/reclone, reset databases, stop unrelated containers, change the
Node 24.22.1 pin, push, open PRs or deploy. Keep costs zero. Remote GitHub Actions
remains NOT RUN until explicit publication authorization. Report any difference
between saved evidence and live state. Do not begin Step 11 without my detailed
instructions. The later authorized STEP 11 work is recorded in CURRENT_STATUS.md;
do not begin STEP 12. Stop after three genuine unsuccessful repairs of the same blocker.
```

The original account handoff was documentation-only. Step 9 implementation and
saved verification are present, and final local acceptance passed in step9-final-e. Current
status overrides premature historical completion claims. A new account does not automatically inherit chat context.

STEP10 subsequently passed27/27 final-c groups,429 unit tests,26 container checks,
74.34% integration coverage and18 sustained load stages. Known capacity limits
remain; loadD included2,480 HTTP429 errors and74.74s50-user streaming queue p95.
All100 evaluation answers/judgments were cached, with fresh SQL retrieval.
The unrelated container was left stopped. Recheck current services before any work;
these are saved results, not a promise of service uptime across account changes.
