# Acceptance and evidence

Updated 6 October 2026. Current production: https://basiraapp.vercel.app. STATUS.md is the release snapshot. Earlier LiveAvatar/DNS/deployment-blocker notes have been archived locally; they do not describe the current Tavus/Upstash release.

## Evidence already obtained

- Automated unit/component/API tests: latest complete run 460 passed, followed by two additional passing deployment-safety regression tests.
- Real Chromium desktop/mobile-sized UI checks: Arabic/English layout, RTL, report selection, retries/comparison, media capture with synthetic devices, saved reports, export/deletion, reconnect state handling and privacy-dialog keyboard behavior. Many API/transport responses in these checks are mocked.
- Live providers: deployed source retrieval, model judgment and report journeys; Arabic/English image vision and sampled video; synthetic audio delivery analysis; bounded actual Tavus video sessions with typed input and cleanup. See ignored `artifacts/reports/` evidence. Synthetic media does not establish human speech accuracy.
- Production build and frontend/function credential scans pass on the latest deployed UI release.

## Human acceptance still required

1. Complete an Arabic and English conversation on a laptop and actual phone. Allow/deny permissions, mute, toggle camera, type during the call, pause naturally, interrupt and finish. Confirm cleanup.
2. Review reference excerpts, actual user quotations, expression feedback and recorded delivery evidence. Retry the same point and compare original/retry under unchanged criteria. Check that unavailable evidence is not invented.
3. Repeat with venue noise and ordinary hesitations. Check that partial thoughts are not cut off and surrounding voices are not treated as reliable learner evidence.
4. Test controlled network loss, reconnect, tab backgrounding, closing/reopening, five-minute duration and inactivity expiry. Confirm paid sessions stop and transcripts remain recoverable.
5. Upload representative text, image, audio and video; correct extracted passages, check time/frame links, accept/reject/edit, export, reload and delete. Visual-only findings must remain separate from source verification.
6. Run concurrent sessions within the provider's current allowance and simulate provider/storage errors. Measure response times instead of assuming latency from synthetic tests.
7. Obtain independent religious/linguistic review and corpus identity/license evidence.

## Commands

`npm test` · `npm run build` · `npm run test:browser`

Set `BASIRA_TEST_URL` for the target deployment. Tests whose names say mocked or synthetic must never be reported as human/live-model acceptance. Live scripts in `scripts/checks/` may consume existing provider credits; inspect them first and keep avatar watchdog/cleanup enabled. Do not buy plans or enable overage as part of testing.

Upload expansion: real local/hosted vision reviewed a 125-second synthetic video with six bounded frame timestamps; large-image browser preparation passed with mocked extraction responses. Real local and production private Blob tests passed: upload, denied public access, range playback, metadata persistence, and deletion. Real hosted video and Arabic speech analysis preserved playback until explicit deletion. Cleanup authentication passed; seven-day expiry is tested with controlled timestamps, not an elapsed seven-day production observation. Maximum-size transfers, unreliable mobile networks, and concurrent media upload/deletion still require acceptance testing.

## 6 October — generated-file browser acceptance

- Real deployed Arabic desktop and English mobile-sized Tavus calls: video, source gateway, typed answer, assessment, preserved retry and confirmed cleanup. Synthetic devices, 55-second watchdog per call.
- Real deployed Arabic/English text review: reviewer edit, export, reload/reopen and deletion.
- After local fixes, generated TXT/PNG/WAV/MP4 uploads all passed real extraction/retrieval/assessment, edited reviewer-note persistence, export and deletion on a locally served production build. Image extraction was editable; audio/video playback and seeking worked. Image/video also produced visual reviews.
- Original production audio/video failed quotation validation; local whitespace resolution fixes this case without accepting changed words. Title preservation and partial-citation resolution have regression coverage. Production has not received these fixes yet.
- Synthetic speech transcription changed one word. These tests confirm workflow operation, not universal transcription/religious accuracy. Physical-device/noisy-room testing remains.

## Final production release — 6 October 2026

All 447 automated tests and production frontend/function credential scans passed. The final deployed four-file browser run used real model and retrieval services with generated Arabic text/PNG/WAV/MP4: reports, canonical correction, reviewer notes, export, reopen/delete passed; image correction and audio/video playback/seek passed. Final English mobile-sized Tavus acceptance and Arabic desktop acceptance passed actual provider video, scripted typed answer routing, source review, targeted retry and confirmed cleanup. These use synthetic devices and do not establish physical speech quality. Shared Redis retention/limiting, Vector count (38,742/3,072 dimensions), private Blob range playback/deletion, cleanup authentication, hosted policies and Dublin function placement were verified.

A first production audio run failed because extraction separated a final quotation word; prompts were tightened and the final real run passed. This is documented as a resolved observed failure, not proof of universal extraction accuracy. Remaining human/permission checks in STATUS.md still apply.

## Expanded media boundary — 6 October

Production accepts 200 MiB/300-second recordings and 30 MiB original images; the function timeout is 300 seconds. Real FFmpeg with a mocked transcriber confirms 300 seconds are preserved and 301 seconds rejected. Real production private five-minute video visual analysis returned six frames, playable media after analysis, and successful deletion. Real 9.6 MiB multipart audio upload/transcription accepted five minutes; a deliberately near-silent input failed the late-speech timestamp assertion (provider returned 272 seconds for speech placed at 290), so timestamp accuracy is not certified. Arabic mobile/English desktop policy display checks passed without overflow. 200 MiB/30 MiB size ceilings have policy/boundary checks, not a full maximum-size transfer/load test.

Five-minute continuous-speech production check: a generated 9,600,078-byte WAV used real multipart private upload and real transcription. Returned duration 300 seconds, 18 grouped segments, final transcript end 299.60 seconds; hosted original deleted afterward. This confirms full-duration transport/processing for this synthetic sample, not universal timestamp or linguistic accuracy. Final deployment includes explicit MIME type on the temporary multipart fallback.

## Content pipeline reliability — 6 October 2026

- Active route sequence: structure → assess-item (server-side retrieval + AI judgment) → summary. No standalone quotation check.
- Real production uploads: TXT, PNG, WAV and MP4 reached final summary, export, reopen, human-note persistence and deletion. Recordings played and sought correctly. Synthetic files, real providers.
- Real mobile-sized production: JPEG, WebP and silent MP4 reached final summary; corrupted WAV showed recoverable rejection and could not export an empty report. Test reports deleted.
- Automated: 460 tests passed; real FFmpeg container decoding and five-minute boundaries, plus mocked provider/network recovery. Four Arabic/English desktop/mobile report browser checks passed with mocked services.
- No claim of universal file/codec support or error-free upstream services. Inputs must satisfy advertised format/size/duration and extracted-text bounds. Source-review requires usable text/speech; visual-only findings remain distinguishable.
