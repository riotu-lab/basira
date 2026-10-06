# Application utilities

Run scripts from the repository root. Prefer the named commands in `package.json`.

- `setup/`: avatar/provider configuration.
- `deploy/`: hosting and environment utilities.
- `diagnostics/`: application health, source access and audit inspection.
- `checks/`: integration verification. Live checks may consume configured service credits and are not part of `npm test`.
- `sources/`: reference import, Q&A preparation and validation.
- `lib/`: shared utility code.

Generated evidence is written to ignored local directories. See the [repository guide](../docs/REPOSITORY.md) and [acceptance documentation](../docs/ACCEPTANCE.md) for scope and limitations.
