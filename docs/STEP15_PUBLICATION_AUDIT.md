# STEP15 — README publication and branch audit

## Authorized publication resolution

After the initial local checkpoint below, the user delegated the temporary build
suppression decision. In the existing DocRAG Vercel project, Ignored Build Step was
changed from Automatic to Don't build anything (`exit 0`) and verified after reload.
The previous production deployment's Automatic snapshot is historical; new builds
use the current project setting. Normal documentation pushes can now proceed.
After both resulting build attempts are confirmed cancelled/skipped, restore
Automatic and verify the existing production deployment remains the active alias.
Final remote equality, rendered README/Mermaid verification and restored build
settings are required observations at the end of publication.

GitHub main has documentation commit `2ef0116`; production documentation begins at
`381dc67`. A small follow-up audit commit records this authorization. Application
code remains identical to6458b35. No branch deletion or application merge is involved.

## Initial local outcome — superseded by the resolution above

Both README updates are prepared locally. GitHub About metadata now points to
https://docrag-demo.onrender.com/ and describes the deployed hybrid RAG application.
The default branch remains `main`.

At this initial checkpoint, **STEP15 was BLOCKED at documentation publication.** The user's instruction requires
stopping a push that would trigger an unwanted deployment. Vercel's DocRAG project
is linked to this repository with Ignored Build Step set to **Automatic**. Production
uses `main`; pushes to `feat/production-rag` create previews. The previous redesign
push demonstrated that feature-branch preview trigger. Render tracks the feature
branch with auto-deploy **Off**, retaining application commit6458b35.

No documentation push, PR creation or deployment had been performed at that checkpoint. Direct
pushes to main are unprotected and no main rulesets were reported, but the hosting
trigger still blocks publication under the user's explicit restriction. An automatic
preview triggered by PR creation would have the same unwanted side effect.

Before publication, obtain approval for a controlled docs-only deployment skip
mechanism or temporary build suppression, verify it applies to both branches, then
publish the prepared commits normally. Restore approved provider settings afterward
if changed. Do not change application logic, merge production into main, change the
default branch or delete branches. GitHub landing-page and client-side Mermaid
rendering verification remain pending until publication is safe.

## Branches and unique work

| Branch | Remote source at audit | Purpose |
| --- | --- | --- |
| `main` | `7ccc792669cef1c254d71ebc342fa4ba624584fa` | Default landing page and older application source |
| `feat/production-rag` | `6458b355d28521f7e0ae32f68d1fb710433f6bdd` | Current deployed implementation |
| `v0/aashleshrshet-8740-2f7e559c` | `f8d2cf1399b295c1eb4887442ee68a39e6c15e68` | Earlier v0 documentation experiment |

The v0 branch has two unique commits relative to both main and production:

- `6326a9a` renamed the project and expanded its README.
- `f8d2cf1` added two README screenshots and references.

The branch changes only README.md, docs/screenshots/chat-with-citations.png and
docs/screenshots/rag-vs-no-rag.png. It has no unique application implementation.
The replacement READMEs supersede its presentation, while its original images and
history remain on the branch.

**Disposition — KEEP pending PR/dependency resolution.**
[PR1](https://github.com/abhi0874/DocRAG/pull/1) remains OPEN, targets main, has two
commits and reports mergeStateStatus DIRTY. Its title is “Upgrade README with
architecture, design decisions, and evaluation results”. Deleting the branch now
would disrupt that open proposal. No branch has been deleted or merged.

Historical GitHub deployment records for the two v0 SHAs report successful Preview
builds under the older beginner-project-roadmap Vercel project:

- https://beginner-project-roadmap-f6ha97n70-aashleshrshet-8740s-projects.vercel.app
- https://beginner-project-roadmap-igpg9akee-aashleshrshet-8740s-projects.vercel.app

Those records establish historical preview dependencies, not current uptime or a
production dependency. Current Render production uses6458b35; current DocRAG Vercel
production uses main. No replacement service or model/data changes are required
for these README updates. A separate explicit deletion decision remains necessary.

## Documentation and evidence

The main README is a recruiter showcase with explicit production-branch routing.
The feature README covers implementation, profile restrictions, retrieval/model
configuration, private setup, security, evaluation and deployment. Both use four
existing real screenshots: public dark/light workspaces, a local public-fixture
citation capture and Safari appearance settings. The local citation capture
includes an earlier cancelled response and is captioned accordingly. Existing
compressed JPEGs are reused; source images and historical evidence are preserved.

Screenshot URLs on main are pinned to the existing production source SHA to avoid
broken relative links against its older tree. Technical documentation links point
to the maintained feature branch. A release summary and unchanged sanitized
production receipts preserve the55/55 Render verification previously held in ignored
local files. The source deployment remains6458b35 regardless of documentation HEAD.

Verified source metrics come from eval/results/observability/ui-redesign-d/evaluation.json:
Recall@5 .975, correctness .990, faithfulness1.000, citations265/265. Its100 fresh
answers/query embeddings,15 fresh/85 cached judgments and shared answer/judge model
are disclosed. Unit receipts show491=218Python+273TS. Production smoke is55/55
with three admitted Gemini requests. These are saved measurements, with no new
benchmark or full test run performed for this documentation-only task.

GitHub's Markdown API rendered both drafts successfully, preserving their images,
tables, details blocks and Mermaid fences. Local link/path validation and secret
review cover the intended files. Client-side Mermaid layout and final GitHub
landing-page visual verification await publication. A new public-demo question was
submitted while preparing a screenshot; browser access later became unavailable,
so no completed answer or new screenshot from that attempt is claimed. Existing
verified captures are used instead.

GitHub About update was authorized and verified through the API. Requested topics
were added while preserving existing related topics. The obsolete official Vercel
homepage was replaced by Render. No provider billing setting was changed.

A read-only PR/deployment query initially could not execute because automatic
approval review hit a usage limit. A later reviewed retry completed successfully;
no safety rejection was bypassed. A local main worktree is retained under ignored
.local/step15-main; the primary checkout remains feat/production-rag.
