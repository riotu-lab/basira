# Visual publication review

Images and videos have two independent review layers:

1. Text extraction/transcription → structured claims → source retrieval → evidence-constrained assessment.
2. Image or distributed video frames → vision model descriptions → visual editorial observations. This path performs no retrieval and makes no religious/factual verification claim.

The second layer considers relevant readability, composition, visual accessibility, message/context ambiguity, visibly exposed personal details, and presentation for an optional intended audience/purpose. It does not manufacture findings for every category. Findings distinguish strengths, suggested changes, and ambiguities requiring context. Each links to supplied frame IDs; invalid IDs or invented evidence references are rejected. Model descriptions can still be mistaken, so human accept/reject/edit decisions remain available.

`POST /api/content/visual/image` accepts JPEG/PNG/WebP (4 MiB maximum). `POST /api/content/visual/video` accepts the existing supported video formats with a prepared 180-second duration cap. Hosted raw uploads are capped at 4 MiB; local/private-Blob uploads support 100 MiB. See LARGE-UPLOADS.md and STATUS.md for activation and verification. Original images up to 20 MiB are prepared client-side before the 4 MiB image endpoint. Video sampling uses 3–6 frames distributed across the clip; it is not scene-complete, motion, soundtrack, or continuous video analysis. The full report separately transcribes the soundtrack and checks sampled visible text. Extraction failures preserve completed independent results.

The report displays the image/frame, description, observation, explanation, suggested edit and human decision. Video findings can seek to their supporting time. Audience/purpose, original media, results and edits persist in the existing local IndexedDB report store; reopen, deletion and readable text export apply. The text export contains descriptions and frame IDs/timestamps, not embedded image binaries. Reports are not account-synced. Changing extracted text invalidates text assessment; changing visual context invalidates visual review.

No automatic publishing, religious approval, identity/emotion/sensitive-trait inference, copyright/consent determination or media authenticity claims. Private identifiers should not be repeated in descriptions. Prompt and schema validation reduce risk but do not certify model correctness. Paid routes use the existing shared request protection and audited model wrapper; raw images/media are omitted from audit records.

Implementation: `server/visualEditorial.ts`, `ModelProvider.reviewVisualContent`, `server/contentMedia.ts`, `src/VisualEditorialPanel.tsx`, `src/ContentReview.tsx`.

Validation: `tests/visualEditorial.test.ts`, `tests/browser/content-visual-editorial.spec.ts`; `scripts/checks/content-visual-live.mjs` exercises actual vision requests with synthetic publication artwork and a short video. These do not replace human acceptance with representative real publication material.
