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
