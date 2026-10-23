# Local judge calibration — HUMAN REVIEW REQUIRED

These 14 proposed examples are separate from the unchanged 100 golden questions. Labels below are AI-drafted proposals, not independently established human labels until you review and confirm/correct them. No judge results have been measured.

Score faithfulness using ONLY the numbered excerpts: 1 supported, 0.5 partly supported, 0 unsupported; refusal scores 1 only when excerpts lack the answer. Score correctness against the reference: 1 complete, 0.5 partial, 0 wrong/refusal despite answerability. A correct answer with a wrong citation can still be faithful to another excerpt, but its citation support is false. Missing citations incur the existing aggregate penalty, not an automatic faithfulness penalty.

Acceptance fixed before measurement: at least 90% exact faithfulness and correctness agreement, 95% citation agreement, 90% substantive-claims agreement; every unsupported/wrong-citation/incorrect-refusal/proper-refusal case must match all labels.

Review each question, answer, excerpt and proposed label below. Reply confirming all 14 or give IDs and corrections. Your earlier review of the 100 golden questions is preserved.


## fastapi-correct

Question: When item_id is declared as int, what type and value does /items/3 produce?

Reference: It produces the Python integer 3.

Answer to score: It produces the Python integer 3. [1]

Excerpt [1] (fastapi.path-params): If you run this example and open your browser at http://127.0.0.1:8000/items/3, you will see a response of:
{"item_id":3}
Tip
Notice that the value your function received (and returned) is 3, as a Python int, not a string "3".
So, with that type declaration, FastAPI gives you automatic request "parsing".

Excerpt [2] (fastapi.path-params): Request parameters are validated.

Proposed labels: {"faithfulness": 1, "correctness": 1, "citation_support": [true], "substantive_claims": true}


## fastapi-unsupported

Question: When item_id is declared as int, what type and value does /items/3 produce?

Reference: It produces the Python integer 3.

Answer to score: It produces the string "three". [1]

Excerpt [1] (fastapi.path-params): If you run this example and open your browser at http://127.0.0.1:8000/items/3, you will see a response of:
{"item_id":3}
Tip
Notice that the value your function received (and returned) is 3, as a Python int, not a string "3".
So, with that type declaration, FastAPI gives you automatic request "parsing".

Excerpt [2] (fastapi.path-params): Request parameters are validated.

Proposed labels: {"faithfulness": 0, "correctness": 0, "citation_support": [false], "substantive_claims": true}


## fastapi-wrong_citation

Question: When item_id is declared as int, what type and value does /items/3 produce?

Reference: It produces the Python integer 3.

Answer to score: It produces the Python integer 3. [2]

Excerpt [1] (fastapi.path-params): If you run this example and open your browser at http://127.0.0.1:8000/items/3, you will see a response of:
{"item_id":3}
Tip
Notice that the value your function received (and returned) is 3, as a Python int, not a string "3".
So, with that type declaration, FastAPI gives you automatic request "parsing".

Excerpt [2] (fastapi.path-params): Request parameters are validated.

Proposed labels: {"faithfulness": 1, "correctness": 1, "citation_support": [false], "substantive_claims": true}


## fastapi-missing_citation

Question: When item_id is declared as int, what type and value does /items/3 produce?

Reference: It produces the Python integer 3.

Answer to score: It produces the Python integer 3.

Excerpt [1] (fastapi.path-params): If you run this example and open your browser at http://127.0.0.1:8000/items/3, you will see a response of:
{"item_id":3}
Tip
Notice that the value your function received (and returned) is 3, as a Python int, not a string "3".
So, with that type declaration, FastAPI gives you automatic request "parsing".

Excerpt [2] (fastapi.path-params): Request parameters are validated.

Proposed labels: {"faithfulness": 1, "correctness": 1, "citation_support": [], "substantive_claims": true}


## fastapi-incorrect_refusal

Question: When item_id is declared as int, what type and value does /items/3 produce?

Reference: It produces the Python integer 3.

Answer to score: I could not find this in the document.

Excerpt [1] (fastapi.path-params): If you run this example and open your browser at http://127.0.0.1:8000/items/3, you will see a response of:
{"item_id":3}
Tip
Notice that the value your function received (and returned) is 3, as a Python int, not a string "3".
So, with that type declaration, FastAPI gives you automatic request "parsing".

Excerpt [2] (fastapi.path-params): Request parameters are validated.

Proposed labels: {"faithfulness": 0, "correctness": 0, "citation_support": [], "substantive_claims": false}


## fastapi-proper_refusal

Question: Which JWT signing algorithm is configured?

Reference: The excerpts do not provide this information.

Answer to score: I could not find this in the document.

Excerpt [1] (fastapi.path-params): If you run this example and open your browser at http://127.0.0.1:8000/items/3, you will see a response of:
{"item_id":3}
Tip
Notice that the value your function received (and returned) is 3, as a Python int, not a string "3".
So, with that type declaration, FastAPI gives you automatic request "parsing".

Excerpt [2] (fastapi.path-params): Request parameters are validated.

Proposed labels: {"faithfulness": 1, "correctness": 1, "citation_support": [], "substantive_claims": false}


## fastapi-partially_correct

Question: When item_id is declared as int, what type and value does /items/3 produce?

Reference: It produces the Python integer 3.

Answer to score: It produces an integer. [1]

Excerpt [1] (fastapi.path-params): If you run this example and open your browser at http://127.0.0.1:8000/items/3, you will see a response of:
{"item_id":3}
Tip
Notice that the value your function received (and returned) is 3, as a Python int, not a string "3".
So, with that type declaration, FastAPI gives you automatic request "parsing".

Excerpt [2] (fastapi.path-params): Request parameters are validated.

Proposed labels: {"faithfulness": 1, "correctness": 0.5, "citation_support": [true], "substantive_claims": true}


## postgresql-correct

Question: Which commands surround an explicit PostgreSQL transaction?

Reference: BEGIN starts the transaction and COMMIT ends it.

Answer to score: BEGIN starts the transaction and COMMIT ends it. [1]

Excerpt [1] (postgresql.tutorial-transactions): In PostgreSQL, a transaction is set up by surrounding the SQL commands of the transaction with BEGIN and COMMIT commands. So our banking transaction would actually look like:

Excerpt [2] (postgresql.tutorial-transactions): If, partway through the transaction, we decide we do not want to commit (perhaps we just noticed that Alice's balance went negative), we can issue the command ROLLBACK instead of COMMIT, and all our updates so far will be canceled.

Proposed labels: {"faithfulness": 1, "correctness": 1, "citation_support": [true], "substantive_claims": true}


## postgresql-unsupported

Question: Which commands surround an explicit PostgreSQL transaction?

Reference: BEGIN starts the transaction and COMMIT ends it.

Answer to score: START TRANSACTIONAL starts it and SAVE ends it. [1]

Excerpt [1] (postgresql.tutorial-transactions): In PostgreSQL, a transaction is set up by surrounding the SQL commands of the transaction with BEGIN and COMMIT commands. So our banking transaction would actually look like:

Excerpt [2] (postgresql.tutorial-transactions): If, partway through the transaction, we decide we do not want to commit (perhaps we just noticed that Alice's balance went negative), we can issue the command ROLLBACK instead of COMMIT, and all our updates so far will be canceled.

Proposed labels: {"faithfulness": 0, "correctness": 0, "citation_support": [false], "substantive_claims": true}


## postgresql-wrong_citation

Question: Which commands surround an explicit PostgreSQL transaction?

Reference: BEGIN starts the transaction and COMMIT ends it.

Answer to score: BEGIN starts the transaction and COMMIT ends it. [2]

Excerpt [1] (postgresql.tutorial-transactions): In PostgreSQL, a transaction is set up by surrounding the SQL commands of the transaction with BEGIN and COMMIT commands. So our banking transaction would actually look like:

Excerpt [2] (postgresql.tutorial-transactions): If, partway through the transaction, we decide we do not want to commit (perhaps we just noticed that Alice's balance went negative), we can issue the command ROLLBACK instead of COMMIT, and all our updates so far will be canceled.

Proposed labels: {"faithfulness": 1, "correctness": 1, "citation_support": [false], "substantive_claims": true}


## postgresql-missing_citation

Question: Which commands surround an explicit PostgreSQL transaction?

Reference: BEGIN starts the transaction and COMMIT ends it.

Answer to score: BEGIN starts the transaction and COMMIT ends it.

Excerpt [1] (postgresql.tutorial-transactions): In PostgreSQL, a transaction is set up by surrounding the SQL commands of the transaction with BEGIN and COMMIT commands. So our banking transaction would actually look like:

Excerpt [2] (postgresql.tutorial-transactions): If, partway through the transaction, we decide we do not want to commit (perhaps we just noticed that Alice's balance went negative), we can issue the command ROLLBACK instead of COMMIT, and all our updates so far will be canceled.

Proposed labels: {"faithfulness": 1, "correctness": 1, "citation_support": [], "substantive_claims": true}


## postgresql-incorrect_refusal

Question: Which commands surround an explicit PostgreSQL transaction?

Reference: BEGIN starts the transaction and COMMIT ends it.

Answer to score: I could not find this in the document.

Excerpt [1] (postgresql.tutorial-transactions): In PostgreSQL, a transaction is set up by surrounding the SQL commands of the transaction with BEGIN and COMMIT commands. So our banking transaction would actually look like:

Excerpt [2] (postgresql.tutorial-transactions): If, partway through the transaction, we decide we do not want to commit (perhaps we just noticed that Alice's balance went negative), we can issue the command ROLLBACK instead of COMMIT, and all our updates so far will be canceled.

Proposed labels: {"faithfulness": 0, "correctness": 0, "citation_support": [], "substantive_claims": false}


## postgresql-proper_refusal

Question: Which backup retention period does this page prescribe?

Reference: The excerpts do not provide this information.

Answer to score: I could not find this in the document.

Excerpt [1] (postgresql.tutorial-transactions): In PostgreSQL, a transaction is set up by surrounding the SQL commands of the transaction with BEGIN and COMMIT commands. So our banking transaction would actually look like:

Excerpt [2] (postgresql.tutorial-transactions): If, partway through the transaction, we decide we do not want to commit (perhaps we just noticed that Alice's balance went negative), we can issue the command ROLLBACK instead of COMMIT, and all our updates so far will be canceled.

Proposed labels: {"faithfulness": 1, "correctness": 1, "citation_support": [], "substantive_claims": false}


## postgresql-partially_correct

Question: Which commands surround an explicit PostgreSQL transaction?

Reference: BEGIN starts the transaction and COMMIT ends it.

Answer to score: BEGIN starts the transaction. [1]

Excerpt [1] (postgresql.tutorial-transactions): In PostgreSQL, a transaction is set up by surrounding the SQL commands of the transaction with BEGIN and COMMIT commands. So our banking transaction would actually look like:

Excerpt [2] (postgresql.tutorial-transactions): If, partway through the transaction, we decide we do not want to commit (perhaps we just noticed that Alice's balance went negative), we can issue the command ROLLBACK instead of COMMIT, and all our updates so far will be canceled.

Proposed labels: {"faithfulness": 1, "correctness": 0.5, "citation_support": [true], "substantive_claims": true}
