# Basira · بصيرة

Bilingual dialogue training and pre-publication content review, built by the RIOTU Lab team at Prince Sultan University, Riyadh. Supports Arabic RTL, source-linked feedback, and focused practice.

[Try Basira](https://basiraapp.vercel.app) · [Setup](docs/SETUP.md) · [Current status](docs/STATUS.md) · [Acceptance evidence](docs/ACCEPTANCE.md)

## What you can do

**Train a conversation.** Choose a background and language, answer a source-linked question, explore AI follow-ups, and review your answer against reference criteria. Retry a finding and compare both attempts. The training collection contains 342 bilingual records across Hinduism, Christianity, atheism, and Judaism; these remain pending specialist approval.

**Review content.** Paste text or upload text, an image, audio, or video, then select **Review content**. The pipeline extracts text, structures evidence/reasoning/conclusion/class tuples, retrieves reference passages for each tuple, assesses them, and produces a final report. Transcript correction is available when needed. Reviewers can inspect passages and references, accept/reject/edit findings, save and reopen reports, and export them. A separate visual editorial layer reviews images and sampled video frames. Retrieval uses managed Upstash Vector in production; self-hosted Chroma is an alternative. Retrieval is not source authentication or religious approval, and imported editions and permissions remain unresolved.

**Practice with an avatar.** The source-guided FULL integration keeps Tavus speech and video while routing conversation decisions through Basira's question bank, grounded follow-ups and assessment. Text, reconnects and retries share the same server session. It uses separate development/production training PALs and callbacks. Run `npm run dev:avatar` for local calls through an authenticated tunnel to your local backend; see [setup](docs/SETUP.md) and [verification status](docs/STATUS.md). Legacy Echo and general-call integrations remain available for earlier records. Text training and assessment do not depend on an avatar account.

## Run locally

Use Node.js 24 and npm.

```bash
npm ci
cp .env.example .env
# Set your own service credentials in .env.
npm run dev
```

Open the URL printed by startup (default: **http://localhost:3000**). The landing page links to both workflows; direct routes are `/?app=training` and `/?app=content`. Add `&lang=en` for English.

Keep credentials server-side. Never commit `.env` or put API keys in browser storage. A fresh checkout does not contain working service credentials or the hosted imported retrieval index. Use your own accounts and a permitted source collection; the live demo runs separately from a local checkout.

| Capability | Configuration |
| --- | --- |
| Text conversation and assessment | OpenAI or DeepSeek; select `AI_PROVIDER` |
| Image reading, transcription, audio coaching, standalone speech | `OPENAI_API_KEY` and model settings |
| Source-guided Tavus training | `TAVUS_API_KEY`, `TAVUS_FACE_ID`, plus training PAL/gateway settings in the setup guide |
| Direct Tavus camera/microphone calls | Separate `TAVUS_FULL_PAL_ID` |
| Persistent training state, protection and AI audit | Upstash Redis REST URL and token |
| Production content retrieval | Upstash Vector URL/token and an ingested reference index |
| Private hosted recordings | Vercel Blob credentials and media-retention settings |

See [.env.example](.env.example), [credential setup](docs/SETUP.md), [Tavus integration](docs/TAVUS.md), and [Vercel deployment](docs/VERCEL.md). Optional LiveAvatar support remains documented in setup. Live provider requests consume the configured account's credits.

## Checks

```bash
npm test
npm run build
npm run test:browser
npm run doctor
```

Unit/component tests use mocks and fixtures. Browser and live-provider evidence are distinguished in [acceptance](docs/ACCEPTANCE.md) and [status](docs/STATUS.md). Live check scripts are opt-in and may consume credits; see [scripts](scripts/README.md).

## Scope and limitations

- Source matching is not religious approval. The bundled Quran collection covers 6,236 Arabic verses; it does not independently establish hadith authenticity, fiqh rulings, or translation accuracy.
- Images support originals up to 30 MiB; audio/video clips support up to 200 MiB and five minutes. Text review is bounded at 20,000 characters. Hosted audio/video above 4 MiB requires the private Blob connection. Video uses sampled frames, so visual coverage is partial. Extraction and classification require human inspection.
- Missing evidence does not establish that a claim is false. Generated training records also require specialist review.
- Spoken-delivery coaching is qualitative; physical-device, dialect, and noisy-recording quality checks remain necessary.
- Saved report libraries are browser-local. Training state uses the configured server store; production uses Redis. Hosted original media remain private and available for review for up to seven days, with deletion supported. Server-side AI audit records are separate and may contain submitted text; see [audit storage and privacy](docs/AI-AUDIT.md).
- This is a hackathon application without user-account authentication. It never automatically publishes content.

## Repository guide

`src/` contains the React interface; `server/` contains API and provider integrations; `api/` is the Vercel entry point. `data/` holds reference datasets and licenses, `tests/` contains automated checks, and `docs/` covers operation and acceptance. Only the brand assets used by the application and their licenses are included. Presentation tooling, font experiments, recording guides, credentials, and private working notes stay local.

[Folder guide](docs/REPOSITORY.md) · [Content review](docs/CONTENT-REVIEW.md) · [Content retrieval setup](docs/CONTENT-RETRIEVAL.md) · [Reference dialogue](docs/REFERENCE-DIALOGUE.md) · [Spoken delivery](docs/SPOKEN-DELIVERY.md) · [Source collection](data/training/qa/README.md)
