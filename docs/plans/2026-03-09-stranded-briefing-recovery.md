# Stranded Briefing Recovery Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Recover the stranded daily briefing feature into the active branch without importing unrelated dirty-worktree changes.

**Architecture:** Add a pure briefing derivation helper plus a standalone briefing card, then wire that card into the existing inbox only when the user is on `All` with no active search. Keep the current inbox layout, sync banner, and active branch behavior intact.

**Tech Stack:** Expo React Native, TypeScript, Zustand, Jest, React Native Testing Library, ESLint

---

### Task 1: Port the pure briefing model

**Files:**
- Create: `src/lib/daily-briefing.ts`
- Test: `src/lib/__tests__/daily-briefing.test.ts`

**Step 1: Add the helper test file**
- Port focused tests for:
  - null when no operational items exist
  - issues prioritized before arrivals/departures
  - compact summary and max action count

**Step 2: Run the helper tests and confirm failure**
Run: `NODE_PATH=/Users/sawbeck/Projects/RentalVoice/node_modules /Users/sawbeck/Projects/RentalVoice/node_modules/.bin/jest src/lib/__tests__/daily-briefing.test.ts --runInBand`
Expected: FAIL because `src/lib/daily-briefing.ts` does not exist yet.

**Step 3: Add the minimal implementation**
- Build a pure `buildDailyBriefing()` helper from conversations, issues, and `now`.
- Keep it independent from UI state.

**Step 4: Re-run the helper tests**
- Confirm PASS.

**Step 5: Commit checkpoint**
- `git add src/lib/daily-briefing.ts src/lib/__tests__/daily-briefing.test.ts`
- `git commit -m "feat: add daily briefing model"`

### Task 2: Port the standalone briefing card

**Files:**
- Create: `src/components/DailyBriefingCard.tsx`
- Test: `src/components/__tests__/DailyBriefingCard.test.tsx`

**Step 1: Add the component tests**
- Port tests for expanded rendering and collapsed-tap behavior.

**Step 2: Run the component tests and confirm failure**
Run: `NODE_PATH=/Users/sawbeck/Projects/RentalVoice/node_modules /Users/sawbeck/Projects/RentalVoice/node_modules/.bin/jest src/components/__tests__/DailyBriefingCard.test.tsx --runInBand`
Expected: FAIL because the component does not exist yet.

**Step 3: Add the minimal card implementation**
- Keep the compact collapsed/expanded behavior.
- Reuse existing design tokens.

**Step 4: Re-run the component tests**
- Confirm PASS.

**Step 5: Commit checkpoint**
- `git add src/components/DailyBriefingCard.tsx src/components/__tests__/DailyBriefingCard.test.tsx`
- `git commit -m "feat: add daily briefing card"`

### Task 3: Wire briefing into the current inbox safely

**Files:**
- Modify: `src/components/InboxDashboard.tsx`
- Reuse: `src/lib/daily-briefing.ts`
- Reuse: `src/components/DailyBriefingCard.tsx`

**Step 1: Add the failing inbox integration expectation mentally before coding**
- Briefing should render only in `All` view and only with empty search.
- It should appear below current banners and above the conversation list.

**Step 2: Implement minimal integration**
- Add `issues` selector from store.
- Add collapsed state for the briefing card.
- Derive `dailyBriefing` with `useMemo()`.
- Insert the card above the list while preserving current sync/demo banners.

**Step 3: Run focused tests for the helper and card again**
Run: `NODE_PATH=/Users/sawbeck/Projects/RentalVoice/node_modules /Users/sawbeck/Projects/RentalVoice/node_modules/.bin/jest src/lib/__tests__/daily-briefing.test.ts src/components/__tests__/DailyBriefingCard.test.tsx --runInBand`
Expected: PASS.

**Step 4: Run targeted lint on changed briefing files**
Run: `NODE_PATH=/Users/sawbeck/Projects/RentalVoice/node_modules /Users/sawbeck/Projects/RentalVoice/node_modules/.bin/eslint src/lib/daily-briefing.ts src/lib/__tests__/daily-briefing.test.ts src/components/DailyBriefingCard.tsx src/components/__tests__/DailyBriefingCard.test.tsx src/components/InboxDashboard.tsx`
Expected: PASS or warnings only with no new errors.

**Step 5: Commit checkpoint**
- `git add src/components/InboxDashboard.tsx src/lib/daily-briefing.ts src/lib/__tests__/daily-briefing.test.ts src/components/DailyBriefingCard.tsx src/components/__tests__/DailyBriefingCard.test.tsx`
- `git commit -m "feat: recover daily briefing inbox card"`
