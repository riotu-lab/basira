# Optional local Docker setup

This runs Basira's own backend and populated Chroma retrieval database on your computer. It does not deploy anything or connect to the team's Vercel, Upstash or Blob storage. Docker is optional; the manual installation remains supported.

## Requirements

- Docker Engine with Compose v2, or Docker Desktop running Linux containers. On Windows enable **Settings → Resources → WSL Integration → Ubuntu-24.04 → Apply & Restart** when using that WSL distro.
- Internet access, space for container images plus at least 3 GiB free during database installation.
- Your own service credentials. Docker does not replace provider accounts or credits:

| Value in `.env` | Where to obtain it | Used for |
|---|---|---|
| `OPENAI_API_KEY` | https://platform.openai.com/api-keys | Conversation, extraction, embeddings and assessment; API credits required |
| `TAVUS_API_KEY` | https://platform.tavus.io/ | Avatar API; available conversational minutes required |
| `TAVUS_FACE_ID` | Your Tavus replica catalog | Accessible replica ID |
| `NGROK_AUTHTOKEN` | https://dashboard.ngrok.com/get-started/your-authtoken | Authenticated callback tunnel to your local backend; a free account can be used subject to its limits |

No Vercel, Redis or Upstash credentials are needed. No Python or Node installation is needed on the host.

## Start

From the repository root, if you do **not** already have `.env`:

```bash
cp docker/local.env.example .env
```

Edit `.env` with your own credentials, then:

```bash
docker compose up --build
```

Open **http://localhost:3000** after the app is healthy. First startup builds images and downloads the existing 606 MB reference archive, verifies its SHA-256, and installs 38,742 passages. Subsequent starts reuse the database. This is the same supplied corpus, not a new source collection; its provenance limitations remain documented in the release notice.

The avatar launcher creates/reuses a separate container-local development PAL and exposes only authenticated training callback routes through ngrok. It does not expose the whole app. Starting a conversation consumes your provider credits. Production PAL IDs and production storage credentials are not forwarded to the container application.

For text training/content review without an avatar, add `BASIRA_DOCKER_AVATAR=false` to `.env`. OpenAI is still required for live analysis. With no keys, the interface can start but paid AI actions are unavailable; no scripted response is silently substituted.

If port 3000 is occupied, set `BASIRA_LOCAL_PORT=3008` in `.env` and open http://localhost:3008. Other processes are not stopped.

## Stop and persistence

```bash
docker compose down
```

Named volumes preserve the reference database, local backend records and development avatar configuration. Browser reports and recordings remain in the same browser/origin. Finish any active call before stopping the stack.

To intentionally delete **all container-local data**, use `docker compose down -v`. This removes the database and saved backend records; the next start downloads the database again. It does not delete browser storage or your host `.env`.

## Troubleshooting and verification

```bash
docker compose ps
docker compose logs --tail=60 reference-setup retrieval app
docker compose config --quiet
```

- Missing credential errors list variable names, never values. Edit `.env` and recreate the app with `docker compose up -d --force-recreate app`.
- Failed download/checksum: retry startup after connectivity is restored; an invalid archive is not installed.
- ngrok/authentication/provider failures require fixing your own account or credits. They are not bypassed by Docker.
- Do not commit `.env`, copy it into an image, or share logs containing provider-returned private URLs.

## Verified on 7 October 2026

- Built both images and started the full Compose stack on Docker Desktop / Linux amd64.
- Downloaded and checksum-verified the release archive; loaded all 38,742 passages. Real local search returned the indexed sample; unauthenticated retrieval was rejected.
- Real Chromium checks: Arabic/English training and content pages at 390 px and 1440 px, with no horizontal overflow or JavaScript errors. These check the UI, not complete AI workflows.
- Real ngrok callback reached this exact container backend. Created and stopped one real Tavus session without joining the media call; no production PAL or storage settings were used.
- Restart preserved the training session and its question; test record deletion worked. Shutdown removed only this Compose stack and preserved its named volumes.
- 466 JavaScript tests and eight Python setup tests passed. Scanned 214 container application files against the configured credentials: no embedded credentials found. The application processes run as UID 10001 after reading the host-owned secret.

## Live workflow acceptance (7 October 2026)

A browser run using the real configured services exposed and fixed a Docker-only connection issue: the app's HTTP retrieval allowlist rejected the Compose service name. The launcher now explicitly permits `retrieval:8000` only in local development; Vercel and other hostnames remain excluded by regression tests.

- Text, image, audio and video uploads completed extraction, retrieval, AI assessment and final report generation. The inputs were synthetic, not human accuracy benchmarks.
- Image text could be corrected. Image/video visual reviews were generated. Audio/video remained playable and seekable. Report edits, export, save/reopen and deletion passed.
- Arabic text training completed real model feedback, retry and comparison. Original answers were preserved; reopening and deletion passed.
- English avatar training completed real WebRTC video, synthetic microphone speech transcribed by Tavus, reference-linked review and a typed targeted retry with comparison. Mic/camera toggles worked; the interruption control was exercised, but provider acknowledgement of interruption was not independently verified. Calls and test records were cleaned up.
- One initial avatar connection timed out; subsequent connections succeeded. An early test also ended at a partial transcript and was corrected to wait for a completed backend answer before reviewing. These results are not a guarantee against provider/network failures.

**Still requiring human acceptance:** physical microphone/camera quality, natural interruption timing and noisy-room performance. Other CPU architectures have not been tested.
