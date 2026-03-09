# Rental Voice open risks

Last updated: 2026-03-09

## Highest risks

1. Founder backend exists, but founder auth is not app-ready yet
- The real founder backend account now exists in `Rental Voice Live`
- The current app still does not expose a durable founder login/recovery path as normal UX

2. Durable account-backed AI learning is still not live in the app
- Imported history and learning surfaces improved, but permanent founder-account-backed learning persistence is not the current app reality yet
- App container resets can still wipe local-only learning state before migration is completed

3. Current linked Supabase project is still the default local runtime
- `/Users/sawbeck/Projects/RentalVoice/server/.env` still points at `gqnocsoouudbogwislsl` by design
- Agents can accidentally run the wrong Supabase workflow if they do not separate `test` from `live`

4. The live founder account is now persistent state and must be protected
- `sawyerbeck25@gmail.com` in `zsitbuwzxtsgfqzhtged` is no longer disposable bootstrap target state
- Casual reruns or destructive founder tests can damage the real canary account

5. Personal-mode and founder/commercial assumptions can still drift
- Current product must remain Hostaway-first and personal-mode default
- Future sessions can accidentally optimize for staged founder/commercial paths before the app-side cutover work is approved

6. Local environment metadata is intentionally local-only
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

## What remains blocked

- app-side founder login/recovery path
- durable learning migration into the founder account
- founder billing-bypass validation from an app session
- personal-to-founder migration rehearsal on a distinct rehearsal target
- any real commercial cutover
