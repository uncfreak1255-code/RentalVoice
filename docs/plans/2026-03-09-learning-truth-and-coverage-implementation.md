# Learning Truth And Coverage Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make AI Learning trustworthy by fixing importer/training truth, adding recurring-intent coverage measurement, and exposing progress toward the 75% recurring-question coverage target.

**Architecture:** Add a canonical derived learning-truth model in the AI-learning domain, wire the screen to that model, and keep the implementation bounded to personal-mode learning and current Hostaway-first flows. Use existing history import, training service, and response index structures rather than inventing parallel state.

**Tech Stack:** Expo React Native, Zustand, AsyncStorage-backed training state, Jest, TypeScript.

---

### Task 1: Add canonical recurring-coverage metrics

**Files:**
- Modify: `/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/lib/ai-learning.ts`
- Test: `/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/lib/__tests__/ai-learning.test.ts`

**Step 1: Write the failing tests**

Add tests for:
- consistent import/training summary output
- recurring intent detection grouped from indexed response patterns
- coverage classification with covered/weak/missing buckets
- overall coverage percentage based on recurring categories above threshold

**Step 2: Run test to verify it fails**

Run:

```bash
npx jest src/lib/__tests__/ai-learning.test.ts --runInBand
```

Expected:
- FAIL on new recurring-coverage and summary assertions

**Step 3: Write minimal implementation**

Add to `ai-learning.ts`:
- a canonical `buildLearningImportSummary(...)`
- a canonical `buildRecurringIntentCoverage(...)`
- typed return objects for:
  - import summary
  - training summary
  - recurring intent rows
  - overall coverage snapshot

Implementation rules:
- recurring intent minimum volume starts at `5`
- `covered` requires enough reusable evidence from indexed patterns
- `weak` means recurring but under evidence threshold
- `missing` means recurring but not covered

**Step 4: Run test to verify it passes**

Run:

```bash
npx jest src/lib/__tests__/ai-learning.test.ts --runInBand
```

Expected:
- PASS

**Step 5: Commit**

```bash
git add src/lib/ai-learning.ts src/lib/__tests__/ai-learning.test.ts
git commit -m "feat: add recurring intent coverage metrics"
```

### Task 2: Fix AI Learning importer/training status rendering

**Files:**
- Modify: `/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/AILearningScreen.tsx`
- Test: `/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/__tests__/AILearningScreen.test.tsx`

**Step 1: Write the failing test**

Add tests for:
- importing state uses consistent units
- training state appears after import
- top-level primary CTA is visible in idle/recovery state
- runtime-broken text structure is not present

**Step 2: Run test to verify it fails**

Run:

```bash
npx jest src/components/__tests__/AILearningScreen.test.tsx --runInBand
```

Expected:
- FAIL because the component/test file does not yet reflect the new structure

**Step 3: Write minimal implementation**

Update `AILearningScreen.tsx` to:
- consume the new canonical summary model from `ai-learning.ts`
- replace ambiguous importer copy
- add a top `Learning Status` card
- add top CTA logic:
  - `Import History`
  - `Resume Import`
  - `Review Coverage`
- keep lower importer section as detail
- fix the current render bug while touching the screen

**Step 4: Run test to verify it passes**

Run:

```bash
npx jest src/components/__tests__/AILearningScreen.test.tsx --runInBand
```

Expected:
- PASS

**Step 5: Commit**

```bash
git add src/components/AILearningScreen.tsx src/components/__tests__/AILearningScreen.test.tsx
git commit -m "fix: make ai learning import and training status truthful"
```

### Task 3: Expose recurring-intent coverage on the AI Learning screen

**Files:**
- Modify: `/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/AILearningScreen.tsx`
- Test: `/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/__tests__/AILearningScreen.test.tsx`

**Step 1: Write the failing test**

Add tests for:
- coverage percentage renders
- top recurring categories render
- covered/weak/missing labels render correctly
- empty/insufficient-data state renders clearly

**Step 2: Run test to verify it fails**

Run:

```bash
npx jest src/components/__tests__/AILearningScreen.test.tsx --runInBand
```

Expected:
- FAIL on missing coverage snapshot UI

**Step 3: Write minimal implementation**

Add:
- `Coverage Snapshot` card
- `Top Repeated Guest Questions` list
- coverage messaging relative to 75% target

Rules:
- do not claim the target is achieved unless the computed metric says so
- if training/import is incomplete, say coverage is still building

**Step 4: Run test to verify it passes**

Run:

```bash
npx jest src/components/__tests__/AILearningScreen.test.tsx --runInBand
```

Expected:
- PASS

**Step 5: Commit**

```bash
git add src/components/AILearningScreen.tsx src/components/__tests__/AILearningScreen.test.tsx
git commit -m "feat: surface recurring question coverage in ai learning"
```

### Task 4: Verify that imported history feeds training state consistently

**Files:**
- Modify: `/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/lib/ai-training-service.ts`
- Modify: `/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/lib/auto-import.ts`
- Test: `/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/lib/__tests__/ai-learning.test.ts`

**Step 1: Write the failing test**

Add tests or assertions for:
- imported host messages update training summary fields consistently
- patterns indexed are not disconnected from host messages analyzed
- initial-training completion state is reflected in the derived summary

**Step 2: Run test to verify it fails**

Run:

```bash
npx jest src/lib/__tests__/ai-learning.test.ts --runInBand
```

Expected:
- FAIL on the new training consistency expectations

**Step 3: Write minimal implementation**

Tighten the training update contract so:
- host messages analyzed
- total messages analyzed
- patterns indexed
- initial training complete

can be read cleanly by the derived summary layer.

Do not redesign training internals yet. Only normalize the state needed for truthful reporting.

**Step 4: Run test to verify it passes**

Run:

```bash
npx jest src/lib/__tests__/ai-learning.test.ts --runInBand
```

Expected:
- PASS

**Step 5: Commit**

```bash
git add src/lib/ai-training-service.ts src/lib/auto-import.ts src/lib/__tests__/ai-learning.test.ts
git commit -m "fix: normalize ai training summary state"
```

### Task 5: Verify the full batch

**Files:**
- Verify touched files from Tasks 1-4
- Optionally update: `/Users/sawbeck/.codex/worktrees/a377/RentalVoice/docs/status/next-batch.md`

**Step 1: Run focused tests**

Run:

```bash
npx jest src/lib/__tests__/ai-learning.test.ts src/components/__tests__/AILearningScreen.test.tsx --runInBand
```

Expected:
- PASS

**Step 2: Run lint on changed files**

Run:

```bash
npx eslint src/lib/ai-learning.ts src/lib/ai-training-service.ts src/lib/auto-import.ts src/components/AILearningScreen.tsx src/lib/__tests__/ai-learning.test.ts src/components/__tests__/AILearningScreen.test.tsx
```

Expected:
- PASS

**Step 3: Run a simulator validation pass**

Verify manually:
- import status copy is consistent
- coverage snapshot appears after training
- no render toast appears
- top CTA is visible

**Step 4: Commit verification batch**

```bash
git add src/lib/ai-learning.ts src/lib/ai-training-service.ts src/lib/auto-import.ts src/components/AILearningScreen.tsx src/lib/__tests__/ai-learning.test.ts src/components/__tests__/AILearningScreen.test.tsx docs/plans/2026-03-09-learning-truth-and-coverage-design.md docs/plans/2026-03-09-learning-truth-and-coverage-implementation.md
git commit -m "feat: add ai learning coverage and truthful import status"
```
