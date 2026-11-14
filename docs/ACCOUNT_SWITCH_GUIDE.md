> Current checkpoint: local STEPS0–12 complete; separately authorized public demo
> is live. Hosted CI and production checks passed; see PUBLICATION_STATUS.md and
> CURRENT_STATUS.md. Reinspect the current commit and service state on resume.

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
   Branch must be feat/production-rag. The verified branch has been published; inspect and
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
7. Read PUBLICATION_STATUS.md and the preserved STEP11/12 reports. The public
   service is separate from local Ollama. Do not recreate resources, repeat corpus
   writes or assume this handoff authorizes new deployments.

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
Inspect the existing DocRAG RAG-Agent checkout on feat/production-rag.
Read AGENTS.md, docs/CURRENT_STATUS.md, docs/PROJECT_HANDOFF.md,
docs/COMMAND_CONTRACT.md and docs/PUBLICATION_STATUS.md first.
Steps0–12 are locally complete. The separately authorized public Render/Neon demo
is live, with hosted CI and production acceptance evidence. Inspect actual Git,
remote commit, CI and live state; distinguish saved from fresh results. Preserve
all files, data, uncommitted changes, historical evidence and model pins. Do not
reset/reclone, change billing, control unrelated services or make further external
changes without applicable authorization. Keep paid costs zero. Stop after three
genuine unsuccessful repairs of the same blocker.
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
