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
