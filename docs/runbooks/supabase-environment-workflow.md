# Supabase environment workflow

Use this runbook whenever a task touches Supabase, auth, migrations, founder bootstrap, or environment promotion.

## Current environment map

### Test / rehearsal default

- Project label: `Rental Voice`
- Project ref: `gqnocsoouudbogwislsl`
- Local env file: `/Users/sawbeck/Projects/RentalVoice/server/.env`
- Env class: `test`
- Purpose: day-to-day development, rehearsal, migration testing, safe iteration

### Non-live forbidden founder targets

- `gqnocsoouudbogwislsl`
- `cqbzsntmlwpsaxwnoath`

Do not run founder bootstrap execute against either ref.

### Live founder target

- Project label: `Rental Voice Live`
- Project ref: `zsitbuwzxtsgfqzhtged`
- Local-only live env file: `/Users/sawbeck/Projects/RentalVoice/server/.env.live.local`
- Env class: `live`
- Current state: Rental Voice schema is applied, preflight passed, founder bootstrap dry run passed, founder auth user not created yet

## Default rule

- build once
- test on `test`
- promote deliberately to `live`

There is one product codebase and one migration history. There are two operational Supabase environments.

## Daily development workflow

1. Leave `/Users/sawbeck/Projects/RentalVoice/server/.env` pointed at `test`
2. Build app/server changes normally
3. If a change needs database updates, create one migration in `supabase/migrations/`
4. Apply and verify that migration on `test` first
5. Validate app behavior on `test`
6. Do not use `live` as a development sandbox

## Live promotion workflow

Use this only when a change is already verified on `test`.

1. Ensure PostgreSQL client tooling is installed so `pg_dump` works
2. Create a fresh protected baseline immediately before the live step
3. Load `/Users/sawbeck/Projects/RentalVoice/server/.env.live.local` intentionally in an isolated shell or worktree
4. Run:

```bash
npm run ops:founder:checklist
npm run ops:founder:packet
npm run ops:founder:preflight
```

5. Apply the exact same migration history or verified server changes to `live`
6. Validate the live result intentionally
7. Return normal development back to the linked `test` environment

## Founder bootstrap workflow

Only use this against `zsitbuwzxtsgfqzhtged`.

### Preconditions

- `pg_dump` is installed locally
- a fresh protected baseline was created immediately before execution
- `/Users/sawbeck/Projects/RentalVoice/server/.env.live.local` is loaded intentionally
- founder password has been chosen
- live preflight passes

### Safe sequence

```bash
npm run ops:founder:checklist
npm run ops:founder:packet
npm run ops:founder:preflight
npm run ops:founder:bootstrap -- --execute --yes --password '<temporary-password>'
```

### Required post-bootstrap validation

- `GET /api/auth/me`
- `GET /api/billing/status`
- `GET /api/entitlements/current`
- `GET /api/analytics/founder-diagnostics`

## Rules future agents must follow

- never overwrite the canonical test env permanently just to touch live
- never invent a second migration history for live
- never run founder bootstrap execute on `gqnocsoouudbogwislsl` or `cqbzsntmlwpsaxwnoath`
- never assume “live project prepared” means “founder account already exists”
- never do casual debugging on live founder data

## When a task does not need live

Do not load the live env file.
Stay on the linked `test` environment.
