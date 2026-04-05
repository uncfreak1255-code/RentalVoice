# Rental Voice agent entry point

Read `/Users/sawbeck/Projects/RentalVoice/CLAUDE.md` first.

Then use this order:

1. `/Users/sawbeck/Projects/RentalVoice/.agents/README.md`
2. `/Users/sawbeck/Projects/RentalVoice/docs/status/current-state.md`
3. `/Users/sawbeck/Projects/RentalVoice/docs/status/next-batch.md`
4. `/Users/sawbeck/Projects/RentalVoice/docs/status/open-risks.md`
5. `/Users/sawbeck/Projects/RentalVoice/docs/runbooks/protected-local-baseline.md`
6. `/Users/sawbeck/Projects/RentalVoice/docs/runbooks/github-canonical-promotion.md`
7. `/Users/sawbeck/Projects/RentalVoice/docs/runbooks/codex-desktop-workflow.md`
8. task-specific runbooks or code

## Non-negotiable repo truths

- Canonical source of truth is GitHub `main`; local checkouts and worktrees are implementation sandboxes until pushed and merged
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
- `docs/status/`: session-state truth for future work

## When working in this repo

- prefer the existing runbooks over inventing new ad hoc workflows
- keep local `main` as a sync checkout; do feature work on isolated branches or worktrees
- before non-trivial edits, run `/Users/sawbeck/bin/guardrail-preflight`
- if the active checkout is root `/Users/sawbeck/Projects/RentalVoice` on protected `main`, stop and move to an isolated worktree before editing
- in Codex Desktop, use `Create permanent worktree` or an existing worktree-owned thread for code changes; do not use the branch dropdown on dirty root `main` as a substitute
- commit from the feature worktree that owns the task, not from the root sync checkout
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
- session recovery / continuation workflow:
  - `/Users/sawbeck/Projects/RentalVoice/.agents/workflows/session-handoff.md`

## Workflow-layer rule

- In this repo, `.agents/workflows/` is the workflow-agent layer.
- Do not create a second conflicting workflow system under `.claude/agents/` unless there is a deliberate migration plan.
- Keep `docs/status/` and `docs/runbooks/` as the canonical durable state for future sessions.
