# Service decision — 2026-09-28

The existing FULL-mode adapter was replaced by a LITE rendering adapter so a missing avatar account cannot block AI conversation, speech, feedback, or comparison.

| Responsibility | Implementation |
|---|---|
| Conversation, review, comparison | OpenAI Responses REST API, configurable model, `store:false`; strict JSON schema for review/comparison |
| User speech | OpenAI transcription of a completed, user-controlled recording; Arabic or English |
| Assistant speech | OpenAI TTS, PCM16 little-endian, 24 kHz mono |
| Avatar | LiveAvatar LITE: the exact generated speech is sent as PCM chunks; one synchronized audio/video stream is played |
| Browser-only preview | Explicit scripted mode; no model or voice requests and no inferred improvement |

Official documentation reviewed: [structured output](https://developers.openai.com/api/docs/guides/structured-outputs), [transcription](https://developers.openai.com/api/docs/guides/speech-to-text), [speech](https://developers.openai.com/api/docs/guides/text-to-speech), [LITE lifecycle](https://docs.liveavatar.com/docs/lite-mode/lifecycle), [LITE events](https://docs.liveavatar.com/docs/lite-mode/events), [LITE configuration](https://docs.liveavatar.com/docs/lite-mode/configuration), [session startup](https://docs.liveavatar.com/api-reference/sessions/start-session).

Arabic/English are supported by the selected OpenAI speech services in their documentation. The speech guide also notes that voices are optimized for English. This establishes advertised support, not Arabic quality, latency, accent, or pronunciation acceptance. LiveAvatar LITE renders supplied audio and does not select a spoken language or synthesize it. No account capabilities have been verified live.

## Interruption and delivery

Microphone input is explicitly gated: the user taps to record; assistant playback and pending generation are cancelled before capture begins. Stop recording releases microphone tracks. The user checks/edits the transcription before sending. This is a turn-based voice demo, **not automatic full-duplex barge-in or streaming word-by-word transcription**. No parallel microphone capture occurs during avatar speech. Echo cancellation is requested, but speaker/headphone behavior still needs hardware testing.

The LITE adapter waits for provider `connected` state and media tracks, sends one-second PCM chunks with a stable utterance ID, correlates speech events by `source_event_id`, and uses `agent.interrupt` to clear queued audio/video generation. Playback is locally muted/paused immediately. New speech is blocked until the matching buffer-clear acknowledgement. Late events for a cancelled utterance cannot resume it. A missing acknowledgement causes a visible disconnect, not optimistic continuation. No second audio player runs alongside avatar media.

On interruption or unconfirmed playback, the whole assistant turn is marked uncertain. Future model context contains a neutral uncertainty marker instead of that generated text. This deliberately loses possible partial content; it does **not** claim word-accurate knowledge of what was heard. The on-screen transcript is generated text, explicitly labelled as not proof of auditory delivery.

A reconnect creates a new avatar session and preserves the text transcript. It never replays a partially heard answer automatically. Text-only continuation is also available. Provider-generated idle/listening/speaking motion and lip sync require actual asset inspection; the code cannot guarantee natural blinking or expressions.

## Feedback provenance

Only existing transcript IDs, exact contiguous quotes, prior assistant questions, and a fixed source ID are accepted. Wrong IDs, invented quotes/URLs, a changed comparison criterion, and uncertain questions are rejected. The model can return no findings or insufficient comparison evidence. This is structural verification, not a proof of semantic correctness. Human review is required for the observations and source relevance.

The current curated source is [Quran 16:125](https://quran.com/16/125). Its Arabic excerpt stays original in either UI language. It supports the broad principle of considerate dialogue. Open questions and the two practice criteria are Basira's coaching applications, not claimed quotations, interpretations, religious scores, or rulings.

## Cost and rights

No API calls with real credentials, account creation, subscription, purchase or publication occurred. API calls consume the configured accounts' existing credits when enabled. No account-specific minute cost is asserted. Check [OpenAI pricing](https://openai.com/api/pricing/) and [LiveAvatar plans](https://www.liveavatar.com/) before authorized use. Avatar sessions are capped at 120 seconds and one active session for this local demo.

The LiveKit library license does not grant rights to an avatar or voice. A licensed provider preset or an already-authorized custom asset is still required. No human likeness is synthesized locally to disguise the missing asset.
