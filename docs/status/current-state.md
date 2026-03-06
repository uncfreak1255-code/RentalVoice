# Rental Voice current state

Last updated: 2026-03-06

## Canonical source of truth

- Canonical workspace: `/Users/sawbeck/Projects/RentalVoice`
- Primary branch in use: `main`
- Current pushed HEAD should be checked directly with `git rev-parse --short HEAD`
- GitHub is now being used as a structured backup and collaboration remote, but the local workspace remains the operational source of truth during foundation work.

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
- Real founder/live app-auth environment: not created or selected yet

## Founder/auth truth

- `sawyerbeck25@gmail.com` is not present as an app-auth founder user in either known current Supabase project
- Supabase dashboard GitHub/passkey login is unrelated to app-user identity
- Founder app-auth account must be created intentionally later in a distinct live environment

## Safety / rollback truth

- Protected baseline rollback anchors currently available:
  - `protected-local-baseline-20260305`
  - `protected-local-baseline-20260306-head-d052d2b`
  - `protected-local-baseline-20260306-head-34fb528`
- Founder live-readiness manifest available:
  - `founder-live-readiness-20260306T161449Z`

## Implemented commercialization foundation

- Billing, entitlements, analytics, and founder diagnostics routes exist server-side
- Founder diagnostics now surface environment truth and readiness state
- Server-managed Hostaway paths for staged commercial flows exist
- Local-to-commercial / personal-to-founder migration base exists
- Founder bootstrap, live preflight, rehearsal preflight, and live-readiness checklist tooling exist
- Founder bootstrap packet generator exists

## Current engineering rule

Before risky work:

1. refresh the protected baseline
2. preserve personal-mode UX
3. do not bootstrap founder auth in the linked test project
4. do not treat current test projects as launch targets
