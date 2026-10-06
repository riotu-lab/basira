# External-source argument review — 2026-10-04

The existing quotation checks are now supplemented by the two-provider MCP retrieval path for argument review. See [implementation, configuration and live-test limits](MCP-RETRIEVAL.md). External retrieval is implemented but not live-verified; both hosts failed DNS in the current runtime. Historical verification notes below retain their original scope.

# Pre-publication content review

This is separate from training-session feedback. Choose **Review Content / مراجعة المحتوى** beside **Start Training / ابدأ التدريب**. An active training conversation must be finished before switching, so navigation cannot orphan its voice/avatar session.

## Text journey

Paste up to 20,000 characters or upload a UTF-8 `.txt` file. Select the content language independently of the interface. The single Review content action uses GPT-5.6 Luna to extract tuples, immediately retrieves reference passages per tuple, then runs AI judgment and prepares the report. There is no separate Quran-quotation validation stage in the active journey. Quran references remain available as retrieved evidence for the AI judge. Explicitly cited quotations provide a bounded extraction fallback, including standalone Arabic frame text. No model-authored reference URL or scripture is trusted as source evidence.

Results distinguish textual matches, textual differences, conflicting attributions, insufficient evidence, and specialist review. A retrieval/load failure never establishes that a claim is false. A difference is not automatically a doctrinal error. Translations, paraphrases and omission markers are not judged as exact Arabic quotations. Correction suggestions are either a verifiable alternate citation or a verbatim near-match from the cited source; users must check context.

Human reviewers can accept, reject or edit findings, add explanations, and supply their own correction. These decisions do not modify the original publication content or constitute religious approval. There is no publish endpoint/action. Suitable accepted/edited, confirmed quotation findings can prefill the existing training workflow with a question about respectfully discussing the correction. That practice assesses communication, not theological correctness; publication passages are not misrepresented as prior training answers.

## Reference coverage and licence

The collection contains all **6,236 Arabic Quran verses**, downloaded directly from the [Tanzil Project](https://tanzil.net/download/) in its Simple 1.1 edition. Original downloaded text, embedded attribution/licence, metadata, download URL, timestamp and SHA-256 are retained in `data/quran/`. The loader checks the checksum and count. It does not retrieve arbitrary model-supplied URLs.

Tanzil permits verbatim use with attribution and a link under its [published terms](https://tanzil.net/docs/Text_License). The application links to Tanzil, preserves the downloaded file unchanged, and includes the notice in report exports. A normalized search index ignores diacritics, pause marks and tatweel; reference excerpts retain original spelling/diacritics. Tanzil's text download prepends basmala at surah openings. Verse excerpts select the verbatim verse portion rather than treating that prelude as part of each first numbered verse (1:1 is retained).

Coverage does **not** include hadith authentication, translations, tafsir, historical/scientific verification, or fatwas. These yield insufficient evidence or specialist review; no claim of comprehensive religious verification is made. English UI and extraction work, but English translations are not presented as original Quran text. Automated extraction can miss claims even within the supported collection.

## Audio

Supported uploads: MP3, WAV, M4A, OGG, WebM, MP4 and MOV; prepared maximum 100 MiB locally or through connected private Blob storage (4 MiB raw on Vercel) and 180 seconds; see STATUS.md for release verification. FFmpeg/ffprobe decode the soundtrack in a temporary directory. Uploaded files are passed as bytes, never shell commands or remote URLs. Temporary server files are removed in `finally`, including errors/cancellation.

The existing OpenAI account runs `whisper-1` with verbose JSON and segment timestamps for this workflow. The dialogue pipeline remains unchanged. [Official transcription documentation](https://developers.openai.com/api/docs/guides/speech-to-text) identifies the timestamp support. Nearby short fragments are grouped into at most 15-second review spans using the provider's first/last timestamps, so quotations remain in context. Timestamps are approximate, not word-accurate.

The user edits a transcript while its original machine text remains available. A checkbox records that the human checked that segment against the media. Corrections clear stale findings/decisions and require reanalysis. Unconfirmed audio/OCR findings remain explicitly uncertain. Finding links seek to the segment start; they do not claim exact phonetic alignment or proof of what was spoken.

## Video — explicitly partial

The soundtrack uses the same audio workflow. A separate action samples frames every 15 seconds and uses the existing image-capable OpenAI model for OCR, following [official image-input documentation](https://developers.openai.com/api/docs/guides/images-vision). Frames and OCR text are shown for correction/confirmation before analysis. Findings display the sampled frame, overlapping spoken segment and source reference where available.

**This is sampled video review, not complete video understanding.** Unsampled titles, brief subtitles, handwriting and transitions may be missed. OCR can confuse Arabic characters. A visible quotation is compared against a reference only when the scope supports it. Translated/abbreviated subtitles are not automatically judged erroneous. Video reports and exports are always labelled incomplete/partial, even when all samples succeed. Soundtrack-only review never implies that visible text was analyzed.

## Saved reports and privacy

IndexedDB stores the original text/upload, machine and corrected transcripts, frame snapshots, findings, references and human decisions in this browser profile. Reports reopen with playback; deletion removes the report and its stored media. No API key, LiveAvatar token or provider configuration is stored. Browser quota/storage errors are visible; reports can be exported as readable UTF-8 text. Anyone sharing the browser profile can access saved reports. This remains a local, unauthenticated demo.

Media/text are sent to OpenAI for processing. No LiveAvatar session is needed for content review. Source lookup, human decisions and stored reports remain independent of LiveAvatar.

## Verification evidence

- Automated: exact source matches, changed quotations, conflicting/unknown citations, insufficient evidence, specialist cases, source-load failure, OCR extraction fallback, timestamp grouping, transcript correction, human accept/reject/edit, persistence/reopen/delete, report export contents, and the practice handoff. Existing dialogue tests remain in the suite.
- Real providers: `artifacts/reports/content-live-check.json` records Arabic/English text checks. Its follow-up media portion timed out; that failure is retained.
- Real media rerun: `artifacts/reports/content-media-live-check.json` records a generated Arabic recording, actual timestamped transcription, a corrected-text review, and actual OCR of a generated video frame. Fixtures are synthetic; providers are real. The recognizer misheard a phrase, illustrating why correction/uncertainty states are required.
- `artifacts/reports/content-video-recheck.json` records a real model/source review of the previously captured real OCR after the resolver correction. This avoids claiming a fresh camera/video capture.
- Subsequent Arabic/English desktop/mobile browser checks passed for content extraction, retrieval and final reports with mocked services; layouts were visually inspected. Real Arabic/English full-report browser tests also passed. See STATUS.md for the latest release evidence.
- Still required: physical playback/seek verification, diverse real user media, longer/noisy recordings, source/context review by a qualified human, and cross-browser IndexedDB persistence.

Run `npm test` and `npm run build` for non-live checks. `npm run test:content-live` uses configured provider credits with synthetic fixtures; it is not part of the ordinary test suite. No plan changes or purchases occur.

## Image input and tuple extraction

Select Image and upload a PNG/JPEG/WebP original up to 30 MiB. Reading starts automatically; large images use a smaller analysis copy while preserving the original. Basira uses the existing OpenAI vision integration (`OPENAI_API_KEY`, current `OPENAI_MODEL`) to read visible text without completing or correcting quotations. Short clear pages are supported; the shared vision-output validator limits each image to 3,000 extracted characters. Use Review content to run the integrated pipeline; extracted text can also be corrected. Original image/text remain available for review with deletion available.

The same extraction action accepts pasted/uploaded text and existing audio/video extracted units. `/api/content/structure` returns `{items, morePossible}`. Each item contains `evidence`, `reasoning`, `conclusion`, `class` plus `id`, `unitId`, exact `passage` and character `start/end`. Missing parts are empty strings. Evidence denotes support presented by the author, not verification. Classes are quran (Quran quotations/attributions), hadith (reported prophetic sayings/attributions), fiqh (jurisprudence/legal rulings), other (other or ambiguous). For an argument based explicitly on Quran/hadith, that quoted source determines class; independent claims should be separate items. Model classification can be mistaken.

Tuple extraction feeds directly into RAG through the single Review content action. Each tuple (all four fields) becomes one text-embedding-3-large query into the existing Upstash collection. The extraction model is gpt-5.6-luna with low reasoning. The server checks JSON shape, known unit IDs/classes and bounded sizes, but no longer rejects or re-extracts tuples for non-exact wording. Source offsets are best-effort: a matching passage is anchored; otherwise the entire original unit is retained as context. AI judgment later checks the extracted meaning against that original context and retrieved evidence. An empty list is valid and is not content approval; `morePossible` flags incomplete extraction. Correcting extracted text invalidates prior results. Reports include structured items in readable export. All model calls use the existing audit wrapper.

## Image-first interaction

Uploading an image starts reading and structuring automatically, with actual stage labels and cancellation. The original remains visible beside the selected extracted passage. Text correction is optional under “View and edit extracted text”; changing it clears stale findings and structured items. Images with no readable text or failed extraction show recovery guidance and preserve the upload. A structuring-only retry does not reread the image.

The `evidence` field contains the supporting source/quotation explicitly cited in the content, including a stated attribution when contiguous. The author's inference belongs in `reasoning`; their claim or outcome belongs in `conclusion`. Absent parts stay empty. Non-exact wording no longer blocks retrieval or triggers a second extraction call; tuple fields remain model extractions rather than certified quotations. This is extraction, not retrieval or authentication. No word-level image coordinates or confidence scores are available, so the UI shows the exact extracted passage beside the image rather than inventing bounding boxes or uncertainty scores.

## Integrated judgment pipeline (6 October 2026)

The full report now connects extraction, Chroma retrieval, independent AI judgment/verification, and human review decisions. Real synthetic image/audio/video inputs passed provider extraction → structuring → retrieval → judgment, with unconfirmed-media flags retained. Evidence: local ignored `artifacts/reports/content-media-assessment-live.json`; this does not establish accuracy on arbitrary human recordings. See [retrieval and report implementation](CONTENT-RETRIEVAL.md).

## Visual publication layer

Images and videos now also support a separate vision-based editorial review, including non-text visual content. It describes the image or 3–6 distributed video frames, attaches observations to those visuals, and preserves human decisions. This does not use RAG or substitute for the existing text/source assessment. See [Visual content review](VISUAL-CONTENT-REVIEW.md) for coverage, persistence, limits and verification.
