# Local canonical promotion to GitHub

This runbook exists because local code is ahead of GitHub and must be promoted deliberately.

## Rule

Do not treat `origin/main` as the public truth until the protected local baseline exists and the promotion steps below are completed.

## Promotion order

1. Create a protected baseline:

```bash
npm run ops:baseline:protect -- --checkpoint-id pre-github-promotion-<timestamp>
```

2. Review the baseline manifest:
   - confirm local workspace is marked canonical
   - confirm current app mode is still `personal`
   - confirm linked Supabase project ref is recorded
   - confirm git dirty counts match expectations

3. Group the local-only work into promotion batches:
   - safety / checkpoint / rollback
   - commercial staging infrastructure
   - billing / telemetry
   - docs / runbooks

4. Promote carefully:
   - commit local work in logical groups
   - push only after the protected baseline exists
   - do not enable commercial mode by default during promotion

5. After push:
   - keep the protected baseline checkpoint id in the release notes or handoff notes
   - use that checkpoint as the rollback anchor if the promoted code needs to be unwound locally

## Non-goals

- This runbook does not decide when to cut over to commercial mode.
- This runbook does not create the founder account.
- This runbook does not declare GitHub as production by itself.
