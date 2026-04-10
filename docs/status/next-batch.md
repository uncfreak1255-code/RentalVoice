# Rental Voice next batch

Last updated: 2026-04-10

## Approved next engineering batch

Move from founder-only canary to public account-first onboarding proof without breaking the current Hostaway-first default path before cutover is approved.

## Scope

1. Define the public account-first app entry contract: `Create account / Sign in` before `Connect Hostaway`
2. Design the cold-start onboarding wedge so a brand-new account can reach useful drafts without Sawyer-specific history
3. Expose voice-readiness and coverage state in a way a new user can understand during early learning
4. Add eval coverage for first-session and first-week quality, not just founder replay quality
5. Keep founder canary as the protected proving lane while the public path is staged behind explicit gates

## Constraints

- Keep the current visible personal-mode UX stable until the public cutover is explicitly approved
- Do not treat founder canary success as proof that a new user experience is ready
- Do not relink `/Users/sawbeck/Projects/RentalVoice/server/.env` away from the linked `test` project
- Do not use `Rental Voice Live` as a casual dev sandbox
- Do not wipe or recreate the live founder account/data during implementation
- Do not claim production-quality voice performance without fresh live evals and a working Google AI key

## Definition of done

- The public account-first entry path is explicit and staged behind a controlled gate
- A brand-new user can understand what the system knows, what it is learning, and what is still weak
- Cold-start evals exist for onboarding, early drafts, and readiness transitions
- Founder canary remains intact as a protected comparison lane while the public path hardens

## Execution docs

- `/Users/sawbeck/.codex/worktrees/rentalvoice-codex-founder-server-canary-plan/docs/superpowers/plans/2026-04-09-founder-server-canary-implementation.md`
- `/Users/sawbeck/Projects/RentalVoice/docs/plans/2026-03-09-founder-app-path-design.md`
- `/Users/sawbeck/Projects/RentalVoice/docs/plans/2026-03-09-user-app-hardening-queue.md`
- `/Users/sawbeck/Projects/RentalVoice/docs/plans/2026-03-09-app-store-readiness-roadmap.md`
