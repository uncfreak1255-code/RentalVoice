# Rental Voice agent entry point

Read `/Users/sawbeck/Projects/RentalVoice/CLAUDE.md` first.

Then use this order:

1. `/Users/sawbeck/Projects/RentalVoice/.agents/README.md`
2. `/Users/sawbeck/Projects/RentalVoice/docs/runbooks/protected-local-baseline.md`
3. `/Users/sawbeck/Projects/RentalVoice/docs/runbooks/local-canonical-promotion.md`
4. task-specific runbooks or code

## Non-negotiable repo truths

- Canonical source of truth is the local workspace, not GitHub
- Current user-facing app path stays in `personal` mode until an explicit cutover
- Current visible auth/onboarding remains Hostaway-first
- The protected local baseline is the rollback anchor
- Do not assume either current Supabase project is the future live founder environment

## Current repo shape

- `src/`: Expo React Native app
- `server/`: TypeScript backend
- `ops/`: checkpoint, rollback, baseline, migration tooling
- `docs/runbooks/`: operational procedures
- `.agents/workflows/`: agent workflow shortcuts

## When working in this repo

- prefer the existing runbooks over inventing new ad hoc workflows
- keep personal-mode UX stable unless the task explicitly says otherwise
- keep commercialization work staged and isolated
- document source-of-truth, migration, and rollback assumptions clearly

## Workflow entry points

- development workflow:
  - `/Users/sawbeck/Projects/RentalVoice/.agents/workflows/dev.md`
- foundation / safety workflow:
  - `/Users/sawbeck/Projects/RentalVoice/.agents/workflows/foundation.md`
- release / GitHub promotion workflow:
  - `/Users/sawbeck/Projects/RentalVoice/.agents/workflows/release.md`
