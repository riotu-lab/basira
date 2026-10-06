# Training entry

The current implementation uses one source-guided session in the meeting interface. Choose a background and session language, then use text, recorded speech or the configured Tavus FULL call. The custom-LLM gateway controls the questions and assessment; Tavus handles direct speech and video. There is no independent Tavus conversation model selecting questions in this route.

Hosted callback deployment and real Tavus gateway acceptance are still pending; see [STATUS.md](STATUS.md). Older local practice records remain available through “Open earlier practice records.” The legacy route is retained for those records and content-review practice prompts.

# Sourced dialogue training — implementation and verification

Implemented locally on 4 October 2026. This workflow selects database records directly; it does not use embeddings, a vector database or RAG.

## Try it

Run `npm run dev` and open the URL printed by the server. Choose a background and session language in training, then begin the conversation. Text and review work without an avatar account. A dedicated source-guided FULL PAL and publicly reachable backend are required for direct avatar speech; the generic FULL PAL is never silently substituted.

The detailed legacy controls below describe archived reference practice. In the unified meeting, each answer triggers the same follow-up/assessment engine automatically. “End discussion and review” shows assessed questions; selecting a finding retries the original question against unchanged criteria. Hosted sessions use Redis and private browser-held resume capabilities; recordings are not stored in those sessions.

1. Answer the selected question by typing or using the existing record-and-transcribe control. The existing avatar can speak the question and follow-ups when configured.
2. Choose **Continue discussion / تابع المناقشة** for an AI follow-up. It receives the latest answer, the full current question/answer history, the selected reference answer, its fixed criteria, and supporting evidence.
3. Choose **Compare my answer with the reference / قيّم إجابتي بالمرجع** whenever there is an answer to review. The review covers the learner’s answers across this attempt, including follow-up answers.
4. Open **Assessment reference and discussion** to inspect the source passage and transcript.
5. Retry the same question. The original attempt stays intact; comparison displays both attempts against the same criteria. It does not assume the retry improved.
6. Reopen or delete the saved practice from **Saved reference practice**. Storage is local to this browser, not account-synchronized.

The bank includes the 342 newly generated records (93 Hinduism, 94 Christianity, 85 atheism, 70 Judaism), plus the two existing source-checked starter questions. Generated records retain `draft_requires_human_review`; enabling practice does not grant specialist approval. Authors’ reference positions are not universal judgments about religions or individuals.

## Data and evidence

- `server/referencePractice.ts` reads the four JSON collections plus the starter bank. No retrieval service or secondary voice pipeline was added.
- The server resolves each reference by question ID. It never accepts a client-provided “correct answer” as the assessment reference.
- `referenceVersion` hashes the selected record. A saved version that differs from the server’s current version returns `reference_changed`; an old attempt is not silently reassessed with changed criteria. Legacy pre-version starter records remain readable.
- Every follow-up has existing criterion IDs. Unknown IDs, empty follow-up questions and contradictory completion metadata are rejected. The model can finish the discussion instead of inventing another question. There is a maximum of 12 learner answers per attempt to bound request context.
- Follow-ups must stay within the selected reference, avoid repeated questions and stereotypes, and respond to actual dialogue. The model sees source/transcript text as untrusted data. Semantic grounding is instructed and model-dependent; criterion-ID validation is not proof that every generated sentence is correct.
- Assessment uses the same reference answer and all original criteria. Omissions differ from contradictions. Exact learner quotations are checked and linked to learner turn IDs; assistant hints cannot count as learner evidence. Quotes cannot span two turns.
- Saved records contain the reference answer, criteria, source metadata, evidence, reference version, transcript and assessed attempts. This makes later discussion review reproducible. The reference is hidden in the interface until requested but is not an exam-security secret: the browser receives it for reveal and offline review.
- Pending answers are saved before follow-up/review requests. A failed request can be retried without losing or resending a duplicate learner turn. Unsubmitted textarea drafts are not autosaved.
- Retries use a fresh discussion history while retaining the original attempt and source snapshot. Prior attempts are not mixed into a new attempt’s evidence.
- Displayed text is available throughout the discussion. Audio delivery does not establish what someone actually heard; these reviews do not score listening or claim exact audio receipt.
- No API keys or provider credentials are saved in browser storage.

## Verification

- `npm test`: 218 tests passed (mocked/offline application and model-transport checks). New coverage includes all dataset counts, reference-version mismatch, invalid transcript/criterion IDs, grounding context supplied to the model, exact quote-to-turn binding, failure recovery, original/retry preservation, and Arabic/English UI behavior.
- `npm run build`: passed. Existing dependency bundler warnings remain non-blocking.
- `npx playwright test tests/browser/reference-dialogue.spec.ts`: four real Chromium browser tests passed, Arabic/English on desktop/mobile. Model replies are explicitly mocked in these tests; question data and the UI use the running application. Tests cover selection, follow-up, assessment, retry, reload, deletion, RTL and horizontal overflow. Screenshots are under `artifacts/screenshots/reference-discussion-*`.
- `node scripts/checks/reference-dialogue-live.mjs`: real model HTTP calls passed for follow-ups in all four backgrounds. Arabic/English review and retry passed with synthetic learner answers and stable criterion IDs. The retry intentionally used the reference answer to verify the assessment plumbing; it is not evidence of human improvement. Detailed local results: `artifacts/reports/reference-dialogue-live.json`.
- **Two real model browser checks passed**, Arabic and English on desktop, from background selection through follow-up, assessment, targeted retry and criterion-by-criterion comparison. Screenshots were visually inspected alongside the Arabic/English desktop/mobile fixture screenshots. Rerun the opt-in check with: `BASIRA_LIVE_CHECK=1 npx playwright test tests/browser/reference-live.spec.ts --project=desktop --workers=1`. It uses synthetic learner answers and never starts an avatar session.

## Remaining acceptance work

- Specialist review of generated records and vision-transcribed supporting passages is still pending.
- An actual human should check question suitability, nuanced follow-up behavior, translations, and pronunciation.
- Voice/avatar playback code is reused; this change does not claim a new live microphone, lip-sync or interruption verification.
- No deployment was performed as part of this change.


## Review completion — 5 October 2026

The sourced discussion review now has a dedicated `ReferenceReview` component:

- Select a criterion to see the learner’s exact answer quote, the preceding question when a turn ID is available, and the model’s explanation.
- Inspect the expected database point, reference answer, original source URL and source passages with their locators. Passages are explicitly presented as evidence for the whole question, not falsely as independently verified support for each criterion.
- Launch **Practise this point / تدرّب على هذه النقطة**. The original question and complete criteria stay fixed; the selected point is saved on the retry and supplied to follow-up generation as a focus. No reference answer is replaced by generated follow-up content.
- Compare any saved retry with the original, criterion by criterion. The comparison uses stored classifications and exact quotes, without a new model judgment or an assumed improvement. A missing point after a contradiction means “not repeated, still not explained,” not automatically “correct.”
- Unanswered final follow-ups are preserved in the saved transcript but excluded from the assessment input’s completed answer pairs.
- Arabic/English layouts use two evidence columns on desktop and a single column on mobile. The review receives keyboard focus after completion; targeted retry focuses the answer field.

Validation: production build and 218 automated tests passed; four real-browser Arabic/English desktop/mobile fixture journeys passed; two real-model desktop journeys passed including review, targeted retry, comparison, unchanged original attempts and identical criterion IDs. Live tests use synthetic answers and deliberately use the stored answer for the retry; they are not evidence of human improvement. Review screenshots: `artifacts/screenshots/reference-review-*` (mocked responses), `reference-live-*` (live responses).

Specialist dataset review, live avatar/microphone acceptance and deployment remain separate. No religious approval is claimed.

## Session-event messages — 5 October 2026

Shared Arabic/English copy in `src/sessionMessages.ts` now covers the final 30-second avatar warning, five-minute limit, and 150-second inactivity shutdown. General dialogue and sourced practice explain text continuation/review; direct video calls offer transcript review without promising an unavailable in-call text continuation. Sourced-practice inactivity is a neutral status rather than a connection error. Messages follow the interface language, which remains separate from the session language. Existing provider errors distinguish unavailable credits, concurrency, rate limiting and connectivity. Removed stale two-minute waiting advice from the active-session error. Build and 218 automated tests passed; no live avatar minutes were consumed for this copy/state update. This change does not add a pre-inactivity countdown.

## Automatic multi-question progression (5 October 2026)

When the follow-up model returns `readyForReview`, the app now assesses the completed question against that question's canonical reference, saves its transcript and assessment, then automatically asks the next unasked question from the same background. The signal means no useful grounded follow-up remains; it is not a claim that the learner answered correctly. Questions are selected in stable catalog order. No retrieval or generated replacement is used for the next question.

Each question retains an independent source snapshot, version, transcript and original/retry attempts. Records share a session ID and retain asked-question IDs. Completed questions can be reviewed from “Questions in this session,” and pending discussions can be resumed. Drafts and session linkage survive reload through saved records. Deletion is still available; retained records' asked IDs prevent a deleted earlier question from being immediately selected again within that session.

Assessment failures leave the current answer available for recovery; progression waits for successful assessment and local persistence. Exhaustion displays a bilingual completion message and stops the avatar. Explicit “End discussion and review” assesses the current answers and stops the avatar. Targeted retries stay on their original question and do not trigger automatic progression. Starting a new session resets the session boundary and permits previously asked questions again. Normal transitions preserve the avatar connection and its existing total-time/inactivity guards.

Validation: 230 automated tests passed, including Arabic/English advancement, background isolation, reload with draft, exhaustion, retry isolation, original-attempt preservation and failed-assessment recovery. Browser progression fixtures test the actual UI using real catalog entries with mocked AI completion/assessment signals; they do not establish live-model grounding quality.

### Follow-up grounding gate (implemented 5 October 2026)

RAG is not used: each proposed follow-up is checked against the selected canonical reference. After generating a candidate, a separate model request reviews its answerability, selected-criterion relevance, factual premises and supporting source excerpts. It receives the candidate and conversation as untrusted data, not the generator's reasoning. It cannot rewrite the question or add criteria.

An accepted candidate must include one binding per selected criterion by selecting server-supplied verbatim answer passages and source excerpts using their IDs. The server validates passage IDs, criterion IDs, evidence IDs, and complete/nonduplicated coverage. Exact quotations come from canonical server text, not model transcription. Candidates explicitly judged unsupported return empty text and `readyForReview=true`, activating the existing assessment-and-next-question flow; rejected wording is never sent to playback or saved as a learner-facing question. A malformed checker response or provider outage returns an error, preserves the learner's answer and permits recovery. If the generator proposes no follow-up, no checker call is necessary.

The existing audit operation stores both raw calls, candidate, checker rationale/bindings, the supplied verbatim passage/ID mappings and final output. The learner-facing response includes only the final question or completion signal and a `grounding` status (`model_checked`, `unsupported`, `not_needed`); it does not leak reference answers. Rejection does not mean the learner was wrong or the broader claim is false.

This costs one extra model call for each proposed follow-up and adds latency. It is a separate check using the configured model, not an independent religious authority or a mathematical proof of semantic correctness. Source-dataset specialist review remains necessary. Retrieval is useful only if we deliberately expand the supported topic beyond this reference.

Deployed to https://basiraapp.vercel.app (`basira-o1sotwvk1-sultan12100s-projects.vercel.app`). Post-deployment: four progression browser checks with mocked AI and four real-model discussion/review/retry browser journeys passed across Arabic/English, desktop/mobile (8 total). No avatar minutes used in these checks. Progression completion signals were deliberately controlled in the progression checks; live-model tests cover the continuing discussion and review/retry paths.

Grounding gate deployed: `basira-hjs32oemd-sultan12100s-projects.vercel.app`, production alias unchanged. 244 tests/build passed. Six local live/mixed checks passed; production Arabic/English two-call follow-ups were verified in Redis. Hosted browser result: 7/8 initially passed, with one existing assessment exact-quote rejection on English mobile retry; that journey passed on standalone rerun. See `STATUS.md` for the preserved failure evidence and remaining assessment limitation.

## Assessment evidence by passage ID (5 October 2026)

Reference assessment still compares the meaning of actual learner answers against the canonical reference answer, evidence and original criteria. It does not require copying the source's wording. The model receives the complete discussion for attribution, negation, uncertainty and self-correction, plus a server-generated catalog of learner-only passages.

The model returns passage IDs instead of composing `answerQuote`. For each covered/contradicted point it selects one to six passages; missing points select none. The server resolves IDs to original text, originating turn and character offsets. Sentence/clause segmentation preserves exact strings and keeps surrounding context in the full transcript. A passage can support several criteria, but duplicate IDs within one finding, invented IDs, missing evidence, and evidence attached to an omission are rejected. Assistant questions/hints are never selectable learner passages.

The API keeps `answerQuote`/`turnId` as the primary selection for compatibility and adds `evidence[]` containing every resolved passage. Review and comparison display these separately; they never join noncontiguous passages into one purported quotation. Older saved records still render their existing single quote.

This prevents model paraphrases from being presented as exact learner quotations. It does not prove that a selected passage supports the model's interpretation: semantic relevance and reference fidelity still require evaluation. Model explanation text remains generated prose, visually separate from evidence quotes. No additional provider call is required for this assessment change.

## Answer quality, communication and language (5 October 2026)

Sourced training now returns an independent `quality` object (rubric version 1) alongside reference findings. Reference alignment/completeness still uses the stored reference points and determines the reference verdict. Eight separate text-quality criteria assess relevance, clarity, organization, concision, respect, responsiveness, grammar and word choice. Good expression cannot cancel a reference contradiction; imperfect grammar cannot invalidate a semantically correct answer.

Every criterion returns effective, needs attention, insufficient evidence, or (language only) possible transcription issue. Non-insufficient findings require server-resolved learner evidence. Concerns require an actionable suggestion, labeled separately from original quotations. The prompt respects dialects/legitimate varieties, does not demand formal Arabic or diacritics, and excludes quoted scripture from learner grammar correction. Short answers can have insufficient evidence without manufactured faults or praise.

User turns retain typed/transcribed/corrected-transcript provenance; old/direct inputs default to unknown. Unknown/raw-transcript grammar or word-choice concerns cannot become confirmed speaker errors: the server downgrades them and substitutes a neutral transcript-verification explanation. Correction provenance describes editing, not a guarantee transcription is perfect. Acoustic features are never inferred: `spokenDelivery` is fixed to `not_assessed`, with a bilingual explanation in the review. Audio pronunciation, pace, intonation and delivery analysis are not implemented by this text rubric.

The bilingual review groups findings into content relevance, communication and language. Quality-focused retries retain the original source criteria and all eight quality criteria, persist `focusQualityId`, and compare original/current classifications without automatically claiming improvement. Quality focus guides the learner via the UI; the interlocutor's follow-up grounding remains tied to the source criteria. Old records remain readable and explicitly lack these new findings. General everyday-dialogue coaching retains its existing understanding/respect rubric; this richer rubric applies to sourced practice.

This is one assessment request with a larger structured response, not an additional model call. AI audits retain the rubric, provenance, model classifications/suggestions and server-resolved evidence. Technical grounding cannot prove stylistic or linguistic judgments correct; human review remains necessary.

## Local recording observations (5 October 2026)

Recorded sourced-training answers now carry optional browser-computed duration, approximate transcript-based rate and low-volume interval measurements. Review supports temporary playback/seeking and descriptive original/retry comparisons. Audio is kept only in page memory (ten-clip cap); saved drafts/attempts contain measurements, not recordings. Editing a transcript disables transcript-dependent rate/filler observations. No extra model/provider call is made, and server-validated model histories exclude these local measurements. This does not change the text assessor's `spokenDelivery=not_assessed` field: recording heuristics are a separate UI component, not pronunciation/intonation assessment. See [SPOKEN-DELIVERY.md](SPOKEN-DELIVERY.md) for measurement thresholds, privacy and test limits.

## Meeting transport and reconnect (5 October 2026)

The default FULL meeting supports typed messages alongside microphone/camera, confirmed stop before text continuation, and reconnect with bounded recent history (20 turns, 800 characters per turn). Playback uncertainty survives that handoff. Standalone speech reuses record-and-send transcription/TTS without creating a Tavus session. These transport features do not merge FULL meetings with the source-bank progression and grounding gate described above.

The latest live Arabic/English checks used real provider sessions but synthetic camera/microphone devices; English topic continuity was confirmed after reconnect. Physical-device and native-Arabic listening acceptance remain open. See [STATUS.md](STATUS.md) for exact validation and limitations.
