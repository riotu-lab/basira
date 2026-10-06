# Recording delivery observations

Sourced practice offers a deliberately limited, low-cost recording analysis. Record an answer using **Record answer**, confirm/correct the transcript, then continue or review. Text-only attempts show no recording measurements.

## Measurements and limits

- Duration from the browser-decoded recording.
- Approximate words/minute: transcript word count divided by the interval between first/last above-threshold audio frames. At least five words and a five-second measurable interval are required. Arabic counts orthographic word tokens, not linguistic morphemes.
- Internal low-volume intervals of at least 0.8 seconds, excluding leading/trailing silence. Energy is measured in 20 ms windows with threshold `max(0.01, peak RMS × 0.08)`. This is a transparent heuristic, not semantic speech detection: noise, quiet speech and microphone processing affect it.
- A narrow list of possible filler tokens present in the transcript; ambiguous words like “like” and “يعني” are excluded. ASR may omit fillers. A zero count does not mean none were spoken; no exact word-to-audio alignment is claimed.

No universal ideal speed, delivery score, automatic improvement claim, pronunciation grade, intonation, emotion or confidence inference is produced. An edited transcript hides rate/filler observations rather than attributing typed corrections to recorded speech. Low-volume timestamps remain recording observations. Original/retry measurements remain separate and descriptive.

## Cost and privacy

The existing transcription request/model is unchanged. Measurement is local JavaScript and adds **zero AI requests and zero analysis tokens**. No additional subscription or upload is needed. The transcript-based content/quality review keeps its existing cost; metrics are stripped from model history by server validation.

Up to ten audio blobs are retained in browser page memory for optional playback/seeking. URLs/audio are never stored in localStorage or the audit database. Reloading or leaving sourced practice releases recordings; deletion revokes retained clips. Saved attempts/drafts contain only small measurements, recording IDs and transcripts. The UI explains this before recording. Audit logging of the existing transcription remains unchanged and does not store uploaded audio.

Official documentation directs word/segment timestamps to Whisper; this implementation does not switch transcription services or claim word timestamps: [OpenAI transcription timestamps](https://developers.openai.com/api/docs/guides/speech-to-text#timestamps).

## Verification

- Deterministic PCM tests: known silence intervals, start/end silence exclusion, short/silent clips, Arabic tokens, narrow filler matching, invalid input and no score.
- Real browser recording/decoding of a synthetic oscillator with a known quiet interval; mocked transcript/assessment; Arabic/English desktop/mobile playback, seeking, correction invalidation, persistence and deletion.
- Real existing TTS/transcription services with synthetic Arabic/English speech; local measurement smoke test, report `artifacts/reports/spoken-delivery-live.json`.
- Physical microphone, dialect-specific ASR behavior, background noise and Safari hardware testing remain necessary. These heuristics are not an independently calibrated speech assessment.

## Contextual playback and focused practice

Interval buttons play from 1.5 seconds before the interval to 1.5 seconds after it (bounded by the recording). Playback errors are visible. The learner decides whether a pause helps the idea; the app does not label quiet intervals as faults. The delivery retry action preserves the original, saves `focusDelivery`, and asks the learner to record the same answer with complete short thoughts before pausing. Single-recording attempts get a side-by-side duration/interval comparison, without an improvement score. This coaching is deterministic guidance, not additional AI speech analysis. Speech-aware detection and pronunciation validation remain future work.

## Audio-based coaching (5 October 2026)

The optional, enabled-by-default recording review now sends the actual recording to `POST /api/training/speech-review?language=ar|en`. Existing transcription remains independent. The server decodes at most 60 seconds/4 MB to mono 16 kHz PCM, splits the entire recording into consecutive 12-second WAV segments, and sends those segments with IDs to `gpt-audio-1.5` via Chat Completions (text output only, `store:false`). Configure `OPENAI_AUDIO_ASSESSMENT_MODEL` to override; `OPENAI_API_KEY` is the only required credential. The text provider can remain DeepSeek. No new account/subscription is required, but this adds one billed audio-input model request per enabled recording.

The model listens for pronunciation clarity, fluency/pauses, and intonation/emphasis. It receives no presumed script or reference answer. This is **qualitative AI coaching**, not a calibrated phoneme test or certified pronunciation score. It must respect intelligible Arabic dialects/English accents, decline unclear evidence and avoid inferred emotion/confidence/identity. Content correctness remains in source-based assessment. Mechanical segment boundaries must not be diagnosed as pauses.

Every supported finding selects existing segment IDs. The server resolves times, rejects unknown/duplicate IDs or missing criteria, and requires actionable suggestions for practice findings. Insufficient-evidence findings cannot cite segments, and any unsolicited advice is discarded. Segment times are exact cut boundaries, **not verified word timings**. The model's semantic/acoustic interpretation can still be wrong. Prompt and validation: `server/audioAssessment.ts`; API operation: `ModelProvider.assessSpeech`.

The UI displays processing, saves the transcript before audio analysis, and preserves it if analysis fails. A checkbox lets users skip this extra analysis. The report includes listening controls and pronunciation/fluency/intonation-focused retries; original/retry observations appear together without an automatic improvement claim. Editing the transcript does not rewrite the recording assessment. Reports/focus persist with attempts; local deletion removes them. Only the latest ten audio blobs remain in page memory. Central audit records retain the model request/response and audio hashes/size, never base64 recording data; existing audit deletion is separate from local report deletion.

Validation evidence: `tests/audioAssessment.test.ts`, audio privacy case in `tests/aiAudit.test.ts`, bilingual desktop/mobile `tests/browser/audio-coaching.spec.ts`, failure-preservation `audio-coaching-recovery.spec.ts`, and `scripts/checks/audio-coaching-live.ts`. Real API checks use synthetic speech and silence. Representative human Arabic/English recordings, dialect/noise testing, and independent listening judgments are still needed before claiming strong assessment accuracy. No claim of best-in-market quality is made.

Official documentation checked: https://developers.openai.com/api/docs/guides/audio-chat-completions and https://developers.openai.com/api/docs/models/gpt-audio-1.5 . Structured Outputs are not listed for this audio model, so JSON instructions plus strict server validation are used instead of assuming schema enforcement by the provider.
