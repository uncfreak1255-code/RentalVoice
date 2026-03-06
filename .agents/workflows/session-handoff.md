# Session handoff workflow

Use this when continuing Rental Voice after any agent switch, context reset, or new session.

## Read order

1. `/Users/sawbeck/Projects/RentalVoice/AGENTS.md`
2. `/Users/sawbeck/Projects/RentalVoice/CLAUDE.md`
3. `/Users/sawbeck/Projects/RentalVoice/docs/status/current-state.md`
4. `/Users/sawbeck/Projects/RentalVoice/docs/status/next-batch.md`
5. `/Users/sawbeck/Projects/RentalVoice/docs/status/open-risks.md`
6. one relevant workflow in `/Users/sawbeck/Projects/RentalVoice/.agents/workflows/`
7. one relevant runbook in `/Users/sawbeck/Projects/RentalVoice/docs/runbooks/`

## Minimum recovery checklist

1. confirm current pushed HEAD
2. confirm latest protected baseline ids
3. confirm current local environment classification
4. confirm the app still defaults to `personal`
5. confirm the next approved batch before editing code

## Handoff rule

If any of the status files conflict with current repo reality, update the status files first before continuing implementation.
