# Basira — background-specific Q&A collection

**Delivered counts:** Hinduism 93, Christianity 94, atheism 85, Judaism 70 — **342 total**, with both supplied resources represented for each background. All records passed schema and export-consistency checks.

Four independent bilingual datasets for **simulated** dialogue partners:

| Background | JSON | Arabic review copy |
| --- | --- | --- |
| Hinduism / الهندوسية | [hinduism.json](hinduism.json) | [hinduism.md](hinduism.md) |
| Christianity / المسيحية | [christianity.json](christianity.json) | [christianity.md](christianity.md) |
| Atheism / الإلحاد | [atheism.json](atheism.json) | [atheism.md](atheism.md) |
| Judaism / اليهودية | [judaism.json](judaism.json) | [judaism.md](judaism.md) |

The source books present their authors' arguments. Answers are reference-grounded training material, not neutral descriptions of all adherents, a judgment of a real user's beliefs, religious approval, or a substitute for specialist review. `humanReviewed` remains false. Image-derived evidence is transcribed by OpenAI vision and can contain errors even after model review.

## What each record contains

- Stable `id`, `tradition`, and source-derived `topic`.
- `question.ar` / `.en`: a concise natural question for one fictional interlocutor.
- `answer.ar` / `.en`: a concise reference response with relevant qualifications and attribution.
- `points`: 2–5 bilingual criteria for evaluating the trainee's actual answer; omissions are not contradictions.
- `source`: stable source ID, original URL, title, author, and original-file SHA-256.
- `evidence`: supporting passages with actual PDF page, paragraph, or Markdown line locators.
- `evidenceMethod`: exact local text, unverified vision transcription, or recorded assistant visual source check. This is not a specialist-review label.
- `extraction`: the original Arabic pair before conversational reformatting.
- `modelReview`: the model's support assessment; distinguish this from human approval.
- `persona`: explicitly simulated, with the chosen background. Never infer a user's religion from face, voice, name, or responses.

[status.json](status.json) records the final exported counts, per-background source coverage, exclusions, and whether the 50–100 target is met. Read this file rather than raw extraction counts. JSONL copies support streaming or later ingestion into a vector store. No embeddings or production RAG have been created by this export.

## Application integration and later reuse

The existing sourced-practice screen now reads these collections directly, with grounded AI follow-ups, saved discussions and reference-based assessment. See [implementation and tests](../../../docs/REFERENCE-DIALOGUE.md). Human review remains pending; no embeddings or RAG are used.

For direct practice, choose the background explicitly, select a record by ID, give the avatar only the chosen question, and resolve the canonical reference answer/criteria server-side for assessment. The practice UI also receives a copy for optional reveal and saved offline review; it is not an exam-security boundary. Preserve that same ID and criteria when retrying. Do not let an avatar imply it is a real person or a representative of an entire faith.

For retrieval, index question, answer, topic and source passages while retaining stable IDs and provenance. Filter by background before retrieval. Never present similarity scores as evidence of factual truth.

The generated `qa.sqlite` contains `questions` and FTS5 `question_search` tables. It is ignored by Git because JSON/JSONL are the portable sources. The exporter uses the tracked draft records and [deduplication.json](deduplication.json) audit snapshot; regeneration without `.local` extraction caches was tested and produced identical datasets. Rebuild it with:

```bash
npm run sources:qa:export
```

Example parameterized database queries:

```sql
SELECT record_json FROM questions WHERE background = ? AND id = ?;
SELECT id, background FROM question_search
WHERE question_search MATCH ? AND background = ?
ORDER BY bm25(question_search) LIMIT 5;
```

## Generation and acceptance

Extraction reads real local source windows and rendered PDF pages through OpenAI; it uses no OCR engine. Text evidence is recovered directly from the cited paragraph. Vision quotation fragments remain individually attributed to a page; fragments are not presented as a single contiguous quotation. Reformatting checks answer support and produces bilingual questions and criteria. A separate question-only persona review checks the speaker/addressee roles. A semantic duplicate audit excludes repeated questions with the same reasoning. The record schema is [question.schema.json](question.schema.json).

The exported set remains **model-reviewed, human-review-pending**. Nothing here replaces `data/training/questions.json` automatically. Before production use, a knowledgeable reviewer should check source fidelity, contested interpretations, translations, question suitability and pronunciation. Refer to the linked Arabic copies and original page locators.

## Reproducible generation commands

These commands make paid model requests except the final export. Extraction resumes existing checkpoints and is not a fresh full-book scan.

```bash
QA_TARGET=100 OPENAI_QA_MODEL=gpt-4.1 npm run sources:qa:extract
QA_TARGET=100 OPENAI_QA_MODEL=gpt-4.1 npm run sources:qa:format
OPENAI_QA_MODEL=gpt-4.1 npm run sources:qa:persona-review
OPENAI_QA_MODEL=gpt-4.1 npm run sources:qa:deduplicate
npm run sources:qa:export
```

Do not run writers concurrently against the same background files. API rate-limit retries are bounded; progress is checkpointed. Review failures must not be converted into approvals just to meet a numerical target. The local SQLite file is rebuildable from these tracked JSON datasets and ignored by Git.
