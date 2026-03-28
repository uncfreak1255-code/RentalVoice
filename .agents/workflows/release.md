---
description: Promote feature work to GitHub and prepare releases without breaking the current personal-mode app path
---

# Rental Voice Release Workflow

Use this workflow before:

- pushing major local-only work to GitHub
- packaging a release
- changing the default app path

## Read first

- `/Users/sawbeck/Projects/RentalVoice/AGENTS.md`
- `/Users/sawbeck/Projects/RentalVoice/CLAUDE.md`
- `/Users/sawbeck/Projects/RentalVoice/docs/runbooks/github-canonical-promotion.md`

## Rules

- GitHub `main` is canonical; local `main` should stay synced to it between feature batches
- refresh the protected local baseline before risky release or live-touching work
- do not mix unrelated feature groups into one promotion batch
- do not enable commercial mode by default as part of a general push

## Required sequence

1. sync local `main`
2. create or confirm a protected baseline when the batch is risky
3. review the baseline manifest
4. group feature work into promotion batches
5. run a push-readiness review
6. promote carefully

## Canonical runbook

- `/Users/sawbeck/Projects/RentalVoice/docs/runbooks/github-canonical-promotion.md`
