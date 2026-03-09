# Rental Voice next batch

Last updated: 2026-03-09

## Approved next engineering batch

Build the app-side founder login/recovery and durable learning migration lane on top of the now-bootstrapped live founder backend.

## Scope

1. Add a safe founder auth entry/recovery path without replacing the default Hostaway-first personal path
2. Detect and restore the founder session cleanly when the app/container resets
3. Design and implement the personal-to-founder learning migration path using the existing migration base
4. Ensure founder-backed learning survives app resets while current personal-mode behavior stays stable during the transition
5. Validate founder-specific backend surfaces from the app side after session establishment

## Constraints

- Keep the visible personal-mode UX stable as the default current user path
- Keep Hostaway-first onboarding as the default visible onboarding/auth flow
- Do not relink `/Users/sawbeck/Projects/RentalVoice/server/.env` away from the linked `test` project
- Do not use `Rental Voice Live` as a casual dev sandbox
- Do not wipe or recreate the live founder account/data during implementation
- Do not make email/password auth the default app path until the cutover is explicitly approved

## Likely files

- `/Users/sawbeck/Projects/RentalVoice/src/lib/commercial-migration.ts`
- `/Users/sawbeck/Projects/RentalVoice/src/lib/store.ts`
- `/Users/sawbeck/Projects/RentalVoice/src/lib/secure-storage.ts`
- `/Users/sawbeck/Projects/RentalVoice/src/app/`
- `/Users/sawbeck/Projects/RentalVoice/server/src/routes/migration.ts`
- `/Users/sawbeck/Projects/RentalVoice/docs/runbooks/supabase-environment-workflow.md`
- `/Users/sawbeck/Projects/RentalVoice/docs/status/`

## Definition of done

- The founder account can be restored intentionally from the app side
- Founder session recovery does not depend on fragile local-only onboarding flags
- Durable learning migration into the founder account is implemented or explicitly staged with verified data paths
- The current personal-mode default remains intact while the founder path is being hardened
