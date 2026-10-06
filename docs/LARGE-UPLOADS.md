# Private review media

Basira uses a dedicated private Vercel Blob store in Dublin for original content uploads and training recordings. Existing Upstash Redis stores bounded report/clip metadata and signed media references; Upstash Vector remains the retrieval index.

## Lifecycle

- Production uploads go directly from the browser to private Blob using a ten-minute capability restricted to one path, MIME and maximum size. Provider credentials never reach the browser.
- Originals remain available for seven days after upload, including after extraction and analysis. Reports retain their local originals and cloud references; the player can seek to cited timestamps.
- Playback requires the signed media handle and is proxied in at most 2 MiB ranges, below Vercel's response-size limit. A handle grants access: treat it as private.
- Deleting the report/clip deletes its cloud original. Failed deletion remains retryable. Cloud access expires at seven days; an authenticated hourly Vercel Cron removes expired files. Abandoned uploads older than one hour are eligible for cleanup.
- Processing scratch files are temporary. The older temporary-upload fallback deletes its own processing copy, not the retained original.
- Local development keeps its browser originals and uses local processing; automatic cloud retention is enabled in production builds. Reports are not account-synchronized across devices. Deleting browser storage loses the local report and its access reference; the cloud object still expires automatically.

## Limits and operation

Original images: 30 MiB. Audio/video: 200 MiB, maximum 300 seconds per content upload. Image analysis uses a browser-prepared copy at most 3 MiB and 2,560 pixels; the original is retained. Training capture rotates into short clips, and cloud saves do not pause the next recording.

Server-only `BLOB_READ_WRITE_TOKEN`, Redis REST credentials and `CRON_SECRET` are required. `/api/media/policy` reports availability. The cron endpoint requires `Authorization: Bearer CRON_SECRET`. Storage and transfer are metered separately from AI usage.

Real storage checks: `node scripts/checks/retained-media-live.mjs` with `BASIRA_TEST_URL` set to the target. Tests upload synthetic media, confirm denied public access, protected range playback, metadata save, and deletion. Unit tests verify expiry and cleanup without waiting seven days. Physical-device playback and recording still require acceptance testing.
