# Basira · بصيرة

Bilingual dialogue training and pre-publication content review, built by the RIOTU Lab team at Prince Sultan University, Riyadh. Supports Arabic RTL, source-linked feedback, and focused practice.

[Try Basira](https://basiraapp.vercel.app) · [Setup](docs/SETUP.md) · [Current status](docs/STATUS.md) · [Acceptance evidence](docs/ACCEPTANCE.md)

## For hackathon judges

**To try the full configured experience, open [the live demo](https://basiraapp.vercel.app).** No installation or personal API keys are required; demo availability remains subject to the team's provider credits and concurrent-session limits. [Watch the recorded walkthrough](https://www.youtube.com/watch?v=dRobDNQ9dP0).

**To inspect or run the code, use the local setup below.** The app starts without credentials, but live AI actions require the relevant services. A local checkout runs its own backend: it does **not** silently use the team's production API, accounts, storage, or credits. Changing `NODE_ENV` or `BASIRA_ENV` to production is not a way to connect to the live demo.

## What you can do

**Train a conversation.** Choose a background and language, answer a source-linked question, explore AI follow-ups, and review your answer against reference criteria. Retry a finding and compare both attempts. The training collection contains 342 bilingual records across Hinduism, Christianity, atheism, and Judaism; these remain pending specialist approval.

**Review content.** Paste text or upload text, an image, audio, or video, then select **Review content**. The pipeline extracts text, structures evidence/reasoning/conclusion/class tuples, retrieves reference passages for each tuple, assesses them, and produces a final report. Transcript correction is available when needed. Reviewers can inspect passages and references, accept/reject/edit findings, save and reopen reports, and export them. A separate visual editorial layer reviews images and sampled video frames. Retrieval uses managed Upstash Vector in production; self-hosted Chroma is an alternative. Retrieval is not source authentication or religious approval, and imported editions and permissions remain unresolved.

**Practice with an avatar.** The source-guided FULL integration keeps Tavus speech and video while routing conversation decisions through Basira's question bank, grounded follow-ups and assessment. Text, reconnects and retries share the same server session. It uses separate development/production training PALs and callbacks. Run `npm run dev:avatar` for local calls through an authenticated tunnel to your local backend; see [setup](docs/SETUP.md) and [verification status](docs/STATUS.md). Legacy Echo and general-call integrations remain available for earlier records. Text training and assessment do not depend on an avatar account.

## Run locally

Use Node.js 24 and npm. The following shell commands assume Git Bash, macOS, or Linux; on Windows PowerShell use `Copy-Item .env.example .env` for the copy step.

```bash
git clone https://github.com/riotu-lab/basira.git
cd basira
npm ci
cp .env.example .env
# Do not overwrite an existing .env; edit it to add your own credentials.
npm run dev
```

For **local text training**, set `AI_PROVIDER=openai` and `OPENAI_API_KEY` in `.env`, leave `BASIRA_ENV=development` and `TRAINING_STORE=sqlite`, restart, and choose text mode in the training settings. No Tavus, ngrok, Redis, or Vercel account is required for that path.

Open the URL printed by startup (default: **http://localhost:3000**). The landing page links to both workflows; direct routes are `/?app=training` and `/?app=content`. Add `&lang=en` for English.

Keep credentials server-side. Never commit `.env` or put API keys in browser storage. A fresh checkout does not contain working service credentials or the hosted imported retrieval index. Use your own accounts and a permitted source collection; the live demo runs separately from a local checkout.

### Services, keys, and expected costs

Set keys only in your ignored local `.env`. Account registration alone does not ensure model access, available credits, or sufficient quotas. Plan allowances change; follow the official links before choosing a plan. Basira does not subscribe or purchase credits automatically.

| Service | When it is needed | Values to configure / where to obtain them | Credits or subscription |
| --- | --- | --- | --- |
| OpenAI API | Default text training/review; content extraction, image reading, transcription, embeddings and audio coaching | `OPENAI_API_KEY`: [API keys](https://platform.openai.com/api-keys). [Setup](https://developers.openai.com/api/docs/quickstart) / [billing](https://platform.openai.com/settings/organization/billing/overview). | API usage requires available billing quota or applicable credits and access to the requested models. This app uses API keys, not a ChatGPT sign-in/subscription integration. |
| Tavus | Live avatar voice/video training | `TAVUS_API_KEY`, `TAVUS_FACE_ID`: [developer portal](https://platform.tavus.io/). Set `AVATAR_PROVIDER=tavus`. The development launcher prepares `TAVUS_TRAINING_PAL_ID_DEV` and `BASIRA_PUBLIC_URL_DEV`. | Available conversation minutes and an available concurrent-session slot are required. Limited free-plan allowances may cover a short test; paid use is needed when allowances are exhausted. [Plans](https://www.tavus.io/pricing). |
| ngrok | Local Tavus callbacks to your own backend; unnecessary for text-only training | `NGROK_AUTHTOKEN`: [account authtoken](https://dashboard.ngrok.com/get-started/your-authtoken). Then run `npm run dev:avatar` instead of `npm run dev`. | A free plan is available with limits; paid features are optional depending on usage. [Plans](https://ngrok.com/pricing). |
| Upstash Vector | Managed source retrieval for content review | `UPSTASH_VECTOR_REST_URL`, `UPSTASH_VECTOR_REST_TOKEN`, `UPSTASH_VECTOR_NAMESPACE`: [console](https://console.upstash.com/). Dense / Custom / **3,072 dimensions** / COSINE; populate a permitted corpus. | The current 3,072-dimensional setup exceeds the free plan's 1,536-dimensional limit; choose a compatible paid plan, or configure the local Chroma alternative. [Limits](https://upstash.com/docs/vector/help/faq) / [pricing](https://upstash.com/pricing/vector). |
| Upstash Redis | Shared hosted sessions, protection and audit retention; not needed for ordinary local SQLite operation | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`: [console](https://console.upstash.com/). | Free tier available within its limits; paid usage beyond the chosen allowance. [Plans](https://upstash.com/pricing/redis). |
| Vercel / private Blob | Hosting and temporary private cloud media; not needed to start the ordinary local app | `BLOB_READ_WRITE_TOKEN`: create/connect a **private** Blob store in your own [Vercel project](https://vercel.com/dashboard). Hosting setup also uses server-side `CRON_SECRET` for cleanup. | Storage, transfer and operations have plan-specific allowances and charges. [Blob pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing). |

**Content retrieval also needs data, not just keys.** The team's 38,742-passage hosted index and original import archive are not distributed in this repository. An empty Vector index will not reproduce the hosted retrieval results. See [retrieval setup](docs/CONTENT-RETRIEVAL.md) for the expected corpus/schema and local Chroma alternative; use sources you have permission to ingest. The migration script requires an existing source index and does not download the missing corpus. The bundled training Q&A and Quran collection remain available in `data/`.

**Model access matters.** The current tuple extractor explicitly calls `gpt-5.6-luna`; its model selection is not overridden by `OPENAI_MODEL`. Other operations use their documented model settings. A fresh provider account must have access to each requested model; missing access or exhausted quota prevents that feature from completing.

The supported local Tavus route requires a model provider, Tavus credentials and ngrok. Keep its terminal open. Microphone/camera access requires browser permission; closing the launcher stops its owned local backend and tunnel. Legacy `LIVEAVATAR_*`, Echo `TAVUS_PAL_ID`, and general-call `TAVUS_FULL_PAL_ID` settings are **not** prerequisites for the current source-guided training route.

See [.env.example](.env.example), [detailed setup](docs/SETUP.md), [Tavus integration](docs/TAVUS.md), and [hosting setup](docs/VERCEL.md). No Vercel login or deployment is required to run the app locally.

## Checks

```bash
npm test
npm run build
npm run doctor
```

For browser tests, install Chromium once and make the app and Playwright use the same port (the test configuration defaults to 3001):

```bash
npx playwright install chromium
PORT=3001 npm run test:browser
```

On PowerShell: `$env:PORT="3001"; npm run test:browser`. Stop only your own server if that port is occupied. Linux may need Playwright's documented system dependencies. Browser/live tests have separate requirements; passing automated tests does not prove live provider credit or physical-device quality.

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
