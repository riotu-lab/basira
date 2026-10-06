# Vercel deployment

Current production: https://basiraapp.vercel.app. Updated 6 October 2026.

React/Vite static frontend and Node/Express API run in the linked Vercel project. `vercel.json` selects Dublin (`dub1`) and a 180-second API duration. Upstash Vector provides persistent retrieval; no Python service is needed in this deployment. Upstash Redis supplies shared sessions, audit retention and request protection. Tavus calls the environment-scoped authenticated training gateway.

## Deploy

Authenticate using `vercel login`. Keep credentials in local ignored environment files or server-side Vercel environment settings. See SETUP.md and `.env.example` for values. `scripts/deploy/vercel-env.mjs` uses an explicit allowlist and sends values through CLI stdin; review its options before use.

```sh
npm test
npm run build
vercel build --prod
node scripts/security/check-deployment.mjs --functions
vercel deploy --prebuilt --prod --yes
```

Confirm the production alias and `/api/health`. Distinguish hosted UI checks with mocked responses from real-provider checks. Keep live avatar tests bounded with stop/cleanup in finally. Deployment does not authorize paid upgrades or overage changes.

## Uploads

Vercel Functions have a 4.5 MB request-body limit. Raw content uploads use a 4 MiB allowance. The connected private Blob path supports larger files without routing upload bytes through the function; see LARGE-UPLOADS.md and STATUS.md for activation and release verification. FFmpeg/ffprobe remain bundled for decoding; temporary processing directories are removed in finally. Server processing duration and response size remain bounded.

`.vercelignore` and function exclusions omit secrets, local documents, presentation material, recordings, tests and source-preparation artifacts. The security checker inspects frontend and function output for configured secret values. Uploaded user media must never be added to build assets.

Historical LiveAvatar credit/DNS failures and earlier deployment blockers were archived locally and do not describe the current Tavus release. Do not infer current balances from those historical checks.
