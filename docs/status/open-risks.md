# Rental Voice open risks

Last updated: 2026-04-10

## Highest risks

1. Durable app identity is still missing from the default app architecture
- Users still enter Hostaway credentials as the visible first-step path
- That is a PMS connection flow, not a durable Rental Voice account identity
- Without account-backed identity, learning and recovery remain fragile

2. Founder canary is real, but the public account-first path is still missing
- The real founder backend account now exists in `Rental Voice Live`
- Founder Access now works in-app for sign-in, restore, migration, and managed drafts
- None of that is the same thing as a production-ready public account onboarding path

3. Durable account-backed AI learning is still founder-canary only
- Verified founder migration now exists in the app, but the default user path is still local-first
- Cold-start users still do not get an account-first learning experience or clear coverage guidance
- Server-canonical generation must be the only eval target; founder-only prompt scores are not proof that onboarding works for a new account

4. Current linked Supabase project is still the default local runtime
- `/Users/sawbeck/Projects/RentalVoice/server/.env` still points at `gqnocsoouudbogwislsl` by design
- Agents can accidentally run the wrong Supabase workflow if they do not separate `test` from `live`

5. The live founder account is now persistent state and must be protected
- `sawyerbeck25@gmail.com` in `zsitbuwzxtsgfqzhtged` is no longer disposable bootstrap target state
- Casual reruns or destructive founder tests can damage the real canary account

6. Personal-mode and founder/commercial assumptions can still drift
- Current product must remain Hostaway-first and personal-mode default
- Future sessions can accidentally optimize for staged founder/commercial paths before the app-side cutover work is approved

7. Sawyer-only evals are still easy to misread as product proof
- Founder canary coverage is useful, but it only measures whether the system can still sound like Sawyer
- Cold-start onboarding quality needs its own eval gate built around account creation, history import, and early-learning usability

8. Local environment metadata is intentionally local-only
- `/Users/sawbeck/Projects/RentalVoice/server/.env` and `/Users/sawbeck/Projects/RentalVoice/server/.env.live.local` are not committed truth
- The committed runbooks and status docs must stay aligned with those local files

## Operational mitigations in place

- protected baseline tooling
- explicit environment classification in runtime manifests
- live founder preflight
- rehearsal preflight with forbidden project-ref gating
- dedicated live founder project `zsitbuwzxtsgfqzhtged`
- local live founder env file
- founder live-readiness checklist
- founder bootstrap packet generator
- founder bootstrap dry run manifest
- founder bootstrap execute manifest
- dedicated Supabase environment workflow runbook
- fresh protected baseline `protected-local-baseline-20260309-founder-live-execute`

## Resolved risks

- **(2026-03-16)** Stuck sync banner — `onError` in auto-import.ts now clears `isSyncing` flag. OTA deployed.
- **(2026-03-14)** Voice pipeline bugs from 2026-03-12 audit — all 6 resolved (few-shot truncation, quality threshold, temporal weights, calibration bucketing, server confidence, MultiPass consumption)

## What remains blocked

- **Google AI API key expired** — blocks Gemini draft generation, semantic voice queries, and promptfoo eval suite. Need fresh key from Google AI Studio.
- public account-first onboarding path for non-founder users
- cold-start coverage/readiness UX that explains strength, weakness, and learning state to a new account
- founder billing-bypass validation from an app session
- personal-to-founder migration rehearsal on a distinct rehearsal target
- any real commercial cutover
- real founder and cold-start eval runs with a fresh Google AI API key
