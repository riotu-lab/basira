# Implementation status

Updated 7 October 2026. [Live application](https://basiraapp.vercel.app).

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
- The hosted imported retrieval index and service credentials are not included in this repository. A local checkout needs its own configured services and permitted corpus.
- Report libraries are device-local; there is no cross-device user-account synchronization.

See [setup](SETUP.md), [acceptance](ACCEPTANCE.md), [architecture](ARCHITECTURE.md), and [source provenance](CONTENT-SOURCE-IDENTITIES.md).
