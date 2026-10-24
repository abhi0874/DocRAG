# A simple way to review the judge examples

You do not need to know FastAPI, PostgreSQL or machine learning to check these
examples. Read the two short pieces of evidence, then compare each answer with
what the evidence says. The complete exact excerpts are in REVIEW.md.

Evidence A says that the `/items/3` example produces the Python integer `3`,
not the text string `"3"`. Another excerpt says parameters are validated.

Evidence B says that `BEGIN` and `COMMIT` surround a PostgreSQL transaction.
Another excerpt explains that `ROLLBACK` cancels changes instead of committing.

For each topic, the seven examples ask the following checks:

1. Correct answer: Does it say the same thing as the evidence? Proposed: yes.
2. Unsupported answer: Does the evidence support “string three” or the invented
   transaction commands “START TRANSACTIONAL” and “SAVE”? Proposed: no.
3. Wrong citation: The answer is correct, but points to excerpt [2], which lacks
   the complete answer. Proposed: the factual answer is supported somewhere in
   the evidence, but that particular citation is wrong.
4. Missing citation: The answer is correct but gives no bracketed reference.
   Proposed: the factual answer is correct; citation coverage is missing.
5. Incorrect refusal: The model says it cannot find an answer that is plainly in
   excerpt [1]. Proposed: this refusal is wrong.
6. Proper refusal: The question asks about JWT signing or backup retention,
   neither of which appears in these excerpts. Proposed: refusing is appropriate.
7. Partial answer: It gives the integer type but omits the value 3, or names BEGIN
   but omits COMMIT. Proposed: what it says is supported, but the answer is incomplete.

These are proposed judgments prepared by the assistant. They do not become human
judgments merely because a model agrees with them. If you understand and agree
with these checks for all 14 entries in REVIEW.md, you can explicitly confirm
that review. If anything is confusing or appears wrong, identify that example;
there is no need to guess or agree automatically.

Your earlier review of the 100 benchmark questions remains valid. This review is
only for the separate 14-example test of the automated answer scorer.
