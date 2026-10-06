# Production readiness

Updated 6 October 2026. https://basiraapp.vercel.app

Basira is deployed on Vercel with static frontend assets and a Node/Express function in Dublin (`dub1`, see vercel.json). The configured function duration is 180 seconds. Upstash Redis supports hosted session/audit/request protection; Upstash Vector hosts the imported retrieval corpus. Tavus uses the authenticated Basira custom conversation gateway. OpenAI handles configured model/vision/audio tasks; text-model alternatives are documented in SETUP.md.

Private source artifacts, credentials, recordings, decks and operational test output are excluded from public/frontend bundles. Production credential scans cover frontend and function output. Browser APIs never receive provider secret keys.

Implemented controls include provider cleanup, call time/inactivity limits, shared weighted request protection, bounded audit storage, validated evidence and human decisions. Content reports retain browser copies; production originals and training clips also use private Blob storage for seven days, with protected playback and deletion. Reports are not account-synchronized. These controls are not proof of reliability under arbitrary load or accuracy for every religious claim.

See STATUS.md for the current upload-expansion release status and blockers, ACCEPTANCE.md for real versus mocked evidence and remaining physical-device checks, and CONTENT-SOURCE-IDENTITIES.md for imported-corpus provenance. Large hosted uploads use the connected private Blob store; Vercel Pro alone does not remove the function request-body limit.

No subscription, overage policy or spending cap is automatically changed by application deployment. Do not state that current provider balances or concurrency capacity have been verified unless a fresh account check was performed.
