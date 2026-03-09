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
- Dedicated live founder project:
  - `SUPABASE_PROJECT_LABEL="Rental Voice Live"`
  - `SUPABASE_PROJECT_REF=zsitbuwzxtsgfqzhtged`
  - Rental Voice schema is applied there
  - local live env file exists at `/Users/sawbeck/Projects/RentalVoice/server/.env.live.local`
- Normal development must continue on the linked `test` project unless the task explicitly requires controlled live validation

## Founder/auth truth

- The live founder backend account now exists for `sawyerbeck25@gmail.com`
- Founder bootstrap execute completed successfully on `2026-03-09`
- Validated live founder state:
  - auth sign-in succeeded with the stored local founder password
  - `users` row exists
  - owner membership exists
  - `org_settings` row exists
  - `org_entitlements` row exists with `plan_tier=enterprise`
- Current founder backend identifiers:
  - founder user id: `502b3aa7-0793-458f-881d-3929a859ab6b`
  - founder org id: `600c7934-8e01-425f-a60c-14c5e7b5c36c`
- Current app UX still does not use founder auth as the default visible login path

## Safety / rollback truth

- Protected baseline rollback anchors currently available:
  - `protected-local-baseline-20260305`
  - `protected-local-baseline-20260306-head-d052d2b`
  - `protected-local-baseline-20260306-head-34fb528`
  - `protected-local-baseline-20260309-founder-live-execute`
- Founder readiness artifacts currently available:
  - `founder-live-readiness-20260309T230538Z`
  - `founder-bootstrap-packet-20260309T230538Z`
  - `founder-bootstrap-20260309T230555Z`
  - `founder-bootstrap-20260309T233411Z`
- `pg_dump` is now available locally via Homebrew `libpq`
- The founder bootstrap execute step now has a fresh protected baseline immediately before it

## Implemented commercialization foundation

- Billing, entitlements, analytics, and founder diagnostics routes exist server-side
- Founder diagnostics surface environment truth and readiness state
- Server-managed Hostaway paths for staged commercial flows exist
- Local-to-commercial / personal-to-founder migration base exists
- Founder bootstrap, live preflight, rehearsal preflight, and live-readiness checklist tooling exist
- Founder bootstrap packet generator exists
- Dedicated live founder project exists and now contains the real founder backend account

## Current engineering rule

Before risky work:

1. refresh or reference the protected baseline
2. preserve personal-mode UX
3. keep `/Users/sawbeck/Projects/RentalVoice/server/.env` pointed at `test`
4. use `/Users/sawbeck/Projects/RentalVoice/server/.env.live.local` only for deliberate live-founder validation or promotion work
5. do not recreate or overwrite the live founder account casually
6. do not treat live as a casual development sandbox
