# Start your independent calibration review here

Open HUMAN_REVIEW.md in this folder. It contains all 14 questions, the exact saved
calibration answers, numbered source excerpts, reference answers, and blank fields.
The examples are controlled test fixtures, not claimed to be Qwen-generated answers.
No knowledge of machine learning is required: compare each answer with its evidence.

In TextEdit, choose File > Open, press Cmd+Shift+G, and enter:
/Users/abhisheshramadasshet/Documents/ChatGPT/DocRAG/RAG-Agent/eval/calibration/HUMAN_REVIEW.md
Then click Open. Alternatively, click the HUMAN_REVIEW.md link in this chat.

1. Read the short scoring instructions at the top.
2. For R01 through R14, replace the six blank fields with your own decisions:
   F (faithfulness), C (correctness), citation support, substantive claims,
   refusal behavior and a short reason. Allowed values are explained in the file.
3. Fill in reviewer name, date and whether you previously saw suggested labels.
4. Save with Cmd+S, then reply "Review file saved". The assistant will validate
   your entries and ask about unfinished or ambiguous entries before recording review.

You can stop partway and save. Leave unfinished fields blank or write `unsure`;
that preserves progress without treating uncertainty as approval. You may instead
send your decisions in chat, using R01–R14 and the same field names. Do not merely
say you agree with the plan; the actual case decisions are needed.

Do not open the old REVIEW.md, cases.json, review-packet-map.json or previous
calibration results before recording your labels: they reveal proposed judgments.
The former version of this guide revealed proposals too. If you already saw any,
mark the exposure field honestly; a new file cannot erase that exposure.

Common problems:
- File appears read-only: open it in TextEdit using the exact path above; if macOS
  reports a permission error, tell the assistant the message. Do not create a second
  file with a different name without saying so.
- Unsure about a score: write `unsure` and a short question in Reason. Do not guess.
- No citations: type `none` in Citation support. Do not invent a yes/no occurrence.
- Saving offers .txt or rich text: keep the existing .md filename and plain text.

Success means your own six fields are saved for every case and no question or
evidence text changed. This file check is not automatic approval of the judge.
The existing 100-question golden-dataset review remains valid and need not be repeated.
