# Setup and credentials

Updated 6 October 2026. See STATUS.md for release evidence and limitations.

## Run locally

Use Node.js 24 and npm. Run `npm ci`, copy `.env.example` to `.env` only if no local file already exists, configure credentials, then `npm run dev`. Open the URL printed by startup; default is http://localhost:3000. If occupied, identify the process and choose a free `PORT` rather than stopping an unrelated service. Restart after environment changes.

Keep secrets in ignored local files and server-side hosting settings. Never use VITE-prefixed secrets, browser storage or chat messages for provider keys. A configured badge proves presence, not account balance or quality.

| Capability | Values / source |
| --- | --- |
| Text/model assessment | `OPENAI_API_KEY` from the OpenAI API project dashboard, or `AI_PROVIDER=deepseek` plus `DEEPSEEK_API_KEY` for supported text tasks |
| Image vision/transcription/audio coaching | `OPENAI_API_KEY`; corresponding model settings in `.env.example` |
| Standalone speech | `OPENAI_TTS_MODEL`; `OPENAI_VOICE_AR` / `OPENAI_VOICE_EN` default to `onyx` |
| Live avatar | `TAVUS_API_KEY`, `TAVUS_FACE_ID` from the Tavus account; environment-specific training PAL setup below |
| Hosted sessions/audit/rate protection | Upstash Redis REST URL/token; see `.env.example` |
| Hosted content retrieval | Upstash Vector REST URL/token, Dense / Custom / 3,072 / COSINE; see CONTENT-RETRIEVAL.md |
| Larger hosted media uploads | Private Blob `BLOB_READ_WRITE_TOKEN`; requires separately authorized store connection; see LARGE-UPLOADS.md |
| Local direct Tavus callback | `NGROK_AUTHTOKEN`, development launcher below |

The current training meeting uses Tavus FULL with Basira as its custom conversation engine. Legacy Echo and LiveAvatar settings in `.env.example` are optional compatibility paths, not requirements for the current journey. No new LiveAvatar subscription is required to run Tavus training.

Browser automation currently uses Playwright/Chromium. If the execution environment denies it, report the exact restriction and continue other work; do not copy historical sandbox problems as current blockers or bypass security controls.

Content review: choose a type, provide content, and use Generate full report. Images are read automatically; the full-report action handles audio/video extraction before assessment. Manual correction and individual extraction actions remain available. Empty/synthetic preview reports never count as real analysis. Source matching does not authenticate unknown books or hadith.

## Unified source-guided FULL training

The default meeting uses Basira's canonical question bank and existing follow-up grounding gate. Tavus retains microphone transcription, turn-taking, speech and video; its custom LLM calls the Basira endpoint for every response. No reference answers are placed in the avatar greeting or browser-supplied prompt.

Development and production use the same training engine, with separate callback routing, credentials and records. Tavus calls the backend belonging to the current environment; development does not delegate decisions to production.

### Local development

Keep existing model-provider credentials, `TAVUS_API_KEY` and `TAVUS_FACE_ID` in `.env`. For text training, run `npm run dev`; no public callback or Redis is needed. Local sessions use SQLite under ignored `.local/training/`.

For native Tavus speech/video, add `NGROK_AUTHTOKEN` to `.env` from https://dashboard.ngrok.com/get-started/your-authtoken (an ngrok account is required). Never paste credentials into chat or commit them. Then run:

```bash
PORT=3006 npm run dev:avatar
```

Choose a free port or stop your own existing development server first. The command starts a loopback callback proxy, opens an HTTPS ngrok tunnel, creates or updates only the development training PAL, and starts the local application. It saves `BASIRA_PUBLIC_URL_DEV` and `TAVUS_TRAINING_PAL_ID_DEV` without displaying other credentials. Open the localhost URL printed by the command and keep its terminal open. Ctrl+C stops its backend and tunnel. Setup creates configuration, not a paid conversation or subscription; starting an avatar call consumes provider credits.

Only authenticated training callback routes are exposed through the tunnel—not the UI, other APIs or local files. Request inspection is disabled. Before a call, the backend checks that the public callback reaches the exact same local process and that the PAL matches its environment. Anonymous Cloudflare Quick Tunnels are unsuitable here because they do not support SSE. Development uses SQLite for training and audit records in this launcher. No deployment or Vercel login is required for local development.

### Production

Configure `BASIRA_PUBLIC_URL_PROD` with the deployed HTTPS origin. Create/update its separate PAL using:

```bash
npm run setup:tavus:training -- --environment production --update
```

This saves only `TAVUS_TRAINING_PAL_ID_PROD`. Production also requires existing model/Tavus credentials and hosted Redis (`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`, or `KV_REST_API_*` aliases). Synchronize using `node scripts/deploy/vercel-env.mjs --training-only` and redeploy to reload settings. The deployment helper excludes development URLs, PALs and ngrok tokens, sets `TRAINING_STORE=redis`, and rejects tunnel URLs. An optional `BASIRA_VERCEL_CONFIG` points the CLI at private writable config. An invalid Vercel login requires `vercel login` for deployment only.

Gateway credentials, training/Redis audit namespaces and browser resume lists are environment-scoped. `BASIRA_DEV_INSTANCE` distinguishes multiple developers; optional previews need their own `BASIRA_PREVIEW_INSTANCE`, URL and PAL. Development rejects reused production URLs or PALs. `NODE_ENV=production` alone does not select production data. Rotating the Tavus key requires PAL setup with `--update`. Existing unscoped records are left untouched and are not silently imported into the new namespaces. Existing generic FULL and Echo PALs remain unchanged.

Server training records have private 256-bit resume capabilities; keep them private like session cookies. The browser stores these session capabilities, not provider keys. Hosted records expire 30 days after their last write. Deletion removes the training record; quality-review audit data remains governed by its separate retention/deletion process. Reopening a session can terminate a previously active connection before resuming. Duplicate callbacks and callbacks from old call IDs cannot advance a newer session.

Checks:

```bash
npm test
BASIRA_TEST_URL=http://127.0.0.1:3005 npm run test:browser -- tests/browser/grounded-meeting.spec.ts
BASIRA_TEST_URL=http://127.0.0.1:3005 node --import tsx scripts/checks/training-session-live.ts
```

The last command consumes model tokens and tests real Arabic/English model review/retry with scripted reference-based answers and a synthetic transport lease. It creates and deletes its own records. It does **not** test live Tavus, physical microphones, cameras or what a listener actually heard. A human live acceptance pass remains necessary. Record-and-send standalone voice remains distinct from Tavus's native hands-free speech.

After the local tunnel is running (or the production callback is deployed) and the matching training PAL is configured, run a bounded real-provider acceptance check:

```bash
BASIRA_TEST_URL=http://127.0.0.1:3005 node scripts/checks/training-avatar-live.mjs
BASIRA_TEST_URL=http://127.0.0.1:3005 node scripts/checks/training-avatar-live.mjs --en --mobile
```

These commands consume Tavus minutes and model tokens. Each avatar call has a 55-second cleanup watchdog; the scripted retry runs by text after stopping the paid call. The browser's microphone/camera are synthetic. The script passed against the real local tunnel and Tavus gateway in Arabic desktop and English mobile-sized browsers on 6 October 2026, with scripted typed input and synthetic media. Spoken recognition, physical devices, interruption and perceived audio/lip-sync quality still require human acceptance. The older `meeting-live.mjs` check now explicitly targets the legacy general-call route, so its results cannot be mistaken for source-guided acceptance.


### Public request and audit bounds

Production paid endpoints require the existing server-only Redis credentials. A signed browser cookie and hashed network identifier enforce shared weighted allowances across instances (default 240 units/browser/minute, ten times that per network). Stop, finish, recovery and deletion remain available; there is no avatar restart cooldown. Provider callbacks are authenticated before consuming their allowance. Request-limit responses include Retry-After; unavailable protection storage fails explicitly.

Audit records expire after seven days and are pruned oldest-first to 1,000 records / 20 MiB. These are independent of training-session retention. Configure AI_AUDIT_RETENTION_DAYS, AI_AUDIT_MAX_RECORDS and AI_AUDIT_MAX_BYTES within the documented code bounds. Redis pruning is atomic and scoped to the audit namespace; local SQLite uses the same limits. Audio/video bytes are not retained in audit records.

Accepted, source-identified Quran discrepancy findings can launch focused practice. Seven-day signed tickets preserve the passage, evidence and criteria; expired tickets require regenerating the review. CONTENT_PRACTICE_SECRET and REQUEST_PROTECTION_SECRET are optional dedicated server keys; when absent existing OPENAI_API_KEY supplies HMAC key material. No provider secret is sent in a ticket. Imported book identities remain pending; see CONTENT-SOURCE-IDENTITIES.md.
