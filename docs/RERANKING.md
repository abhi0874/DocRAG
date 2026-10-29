# Step 5 local reranking — verified, disabled by default

The independent Step 4 audit passed before implementation: correct clean checkout
at 4ba666c, all seven commits preserved, 162 tests, lint/build, golden-set/source
verification, Step 4 compatibility gate, historical gate and Gemini preservation.
The single loopback listener was the checksum-verified project-local Ollama 0.40.9
executable, and both configured model digests matched. No baseline was rewritten.

## Approved model and installation location

The user approved the approximately 91 MB MiniLM download on condition that the
software and residual files can be removed and their locations are documented.
Model: cross-encoder/ms-marco-MiniLM-L6-v2, Apache-2.0, revision
233902d25c440f23af6f7d6e94d2946bac0bee0a. Official model card:
https://huggingface.co/cross-encoder/ms-marco-MiniLM-L6-v2

All additional downloaded software, weights and caches are kept in:

`/Users/abhisheshramadasshet/Documents/ChatGPT/DocRAG/RAG-Agent/.local/reranker-minilm`

- `env/`: separate Python environment; the existing `.venv` is unchanged.
- `model/`: the pinned weights, tokenizer and model metadata.
- `cache/`: package/library/bytecode caches, if generated.
- `tmp/`: installation and runtime temporary files.
- `manifest.json`, `owner.json`, `installed-requirements.txt`: integrity/ownership receipts.

Downloads remain out of Git. Source code, dependency pins, tests and benchmark
reports remain in the repository for reproducibility; they contain no model weights.
No additional global package or inference service is installed.

## Remove the optional software later

1. Stop any DocRAG Next.js server with Ctrl+C. Production checks verify that stopping the server also stops its managed
   reranker worker.
2. In Terminal, enter the existing checkout and run:

   ```sh
   cd /Users/abhisheshramadasshet/Documents/ChatGPT/DocRAG/RAG-Agent
   .venv/bin/python -m scripts.reranker_setup --remove
   ```

   The cleanup checks an exact ownership marker and removes only the directory
   listed above. It verifies that the directory no longer exists. Do not run this
   while inference is active. No cleanup has been performed during installation.
3. Set `RERANKER_ENABLED=false` when running the application without the feature.

Alternatively, after stopping the app, use Finder → Go → Go to Folder, enter the
absolute directory above, and move that folder to Trash. Empty Trash when ready.
Never remove the parent `.local` folder: it also contains the development database.
An ownership error means the installer cannot verify the folder; inspect its exact
path rather than bypassing the check. A missing-model response after removal is
expected; optional reranking must fall back to hybrid retrieval, not crash Q&A.

The database, core `.venv`, Ollama app and existing Qwen/EmbeddingGemma models are
separate and are not removed by this cleanup. Actual CPU/MPS latency, memory use,
default selection and API integration are recorded below and in STEP5_COMPLETE.md.

## Implementation and initial measurements

The Next.js chat and comparison routes call `selectContext`. With reranking off
(the default), this delegates to the unchanged hybrid search and selects its
original top six. With it on, the same search retrieves up to 10 or 20 candidates,
then a persistent Python child scores query/passage pairs. It is an inference
utility, not a replacement web backend. The worker uses only local safetensors,
verifies their manifest, and receives no inherited API/database credentials.
The child exits on stdin EOF, is stopped after 60 seconds idle, and is explicitly
closed by evaluation. Concurrent requests fall back rather than queue indefinitely.

`RERANKER_ENABLED=true`, `RERANKER_CANDIDATES=10|20`,
`RERANKER_DEVICE=cpu|mps`, `RERANKER_TIMEOUT_MS=15000` configure the feature.
Invalid configuration fails validation; missing software, runtime errors, invalid
scores or timeout return the original hybrid order. Chat headers expose
`X-DocRAG-Reranker-Status` and a safe fallback reason. The comparison route returns
its trace. No fallback is counted as reranker inference in experiments.

The real CPU/MPS two-passage probe passed six repetitions each. CPU initialization
1475.40 ms, first inference 7.16 ms, warm median 3.14 ms, peak RSS 542,801,920 bytes.
MPS initialization 1524.78 ms, first inference 692.06 ms, warm median 3.58 ms,
peak RSS 633,667,584 bytes; MPS allocation 91,168,512 bytes. These RSS/allocation
figures overlap in unified memory and must not be summed. CPU was selected for
its lower observed startup/memory and comparable warm toy latency. This does not
prove CPU faster on every batch size. Real passage timings follow in experiments.
MPS was unavailable inside the execution sandbox and succeeded with macOS GPU
access; no system software was changed. The installed directory occupies 1.2 GiB.

Step 4 historical profile verification now compares code hashes to the recorded
Git revision rather than requiring today's integration route to be identical.
Its settings, hash coverage, committed file hashes, source mappings and computed
metrics remain checked. Historical gate tests use the saved Step 4 candidate;
negative prompt, configuration and regression checks remain in place.

## Production build recovery

The reproduced Next.js16.2.6/Turbopack failure occurred during module file-reference
resolution (`DirAssetReference`), before successful production emission:
`Symlink [project]/.local/reranker-minilm/env/bin/python is invalid, it points out
of the filesystem root`. That Python link resolves through python3.14 to
`/Library/Frameworks/Python.framework/Versions/3.14/bin/python3.14`. This is a normal
working Python venv link, distinct from pnpm's working package links. There was no
custom tracing include or broad Next.js configuration glob.

The client previously constructed a statically discoverable path from process.cwd
into `.local/reranker-minilm`. Its runtime filesystem/process references caused
Turbopack to discover the optional host installation as directory assets. Tracing
annotations and `/usr/bin/env` did not fix this. The successful correction makes
`DOCRAG_RERANKER_HOME` an explicit absolute server-launch setting, removing that
project-relative asset reference. Missing configuration falls back honestly.
Direct argument-vector Python spawn is restored. No global tracing/type-check
setting was disabled, no dependency downgraded, and no environment or model moved.

Lint, 198 tests and the actual production build passed after that correction.
Ten production trace manifests contained1,931 file entries and zero Python venv,
site-packages or safetensors entries. The CPU environment and weights stay at the
same removable path. A host enabling the optional feature must separately install
its pinned environment and provide the repository's Python worker/setup modules;
these are server runtime requirements, not files delivered to a visitor's browser.
The eventual free hosting platform is not verified here. Missing optional runtime
on that host uses original hybrid search; it is not described as reranking.

## Clean candidate comparison and frozen decision

The final evidence is under `eval/results/reranking-final/`; the original
`reranking/` matrix remains preserved as preliminary because earlier builds and
source edits overlapped it. The final matrix used committed stable application
code, fresh query embeddings and three repetitions with persistent SQL/worker
processes. No simultaneous build or model benchmark ran. The existing60/40 split
and selection rule were reused unchanged; this is not an unseen benchmark.

| Development result (60 questions,180 observations/config) | Hybrid control | MiniLM top10 | MiniLM up to20 |
|---|---:|---:|---:|
| Actual candidate count | 10 | 10 | 12 |
| Recall@3 | .9270833333333334 | .9479166666666666 | .9479166666666666 |
| Recall@5 | .9583333333333334 | .96875 | .96875 |
| Recall@10 | 1 | 1 | 1 |
| MRR | .9756944444444444 | .9340277777777778 | .9236111111111112 |
| Multi-hop Recall@5 | .8333333333333334 | .875 | .875 |
| Selection p50 ms | 19.816146 | 142.5441665 | 165.419333 |
| Selection p95 ms | 20.8225458 | 159.34351075 | 186.78290865 |

Control was retained because both rerankers lost MRR under the predeclared
no-Recall@5-or-MRR-loss rule. No tuning followed holdout. Control's40-question
holdout (120 observations) had Recall@3 .984375, Recall@5/10 1, MRR .96875.
There were12 unanswerable development and8 unanswerable holdout questions;
they contribute timing but are excluded from retrieval-recall means. Their answer
behavior is evaluated separately; retrieved scores alone cannot prove a good refusal.

Warm reranking excludes the first model initialization:179 observations/config.
Top10 warm p50/p95:114.652750/131.2215494ms; up-to20:137.374375/158.4795039ms.
Cold worker request time:1633.008875/1689.425333ms respectively, of which model
initialization was1465.675125/1495.555834ms. These are process-cold measurements,
not cold disk-cache experiments. Peak worker RSS782,876,672/885,063,680bytes.
No candidate pairs were truncated. Existing RRF limits remained12vector+12keyword;
all larger measured pools actually had12 candidates, so20 must not be claimed.

Recovery CPU/MPS toy verification repeated six inferences/device with the existing
weights. CPU initialization1473.3805ms, first7.269666ms, five-warm median3.154208ms,
peak RSS542,621,696bytes. MPS initialization1500.728375ms, first143.427208ms,
five-warm median3.880959ms, peak RSS624,902,144bytes. CPU remained selected. This
two-short-passage comparison does not establish a universal CPU/GPU speed ranking.

The first all100 answer run was interrupted after16 complete questions. Recovery
uses compatible cached responses, verifies model/runtime identities, and keeps
cached versus fresh timings explicit. Final full-run numbers must come from the
validated selected artifact; development retrieval scores are not all100 answer scores.

## Final 100-question result and answer limitations

The selected disabled configuration matched Step 4: Recall@3 = .95, Recall@5 = .975,
Recall@10 = 1, MRR = .9729166666666667, automated citation accuracy 269/269, faithfulness 1,
correctness .99 (98 complete, 2 partial). The 83 fresh-answer subset and all observed
cache timings are reported separately in STEP5_COMPLETE.md and verified-report.json.
All 100 disabled rankings matched Step 4; exact cached replay reproduced every
context, answer and judgment. Strict regression and synthetic-negative gates pass.

Neither reranking pool repaired the two incomplete cases. Chunk 106 already supplies
the omitted savepoint detail. For the join/constraint question, foreign-key chunks
128/126/123 are in the 12-candidate pool, but none reaches the final six under the
tested reranker. A separate control diagnostic generated a correct foreign-key
fact absent from selected context and scored faithfulness .5. That grounding failure
is retained, not described as a successful fix. Automated full 100-question scores do not
guarantee perfect answers. Four targeted questions/configuration are diagnostic,
not a replacement 100-question benchmark for each rejected candidate.

Final production API checks pass for enabled/disabled/missing-runtime/timeout modes,
with source identities/citations intact and managed workers stopped. Cleanup tests
remove only owned temporary fixtures and preserve sibling data; actual weights
remain installed. Uninstalling the 1.2 GiB optional folder removes its environment,
weights and library caches. Small experiment reports and private run logs outside
that folder are retained evaluation records, not additional model installations.
