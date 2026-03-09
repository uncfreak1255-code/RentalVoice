# Rental Voice — Current Engineering Context

## What this repo is now

Rental Voice is an Expo React Native app with a TypeScript backend in `server/`.

Primary folders:

- `/Users/sawbeck/Projects/RentalVoice/src`: mobile app
- `/Users/sawbeck/Projects/RentalVoice/server/src`: backend API
- `/Users/sawbeck/Projects/RentalVoice/ops`: checkpoint, rollback, migration, and baseline tooling
- `/Users/sawbeck/Projects/RentalVoice/docs/runbooks`: operational runbooks
- `/Users/sawbeck/Projects/RentalVoice/docs/status`: session-state and approved next work
- `/Users/sawbeck/Projects/RentalVoice/.agents`: agent workflow entry points

## Canonical source of truth

- Current canonical codebase: local workspace at `/Users/sawbeck/Projects/RentalVoice`
- GitHub remote is behind local and should not be treated as canonical until a controlled promotion happens
- Protected local baseline is now the rollback anchor

Protected baseline artifacts:

- `/Users/sawbeck/Projects/RentalVoice/ops/manifests/protected-local-baseline-20260305.json`
- `/Users/sawbeck/Projects/RentalVoice/ops/manifests/protected-local-baseline-20260305.baseline.json`
- `/Users/sawbeck/Projects/RentalVoice/ops/manifests/protected-local-baseline-20260306-head-d052d2b.baseline.json`
- `/Users/sawbeck/Projects/RentalVoice/ops/manifests/protected-local-baseline-20260306-head-34fb528.baseline.json`
- `/Users/sawbeck/Projects/RentalVoice/ops/manifests/protected-local-baseline-20260309-founder-live-execute.baseline.json`

Current founder/live readiness artifacts:

- `/Users/sawbeck/Projects/RentalVoice/ops/manifests/founder-live-readiness-20260309T230538Z.json`
- `/Users/sawbeck/Projects/RentalVoice/ops/manifests/founder-bootstrap-packet-20260309T230538Z.json`
- `/Users/sawbeck/Projects/RentalVoice/ops/manifests/founder-bootstrap-20260309T230555Z.json`
- `/Users/sawbeck/Projects/RentalVoice/ops/manifests/founder-bootstrap-20260309T233411Z.json`

## Current product modes

Rental Voice has two explicit operating modes:

- `personal`: current real user-facing app path
- `commercial`: staged future multi-user/server-managed path

Current default:

- `src/lib/config.ts` defaults to `personal`
- the current user-facing UX must remain Hostaway-first during foundation work

## Current UX truth

The current app is still organized around:

- Hostaway Account ID + API key onboarding
- personal-mode workflows
- local/device-first behavior where personal mode still applies

Do not assume:

- email/password auth is live in the current app UX
- the founder account is already the default app login path
- commercial mode is ready to become the default app path

## Current backend truth

Backend lives in `/Users/sawbeck/Projects/RentalVoice/server/src`.

Implemented staged backend capabilities already include:

- managed billing routes
- entitlements routes
- analytics ingestion
- founder diagnostics
- server-managed Hostaway routes for staged commercial flows
- local-learning migration routes

These exist, but they do not override the requirement that the current app remain personal-mode first until cutover is intentional.

## Supabase truth

Known current Supabase projects:

- `gqnocsoouudbogwislsl` (`Rental Voice`): linked local default project with test/smoke app users
- `cqbzsntmlwpsaxwnoath` (`uncfreak1255-code's Project`): legacy non-live project with no app auth users
- `zsitbuwzxtsgfqzhtged` (`Rental Voice Live`): dedicated live founder target with Rental Voice schema applied

Environment rules:

- `/Users/sawbeck/Projects/RentalVoice/server/.env` stays pointed at the linked `test` project for normal development
- `/Users/sawbeck/Projects/RentalVoice/server/.env.live.local` is the local-only live founder environment file
- do not relink the canonical repo away from `test` during normal development
- do not run casual development or experiments against `Rental Voice Live`

Founder bootstrap rules:

- forbidden founder bootstrap targets remain `gqnocsoouudbogwislsl` and `cqbzsntmlwpsaxwnoath`
- the real founder backend account now exists in `zsitbuwzxtsgfqzhtged` for `sawyerbeck25@gmail.com`
- treat that live founder account as persistent canary state, not disposable test data
- current app UX still does not expose founder auth as the default visible login path

## AI learning and migration truth

Current goal:

- preserve existing personal learning data
- import it one-way into the live founder account
- make founder-account-backed learning durable before using founder auth as the normal daily app path

Existing migration base:

- client snapshot builder: `/Users/sawbeck/Projects/RentalVoice/src/lib/commercial-migration.ts`
- server import route: `/Users/sawbeck/Projects/RentalVoice/server/src/routes/migration.ts`
- founder bootstrap script: `/Users/sawbeck/Projects/RentalVoice/ops/founder/bootstrap-founder-account.sh`
- founder bootstrap runtime: `/Users/sawbeck/Projects/RentalVoice/server/scripts/bootstrap-founder-account.ts`

Important current limitation:

- durable founder-account-backed learning is not live in the app UX yet
- local/device learning can still be lost if the app container resets before migration is completed

## Required operating discipline

Before risky work:

1. create or reference a protected baseline
2. keep current user-facing mode in `personal`
3. use `test` for iteration and rehearsal; use `live` only for deliberate promotion or founder validation work
4. if the task touches Supabase, auth, migration, or promotion, read `/Users/sawbeck/Projects/RentalVoice/docs/runbooks/supabase-environment-workflow.md`
5. treat GitHub promotion as a separate deliberate workflow
6. read the `docs/status/` files before starting a new implementation batch

Additional live-founder rule:

- do not recreate, rotate, or overwrite the live founder account casually
- future founder work should focus on app-side login/recovery and durable learning migration, not redoing backend bootstrap

## Start here

Read these in order:

1. `/Users/sawbeck/Projects/RentalVoice/AGENTS.md`
2. `/Users/sawbeck/Projects/RentalVoice/.agents/README.md`
3. `/Users/sawbeck/Projects/RentalVoice/docs/status/current-state.md`
4. `/Users/sawbeck/Projects/RentalVoice/docs/status/next-batch.md`
5. `/Users/sawbeck/Projects/RentalVoice/docs/status/open-risks.md`
6. `/Users/sawbeck/Projects/RentalVoice/docs/runbooks/protected-local-baseline.md`
7. `/Users/sawbeck/Projects/RentalVoice/docs/runbooks/local-canonical-promotion.md`
8. `/Users/sawbeck/Projects/RentalVoice/docs/runbooks/supabase-environment-workflow.md`
9. task-specific files
