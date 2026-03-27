---
description: Protect the current local app state and keep personal-mode UX stable while commercialization remains staged
---

# Rental Voice Foundation Workflow

Use this workflow for:

- source-of-truth questions
- rollback/baseline work
- founder bootstrap staging
- commercial cutover preparation

## Read first

- `/Users/sawbeck/Projects/RentalVoice/AGENTS.md`
- `/Users/sawbeck/Projects/RentalVoice/CLAUDE.md`
- `/Users/sawbeck/Projects/RentalVoice/docs/runbooks/protected-local-baseline.md`

## Current rules

- GitHub `main` is canonical
- protected local baseline is the rollback anchor
- do risky work on isolated branches or worktrees, not local `main`
- current app remains `personal` mode
- current visible auth remains Hostaway-first
- neither current Supabase project is the founder/live app-auth environment

## Key commands

Protected baseline:

```bash
cd /Users/sawbeck/Projects/RentalVoice
npm run ops:baseline:protect -- --checkpoint-id protected-local-baseline-<timestamp>
```

Founder bootstrap dry run:

```bash
cd /Users/sawbeck/Projects/RentalVoice
npm run ops:founder:bootstrap
```

## Canonical runbooks

- `/Users/sawbeck/Projects/RentalVoice/docs/runbooks/protected-local-baseline.md`
- `/Users/sawbeck/Projects/RentalVoice/docs/runbooks/founder-bootstrap.md`
- `/Users/sawbeck/Projects/RentalVoice/docs/runbooks/personal-to-founder-migration.md`
