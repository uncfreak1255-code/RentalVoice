# Rental Voice agent workspace guide

This folder is the operational layer for coding agents working in Rental Voice.

## Purpose

Keep short workflow entry points here.

Put durable operational truth in:

- `/Users/sawbeck/Projects/RentalVoice/CLAUDE.md`
- `/Users/sawbeck/Projects/RentalVoice/docs/runbooks/`

## Read order for new agents

1. `/Users/sawbeck/Projects/RentalVoice/AGENTS.md`
2. `/Users/sawbeck/Projects/RentalVoice/CLAUDE.md`
3. one relevant workflow in `/Users/sawbeck/Projects/RentalVoice/.agents/workflows/`
4. one relevant runbook in `/Users/sawbeck/Projects/RentalVoice/docs/runbooks/`

## Available workflows

- `dev.md`: local development and simulator/device workflow
- `foundation.md`: current source-of-truth and safety workflow
- `release.md`: GitHub promotion and release-prep workflow

## Rules for keeping this folder clean

- keep workflow files short
- point to canonical runbooks instead of duplicating them
- update workflow links when repo structure changes
- do not store secrets here
