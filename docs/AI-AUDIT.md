# AI response audit log

Implemented 5 October 2026. This is the storage and interception layer for a later human performance/accuracy review interface. No public log-reading endpoint or human-review UI is exposed.

## What is recorded

Each public `ModelProvider` operation runs through `AiAudit.run`. The wrapper surrounds the **whole operation**, so it saves both raw provider output and Basira's final validation result. HTTP 200 with invalid evidence is a failed operation, not an approved answer.

Records include:

- UUID, creation/completion timestamps, operation name, duration, status and `reviewStatus: pending`.
- Request ID, API route, session ID where supplied, question ID/reference version/language where available. Client-supplied session IDs are correlation hints, not authenticated user identities.
- Operation inputs, model instructions, conversation context, reference answers, criteria and source evidence when supplied to that operation.
- Provider, endpoint, model/options, raw JSON/text response, provider request ID, HTTP status, and token usage when the provider returns it.
- The validated final output or a safe error code. A completed operation is **not** a human accuracy approval.

Coverage: conversation, follow-ups, discussion assessment, comparison, publication extraction/review, source/argument model calls, book drafting, transcription, speech and frame-text extraction through `ModelProvider`. New public model methods are automatically wrapped. Future direct `fetch` calls outside this provider must use the audit adapter explicitly.

The three dataset generation/editorial/deduplication scripts use `scripts/lib/audited-fetch.mjs`. Their provider responses and transport failures are logged, but **post-transport semantic validation remains in the existing dataset checkpoints**, not this transport record. Prior runs are not retroactively imported.

Tavus full video-call final assistant utterances are submitted using the session's authenticated encrypted handle and logged as **client-reported, unverified observations** with available preceding history. These are not signed provider webhooks. Browser/network interruption can prevent delivery; audit upload failure ends the call with an explicit error. Provider-managed hidden prompts, token usage and partial/unemitted responses are unavailable. Echo avatar replies already come through the logged text-model calls.

## Privacy and media boundaries

Authorization headers are never collected. Configured secret values, credential-named fields and common bearer/API-key patterns are redacted. Audio buffers and embedded image data are replaced by omission metadata; uploaded file content is not retained. Generated speech stores its input text plus byte length/hash, **not playable audio**. This supports text-response auditing, not listening back to speech or independently rechecking transcription/frame accuracy without the original media.

Prompts and transcripts **can contain personal information**: this is not automatic anonymization. A bilingual notice in the app explains server-side AI quality logging. Private SQLite files and exports belong under ignored `.local/`; never add them to Git. Browser-session deletion does not automatically delete the independent server audit log. Use the operator deletion command for audit records.

## Storage

- Local default: `.local/ai-audit/ai-calls.sqlite`, using Node's built-in SQLite (Node 22.13+ / the project's Node 24 environment). The table is `ai_calls`; each row contains JSON plus an indexed creation timestamp.
- Vercel default: existing Upstash Redis REST credentials, using `basira:ai-audit:v1:record:<uuid>` and a timestamp-sorted index. The JSON record and index are written together through `/multi-exec`.
- `AI_AUDIT_STORE=redis` can also use Redis locally. `AI_AUDIT_SQLITE_PATH` overrides the local path.
- Credentials: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`; existing `KV_REST_API_URL` / `KV_REST_API_TOKEN` are also recognized.
- `AI_AUDIT_ENABLED=false` explicitly disables collection. Tests disable it unless they explicitly opt in. `/api/config` reports configured backend/enabled status without returning secrets; configuration presence does not prove database reachability.
- There is **no automatic expiry**. Records stay until explicitly deleted or the database's own eviction/storage policy removes them. This implementation does not change provider plans, overage or eviction settings.

Vercel never silently falls back to ephemeral SQLite. If initial persistence fails, `ai_audit_unavailable` stops the operation before a billable model request. If final persistence fails after the provider replied, the application reports failure and the previously saved record remains `started`; that is an incomplete log, not a successful capture. This layer cannot guarantee retention across abrupt process termination or storage-provider loss.

## Operator commands (no public HTTP access)

```bash
# List metadata only; no prompts, transcripts or secrets printed.
npm run audit:ai -- --limit=50

# Export the latest records to a private file (maximum 1,000 per call).
npm run audit:ai -- --limit=1000 --export=.local/ai-audit/export.json

# Delete one record from the configured database and index.
npm run audit:ai -- --delete=RECORD_UUID

# Use the hosted store from an authorized local terminal:
AI_AUDIT_STORE=redis npm run audit:ai -- --limit=50
```

The later review UI still needs administrator authentication/authorization, filtering/pagination, human labels, reviewer notes and retention/deletion controls. Do not expose these records through an unauthenticated endpoint.

## Verification

- Production build and 227 automated tests passed. Four Arabic/English desktop/mobile browser regression journeys passed (mocked model replies). A real HTTP model request was also matched to its stored record and session ID.
- Unit tests cover raw output and token usage, post-response evidence rejection, secret/media redaction, concurrent context isolation, fail-before-provider behavior, incomplete final persistence, SQLite reopen/deletion, Redis command errors and transcription storage.
- Real model + SQLite write/reopen and real configured Redis write/read/delete passed using synthetic probe data. Redis probe keys were removed afterward. No avatar session was started for verification.
- Reproduce the opt-in live check: `npx tsx scripts/checks/ai-audit-live.ts`. It makes one model request and writes/deletes isolated Redis probe records.
- Verification report: `artifacts/reports/ai-audit-verification.json` (local, ignored by Git).

Official implementation references: [Node SQLite](https://nodejs.org/api/sqlite.html), [Upstash REST API and transactions](https://upstash.com/docs/redis/features/restapi).


## Production deployment status — 5 October 2026

The linked Vercel production environment was inspected: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are present. The deployment helper now includes audit settings and Redis credentials in its explicit allowlist. `--audit-only` configures `AI_AUDIT_ENABLED=true` and `AI_AUDIT_STORE=redis` without replacing service credentials.

The deployment attempt did not complete. The CLI first could not update its authentication file in the read-only home directory. A supported temporary configuration directory resolved that filesystem constraint, but Vercel then rejected the authentication token as invalid. The temporary private configuration was removed. The operator must run `vercel login` in their terminal before deployment and hosted write verification can continue. This is not a Redis-configuration failure and is not a completed production deployment.


## Production deployed and verified — 5 October 2026

The authentication blocker above was resolved after the operator logged in again. Production is now live at **https://basiraapp.vercel.app**, deployment `dpl_DpMcqKZHxViRTtWmdjoQ9Fpix9Ts`. `AI_AUDIT_ENABLED=true` and `AI_AUDIT_STORE=redis` were set explicitly; existing Redis and other service credentials were preserved.

Real Arabic and English hosted conversation requests returned HTTP 200. Each response was found in production Redis with matching output text, request ID, session ID and completed status. The records are identifiable synthetic quality-log probes. Evidence: `artifacts/reports/hosted-ai-audit.json`. Reproduce with `npx tsx scripts/checks/hosted-ai-audit.ts https://basiraapp.vercel.app` (two real model calls).

No avatar session was started for this verification. The human-review UI remains future work.

### Follow-up grounding coverage — 5 October 2026

`referenceFollowup` now captures two provider calls when a candidate is generated: generation and a separate scope/answerability check. The second request contains numbered verbatim reference-answer passages, source excerpts and criterion IDs; the response selects supporting passage IDs or rejects the candidate with a reason. Both raw responses remain in the same audit operation, including rejected wording. The final output records `model_checked`, `unsupported`, or `not_needed`; none is human religious approval. Invalid evidence/provider failure marks the operation failed and does not return the unchecked question. The learner-facing transcript never receives a rejected candidate or checker-only reference-answer excerpts.

### Assessment evidence coverage — 5 October 2026

`assessReference` records the full context, canonical reference/criteria, numbered learner passages, raw model passage-ID selections, and final server-resolved evidence (original quote, turn, offsets). The model no longer writes the learner quotation field. Audit records allow a reviewer to distinguish valid quotation provenance from potentially incorrect semantic judgments. Existing saved API output fields remain compatible.

### Quality coaching rubric — 5 October 2026

Sourced `assessReference` now also logs the fixed text-quality rubric and model findings, including language uncertainty and suggested rephrasing. Final outputs include the server-enforced transcription uncertainty status/explanation and exact resolved evidence. Raw model findings remain available for human comparison. Spoken delivery is explicitly not assessed. This does not extend general everyday-dialogue coaching or introduce audio analysis.

Audio coaching (`assessSpeech`) is audited locally and in production through the same ModelProvider wrapper. Binary input arguments and Chat Completions `input_audio.data` are replaced with hash/size metadata. Raw textual response, usage, selected segment IDs and validated coaching are retained, including failed validation. Audio recordings are not retained in this audit store.
