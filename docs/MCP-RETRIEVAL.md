# Basira source retrieval — implementation and acceptance

> **Successful download retry, 4 October 2026:** All eight active resources are now local. Both new Judaism PDFs were downloaded and their stored hashes verified. The 153-page Old Testament book yielded extractable text; the 216-page ifham book needs OCR. The active index contains 3,517 chunks and six books have draft inputs. Earlier DNS-failure notes below are historical. No new training questions were generated.

> **Network-change retry, 2026-10-04:** Both MCP services completed live initialization and tool discovery once; subsequent requests still had network/DNS failures, so search/open retrieval remains unverified. Six book resources are now cached locally; the importer rebuilt 2,860 chunks and prepared draft inputs for four books. Google Doc access is denied, one Hinduism resource needs OCR, and the Judaism source identity needs verification. No new model-generated questions were produced. Earlier failure descriptions below are historical; see [current status](STATUS.md).

Updated 2026-10-04. The two approved services are integrated into the existing Node backend:

- Islamic Content: `https://mcp.islamiccontent.org/mcp`
- Turath AI: `https://api.turath.ai/mcp`

Basira uses its own server-side MCP client; no external example client or turath.io wrapper is required. Avatar integration remains separate.

## What runs when someone reviews content

1. The configured text model extracts quotation claims and evidence/reasoning/conclusion chains concurrently from the supplied text/transcript/frame text.
2. Existing local Quran quotation/attribution checks run unchanged.
3. Basira opens a separate MCP session with each provider, discovers actual tools/schemas, and limits execution to the named read-only search/open tools. The configured text model plans calls using the discovered schemas. It can stop without a result; no source is invented to fill a quota.
4. Up to four calls per provider search and open relevant passages. Each provider has a 50-second processing budget; calls have 15-second network timeouts. The two providers run concurrently. An oversized response, repeated pagination cursor, unsupported schema/protocol, or outage is recorded as failure rather than silently interpreted as evidence.
5. Selected references must contain an exact excerpt, title and HTTPS source URL from the **same opened response**, linked to an existing argument ID. Search snippets and library-item metadata are not accepted as opened evidence. Basira generates its own reference IDs.
6. The model compares each argument part using only its attached references. Quran wording alone cannot validate reasoning. External texts support only their attributable published positions, not universal consensus, independent hadith authentication, religious approval or permission to publish.
7. Reports show sources and retrieval status in Arabic/English; originals, judgments, decisions and source snapshots persist through existing report storage/export. Corrections clear obsolete judgments.
8. Stateful MCP sessions receive a best-effort DELETE on completion or failure. User cancellation propagates to requests. Failure does not erase existing local findings or become proof that a claim is false.

Implementation: `server/mcpClient.ts`, `server/sourceRetrieval.ts`, `server/model.ts`, `server/argumentReview.ts` and `/api/content/review` in `server/app.ts`.

This is bounded MCP-assisted retrieval for publication review. It is **not** a completed full-book RAG corpus, a replacement for the prepared training bank, or a general religious authority.

## Configuration

External retrieval is enabled by default. To use only local Quran checks, set `CONTENT_RETRIEVAL_ENABLED=false`.

Optional private server-side variables:

```dotenv
CONTENT_RETRIEVAL_ENABLED=true
ISLAMIC_CONTENT_MCP_TOKEN=
TURATH_MCP_TOKEN=
```

Islamic Content advertises anonymous access. Turath's actual authentication requirements must be confirmed by a live handshake. Supply a token only when issued/required by that service. Do not put model keys in these variables. No tokens, API credentials or raw session IDs are sent to the frontend or saved with reports. The two destinations are fixed in server code; content cannot redirect authentication to another host.

The configured model provider performs planning, excerpt selection and assessment, so normal model API usage applies when a real review runs. MCP configuration does not require changing the avatar pipeline or switching text-model providers.

## Live diagnostics

```bash
npm run check:sources
```

This uses no model calls and prints only provider status, error category and advertised tool names. It saves tool schemas/instructions to ignored `.local/source-mcp/` files for inspection, then releases sessions.

**Observed this session:** both endpoint initialization attempts failed with `EAI_AGAIN` (DNS). No live tool discovery, source retrieval, live model judgment or hosted deployment is claimed. No DNS setting or security control was bypassed.

Run diagnostics from a network-permitted normal terminal to obtain real schemas. If they differ from the approved names/transport, adapt the client after inspecting those exact schemas; do not guess successful behavior from mocked fixtures. The client currently negotiates MCP 2025-06-18 or 2025-03-26 Streamable HTTP and supports JSON/SSE responses. Authentication, rate limits, newer protocol negotiation and actual response structures remain live acceptance checks.

## Acceptance checklist

- [x] JSON and fragmented-SSE protocol fixtures, session/version headers, pagination guards, errors, bounded response bodies, session cleanup.
- [x] Exact source excerpt/title/URL validation; invented references, arbitrary fetch URLs, search snippets and metadata-only entries rejected.
- [x] Full Express review route with simulated model and MCP services: extraction → retrieval → comparison → report.
- [x] Failure path preserves local results and marks insufficient external evidence.
- [x] Arabic/English status rendering; saved report/export paths retain evidence and reviewer decisions.
- [ ] Real Islamic Content discovery, hadith/verse retrieval and comparison with publisher pages.
- [ ] Real Turath discovery, research ID reuse, source opening, citations and session termination.
- [ ] Physical Arabic/English media, corrected transcripts, and desktop/mobile visual inspection.
- [ ] Network/rate-limit recovery with real services and hosted Vercel runtime.
- [ ] Broader specialist assessment of reference relevance and argument judgments.

## Training-bank work remains separate

The eight current source URLs (two per background) and extraction scopes are recorded in `data/training/resources.json`. Run `npm run sources:books` to download/extract/index them, then `npm run sources:book-drafts` to prepare page windows. Model-generated questions require source checks before entering the live bank. All eight active resources are local after the successful retry; text quality and OCR remain pending. Question extraction is still pending, so the live bank remains the two existing starter questions—not the requested 40–70 per background.

## Recorded checks for this implementation

- Full JavaScript/TypeScript test suite: **194 passed** before the final two additional UI status cases.
- Final focused MCP protocol/provenance/API/UI run: **24 passed**, including those two Arabic/English status cases.
- Offline book-ingestion tests: **8 passed**.
- Final TypeScript and production build: passed. Dependency directive warnings remain nonfatal.
- Real endpoints: initialization attempted for each; both failed DNS with `EAI_AGAIN`. No successful live retrieval is claimed.
- No new browser or live avatar session was run; no deployment or paid-plan change was made.
