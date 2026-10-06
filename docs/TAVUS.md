# Tavus integration

Updated 6 October 2026. This describes the current source-guided training journey, not historical Echo/LiveAvatar experiments.

## Current path

The meeting uses Tavus FULL and Daily's media transport for microphone/camera input and synchronized avatar speech/video. A custom conversation endpoint routes decisions to Basira's source question bank and grounded follow-up logic. Basira preserves the transcript, reference answer, evidence and criteria, selects unused questions, and generates training assessment/retry comparisons. It does not expose the reference answer as the avatar greeting.

Typed messages, live call turns, reconnects and retries use the same canonical server session. Partial utterance events drive display-only streaming text; only final validated learner turns enter assessment. Interrupted assistant speech is not presented as a verified record of exactly what the learner heard.

Ordinary training ends when the user chooses End & review, or a documented call resource limit triggers cleanup. Intentional silent continuation is not replaced with a training-ended message. Targeted practice may complete its bounded attempt and open its review without asking unrelated questions.

## Configuration

`TAVUS_API_KEY`, `TAVUS_FACE_ID`, environment-specific training PAL and authenticated public callback are required. See SETUP.md for `npm run dev:avatar` and production PAL setup. Development callbacks return to the local backend via its authenticated tunnel; production callbacks return to production. Records and namespaces are environment-scoped.

Legacy Echo and generic FULL PAL settings remain for compatibility; they do not define the default source-guided journey. Provider IDs/keys are account-specific and must not be committed.

## Limits and cleanup

Five-minute call cap; 2½-minute inactivity guard; no blanket restart cooldown. Provider concurrency/credits are handled using actual responses. Cleanup occurs on end, retry handoff, explicit disconnect and unload where possible, with provider stop confirmation and recovery handling. No claim that every browser crash or network failure can guarantee immediate remote acknowledgement.

Recording-based coaching is enabled by default with a remembered opt-out. Local learner tracks are recorded alongside the media connection without inserting a Whisper/TTS round trip. Remote avatar tracks are excluded; mute/avatar-speaking periods are suppressed. See CALL-RECORDING-REVIEW.md for limitations and deletion.

## Evidence

Bounded actual Tavus sessions have returned avatar video and passed typed-input routing, source review, retry and cleanup. Browser/synthetic-media regression tests cover UI transport events and capture. Human Arabic/English pronunciation, noisy-room turn taking, actual phones and real interruption/network recovery still require acceptance. See ACCEPTANCE.md. Historical account balances are not current quota evidence.
