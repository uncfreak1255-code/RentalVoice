# Rental Voice agent workspace guide

This folder is the operational layer for coding agents working in Rental Voice.

## Purpose

Keep short workflow entry points here.

Put durable operational truth in:

- `/Users/sawbeck/Projects/RentalVoice/CLAUDE.md`
- `/Users/sawbeck/Projects/RentalVoice/docs/status/`
- `/Users/sawbeck/Projects/RentalVoice/docs/runbooks/`

For Codex Desktop sessions that may edit code, the primary git-safety runbook is:

- `/Users/sawbeck/Projects/RentalVoice/docs/runbooks/codex-desktop-workflow.md`

## Read order for new agents

1. `/Users/sawbeck/Projects/RentalVoice/AGENTS.md`
2. `/Users/sawbeck/Projects/RentalVoice/CLAUDE.md`
3. `/Users/sawbeck/Projects/RentalVoice/docs/status/current-state.md`
4. `/Users/sawbeck/Projects/RentalVoice/docs/status/next-batch.md`
5. `/Users/sawbeck/Projects/RentalVoice/docs/status/open-risks.md`
6. one relevant workflow in `/Users/sawbeck/Projects/RentalVoice/.agents/workflows/`
7. `/Users/sawbeck/Projects/RentalVoice/docs/runbooks/codex-desktop-workflow.md`
8. one other relevant runbook in `/Users/sawbeck/Projects/RentalVoice/docs/runbooks/`

## Available workflows

- `dev.md`: local development and simulator/device workflow
- `foundation.md`: current source-of-truth and safety workflow
- `release.md`: GitHub promotion and release-prep workflow
- `session-handoff.md`: recover state and continue safely after context switches

## Rules for keeping this folder clean

- keep workflow files short
- point to canonical runbooks instead of duplicating them
- update workflow links when repo structure changes
- do not store secrets here
