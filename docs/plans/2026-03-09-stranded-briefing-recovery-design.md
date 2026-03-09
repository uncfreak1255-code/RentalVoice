# Stranded Briefing Recovery Design

**Date:** 2026-03-09

**Owner:** Codex

## Goal

Recover the uncommitted daily briefing feature from the stranded `codex/review-main-branch-changes` worktree and land it in the active branch without pulling in unrelated AI, composer, or inbox redesign changes.

## Current State

The daily briefing feature exists only as uncommitted changes in `/Users/sawbeck/.codex/worktrees/3a17/RentalVoice`.

Observed implemented pieces there:
- `src/lib/daily-briefing.ts`
- `src/components/DailyBriefingCard.tsx`
- `src/components/InboxDashboard.tsx` integration
- focused tests for the helper and the card

The same worktree also contains broad unrelated modifications across `InboxDashboard`, `ChatScreen`, `MessageComposer`, `SettingsScreen`, AI generation, and training. That broader bundle is not safe to transplant wholesale.

## Recovery Options

1. Surgical recovery
- Port only the briefing helper, card, minimal inbox wiring, and tests.
- Preserve current branch onboarding, sync banner, and AI-learning work.
- Recommended.

2. Broader inbox salvage
- Recover briefing plus guest memory and issue triage.
- Higher merge risk and larger verification burden.

3. Full dirty-worktree transplant
- Copy most of the other worktree into the active branch.
- Rejected due to excessive unrelated risk.

## Approved Design

Use the surgical recovery path.

### Scope

Create these new files in the active branch:
- `src/lib/daily-briefing.ts`
- `src/components/DailyBriefingCard.tsx`
- `src/lib/__tests__/daily-briefing.test.ts`
- `src/components/__tests__/DailyBriefingCard.test.tsx`

Modify only:
- `src/components/InboxDashboard.tsx`

### UX behavior

- Show the briefing only on the inbox `All` view.
- Hide the briefing when a search query is active.
- Render the briefing above the conversation list and below any existing demo/sync banners.
- Keep the card compact and collapsed by default.
- Tapping a briefing action opens the related conversation.
- Do not adopt the stranded worktree's broader inbox visual redesign in this batch.

### Data model

The briefing is a pure derived view model built from:
- active, non-archived conversations
- unresolved issues tied to those conversations
- arrivals within the next 48 hours
- departures within the next 48 hours

Priority order:
1. unresolved issues
2. upcoming arrivals
3. upcoming departures

Max visible action count in the model remains 3.

### Risk controls

- Do not overwrite current branch `InboxDashboard` layout beyond the minimum needed for insertion.
- Do not port unread-filter changes, settings changes, AI changes, or layout changes from the stranded worktree.
- Keep the current active branch as the source of truth for app behavior.

### Verification

Required verification:
- `daily-briefing` unit tests
- `DailyBriefingCard` component tests
- targeted lint on changed files

## Out of Scope

- guest memory recovery
- issue triage card recovery
- broader inbox redesign
- any AI output or composer changes from the stranded worktree
