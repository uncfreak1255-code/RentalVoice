# Rental Voice current state

Last updated: 2026-03-09

## Canonical source of truth

- Canonical workspace: `/Users/sawbeck/Projects/RentalVoice`
- Primary branch in use: `main`
- Current pushed HEAD should be checked directly with `git rev-parse --short HEAD`
- GitHub is being used as a structured backup and collaboration remote, but the local workspace remains the operational source of truth during foundation work.

## Current product truth

- Current user-facing mode: `personal`
- Current visible onboarding/auth flow: Hostaway Account ID + API key
- Current visible UX must remain Hostaway-first until an explicit cutover
- Commercial mode remains staged and non-default

## Current Supabase truth

- Linked project in local server env:
  - `SUPABASE_PROJECT_LABEL="Rental Voice"`
  - `SUPABASE_PROJECT_REF=gqnocsoouudbogwislsl`
  - `SUPABASE_ENV_CLASS=test`
- Known non-live / forbidden founder bootstrap targets:
  - `gqnocsoouudbogwislsl`
  - `cqbzsntmlwpsaxwnoath`
- Dedicated live founder project prepared:
  - `SUPABASE_PROJECT_LABEL="Rental Voice Live"`
  - `SUPABASE_PROJECT_REF=zsitbuwzxtsgfqzhtged`
  - Rental Voice schema is applied there
  - local live env file exists at `/Users/sawbeck/Projects/RentalVoice/server/.env.live.local`
- Normal development must continue on the linked `test` project unless the task explicitly requires controlled live validation

## Founder/auth truth

- `sawyerbeck25@gmail.com` is not present yet as an app-auth founder user in the live project
- Supabase dashboard GitHub/passkey login is unrelated to app-user identity
- Founder live-prep is complete through:
  - live env creation
  - schema push
  - founder checklist/packet generation
  - founder preflight pass
  - founder bootstrap dry run
- Founder bootstrap execute has not run yet

## Safety / rollback truth

- Protected baseline rollback anchors currently available:
  - `protected-local-baseline-20260305`
  - `protected-local-baseline-20260306-head-d052d2b`
  - `protected-local-baseline-20260306-head-34fb528`
- Founder readiness artifacts currently available:
  - `founder-live-readiness-20260309T230538Z`
  - `founder-bootstrap-packet-20260309T230538Z`
  - `founder-bootstrap-20260309T230555Z`
- Fresh protected baseline creation is still blocked on this machine until `pg_dump` is installed
- Existing baselines are sufficient for planning and rehearsal, but not the final live founder bootstrap execute step

## Implemented commercialization foundation

- Billing, entitlements, analytics, and founder diagnostics routes exist server-side
- Founder diagnostics surface environment truth and readiness state
- Server-managed Hostaway paths for staged commercial flows exist
- Local-to-commercial / personal-to-founder migration base exists
- Founder bootstrap, live preflight, rehearsal preflight, and live-readiness checklist tooling exist
- Founder bootstrap packet generator exists
- Dedicated live founder project now exists and is ready for intentional bootstrap execution

## Current engineering rule

Before risky work:

1. refresh or reference the protected baseline
2. preserve personal-mode UX
3. keep `/Users/sawbeck/Projects/RentalVoice/server/.env` pointed at `test`
4. use `/Users/sawbeck/Projects/RentalVoice/server/.env.live.local` only for deliberate live-founder work
5. do not bootstrap founder auth until `pg_dump` is installed, a fresh baseline exists, and the founder password is chosen
6. do not treat live as a casual development sandbox
