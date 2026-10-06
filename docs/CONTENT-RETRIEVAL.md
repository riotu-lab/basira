# Content retrieval integration

The teammate's Chroma index supplies candidate passages for the extracted four-field items. It does not authenticate a hadith, verify a Quran quote, decide whether reasoning is sound, or issue religious approval. A separate AI judge and focused final report are connected locally and in production. The existing quotation-review action remains available.

## Data flow

1. Text/image/audio/video extraction produces editable text and structured items.
2. **Generate full report** runs retrieval and assessment automatically. The separate **Find sources for these passages** action is available for inspection.
3. Express validates the items against the original text (client IDs/offsets are not trusted).
4. The existing audited model client requests OpenAI `text-embedding-3-large`, 3,072 dimensions, once for the query batch.
5. Express sends vectors over authenticated HTTPS to Upstash Vector when configured, otherwise to the private Python service. The browser never receives database credentials or embeddings.
6. The selected database returns up to three candidates per item. Express validates the response and exposes exact excerpts and available locators.
7. Candidate passages are saved with the browser-local report, reopened, deleted and included in readable exports. Correcting the original text invalidates the extraction and retrieval.

Fiqh items search fiqh; Quran items search tafsir commentary; hadith/other items search all three collections. There is no dedicated hadith-verification collection. Results are nearest neighbours, not thresholded proof; an irrelevant query may still have candidates. Never use distance as a correctness score. The final judge must be able to reject every candidate.

## Corpus

- Collection: `islamthon`; 38,742 chunks: aqeeda 8,796; fiqh 1,078; tafsir 28,868.
- Stored model: `text-embedding-3-large`; cosine distance; dimensions 3,072.
- Original archive: `search.zip` (local and ignored); working copy: `.local/content-rag/vectordb`.
- About 1.03 GB unpacked. Original archive is preserved; Chroma may migrate/update the working copy.
- Page/part and surah/verse/section metadata exist. The source audit records declared encyclopedia titles, institutional attribution, candidate editions and sampled official-page correspondences; exact snapshots and reuse permissions remain unresolved (see CONTENT-SOURCE-IDENTITIES.md). UI labels this limitation; no URLs are invented.
- Current executable dependency versions are pinned in `services/content-retrieval/requirements.lock`.

## Managed Vector deployment (preferred)

Configure server-only `UPSTASH_VECTOR_REST_URL`, `UPSTASH_VECTOR_REST_TOKEN` and optional `UPSTASH_VECTOR_NAMESPACE` (default `basira-content-v1`). The index must use Dense / Custom embeddings / 3072 dimensions / COSINE. When either Upstash credential is present, partial configuration fails explicitly; there is no silent Chroma fallback. Local and hosted Express use the same adapter. No Python process is required at runtime with Upstash.

The adapter queries at most four items concurrently with a shared 30-second deadline, preserves item order and filters by source category. Passages carry a corpus marker, their original IDs and available locators. Scores are converted from Upstash's normalized cosine score to cosine distance, never treated as truth or confidence.

Migration (local, never shipped in the function):

```sh
.local/rag-venv/bin/python scripts/migrations/content-vector.py
```

This copies all 38,742 existing vectors, documents and metadata without generating new embeddings. Stable-ID upserts and an ignored checkpoint make it resumable. The original local corpus is retained. The supplied read/write token is required for migration; a read-only token may replace it in runtime settings afterward. Corpus source identity and permission verification are still separate human responsibilities.

Deploy credentials using `npm run deploy:env -- --retrieval-only`. They stay server-side and are included in the credential leak scan. `vercel.json` places functions in Dublin (`dub1`) alongside the chosen Ireland database. Production is deployed in Dublin; recheck vercel.json and the deployed configuration before future region changes.

## Alternative: local Chroma operation

The prepared environment is `.local/rag-venv`; it is excluded from Git/deployment. Start:

```sh
.local/rag-venv/bin/python scripts/dev/content-rag.py
```

The service binds only to `127.0.0.1:8010`. It reads `CONTENT_RAG_TOKEN` from local `.env`, without printing it. Express needs `CONTENT_RAG_URL=http://127.0.0.1:8010` and the same token. Restart Express after changing configuration. The original OpenAI key stays in Express; Python does not need it. If creating a fresh environment, install the lockfile using Python 3.12 and a virtual environment.

All endpoints require bearer authentication, including `/health`. `/search` accepts at most 30 vectors of exactly 3,072 finite numbers. Output is capped to three 6,000-character excerpts per item; shortened excerpts are marked. Missing configuration or service failure produces an explicit error, never sample results.

## Alternative: self-hosted Chroma deployment

Keep Basira's React/Express application on Vercel. Deploy `services/content-retrieval` as a separate Python container on a host with persistent writable storage and TLS. Chroma's local index is not an appropriate direct addition to the current Vercel function: its working database needs durable writable storage, and copying 1 GB at cold start is unsuitable.

Build from the narrowly scoped context:

```sh
docker build -t basira-content-retrieval services/content-retrieval
```

Mount a **working copy** of `vectordb` at `/data/vectordb`, owned/writable by UID 10001. Set `CONTENT_RAG_DB_PATH=/data/vectordb` and inject `CONTENT_RAG_TOKEN` as a server secret. Run one application worker initially to avoid duplicating the in-memory index. Port 8000 should be behind the hosting provider's HTTPS ingress; never expose a raw Chroma API. Health probes must send the bearer token to `/health` without logging it. Back up the original corpus separately. Provision persistent disk with headroom beyond the 1.03 GB index and measure memory under real load before scaling.

Set local `CONTENT_RAG_URL_PROD=https://<retrieval-host>` and `CONTENT_RAG_TOKEN_PROD` after provisioning the service. Run `npm run deploy:env -- --retrieval-only` to map them to Vercel server-only `CONTENT_RAG_URL` and `CONTENT_RAG_TOKEN`; local loopback configuration is never promoted automatically. The existing `OPENAI_API_KEY` handles embeddings. Never prefix these variables with `VITE_`. Deploy/restart Basira and test the full public route. The frontend bundle scan includes the retrieval token.

This alternative container host has not been provisioned. Production uses the connected Upstash Vector index and does not require this container. The Docker configuration is prepared but has not been built in this environment.

## Verification

- Original SQLite quick_check passed.
- Real embedding + Chroma queries passed for Arabic and English fiqh, Arabic Quran/tafsir, and an unrelated query; the last confirms nearest-neighbour search does not establish relevance.
- Local Express route returns candidate-only results; observed test requests took approximately 0.5–3 seconds, not a production latency guarantee.
- Automated checks cover model/dimension pinning, response validation, missing configuration and provider failures.
- Browser checks cover Arabic/English desktop/mobile display, errors, save/reopen and deletion using mocked retrieval.

Official deployment references: [Chroma clients](https://docs.trychroma.com/reference/python), [Vercel runtimes and filesystem](https://vercel.com/docs/functions/runtimes).

- Real browser extraction → embeddings → Chroma → displayed candidates passed in Arabic and English; test reports were deleted. Re-run with `BASIRA_TEST_URL=http://127.0.0.1:3007 node scripts/checks/content-retrieval-live.mjs` (uses model credits). This does not establish corpus-wide recall or source authenticity.

## AI judge and final report

**Generate full report** runs extraction, local quotation checks, then `/api/content/assess-item` sequentially for each item. Each request validates the original passages, retrieves fresh candidates server-side, judges the evidence/reasoning/conclusion separately, and runs an independent semantic check. Browser-supplied verdicts and citations are not trusted. Exact source excerpts are resolved from server passage IDs, rather than generated quotations. Empty input fields stay empty; missing or rejected evidence produces insufficient-evidence outcomes, never proof of falsity. Suggestions without supporting excerpts are removed.

The focused Arabic/English report preserves original content and media, shows status and exact citations, supports human acceptance/rejection/edits, filtering, export, save/reopen and deletion. Results save after each item; interrupted runs can resume without redoing completed items. Corrected input invalidates prior analysis. Unconfirmed image/transcript text and incomplete video coverage remain explicit. Suitable verified local quotation findings can launch practice; unverified retrieved claims do not automatically become practice material.

The report uses the validated judgment directly; it does not run a third free-form model call that could introduce new findings. Neither model agreement nor a reviewer accepting a finding establishes religious approval or source authenticity.

Run `node scripts/checks/content-assessment-live.mjs` against the local running app for real Arabic/English extraction → retrieval → judgment → report → human decision → export/save/reopen/deletion checks (uses model credits). Unit/API/browser tests distinguish mocked services from real model runs. Production uses the connected managed Upstash Vector adapter described above.
