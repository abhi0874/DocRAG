"""Source-page recall at actual chunk ranks and semantically judged citations."""

import math
import re
from statistics import mean

DEFINITIONS = {
    "version": "docrag-metrics-v1",
    "relevance": "source-page IDs at original chunk ranks; no rank compression",
    "recall": "unique relevant source IDs in first k chunks / unique relevant IDs",
    "mrr": "reciprocal rank of first relevant chunk, truncated at 10",
    "retrieval_population": "answerable only; macro mean",
    "citation": "micro supported citation occurrences / attempted occurrences; "
    "missing citations contribute one incorrect occurrence; correct uncited "
    "unanswerable refusals excluded",
    "judge": "faithfulness/correctness rubric v1; scores 0, 0.5, 1; macro mean",
    "latency": "wall milliseconds; observed current run; excludes judge and pacing; "
    "p50/p95 linear interpolation between sorted observations",
}


def recall_at_k(retrieved, relevant, k, question_type="easy"):
    if question_type == "unanswerable":
        return None
    if type(k) is not int or k <= 0:
        raise ValueError("k must be a positive integer")
    relevant = set(relevant)
    if not relevant:
        raise ValueError("Answerable question has no relevance labels")
    return len(set(retrieved[:k]) & relevant) / len(relevant)


def reciprocal_rank(retrieved, relevant, question_type="easy"):
    if question_type == "unanswerable":
        return None
    relevant = set(relevant)
    if not relevant:
        raise ValueError("Answerable question has no relevance labels")
    return next(
        (1 / rank for rank, source in enumerate(retrieved, 1) if source in relevant),
        0.0,
    )


def citations(answer):
    return [int(match) for match in re.findall(r"\[(\d+)\]", answer)]


def citation_counts(
    numbers, support, context_count, question_type, correctness, substantive_claims
):
    if len(numbers) != len(support) or any(
        type(value) is not bool for value in support
    ):
        raise ValueError("Every citation occurrence needs a Boolean support judgment")
    if not numbers:
        if (
            question_type == "unanswerable"
            and correctness == 1
            and not substantive_claims
        ):
            return 0, 0
        return 0, 1
    correct = sum(
        ok and 1 <= number <= context_count
        for number, ok in zip(numbers, support, strict=True)
    )
    return correct, len(numbers)


def percentile(values, q):
    if not values or not 0 <= q <= 1:
        raise ValueError("Percentile requires observations and q in [0,1]")
    values = sorted(values)
    if any(not math.isfinite(v) or v < 0 for v in values):
        raise ValueError("Invalid latency observations")
    position = (len(values) - 1) * q
    lower = int(position)
    upper = min(lower + 1, len(values) - 1)
    return values[lower] + (values[upper] - values[lower]) * (position - lower)


def aggregate(rows):
    answerable = [r for r in rows if r["type"] != "unanswerable"]
    if not answerable:
        raise ValueError("No answerable questions to evaluate")
    result = {
        f"recall@{k}": mean(r[f"recall@{k}"] for r in answerable) for k in (3, 5, 10)
    }
    numerator = sum(r["citation_supported"] for r in rows)
    denominator = sum(r["citation_denominator"] for r in rows)
    result.update(
        {
            "mrr": mean(r["mrr"] for r in answerable),
            "citation_accuracy": numerator / denominator if denominator else None,
            "citation_supported": numerator,
            "citation_denominator": denominator,
            "faithfulness": mean(r["faithfulness"] for r in rows),
            "correctness": mean(r["correctness"] for r in rows),
            "p50_latency_ms": percentile([r["total_latency_ms"] for r in rows], 0.5),
            "p95_latency_ms": percentile([r["total_latency_ms"] for r in rows], 0.95),
            "answerable_count": len(answerable),
            "unanswerable_count": len(rows) - len(answerable),
            "tokens_per_query": None,
            "tokens_unavailable_reason": "Embedding SDK does not report token usage; "
            "answer and judge usage are reported separately, not invented totals.",
            "estimated_cost_per_query_usd": None,
            "cost_unavailable_reason": "Account billable usage/pricing not verified.",
        }
    )
    for kind in ("answer", "judge"):
        tokens = [r[f"{kind}_usage"].get("totalTokens") for r in rows]
        result[f"{kind}_tokens_per_query"] = (
            mean(tokens) if all(type(t) is int and t >= 0 for t in tokens) else None
        )
    return result
