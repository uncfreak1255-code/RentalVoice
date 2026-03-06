# Rental Voice next batch

Last updated: 2026-03-06

## Approved next engineering batch

Improve founder diagnostics and founder handoff artifacts without changing the current personal-mode user flow.

## Scope

1. Upgrade founder diagnostics to show:
   - environment classification
   - project ref and project label
   - whether founder bypass is active
   - effective plan and entitlements source
   - whether the current project ref is forbidden
   - readiness summary for founder bootstrap and migration
2. Add a founder bootstrap packet artifact generator that emits:
   - required env keys
   - command order
   - preflight steps
   - post-bootstrap verification endpoints
   - rollback requirement to create a fresh baseline first

## Constraints

- Do not change the visible personal-mode UX
- Do not make commercial mode the default path
- Do not create the founder auth user yet
- Do not execute bootstrap or migration against the linked test project

## Likely files

- `/Users/sawbeck/Projects/RentalVoice/server/src/routes/analytics.ts`
- `/Users/sawbeck/Projects/RentalVoice/src/components/FounderDiagnosticsScreen.tsx`
- `/Users/sawbeck/Projects/RentalVoice/src/app/settings/founder-diagnostics.tsx`
- `/Users/sawbeck/Projects/RentalVoice/ops/founder/`
- `/Users/sawbeck/Projects/RentalVoice/docs/runbooks/`

## Definition of done

- Founder diagnostics surfaces current environment truth clearly
- Founder packet generator exists and is documented
- Current test project remains blocked for live and rehearsal execute paths
