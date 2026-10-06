## 7 October 2026 — visible Docker quick start

Expanded both Arabic and English main READMEs with copyable clone/configuration, credential, build/start and stop instructions, default URL, occupied-port alternative and first-download expectations. Manual npm setup is explicitly an alternative. Checked against the tracked Compose configuration and Docker environment template; documentation-only change, no deployment.

## 7 October 2026 — replay after interruption

Added a connected-call “Replay latest reply / استمع للرد الأخير” action using Tavus conversation.echo. Replays the full latest canonical assistant reply without adding a learner answer, assessment or question advancement; no claim of exact resume position or verified hearing. Debounced pending replay, timeout/error handling, cleanup on stop/interrupt, and suppression of continuation nudges during replay preparation. Fixed the local muted state surviving a missing stopped-speaking event: the next authenticated avatar started-speaking event restores playback. Added explicit “أعد الرد الأخير” / “repeat the last reply” control returning the latest follow-up rather than the original question, without another model call. 504 automated tests and production build passed. Real Tavus audio replay remains unverified; browser tests use synthetic transport.

Release verification: all eight Arabic/English desktop/mobile synthetic-transport scenarios passed (one development HMR navigation interruption passed on isolated rerun). Checks include muted playback after interrupt, replaying the exact latest reply, restoration on the next speaking event without a stop acknowledgement, and unchanged canonical question. Arabic mobile layout inspected. Local Docker healthy at port 3018; deployed to https://basiraapp.vercel.app. Live production API replay control returned the latest response without grading or advancing; test session deleted. Actual Tavus audio output was not tested.

## 7 October 2026 — fragmented speech, interrupted text and chat activity

Fixed callback ingestion that previously retained only the latest user message: consecutive unprocessed provider fragments now combine under the session lock, with persisted prefix IDs preventing replay/duplication on subsequent or stale callbacks. Added fast unfinished-syntax guards for Arabic trailing complements (including “يتحكم في كل.”), fillers and selected English fragments, and the explicit “هل تستطيع أن تسألني مرة أخرى؟” repeat-question control. Tightened semantic-readiness instructions to avoid inventing missing words and recognize a completion such as “شيء.” in preceding context. No further blanket latency increase.

Interrupted streaming replies no longer erase the canonical generated question in chat; retained wording is explicitly labeled as potentially not heard in full. Added a small three-dot preparing-reply indicator within chat with Arabic/English text and reduced-motion support. 503 automated tests and production build passed. Two real model calls using synthetic Arabic input returned independently grounded follow-ups for a split completed answer and a brief complete answer. This is not a real microphone test or a guarantee of perfect turn-taking; upstream ASR/turn detection can still fail. Prompt guidance: https://developers.openai.com/api/docs/guides/prompt-engineering.

Release verification: eight Arabic/English desktop/mobile synthetic-transport browser checks passed; Arabic mobile chat indicator visually inspected. Local Docker healthy at port 3018. Deployed to https://basiraapp.vercel.app (basira-p1x7ak0wu-sultan12100s-projects.vercel.app). Real production API replay confirmed the reported trailing كل fragment waits, and the repeat request returns the original question without grading or advancing; synthetic session deleted. No live microphone/Tavus call was run for this release.

## 7 October 2026 — spoken pause and conversational recovery

Increased cancellable spoken-turn settling from 1.8 to 2.8 seconds. Explicit trailing connectives now take precedence over admissions of uncertainty, so “في الحقيقة لا أعرف، ولكن.” remains silent instead of offering to skip. Added deterministic Arabic/English presence, understanding, repeat-question and explicit next-question controls before semantic/factual processing. These controls do not invent factual answers or claim audio hearing quality. Retry clarification caps count only grounded follow-ups, not social recovery exchanges.

After a saved incomplete turn, a connected, unmuted, error-free call may send one Tavus conversation.echo invitation after 15 seconds of quiet. User/provider speech, detected microphone activity, avatar speech, typed pending replies, disconnect and end cancel/defer the timer. At most one invitation per saved turn; no automatic question advancement or assessment, no idle-credit timer reset. Uses https://docs.tavus.io/sections/event-schemas/conversation-echo. Echo delivery remains provider-dependent, not guaranteed. 493 automated tests and production build passed, including the reported fragment/control sequence and nudge cancellation. Physical microphone/noisy-room acceptance remains unverified.

Release verification: deployed these fixes to https://basiraapp.vercel.app (basira-g0x9n7cqc-sultan12100s-projects.vercel.app). Eight synthetic-transport browser checks passed. Real production HTTP replay of Arabic and English incomplete phrases plus presence/understanding requests confirmed silence for unfinished phrases, spoken-response text for recovery, no assessment or question advancement; both synthetic sessions were deleted. These deterministic controls made no model calls. Local Docker recovered from a development Tavus network timeout and is healthy at port 3018. New physical microphone and Tavus echo-delivery acceptance remain unverified.

## 7 October 2026 — production update verified

Deployed committed release a4ffd3d to the existing Basira Vercel project after explicit approval to resume production deployment. Production alias: https://basiraapp.vercel.app; deployment ID dpl_Ex97L7fALSs9zLuPvpxvU9dnid8M. Used a clean source export and existing hosted production configuration; no local Docker environment values, production credentials, service plans or PAL settings were changed. Local frontend/function bundle safety checks passed (36 frontend files, 588 function files, nine configured credential values checked). Hosted build passed. Live HTML, health, production AI/voice/avatar configuration and withheld-question exclusion checks passed. Four Arabic/English desktop/mobile browser checks against hosted assets passed using mocked retry-session data; these are not new live microphone/avatar acceptance tests. No paid avatar session started.

## 7 October 2026 — text and voice retries only

Removed the avatar-call/settings sidebar from targeted retry screens. The selected focus now sits above the answer in a full-width workspace; Arabic/English guidance offers typing or voice recording only. Original answers and comparison criteria are preserved. Main training avatar entry is unchanged. Production build and four mocked Arabic/English desktop/mobile browser checks passed, including absence of avatar controls/requests and availability of text/voice controls. Arabic desktop layout inspected. No production deployment.

## 7 October 2026 — patient spoken turns and reply activity

Added a cancellable 1.8-second grace period before the authenticated Tavus callback processes user turns. Opening questions and normal text endpoints do not wait. Existing Sparrow-2 high turn-taking patience and semantic continuation checks remain in place. The grace period relies on the provider cancelling its request when speech resumes; it is not a server-side measurement of microphone silence. No production persona/configuration was modified.

The avatar stage now shows a compact animated listening/preparing-reply indicator based on provider speaking/transcript events, resets when the trainee resumes, disappears for avatar speech/disconnection, and offers a slower-response message after 20 seconds. Arabic/English, RTL, mobile and reduced-motion are supported. 476 automated tests and eight mocked-provider browser checks passed; Arabic mobile and English desktop screenshots were inspected. Production build passed. Real microphone pause/resumption and noisy-room acceptance remain to be tested; this does not guarantee perfect endpoint detection. Local Docker rebuilt and healthy at http://localhost:3018; initial Tavus development-configuration network timeout recovered on retry. Production is unchanged.

## 7 October 2026 — prevent unrelated training findings after acknowledgments

Traced a local session and AI audit records: a rejected follow-up returned readyForReview=true, triggering assessment/progression; the next randomly selected atheism-bank item concerned Jewish rituals, and a thanks-only response was graded against it. Fixes: rejected follow-ups stay on the current question; narrow Arabic/English social acknowledgments neither advance nor generate assessments; disputed item 5df09cbb8ae4433656d7 is withheld from selection and retries pending source/scope review. Original datasets and saved reports remain intact. Old findings using that item, or thanks-only answers, show an explicit exclusion notice instead of deficiency scores. This is not a claim that the rest of the source bank has specialist approval. 473 automated tests and production build passed; checks include the exact reported thanks phrase, substantive short answers, and saved-report warnings. Production is not deployed. Local Docker updated and healthy at port 3018. Real local API replay confirmed the reported phrase is not graded, the question does not advance, and the withheld item is absent from the selectable catalog. Test session deleted; user sessions preserved.

## 7 October 2026 — prepare retries before connecting the avatar

Review retry actions now prepare the selected original question and focus without automatically creating a paid avatar call. The first answer and criteria remain intact. Users explicitly start the avatar or continue with typing/recording; the connection button unlocks browser audio on the click and prevents duplicate starts. Retry chat shows only the current attempt, and the preparation layout hides irrelevant setup fields and the placeholder stage. Eight Arabic/English desktop/mobile mocked-provider browser checks passed, including simulated connection failure and text fallback; the application build passed. Production's reported connection failure has not been diagnosed; this change is local, not deployed or live-provider-tested. Existing Docker runtime is unchanged.

# Implementation status

Updated 7 October 2026. [Live application](https://basiraapp.vercel.app).

## Local Docker evaluation setup

Optional Compose configuration runs the app, checksum-verified populated Chroma service and isolated development avatar callback. Verified image builds/startup, 38,742-passage retrieval, Arabic/English desktop/mobile browser rendering, real Tavus session creation/cleanup, restart persistence and shutdown. 466 JavaScript and eight Python tests passed. Live browser uploads for all four media types completed the full AI report pipeline. Arabic text training and English avatar training with synthetic microphone/camera completed assessment and retry comparison. Fixed the local-only Docker retrieval hostname allowlist. Physical-device/noisy-room acceptance and provider acknowledgement of interruption remain unverified. One initial avatar connection timed out; later connections passed. Production is unchanged. See [Docker guide](DOCKER.md).

## Implemented

- Arabic/English interface, RTL layouts and responsive training/content review journeys.
- Source-guided Tavus conversation: question-bank selection, contextual follow-ups, transcript persistence, interruption, reconnect and targeted retries using the same assessment criteria.
- Content text/image/audio/video inputs: extraction → evidence/reasoning/conclusion/class tuples → per-item retrieval → AI judgment → final review. Human decisions, export, saved reports and deletion are available.
- Audio coaching and sampled visual review when usable recordings are available. No emotion, belief or personality inference.
- Production on Vercel, with Upstash Vector retrieval, Redis shared state/protection/audit retention, and private temporary Vercel Blob media.
- Compact review-source links identify the declared collections. The current content flow does not call the legacy standalone quotation-check route.

## Verification

The last complete automated run passed 460 tests; two deployment-safety regression tests were subsequently added. Real-provider checks exercised representative synthetic text/image/audio/video inputs, retrieval, reports, export/reopen/delete and playback. Arabic/English avatar checks used real transport with typed input and synthetic browser media, with bounded duration and cleanup. These are not physical-device or religious-accuracy certification.

## Remaining validation and limitations

- Independent specialist review of religious judgments, source editions and permissions remains outstanding. A retrieved passage is not authentication or automatic publication approval.
- Physical Arabic/English conversations, noisy-room interruptions, dialect/pronunciation quality, concurrent load and provider failure recovery require representative human acceptance.
- Video analysis samples frames; it is not exhaustive. Provider credits, execution limits and accepted media bounds remain finite.
- Service credentials are not included. A populated local reference index is available as a separate checksummed release download; source permissions remain unresolved. Local avatar/AI use still requires the evaluator’s own provider accounts.
- Report libraries are device-local; there is no cross-device user-account synchronization.

See [setup](SETUP.md), [acceptance](ACCEPTANCE.md), [architecture](ARCHITECTURE.md), and [source provenance](CONTENT-SOURCE-IDENTITIES.md).

## Local retrieval release

A separate 606 MB Chroma archive provides the 38,742-passage local index without adding it to Git history. The local installer verifies integrity and preserves unrelated secrets. Five offline installer tests, actual archive extraction, local health/authentication and sample-vector retrieval passed. No production deployment or configuration changed; no paid model call was made for these checks. This release does not resolve corpus permissions or establish religious accuracy.
