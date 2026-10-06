# Call recording review

Tavus still receives microphone/video directly over the existing call. Basira does not add a transcription intermediary. A disclosed browser recorder, enabled by default with a remembered opt-out, taps only the learner's local tracks. It never receives the remote avatar track. Microphone capture is suppressed during local mute and avatar speech; speaker echo or other nearby people cannot be perfectly excluded. Use headphones and assess ambiguous clips as insufficient evidence.

The browser stores approximately 30-second independently playable audio/video clips and up to three sampled JPEG frames per clip. Camera-off calls store audio only. Clips are associated with the current question and attempt, including retries and reconnects. Capture finalizes before call cleanup/review. Recorder-owned audio graph tracks are released separately from the original call tracks. A capture error is visible and does not end the call.

Storage: separate IndexedDB database `basira-call-review-v1`, seven-day age cleanup on access and oldest-first pruning at approximately 100 MiB of recording blobs. Frames/metadata add overhead. Browser storage may be evicted earlier. No provider credentials are stored. Deleting a clip deletes its local analyses; deleting a saved training session removes its local clips. Local reports are not account-synced; production clips additionally retain a protected cloud copy for seven days. Existing sessions cannot recover media that were never captured.

After review opens, pending clips go to the existing speech-review API. Audio feedback covers pronunciation clarity, fluency/phrasing, intonation and emphasis. Evidence links seek within the original playable clip, at server-generated segment boundaries, not phoneme timestamps. Dialects are respected; no clinical speech diagnosis or numerical quality score. Suppressed audio and artificial clip boundaries must not be scored as learner pauses. Failures preserve the clip and expose retry; content assessment remains available.

Optional visual review uses sampled frames, not continuous motion analysis. It evaluates framing, lighting and visibility only. Each non-abstaining observation references supplied frame IDs. It does not infer emotions, beliefs, confidence, identity, personality, eye-contact quality or body-language meaning. The learner can watch their own video to self-review gestures. No automatic emotional or whole-call body-language scoring is claimed.

Provider media processing uses the existing credentials and existing audited model wrapper. Raw media is omitted from central audit logs; the textual responses follow the bounded audit policy. Visual upload JSON is bounded to 1 MiB (three capped JPEG data URLs); raw audio/video requests to 4 MiB; retained private uploads support 100 MiB, decoded to at most 60 seconds. Both paid routes use shared request protection. Model output validation rejects unknown evidence IDs and removes suggestions from visual abstentions.

Official input documentation checked 6 October 2026:
- https://developers.openai.com/api/docs/guides/audio-chat-completions
- https://developers.openai.com/api/docs/guides/images-vision

Acceptance requires actual human Arabic/English recordings and noisy-room/physical-phone checks. Synthetic browser media proves capture and plumbing, not real-world coaching accuracy.

Production recording clips also retain a private cloud copy for seven days, with immediate deletion and authenticated scheduled cleanup. Local clips remain the primary review copy. See LARGE-UPLOADS.md.
