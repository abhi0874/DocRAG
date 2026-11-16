# MONO / GLASS production release

Verified on 16 November 2026 at https://docrag-demo.onrender.com/.

| Item | Observed result |
| --- | --- |
| Source | `6458b355d28521f7e0ae32f68d1fb710433f6bdd` on `feat/production-rag` |
| Hosted CI | [43883857434](https://github.com/abhi0874/DocRAG/actions/runs/43883857434), success on the exact source SHA |
| Render deployment | `dep-dbth6m9srm7s73b9vmag`, Live |
| Service | Existing `docrag-demo`, Docker, Free, Virginia |
| Runtime | Node24.22.1 pinned by Docker image digest; pnpm11.25.0 |
| Health and readiness | HTTP200; dedicated database and embedding-space validation passed |
| Production smoke | 55/55 checks, exit0, three admitted Gemini requests |
| Browser | Themes/accents, saved intensity, one morphing pill, reduced motion, 401px mobile views without overflow |
| Log review | No HTTP5xx/unexpected errors among50 reviewed entries; expected cancellation emitted two error-level entries |
| Rollback | `b40319c` / `dep-dbs2sntg1s2s73e1ep00`, Rollback available; no rollback performed |
| Cost | Observed ₹0; Render Hobby/Free, no card, Gemini no linked billing account |

The existing production configuration and database were retained. No schema
migration, model/quota change, new infrastructure or Vercel deployment was performed.
The smoke checked HTTPS assets against actual secret values, secure eight-hour
sessions, two-user feedback/metrics isolation, anonymous denials, public document
sources, disabled signup/uploads/evaluation writes, origin/input validation,
streamed cited answers, valid refusal, quota429 and cancellation accounting.
Test sessions were signed out. This is a bounded production check, with two
completed generations and one cancellation; no hosted100-answer benchmark occurred.

[Smoke receipt](mono-glass-production-smoke.json) ·
[Browser/deployment receipt](mono-glass-production-release.json) ·
[Local evaluation and test provenance](../ui-redesign/VERIFICATION.md) ·
[Deployment operations](../DEPLOYMENT.md)

These receipts were preserved under ignored local evidence during deployment and
copied unchanged into public documentation during STEP15. This documentation
change does not redeploy the application. Historical publication and local-only
acceptance pages retain their original checkpoints.
