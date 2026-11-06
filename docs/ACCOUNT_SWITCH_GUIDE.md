# Continue on another Codex account — same Mac

The repository, Git history and unfinished files remain on this Mac. Do not expect
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
   unfinished Dockerfile are visible.
3. Ask Codex to read [AGENTS](../AGENTS.md), [PROJECT_HANDOFF](PROJECT_HANDOFF.md),
   [CURRENT_STATUS](CURRENT_STATUS.md), then [COMMAND_CONTRACT](COMMAND_CONTRACT.md).
4. Have it run `git branch --show-current`, `git status --short`, `git log -3 --oneline`.
   Branch must be feat/production-rag; unfinished files must still be present.
   A dirty working tree is expected. Do not ask it to clean/reset the project.
5. Verify Node using `.local/node-v24.22.1-darwin-arm64/bin/node --version`.
   For direct pnpm commands, from this checkout set
   `export PATH="$PWD/.local/node-v24.22.1-darwin-arm64/bin:$PATH"` in that terminal.
   Then `pnpm --version` should show 11.25.0 and `.venv/bin/python --version` 3.14.6.
   Do not reinstall dependencies or upgrade runtimes merely because a different
   account has different shell defaults.
6. Inspect Docker using `docker ps -a` without environment dumps. Native
   `make db-status` currently fails because the server is stopped. Have the agent
   inspect ownership and the documented safe startup procedure before restoring it;
   do not touch the other project's port 55432 or database. No migrations/reset.
7. Resume only Step 9 after prerequisites pass. Require actual verification and
   a detailed step report; do not advance to Step 10 or publish automatically.

Common problems: wrong branch/files usually means the parent folder was opened;
reopen RAG-Agent without recloning. Wrong Node means the local PATH selection is
missing. Docker unavailable means inspect whether the installed app is running;
do not reinstall or prune. Missing private configuration must be entered privately,
never pasted into chat. Stop and diagnose a failed prerequisite rather than bypass it.

Official [project/folder documentation](https://learn.chatgpt.com/docs/projects)
explains that the primary project folder supplies Git operations and AGENTS discovery.
The exact account-switch UI was not exercised here; follow the controls offered by
your installed app. Local folders are the continuity mechanism, not chat migration.

## Ready-to-copy continuation prompt

```text
Continue my existing DocRAG project in the current local RAG-Agent checkout.
Read AGENTS.md, docs/PROJECT_HANDOFF.md, docs/CURRENT_STATUS.md and
 docs/COMMAND_CONTRACT.md first. Inspect Git status and all unfinished work.
Step 9 is in progress, NOT complete. Preserve every modified and untracked file.
The historical Step 8 prerequisite audit passed 27/27, but native PostgreSQL was
stopped at handoff and make db-status exited 2. Diagnose and safely restore only
the owned native instance according to the contract, then rerun prerequisites.
If any mandatory prerequisite fails, stop and report it before implementation.
Docker image build/basic container health were verified; authenticated container
flows, host Ollama connectivity, coverage >=70%, CI and final tests are pending.
Use the 20-task plan in CURRENT_STATUS.md. Continue only the remaining Step 9 work.
Do not reset/reclone, discard unfinished files, reset databases, stop unrelated
containers, change the Node 24.22.1 pin, or push/open PRs/deploy. Keep costs zero.
Remote GitHub Actions must remain NOT RUN until explicit push authorization.
Use actual commands and report exit codes, provenance and limitations. Preserve
historical results and security tests. Stop after Step 9 or a genuine blocker;
stop after three genuine unsuccessful repairs of the same blocker. Do not start
Step 10. Provide the required detailed STEP REPORT and confirmations.
```

The account handoff itself changes documentation only. It does not establish
Step 9 completion or resolve the stopped database and unfinished container checks.
