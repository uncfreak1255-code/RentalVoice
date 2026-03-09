# Session handoff workflow

Use this when continuing Rental Voice after any agent switch, context reset, or new session.

## Read order

1. `/Users/sawbeck/Projects/RentalVoice/AGENTS.md`
2. `/Users/sawbeck/Projects/RentalVoice/CLAUDE.md`
3. `/Users/sawbeck/Projects/RentalVoice/docs/status/current-state.md`
4. `/Users/sawbeck/Projects/RentalVoice/docs/status/next-batch.md`
5. `/Users/sawbeck/Projects/RentalVoice/docs/status/open-risks.md`
6. if the task touches Supabase, auth, migration, or promotion: `/Users/sawbeck/Projects/RentalVoice/docs/runbooks/supabase-environment-workflow.md`
7. one relevant workflow in `/Users/sawbeck/Projects/RentalVoice/.agents/workflows/`
8. one relevant runbook in `/Users/sawbeck/Projects/RentalVoice/docs/runbooks/`

## Minimum recovery checklist

1. confirm current pushed HEAD
2. confirm latest protected baseline ids
3. confirm the current linked local environment classification in `/Users/sawbeck/Projects/RentalVoice/server/.env`
4. confirm whether the task is supposed to stay on `test` or intentionally touch `live`
5. confirm the app still defaults to `personal`
6. confirm the next approved batch before editing code
7. if the task touches live founder work, confirm founder bootstrap execute has or has not run yet

## Handoff rule

If any of the status files conflict with current repo reality, update the status files first before continuing implementation.
