# Multi-passage quality investigation

**Decision: BLOCKED.** One candidate recovered both target answers. It failed an existing grounding control and returned invalid refusals on a synthetic question and a held-out golden question. All three candidates were rejected before application integration. Source checkpoint `c93e1edeae649640f8ba7ea1d3d26bbf89a4e4e4` retains the application measured at `ddb0e0c27284eef9986983ee211541eaee776209`. The only new tracked work consists of evidence and deterministic tests. [Focused results and request provenance](MULTIPASSAGE_RESULTS.json) · [Prior benchmark](GROUNDING_REPAIR.md)

## What the answer model received

The frozen benchmark uses the first six of ten hybrid/RRF results. A read-only comparison with the owned PostgreSQL cluster on port 55433 matched the text of all 600 answer passages to the saved results. No answer passage was truncated during prompt assembly. The top-six cutoff still matters.

| Question | Evidence in the original six | Root cause |
|---|---|---|
| `fastapi-036` | Dependencies occupied ranks 1, 2 and 6. Rank 6, chunk 92, describes calling the dependency and assigning its result to the endpoint parameter. Ranks 4 and 5 contain an exception example and the response for a missing item. | The answer described both mechanisms but refused to connect them. The clearest evidence about propagation from a utility function, chunk 72 with the actual missing-item check, ranked **10th**. Excessive caution and context selection both contributed. |
| `postgresql-040` | Chunk 161 at rank 4 shows the aliased self-join and its output rows. Chunk 153 at rank 6 defines an aggregate as computing one result over input rows. Both passages reached generation intact. | The answer required a worked example of an aggregate over that specific join. The requested operation follows from applying the documented aggregate to the rows produced by the join. No extra source was needed. |

The historical agent instructions about partial evidence applied to both answers. The model produced valid, supported citations while withholding the final workflow. The citation validator did not reject either original answer. The experiments varied more than one factor, so the evidence does not isolate the effect of instructions from ordering or generation variability. Four fresh unchanged-entrypoint controls used the pinned runtime and model digests. Only `postgresql-037` reproduced the saved answer byte-for-byte. For the unchanged `postgresql-031` control, an offline serialization check showed identical Ollama request bodies through the application and diagnostic paths.

## Focused candidate results

All candidates ran locally on Ollama 0.40.9 with the configured model and sampling settings. None used golden labels, model scores or question IDs to choose an answer or select passages. IDs selected diagnostic cases. Each judge used the existing rubric and reference documents. The target scores below are automated correctness on individual questions.

| Approach | FastAPI | PostgreSQL | Decision |
|---|---:|---:|---|
| Verified checkpoint | 0 | .5 | Retained application |
| Group evidence by document/page in the prompt, order each group by chunk index, and retain original citation numbers | .5 | 1 | FastAPI still withheld the supported combination. |
| Present the original request and its explicit clauses to a single generation | 0 | .5 | Neither target recovered. The missing-fact control also showed why a correct citation number alone cannot certify the full answer. |
| Independently answer each explicit clause with shared numbered evidence, using complementary neighboring chunks when available, then join the responses | **1** | **1** | Both targets passed. The unchanged grounding and final-answer checks below rejected the candidate. |

For the third trial, a conservative clause splitter matched 17/100 questions. The original question was included only to resolve subjects and conditions. The diagnostic used the existing hybrid search for each clause and selected among the original ten authorized public candidates. It retained the top four slots, included pages represented in the original six when space allowed, then preferred consecutive chunks from the same page that ranked well for the individual clauses. It retained original rank order within the resulting six. The selected six changed on eight questions. A replay across all 100 stored rankings preserved Recall@3/5/10 and MRR on every row. This was a retrieval replay only.

The complementary window included FastAPI chunk 72. The candidate explained the dependency and the terminating HTTP 404, with **7/7** supported citations. On the original six PostgreSQL passages it explained the aliases and aggregation, with **5/5** supported citations. The clause splitter did not match the price-constraint question `postgresql-031`; this row cannot demonstrate a benefit from decomposition.

Two independent findings disqualified the candidate:

- On `postgresql-037`, the answer explained the inner join with two supported citations, then appended a generic refusal for the missing constraint. The unchanged automated judge returned **.5 faithfulness** versus **1.0** at the checkpoint. Its rationale describes an incomplete answer and identifies no invented factual claim. The recorded score stands; the rationale does not establish a hallucination.
- On `postgresql-044` and the synthetic missing-information case, both subanswers independently returned the canonical refusal. Concatenation produced the refusal twice. The existing application citation validator classified the result as `missing-references`. The automated judge gave both answers full credit. In both cases the assembled text fails application validation for a completed answer. Deduplicating that string alone would leave the first failure unresolved.

The third candidate correctly distinguished two seating capacities, retained conflicting desk-opening times and declined to attribute a grant to the wrong project. The four other previously correct held-out answers also retained full automated correctness and faithfulness. Across the three prototypes there were 29 diagnostic outputs from 41 local answer calls, plus the four unchanged controls. Of 21 diagnostic judgments, 19 were fresh and two reused identical judgments from this task's separate cache. These are exploratory results. No candidate passed the prerequisite for a fresh 100-question evaluation.

The results file also stores the public model requests, reconstructed offline from the diagnostic harness with a recording transport. The following example verifies the precise message text, option values and request body for the independent FastAPI trial without calling a provider. Change the case or trial name to inspect another request. Clause index zero is the first model call.

```python
import hashlib
import json
from pathlib import Path

receipt = json.loads(Path("docs/gemini-repair/MULTIPASSAGE_RESULTS.json").read_text())
wire = receipt["offline_request_reconstruction"]
for request in wire["requests"]:
    if (request["trial"], request["id"]) != ("independent", "fastapi-036"):
        continue
    body = request["body"]
    for message in body["messages"]:
        message["content"] = wire["content_by_sha256"][message["content"]]
    raw = json.dumps(body, ensure_ascii=False, separators=(",", ":")).encode()
    assert hashlib.sha256(raw).hexdigest() == request["sha256"]
    print(request["index"], request["sha256"])
```

## Provenance and historical comparisons

The frozen 100-question candidate and both historical baselines independently passed the existing artifact verifier again. The generic comparison checks configuration identity, including measured implementation hashes; it does not require identical commit IDs for documentation-only changes. Comparing the UI baseline with the retained candidate again exited 1 with `Missing or incompatible config_sha256`. The STEP 11 deployment comparison exited 1 with `Undeclared implementation change`. Its specific change declaration excludes changes present in `lib/evidence.ts`, `lib/observability/http.ts`, `lib/security/http.ts`, `lib/types.ts` and `pnpm-lock.yaml`. Those outcomes establish incompatibility; they do not measure the numerical regression.

The contract provides stage-specific comparisons for explicitly declared changes and like-for-like checks for matching configurations. It provides no existing declaration for the rejected prototypes. No new measured candidate or baseline migration was warranted. The two independent negative controls still rejected a decrease of .020000000001 (exit 1 per control).

| Last verified full benchmark | Value |
|---|---:|
| Recall@3 / @5 / @10; MRR | .950 / .975 / 1.000; .972917 |
| Correctness; faithfulness | .970; 1.000 |
| Supported citations; unanswerable correctness | 267/267; 20/20 |
| Pipeline p50 / p95 | 5.85 / 10.26 s |
| Retrieval p50 / p95 | 40.09 / 85.18 ms |

The original full-run receipt has 100 fresh embeddings, answers and judgments. Its inputs, model identities, configuration, hashes and measurements are preserved. No new aggregate correctness or latency estimate is available. [Verified full benchmark](../../eval/results/observability/grounding-repair-a/evaluation.json)

## Acceptance of the retained application

| Fresh check | Result |
|---|---|
| Focused Vitest tests covering both target passage mappings, two-document attribution, exact quotations, partial and missing evidence, conflicting facts, unsupported relationships, guest/owner boundaries and cancellation | 46/46, exit 0 |
| `make lint` and `make test` | Both exited 0. 220 Python and 347 TypeScript tests passed, including seven new offline replay cases. |
| `python -m scripts.workspace_http --run-id multipassage-acceptance-a` | 63/63, ten fresh local answers, one cancellation. Registration, sign-in, upload, indexing, guest free-form questions, personal comparison, missing information, private-source access denial, quotas, deletion and post-cancellation health passed on a new isolated synthetic database. |

Run `pnpm exec vitest run tests/multipassage-grounding.test.ts` to replay the exact citation assignments and refused outputs without a model or database. Full build, 66 HTTP security checks, 27 SQL checks, 26 container checks, 72.67% Python integration coverage and mobile emulation remain historical evidence for the unchanged application. The complete release verification sequence was not rerun. CVE-2026-112366 remains a separate publication hold. No cloud calls, payment, push, production database access or deployment took place. [Security decision](SECURITY_DECISION.md)
