# Fresh review: one case at a time

This set contains 14 newly authored controlled examples from the existing public
corpus. It is separate from the earlier AI-assisted review. No old labels were
copied. These are calibration fixtures, not claimed to be Qwen-generated answers.

The assistant will present N01 through N14 individually in their fixed random
order. You can reply in chat; there is no need to edit JSON or learn programming.
Only your actual decisions will be recorded, along with your original message.
If a decision is unclear, it stays pending until clarified. You may stop and resume.
Do not ask another AI to decide scores before you give your own decisions. Terms
and instructions can be explained without supplying a case's expected outcome.

## Rubric recorded before labels

Faithfulness F: use only the provided excerpts. 1 means all material factual claims
are supported; 0.5 means partly supported with a material unsupported claim; 0 means
mostly unsupported or contradictory. For a refusal, 1 means the excerpts cannot
answer the question; 0 means they can. Wrong/missing citation numbers alone do not
reduce F if the claim is supported by another supplied excerpt.

Correctness C: 1 means the answer correctly and completely addresses the question;
0.5 means partly correct but materially incomplete; 0 means wrong, irrelevant, or
refusing when evidence answers the question. For an unanswerable question, explicit
refusal without invention gets 1, caveat plus unsupported speculation gets 0.5,
and a fabricated answer gets 0. Scope is the provided evidence, not outside knowledge.
The judge will also receive a frozen reference answer drawn from the same evidence;
that reference is withheld during human review so it cannot serve as an answer key.

Citation support: for each [number] occurrence in reading order, judge whether that
specific excerpt supports its attached claim: yes or no. Topic similarity or correct
format alone is insufficient; out-of-range/unattached citations are no. With no
citations, enter none. Missing citations receive the existing separate penalty.

Substantive claims: yes for factual answer claims; no only for a pure refusal.
Refusal behavior: appropriate, inappropriate, or not_a_refusal. Include a short
reason for your decisions. Write unsure rather than guessing; it stays pending.

## Frozen acceptance criteria

The existing criteria are unchanged: at least 14 cases; exact agreement at least
90% for F, C and substantive claims, and at least 95% for each case's complete
citation-support list. Every predeclared critical case must match all four labels.
Criteria were frozen before human decisions or model predictions. Case category
assignments are withheld, with their hash committed, to avoid revealing outcomes.

The judge rubric is frozen verbatim from the current evaluator. The manifest binds
the packet, rubric, criteria and withheld reference/category metadata by SHA-256.
No predicted scores or proposed human labels exist in this packet. Withheld metadata
is local and its committed hash prevents silently changing its contents after review.
Do not delete .local, which also contains the existing database and evaluation caches.

Only after all independent labels are recorded may Qwen predictions be obtained
and compared. No automatic receipt, baseline promotion or acceptance follows from
merely filling fields. Small-sample limitations and self-judging bias remain even
if this narrow calibration passes. Thresholds will not be lowered to force success.
