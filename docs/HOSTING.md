# Hosting and data paths

Updated 6 October 2026.

| Component | Runtime/service |
| --- | --- |
| React/Vite frontend | Vercel static asset CDN |
| API and Tavus custom conversation gateway | Node.js / Express on Vercel Functions, `dub1` |
| Live microphone/camera/avatar | Tavus / Daily media transport |
| Question selection, follow-ups and assessment | Basira backend plus configured model provider |
| Vision, transcription, audio coaching | Configured OpenAI services |
| Hosted sessions, bounded audits, shared request counters | Upstash Redis over HTTPS |
| Imported content retrieval | Upstash Vector, 3,072 dimensions, 38,742 passages |
| Reports and local recording copies | Browser IndexedDB; no account-based cross-device library |
| Retained original media and large upload transport | Active private Vercel Blob in Dublin; protected playback, explicit deletion, 7-day retention |
| Retained media metadata and expiry index | Upstash Redis; hourly Vercel cleanup cron |

Local frontend calls the local backend. Live Tavus callbacks need a reachable authenticated development tunnel to that backend (`npm run dev:avatar`); local text/content review does not need the tunnel. Production callbacks use the production gateway. See SETUP.md.

Provider service regions, quotas and balances should be verified when operationally needed. The application does not infer them from keys or past successful calls. Source migration does not authenticate the imported books. See STATUS.md and CONTENT-SOURCE-IDENTITIES.md.

## Production boundaries

The browser uses the same application and model workflows in production. Production stores shared state in Redis and uses direct private Blob uploads to avoid the function request-body ceiling. Development uses a tunnel only for Tavus callbacks; production uses its public authenticated gateway. A separate database per workflow is unnecessary: Redis keys isolate sessions, audits, rate limits and media metadata; Vector indexes retrieval passages; Blob holds media bytes.

Current application limits: 5-minute avatar calls, 2.5-minute inactivity protection, 200 MiB/5-minute content recordings, 30 MiB images, 20,000-character text, 300-second function execution, and 7-day retained media/audits. Provider credits/concurrency remain external limits. Browser report libraries are device-local, not account-synchronized. Physical microphone/camera and noisy-room acceptance still require a person.
