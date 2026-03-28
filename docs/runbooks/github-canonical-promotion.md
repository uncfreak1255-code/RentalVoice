# GitHub-canonical promotion with local rollback

This runbook assumes GitHub `main` is canonical and the protected local baseline is the recovery anchor for risky local/live work.

## Rule

Do not treat unpushed local work as canonical. Feature work earns canonical status only after review and merge to GitHub `main`.

## Promotion order

1. Sync the primary local checkout:

```bash
git fetch origin
git switch main
git pull --ff-only
```

2. Create a protected baseline before risky promotion or live-touching work:

```bash
npm run ops:baseline:protect -- --checkpoint-id pre-github-promotion-<timestamp>
```

3. Review the baseline manifest:
- confirm the baseline is tied to the current synced local checkout
- confirm current app mode is still `personal`
- confirm linked Supabase project ref is recorded
- confirm git dirty counts match expectations

4. Group the feature work into promotion batches:
- safety / checkpoint / rollback
- commercial staging infrastructure
- billing / telemetry
- docs / runbooks
- founder/live environment prep

5. Rehearse database-impacting changes on `test` first:
- keep `/Users/sawbeck/Projects/RentalVoice/server/.env` pointed at `gqnocsoouudbogwislsl`
- apply migrations and verify app behavior there first
- if the batch touches Supabase promotion rules, read `/Users/sawbeck/Projects/RentalVoice/docs/runbooks/supabase-environment-workflow.md`

6. Promote carefully:
- do the work on an isolated feature branch or worktree, not directly on local `main`
- commit source changes in logical groups
- push only after the protected baseline exists when the batch is risky
- do not enable commercial mode by default during promotion
- do not silently switch the default local environment from `test` to `live`
- merge to GitHub `main` only after review and verification

7. If the same batch needs live promotion later:
- use the same migration history already rehearsed on `test`
- load `/Users/sawbeck/Projects/RentalVoice/server/.env.live.local` intentionally in an isolated shell or worktree
- run preflight before touching live
- validate live deliberately after promotion

8. After merge:
- fast-forward the primary local checkout back to `origin/main`
- keep the protected baseline checkpoint id in the release notes or handoff notes
- use that checkpoint as the rollback anchor if the promoted code needs to be unwound locally

## Non-goals

- This runbook does not decide when to cut over to commercial mode.
- This runbook does not create the founder account automatically.
- This runbook does not make live founder validation casual or automatic.
