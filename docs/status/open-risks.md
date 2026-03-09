# Rental Voice open risks

Last updated: 2026-03-09

## Highest risks

1. Founder/live backend exists, but the actual founder account still does not
- `Rental Voice Live` (`zsitbuwzxtsgfqzhtged`) is prepared, but `sawyerbeck25@gmail.com` is not bootstrapped yet
- Future sessions can mistake “live project prepared” for “founder account ready” if they do not read status first

2. Fresh live rollback is blocked by missing `pg_dump`
- This machine cannot create a fresh protected baseline right now because PostgreSQL client tooling is missing
- Live founder bootstrap execute should not happen until that is fixed

3. Durable account-backed AI learning is still not live
- Imported history and learning surfaces improved, but permanent founder-account-backed learning persistence is not the current app reality yet
- App container resets can still wipe local-only learning state before migration is completed

4. Current linked Supabase project is still the default local runtime
- `/Users/sawbeck/Projects/RentalVoice/server/.env` still points at `gqnocsoouudbogwislsl` by design
- Agents can accidentally run the wrong Supabase workflow if they do not separate `test` from `live`

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
- live founder env template and local live env file
- founder live-readiness checklist
- founder bootstrap packet generator
- founder bootstrap dry run manifest
- dedicated Supabase environment workflow runbook

## What remains blocked

- founder bootstrap execute until `pg_dump` is installed and a fresh baseline exists
- founder billing-bypass validation with a real founder session
- app-side founder login/recovery path
- durable learning migration into the founder account
- personal-to-founder migration rehearsal on a distinct rehearsal target
- any real commercial cutover
