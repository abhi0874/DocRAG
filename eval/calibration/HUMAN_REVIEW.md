# Your independent review — 14 examples

No scores are pre-filled. Do not open the older REVIEW.md, cases.json,
review-packet-map.json or calibration result files until you finish: they expose
proposed labels or category names. R01–R14 are neutral IDs in mixed order.

These are the exact saved **calibration test answers**, authored as controlled
examples by the assistant; they are not claimed to be Qwen-generated benchmark
answers. Evidence below is quoted exactly from the saved public documentation.
One old paraphrase has been replaced with an exact sentence from the same source.
This packet is version 2; historical results are preserved and cannot automatically
validate it. Reference answers are provided for checking completeness, not as scores.

## How to fill this file

Read the question, answer and numbered evidence for each case. Replace every `____`
in its **Your labels** block with your own decision. Do not edit questions/evidence.
Save with Cmd+S. You may save and return later; unfinished fields stay `____`.
If unsure, write `unsure` and explain why; it will stay pending rather than count as
approval. A reply saying only "done" is not a substitute for your actual labels.

Faithfulness (F): use only the numbered retrieved evidence.
- `1`: all material factual claims are supported.
- `0.5`: partly supported, but a material claim lacks support.
- `0`: mostly unsupported or contradictory.
For a refusal, use `1` only if the evidence lacks enough information to answer;
otherwise use `0`. A missing/wrong citation does not by itself reduce F when the
claim is supported by another supplied excerpt.

Correctness (C): compare with the question, reference answer and supplied reference
evidence (the two excerpts).
- `1`: accurate and complete on every requested point.
- `0.5`: partly correct but materially incomplete.
- `0`: wrong, irrelevant, or refuses a question the evidence can answer.
If the evidence cannot answer the question: explicit refusal without invention is
`1`; a caveat plus unsupported speculation is `0.5`; a fabricated answer is `0`.
Use this document scope, not outside knowledge.

Citation support: for each bracketed number in the answer, in reading order, enter
`yes` or `no`, separated by commas. Check the **specifically numbered excerpt**,
not just the topic or citation format. An out-of-range/unattached citation is `no`.
With no bracketed citations, enter `none` (not `no`). The evaluator separately
penalizes missing citations where required; do not invent a citation occurrence.

Substantive claims: enter `yes` if the answer makes factual answer claims; `no`
only for a pure refusal with no factual answer claim.

Refusal behavior: enter `appropriate`, `inappropriate`, or `not_a_refusal`.
This records your explanation; F/C still follow the established rules above.
Reason: one short sentence citing the evidence and explaining your decisions.

The earlier guide showed suggested labels. If you saw them, disclose that below;
we cannot promise a fully blind review after prior exposure. Honesty here does not
change the acceptance thresholds or count an unfinished review as complete.

Reviewer name: Abhishesh Ramadas Shet
Previously saw proposed labels: yes
(use yes, no, or unsure)
Review date: 2026-10-25

Packet SHA-256: 2bae0b05351dfe98954c77d663baf7e4a48de2df556e321c196e23ed145236ad

## R01

Question: Which JWT signing algorithm is configured?

Answer to assess (unchanged):

> I could not find this in the document.

Reference answer: The excerpts do not provide this information.

Reference evidence: excerpts [1] and [2] below.
### Retrieved excerpt [1]

Source: fastapi.path-params; saved lines 24–28.

> If you run this example and open your browser at http://127.0.0.1:8000/items/3, you will see a response of:
> {"item_id":3}
> Tip
> Notice that the value your function received (and returned) is 3, as a Python int, not a string "3".
> So, with that type declaration, FastAPI gives you automatic request "parsing".

### Retrieved excerpt [2]

Source: fastapi.path-params; saved lines 47–47.

> So, with the same Python type declaration, FastAPI gives you data validation.

Citation occurrences in order: (no bracketed citations present)

Your labels — R01:

F: 1
C: 1
Citation support: none
Substantive claims: no
Refusal behavior: appropriate
Reason: The provided excerpts do not mention JWT configuration, making this refusal justified and faithful to the source scope.

---

## R02

Question: When item_id is declared as int, what type and value does /items/3 produce?

Answer to assess (unchanged):

> It produces the Python integer 3. [1]

Reference answer: It produces the Python integer 3.

Reference evidence: excerpts [1] and [2] below.
### Retrieved excerpt [1]

Source: fastapi.path-params; saved lines 24–28.

> If you run this example and open your browser at http://127.0.0.1:8000/items/3, you will see a response of:
> {"item_id":3}
> Tip
> Notice that the value your function received (and returned) is 3, as a Python int, not a string "3".
> So, with that type declaration, FastAPI gives you automatic request "parsing".

### Retrieved excerpt [2]

Source: fastapi.path-params; saved lines 47–47.

> So, with the same Python type declaration, FastAPI gives you data validation.

Citation occurrences in order: [1]

Your labels — R02:

F: 1
C: 1
Citation support: yes
Substantive claims: yes
Refusal behavior: not_a_refusal
Reason: Excerpt [1] explicitly states that the returned value is 3 as a Python int, which fully supports the answer and its citation.

---

## R03

Question: When item_id is declared as int, what type and value does /items/3 produce?

Answer to assess (unchanged):

> I could not find this in the document.

Reference answer: It produces the Python integer 3.

Reference evidence: excerpts [1] and [2] below.
### Retrieved excerpt [1]

Source: fastapi.path-params; saved lines 24–28.

> If you run this example and open your browser at http://127.0.0.1:8000/items/3, you will see a response of:
> {"item_id":3}
> Tip
> Notice that the value your function received (and returned) is 3, as a Python int, not a string "3".
> So, with that type declaration, FastAPI gives you automatic request "parsing".

### Retrieved excerpt [2]

Source: fastapi.path-params; saved lines 47–47.

> So, with the same Python type declaration, FastAPI gives you data validation.

Citation occurrences in order: (no bracketed citations present)

Your labels — R03:

F: 0
C: 0
Citation support: none
Substantive claims: no
Refusal behavior: inappropriate
Reason: The answer refuses the question even though excerpt [1] clearly states the function returns the Python int 3.

---

## R04

Question: Which commands surround an explicit PostgreSQL transaction?

Answer to assess (unchanged):

> START TRANSACTIONAL starts it and SAVE ends it. [1]

Reference answer: BEGIN starts the transaction and COMMIT ends it.

Reference evidence: excerpts [1] and [2] below.
### Retrieved excerpt [1]

Source: postgresql.tutorial-transactions; saved lines 15–15.

> In PostgreSQL, a transaction is set up by surrounding the SQL commands of the transaction with BEGIN and COMMIT commands. So our banking transaction would actually look like:

### Retrieved excerpt [2]

Source: postgresql.tutorial-transactions; saved lines 21–21.

> If, partway through the transaction, we decide we do not want to commit (perhaps we just noticed that Alice's balance went negative), we can issue the command ROLLBACK instead of COMMIT, and all our updates so far will be canceled.

Citation occurrences in order: [1]

Your labels — R04:

F: 0
C: 0
Citation support: no
Substantive claims: yes
Refusal behavior: not_a_refusal
Reason: The claims START TRANSACTIONAL and SAVE directly contradict excerpt [1], which specifies BEGIN and COMMIT commands.

---

## R05

Question: When item_id is declared as int, what type and value does /items/3 produce?

Answer to assess (unchanged):

> It produces the Python integer 3. [2]

Reference answer: It produces the Python integer 3.

Reference evidence: excerpts [1] and [2] below.
### Retrieved excerpt [1]

Source: fastapi.path-params; saved lines 24–28.

> If you run this example and open your browser at http://127.0.0.1:8000/items/3, you will see a response of:
> {"item_id":3}
> Tip
> Notice that the value your function received (and returned) is 3, as a Python int, not a string "3".
> So, with that type declaration, FastAPI gives you automatic request "parsing".

### Retrieved excerpt [2]

Source: fastapi.path-params; saved lines 47–47.

> So, with the same Python type declaration, FastAPI gives you data validation.

Citation occurrences in order: [2]

Your labels — R05:

F: 1
C: 1
Citation support: no
Substantive claims: yes
Refusal behavior: not_a_refusal
Reason: The answer is factually correct per excerpt [1], but citation [2] is unsupported because excerpt [2] covers data validation instead.

---

## R06

Question: Which commands surround an explicit PostgreSQL transaction?

Answer to assess (unchanged):

> BEGIN starts the transaction and COMMIT ends it.

Reference answer: BEGIN starts the transaction and COMMIT ends it.

Reference evidence: excerpts [1] and [2] below.
### Retrieved excerpt [1]

Source: postgresql.tutorial-transactions; saved lines 15–15.

> In PostgreSQL, a transaction is set up by surrounding the SQL commands of the transaction with BEGIN and COMMIT commands. So our banking transaction would actually look like:

### Retrieved excerpt [2]

Source: postgresql.tutorial-transactions; saved lines 21–21.

> If, partway through the transaction, we decide we do not want to commit (perhaps we just noticed that Alice's balance went negative), we can issue the command ROLLBACK instead of COMMIT, and all our updates so far will be canceled.

Citation occurrences in order: (no bracketed citations present)

Your labels — R06:

F: 1
C: 1
Citation support: none
Substantive claims: yes
Refusal behavior: not_a_refusal
Reason: The answer is completely correct and supported by excerpt [1], though it contains no bracketed citations.

---

## R07

Question: Which backup retention period does this page prescribe?

Answer to assess (unchanged):

> I could not find this in the document.

Reference answer: The excerpts do not provide this information.

Reference evidence: excerpts [1] and [2] below.
### Retrieved excerpt [1]

Source: postgresql.tutorial-transactions; saved lines 15–15.

> In PostgreSQL, a transaction is set up by surrounding the SQL commands of the transaction with BEGIN and COMMIT commands. So our banking transaction would actually look like:

### Retrieved excerpt [2]

Source: postgresql.tutorial-transactions; saved lines 21–21.

> If, partway through the transaction, we decide we do not want to commit (perhaps we just noticed that Alice's balance went negative), we can issue the command ROLLBACK instead of COMMIT, and all our updates so far will be canceled.

Citation occurrences in order: (no bracketed citations present)

Your labels — R07:

F: 1
C: 1
Citation support: none
Substantive claims: no
Refusal behavior: appropriate
Reason: Neither excerpt mentions backup retention periods, so the refusal is accurate and faithful.

---

## R08

Question: When item_id is declared as int, what type and value does /items/3 produce?

Answer to assess (unchanged):

> It produces the string "three". [1]

Reference answer: It produces the Python integer 3.

Reference evidence: excerpts [1] and [2] below.
### Retrieved excerpt [1]

Source: fastapi.path-params; saved lines 24–28.

> If you run this example and open your browser at http://127.0.0.1:8000/items/3, you will see a response of:
> {"item_id":3}
> Tip
> Notice that the value your function received (and returned) is 3, as a Python int, not a string "3".
> So, with that type declaration, FastAPI gives you automatic request "parsing".

### Retrieved excerpt [2]

Source: fastapi.path-params; saved lines 47–47.

> So, with the same Python type declaration, FastAPI gives you data validation.

Citation occurrences in order: [1]

Your labels — R08:

F: 0
C: 0
Citation support: no
Substantive claims: yes
Refusal behavior: not_a_refusal
Reason: The claim that it produces the string "three" is incorrect and directly contradicted by excerpt [1].

---

## R09

Question: Which commands surround an explicit PostgreSQL transaction?

Answer to assess (unchanged):

> BEGIN starts the transaction and COMMIT ends it. [1]

Reference answer: BEGIN starts the transaction and COMMIT ends it.

Reference evidence: excerpts [1] and [2] below.
### Retrieved excerpt [1]

Source: postgresql.tutorial-transactions; saved lines 15–15.

> In PostgreSQL, a transaction is set up by surrounding the SQL commands of the transaction with BEGIN and COMMIT commands. So our banking transaction would actually look like:

### Retrieved excerpt [2]

Source: postgresql.tutorial-transactions; saved lines 21–21.

> If, partway through the transaction, we decide we do not want to commit (perhaps we just noticed that Alice's balance went negative), we can issue the command ROLLBACK instead of COMMIT, and all our updates so far will be canceled.

Citation occurrences in order: [1]

Your labels — R09:

F: 1
C: 1
Citation support: yes
Substantive claims: yes
Refusal behavior: not_a_refusal
Reason: Excerpt [1] directly supports the statement that transactions are surrounded by BEGIN and COMMIT commands.

---

## R10

Question: Which commands surround an explicit PostgreSQL transaction?

Answer to assess (unchanged):

> BEGIN starts the transaction and COMMIT ends it. [2]

Reference answer: BEGIN starts the transaction and COMMIT ends it.

Reference evidence: excerpts [1] and [2] below.
### Retrieved excerpt [1]

Source: postgresql.tutorial-transactions; saved lines 15–15.

> In PostgreSQL, a transaction is set up by surrounding the SQL commands of the transaction with BEGIN and COMMIT commands. So our banking transaction would actually look like:

### Retrieved excerpt [2]

Source: postgresql.tutorial-transactions; saved lines 21–21.

> If, partway through the transaction, we decide we do not want to commit (perhaps we just noticed that Alice's balance went negative), we can issue the command ROLLBACK instead of COMMIT, and all our updates so far will be canceled.

Citation occurrences in order: [2]

Your labels — R10:

F: 1
C: 1
Citation support: no
Substantive claims: yes
Refusal behavior: not_a_refusal
Reason: The answer is supported by excerpt [1], but citation [2] is incorrect because excerpt [2] only discusses ROLLBACK.

---

## R11

Question: Which commands surround an explicit PostgreSQL transaction?

Answer to assess (unchanged):

> I could not find this in the document.

Reference answer: BEGIN starts the transaction and COMMIT ends it.

Reference evidence: excerpts [1] and [2] below.
### Retrieved excerpt [1]

Source: postgresql.tutorial-transactions; saved lines 15–15.

> In PostgreSQL, a transaction is set up by surrounding the SQL commands of the transaction with BEGIN and COMMIT commands. So our banking transaction would actually look like:

### Retrieved excerpt [2]

Source: postgresql.tutorial-transactions; saved lines 21–21.

> If, partway through the transaction, we decide we do not want to commit (perhaps we just noticed that Alice's balance went negative), we can issue the command ROLLBACK instead of COMMIT, and all our updates so far will be canceled.

Citation occurrences in order: (no bracketed citations present)

Your labels — R11:

F: 0
C: 0
Citation support: none
Substantive claims: no
Refusal behavior: inappropriate
Reason: The model refuses to answer even though excerpt [1] explicitly states BEGIN and COMMIT surround transactions.

---

## R12

Question: When item_id is declared as int, what type and value does /items/3 produce?

Answer to assess (unchanged):

> It produces the Python integer 3.

Reference answer: It produces the Python integer 3.

Reference evidence: excerpts [1] and [2] below.
### Retrieved excerpt [1]

Source: fastapi.path-params; saved lines 24–28.

> If you run this example and open your browser at http://127.0.0.1:8000/items/3, you will see a response of:
> {"item_id":3}
> Tip
> Notice that the value your function received (and returned) is 3, as a Python int, not a string "3".
> So, with that type declaration, FastAPI gives you automatic request "parsing".

### Retrieved excerpt [2]

Source: fastapi.path-params; saved lines 47–47.

> So, with the same Python type declaration, FastAPI gives you data validation.

Citation occurrences in order: (no bracketed citations present)

Your labels — R12:

F: 1
C: 1
Citation support: none
Substantive claims: yes
Refusal behavior: not_a_refusal
Reason: The statement is completely accurate and supported by excerpt [1], with no citations provided.

---

## R13

Question: Which commands surround an explicit PostgreSQL transaction?

Answer to assess (unchanged):

> BEGIN starts the transaction. [1]

Reference answer: BEGIN starts the transaction and COMMIT ends it.

Reference evidence: excerpts [1] and [2] below.
### Retrieved excerpt [1]

Source: postgresql.tutorial-transactions; saved lines 15–15.

> In PostgreSQL, a transaction is set up by surrounding the SQL commands of the transaction with BEGIN and COMMIT commands. So our banking transaction would actually look like:

### Retrieved excerpt [2]

Source: postgresql.tutorial-transactions; saved lines 21–21.

> If, partway through the transaction, we decide we do not want to commit (perhaps we just noticed that Alice's balance went negative), we can issue the command ROLLBACK instead of COMMIT, and all our updates so far will be canceled.

Citation occurrences in order: [1]

Your labels — R13:

F: 1
C: 0.5
Citation support: yes
Substantive claims: yes
Refusal behavior: not_a_refusal
Reason: The claim about BEGIN is supported by excerpt [1], but the answer is materially incomplete because it omits COMMIT.

---

## R14

Question: When item_id is declared as int, what type and value does /items/3 produce?

Answer to assess (unchanged):

> It produces an integer. [1]

Reference answer: It produces the Python integer 3.

Reference evidence: excerpts [1] and [2] below.
### Retrieved excerpt [1]

Source: fastapi.path-params; saved lines 24–28.

> If you run this example and open your browser at http://127.0.0.1:8000/items/3, you will see a response of:
> {"item_id":3}
> Tip
> Notice that the value your function received (and returned) is 3, as a Python int, not a string "3".
> So, with that type declaration, FastAPI gives you automatic request "parsing".

### Retrieved excerpt [2]

Source: fastapi.path-params; saved lines 47–47.

> So, with the same Python type declaration, FastAPI gives you data validation.

Citation occurrences in order: [1]

Your labels — R14:

F: 1
C: 0.5
Citation support: yes
Substantive claims: yes
Refusal behavior: not_a_refusal
Reason: The answer correctly identifies the type per excerpt [1] but omits the requested value 3, making it materially incomplete.

---
