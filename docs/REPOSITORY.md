# Repository guide

This repository contains the Basira web application and what is needed to run, test, deploy, and maintain it. Presentation materials are submitted separately.

| Location | Purpose |
| --- | --- |
| `src/` | React interface and browser integrations |
| `server/` | API handlers, models, media processing, source validation and audit storage |
| `api/` | Vercel entry point |
| `public/` | Application assets and required brand licenses |
| `data/` | Reference collections, training records, schemas and provenance |
| `tests/` | Unit, component, integration and browser checks |
| `docs/` | Setup, integration details, acceptance evidence and current status |
| `scripts/checks/` | Opt-in integration checks; live requests may consume credits |
| `scripts/deploy/` | Deployment and environment configuration utilities |
| `scripts/diagnostics/` | Runtime and service diagnostics |
| `scripts/setup/` | Provider configuration helpers |
| `scripts/sources/` | Dataset import, preparation and validation |
| `scripts/lib/` | Shared utility code |

Build and tool configuration files remain at the root. Start with the [README](../README.md) and [setup guide](SETUP.md).

## Local-only files

`.env`, `.vercel/`, `.local/`, `artifacts/`, and `deliverables/` are ignored. Never commit credentials, audit databases, uploaded recordings, or private session data. `.env.example` contains the shareable configuration template.

Presentation decks, recording guides, font studies and presentation generators are maintained outside the tracked application tree. They are not required to build or run the web app.
