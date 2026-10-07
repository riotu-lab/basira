<p align="center"><img src="docs/assets/basira-logo.png" width="320" alt="Basira logo"></p>

<p align="center"><a href="README.md">العربية</a> · <strong>English</strong></p>

# Basira · بصيرة

Bilingual dialogue training and pre-publication content review, built by the RIOTU Lab team at Prince Sultan University, Riyadh. Supports Arabic RTL, source-linked feedback, and focused practice.

[Try Basira](https://basiraapp.vercel.app) · [Setup](docs/SETUP.md) · [Current status](docs/STATUS.md) · [Acceptance evidence](docs/ACCEPTANCE.md)

## For hackathon judges

**To try the full configured experience, open [the live demo](https://basiraapp.vercel.app).** No installation or personal API keys are required; demo availability remains subject to the team's provider credits and concurrent-session limits. [Watch the recorded walkthrough](https://www.youtube.com/watch?v=dRobDNQ9dP0).

**Judges running locally must supply their own API keys and service accounts.** The repository does not include the team’s keys or subscriptions. A populated local retrieval database is provided as a separate release download, outside Git history. An OpenAI key alone does not enable the Tavus avatar or complete source retrieval.

**To inspect or run the code, use the local setup below.** The app starts without credentials, but live AI actions require the relevant services. A local checkout runs its own backend: it does **not** silently use the team's production API, accounts, storage, or credits. Changing `NODE_ENV` or `BASIRA_ENV` to production is not a way to connect to the live demo.

## Project at a glance

```text
basira/
├── src/             React interface and browser interactions
├── server/          Backend, AI integrations and assessment
├── api/             Vercel API entry points
├── data/            Runtime reference data, training Q&A and licenses
├── public/          Web assets and branding
├── tests/           Automated and browser checks
├── scripts/         Setup, diagnostics and data preparation
├── services/        Optional Python retrieval service
├── docs/            Setup, architecture and acceptance documentation
├── .env.example     Empty configuration template; no working secrets
├── package.json     Dependencies and run/build/test commands
└── vercel.json      Hosting configuration
```

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

Keep credentials server-side. Never commit `.env` or put API keys in browser storage. A fresh checkout does not contain working service credentials; download the local index using the instructions below. Use your own accounts and a permitted source collection; the live demo runs separately from a local checkout.

<a id="services-keys-and-expected-costs"></a>

### Full local setup: services, keys, and data

For **avatar training plus source-backed content review**, provide **OpenAI, Tavus and ngrok accounts**, plus **the populated local Chroma database** from the [data release](https://github.com/riotu-lab/basira/releases/tag/retrieval-v1). No Upstash account is needed for this route.

**Local operation does not require Vercel, Vercel Blob or Upstash Redis.** Leave `BLOB_READ_WRITE_TOKEN`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` and `CRON_SECRET` empty. Development sessions/audit use SQLite; local originals remain in browser storage. This does not reproduce the team's optional cloud media storage.

Set keys only in your ignored local `.env`. Account registration alone does not ensure model access, available credits, or sufficient quotas. Plan allowances change; follow the official links before choosing a plan. Basira does not subscribe or purchase credits automatically.

| Service | When it is needed | Values to configure / where to obtain them | Credits or subscription |
| --- | --- | --- | --- |
| OpenAI API | Default text training/review; content extraction, image reading, transcription, embeddings and audio coaching | `OPENAI_API_KEY`: [API keys](https://platform.openai.com/api-keys). [Setup](https://developers.openai.com/api/docs/quickstart) / [billing](https://platform.openai.com/settings/organization/billing/overview). | API usage requires available billing quota or applicable credits and access to the requested models. This app uses API keys, not a ChatGPT sign-in/subscription integration. |
| Tavus | Live avatar voice/video training | `TAVUS_API_KEY`, `TAVUS_FACE_ID`: [developer portal](https://platform.tavus.io/). Set `AVATAR_PROVIDER=tavus`. The development launcher prepares `TAVUS_TRAINING_PAL_ID_DEV` and `BASIRA_PUBLIC_URL_DEV`. | Available conversation minutes and an available concurrent-session slot are required. Limited free-plan allowances may cover a short test; paid use is needed when allowances are exhausted. [Plans](https://www.tavus.io/pricing). |
| ngrok | Local Tavus callbacks to your own backend; unnecessary for text-only training | `NGROK_AUTHTOKEN`: [account authtoken](https://dashboard.ngrok.com/get-started/your-authtoken). Then run `npm run dev:avatar` instead of `npm run dev`. | A free plan is available with limits; paid features are optional depending on usage. [Plans](https://ngrok.com/pricing). |

**Local `.env` checklist:** keep other template defaults and fill the blank credential fields with your own values.

```dotenv
AI_PROVIDER=openai
OPENAI_API_KEY=
AVATAR_PROVIDER=tavus
TAVUS_API_KEY=
TAVUS_FACE_ID=
NGROK_AUTHTOKEN=
BASIRA_ENV=development
TRAINING_STORE=sqlite
AI_AUDIT_STORE=sqlite
CONTENT_RETRIEVAL_ENABLED=true

# Leave managed database credentials empty for local Chroma.
UPSTASH_VECTOR_REST_URL=
UPSTASH_VECTOR_REST_TOKEN=
```

### Install the populated local reference database

Use Python 3.12 and keep at least 3 GiB of disk space free. The download is about 606 MB; the installed database is about 1.03 GB. Commands below target Linux/macOS; use WSL on Windows.

```bash
python3.12 -m venv .local/rag-venv
.local/rag-venv/bin/python -m pip install -r services/content-retrieval/requirements.lock
.local/rag-venv/bin/python scripts/setup/install-local-retrieval.py
.local/rag-venv/bin/python scripts/dev/content-rag.py
```

The installer verifies the pinned SHA-256 checksum, refuses to overwrite an existing index, and configures `CONTENT_RAG_URL`, `CONTENT_RAG_DB_PATH` and a locally generated `CONTENT_RAG_TOKEN` in `.env` without displaying or changing other credentials. This token is a local service secret, not a paid provider key. Keep the retrieval terminal open, then run `npm run dev:avatar` in another terminal after adding your own OpenAI/Tavus/ngrok credentials. Use `npm run dev` instead for text-only training.

For a manual download, obtain the archive from the [data release](https://github.com/riotu-lab/basira/releases/tag/retrieval-v1), then pass `--archive /path/to/basira-retrieval-v1.tar.gz` to the installer. The index contains 38,742 `islamthon` passages. **Redistribution permissions and exact editions remain unverified; the release preserves source notices and grants no new license.** See [retrieval details](docs/CONTENT-RETRIEVAL.md#local-database-download).


**Model access matters.** The current tuple extractor explicitly calls `gpt-5.6-luna`; its model selection is not overridden by `OPENAI_MODEL`. Other operations use their documented model settings. A fresh provider account must have access to each requested model; missing access or exhausted quota prevents that feature from completing.

The supported local Tavus route requires a model provider, Tavus credentials and ngrok. Keep its terminal open. Microphone/camera access requires browser permission; closing the launcher stops its owned local backend and tunnel. Legacy `LIVEAVATAR_*`, Echo `TAVUS_PAL_ID`, and general-call `TAVUS_FULL_PAL_ID` settings are **not** prerequisites for the current source-guided training route.

See [.env.example](.env.example), [detailed setup](docs/SETUP.md), [Tavus integration](docs/TAVUS.md), and [local retrieval setup](docs/CONTENT-RETRIEVAL.md). No Vercel login or deployment is required to run the app locally.

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
- Images support originals up to 30 MiB; audio/video clips support up to 200 MiB and five minutes. Text review is bounded at 20,000 characters. Video uses sampled frames, so visual coverage is partial. Extraction and classification require human inspection.
- Missing evidence does not establish that a claim is false. Generated training records also require specialist review.
- Spoken-delivery coaching is qualitative; physical-device, dialect, and noisy-recording quality checks remain necessary.
- Saved report libraries are browser-local. Training state uses the configured server store; production uses Redis. Hosted original media remain private and available for review for up to seven days, with deletion supported. Server-side AI audit records are separate and may contain submitted text; see [audit storage and privacy](docs/AI-AUDIT.md).
- This is a hackathon application without user-account authentication. It never automatically publishes content.

## Repository guide

`src/` contains the React interface; `server/` contains API and provider integrations; `api/` is the Vercel entry point. `data/` holds reference datasets and licenses, `tests/` contains automated checks, and `docs/` covers operation and acceptance. Only the brand assets used by the application and their licenses are included. Presentation tooling, font experiments, recording guides, credentials, and private working notes stay local.

[Folder guide](docs/REPOSITORY.md) · [Content review](docs/CONTENT-REVIEW.md) · [Content retrieval setup](docs/CONTENT-RETRIEVAL.md) · [Reference dialogue](docs/REFERENCE-DIALOGUE.md) · [Spoken delivery](docs/SPOKEN-DELIVERY.md) · [Source collection](data/training/qa/README.md)
