# Rental Voice next batch

Last updated: 2026-03-09

## Approved next engineering batch

Complete the intentional founder bootstrap execution gate for `Rental Voice Live`, then begin the app-side founder account and durable learning migration lane on top of that prepared live backend.

## Scope

1. Install PostgreSQL client tooling so `pg_dump` is available locally
2. Create a fresh protected baseline immediately before any live founder execute step
3. Execute founder bootstrap once against `zsitbuwzxtsgfqzhtged` with an intentionally chosen founder password
4. Validate founder backend endpoints after bootstrap
5. After bootstrap succeeds, design and implement the app-side founder entry/recovery path and durable learning migration without making founder auth the default visible UX yet

## Constraints

- Keep the visible personal-mode UX stable
- Keep Hostaway-first onboarding as the default current user path
- Do not relink `/Users/sawbeck/Projects/RentalVoice/server/.env` away from the linked `test` project
- Do not run bootstrap or migration against `gqnocsoouudbogwislsl` or `cqbzsntmlwpsaxwnoath`
- Do not use `Rental Voice Live` as a casual dev sandbox
- Do not make email/password auth the default app path until the cutover is explicitly approved

## Likely files

- `/Users/sawbeck/Projects/RentalVoice/server/.env.live.local`
- `/Users/sawbeck/Projects/RentalVoice/ops/founder/`
- `/Users/sawbeck/Projects/RentalVoice/docs/runbooks/supabase-environment-workflow.md`
- `/Users/sawbeck/Projects/RentalVoice/src/lib/commercial-migration.ts`
- `/Users/sawbeck/Projects/RentalVoice/server/src/routes/migration.ts`
- `/Users/sawbeck/Projects/RentalVoice/docs/status/`

## Definition of done

- `pg_dump` is available locally
- A fresh protected baseline exists for the live founder execution step
- Founder bootstrap execute has run once against `zsitbuwzxtsgfqzhtged`
- Founder validation endpoints have been checked successfully
- The next app-side founder auth and durable learning migration slice is explicitly staged without breaking the current personal-mode default
