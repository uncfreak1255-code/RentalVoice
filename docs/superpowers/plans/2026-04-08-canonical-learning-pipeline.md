# Canonical Learning Pipeline Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Rental Voice one canonical learning write path so chat approvals, chat edits, independent replies, and `Test My Voice` all store the same example truth, the same correction truth, and surface visible proof to the user.

**Architecture:** Add a single `recordLearningEvent()` orchestrator in the mobile app. It becomes the only live write entry point for learning-producing actions, dual-writing local truth immediately and best-effort server truth when a session exists. Coverage moves behind a retrieval adapter so it reads from the same source the next draft uses, and the dead `useAIDraft.ts` path is removed or quarantined.

**Tech Stack:** Expo Router, React Native, Zustand, AsyncStorage, Jest, existing API client/server endpoints

---

## File Structure

### Canonical learning event orchestration

- Create: `src/lib/learning-events.ts`
- Create: `src/lib/__tests__/learning-events.test.ts`
- Modify: `src/lib/ai-enhanced.ts`
- Modify: `src/lib/api-client.ts`

Responsibility:

- normalize learning writes from all surfaces
- write local example truth and local correction truth
- best-effort sync server example/correction truth
- return UI-ready learning receipts

### Live callers

- Modify: `src/components/chat/useChatMessageActions.ts`
- Modify: `src/components/TestVoiceScreen.tsx`

Responsibility:

- stop writing learning state ad hoc
- call the canonical function instead
- render save receipts from canonical results

### Retrieval/coverage alignment

- Create: `src/lib/retrieval-source.ts`
- Create: `src/lib/__tests__/retrieval-source.test.ts`
- Modify: `src/lib/advanced-training.ts`
- Modify: `src/components/AILearningScreen.tsx`

Responsibility:

- expose active retrieval mode
- expose coverage rows from that same mode
- remove dependence on the stale response-index path

### Proof UI

- Modify: `src/components/chat/useChatDraftEngine.ts`
- Modify: `src/components/AIReasoningSection.tsx`

Responsibility:

- attach learning proof to generated drafts
- show “using N examples and M corrections” on the next draft

### Dead-path cleanup

- Delete or move: `src/hooks/useAIDraft.ts`
- Delete or move: `src/hooks/__tests__/useAIDraft.test.ts`

Responsibility:

- ensure the repo has one obvious live learning path

## Execution Order

1. Canonical event module
2. Active caller migration
3. Retrieval/coverage alignment
4. Proof UI
5. Dead hook cleanup

## Chunk 1: Canonical Learning Events

### Task 1: Create learning event types and receipts

**Files:**
- Create: `src/lib/learning-events.ts`
- Test: `src/lib/__tests__/learning-events.test.ts`

- [ ] **Step 1: Write the failing tests for normalized events**

Cover:
- `host_written` stores example truth and no correction truth
- `ai_approved` stores example truth and outcome truth
- `ai_edited` stores example truth and correction truth
- returned receipt summary is deterministic

Run: `npm test -- src/lib/__tests__/learning-events.test.ts`
Expected: FAIL because module does not exist

- [ ] **Step 2: Implement minimal event types and receipt types**

Add:
- `LearningEvent`
- `LearningReceipt`
- helper guards for whether an event contains draft-correction data

- [ ] **Step 3: Re-run the focused test**

Run: `npm test -- src/lib/__tests__/learning-events.test.ts`
Expected: FAIL on missing behavior, not missing imports

- [ ] **Step 4: Implement local write orchestration**

Minimal implementation should:
- write local few-shot example
- queue incremental training
- add local edit pattern when `ai_edited`
- produce local draft outcome metadata
- return a `LearningReceipt`

Do not wire UI callers yet.

- [ ] **Step 5: Re-run the focused test**

Run: `npm test -- src/lib/__tests__/learning-events.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/learning-events.ts src/lib/__tests__/learning-events.test.ts
git commit -m "feat: add canonical learning event orchestration"
```

### Task 2: Add best-effort server sync to canonical writes

**Files:**
- Modify: `src/lib/learning-events.ts`
- Modify: `src/lib/api-client.ts`
- Test: `src/lib/__tests__/learning-events.test.ts`

- [ ] **Step 1: Write the failing tests for server sync behavior**

Cover:
- server example sync only when session exists
- server correction sync only when event contains AI draft correction truth
- local success is preserved if server sync fails

Run: `npm test -- src/lib/__tests__/learning-events.test.ts`
Expected: FAIL because server sync is not implemented

- [ ] **Step 2: Implement best-effort server sync**

Use existing API helpers where possible.
If current helpers are insufficient, add narrowly scoped ones instead of inventing a parallel client.

- [ ] **Step 3: Re-run the focused test**

Run: `npm test -- src/lib/__tests__/learning-events.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/learning-events.ts src/lib/api-client.ts src/lib/__tests__/learning-events.test.ts
git commit -m "feat: sync canonical learning events to server truth"
```

## Chunk 2: Migrate Live Callers

### Task 3: Route chat learning writes through the canonical function

**Files:**
- Modify: `src/components/chat/useChatMessageActions.ts`
- Test: `src/components/chat/__tests__/useChatMessageActions.test.ts`

- [ ] **Step 1: Write failing caller tests**

Cover:
- edited approval calls `recordLearningEvent({ type: 'ai_edited' })`
- straight approval calls `recordLearningEvent({ type: 'ai_approved' })`
- independent manual reply calls `recordLearningEvent({ type: 'host_written' })`
- existing toasts use the returned receipt summary

Run: `npm test -- src/components/chat/__tests__/useChatMessageActions.test.ts`
Expected: FAIL because the old ad hoc writes are still in place

- [ ] **Step 2: Replace ad hoc writes with canonical calls**

Remove direct responsibility for:
- `addLearningEntry`
- `storeEditPattern`
- `learnFromSentMessage`
- local/server outcome branching

from the caller, except where the canonical module explicitly depends on caller-provided metadata.

- [ ] **Step 3: Re-run the focused test**

Run: `npm test -- src/components/chat/__tests__/useChatMessageActions.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/chat/useChatMessageActions.ts src/components/chat/__tests__/useChatMessageActions.test.ts
git commit -m "refactor: route chat learning writes through canonical events"
```

### Task 4: Route `Test My Voice` through the canonical function

**Files:**
- Modify: `src/components/TestVoiceScreen.tsx`
- Add or modify test: `src/components/__tests__/TestVoiceScreen.test.tsx`

- [ ] **Step 1: Write the failing test**

Cover:
- saving a `Test My Voice` comparison with a changed reply produces an `ai_edited` event
- saving without AI/user delta produces a `host_written` event only if no AI draft exists
- receipt text is shown after save

Run: `npm test -- src/components/__tests__/TestVoiceScreen.test.tsx`
Expected: FAIL because the screen still writes learning ad hoc

- [ ] **Step 2: Implement the caller migration**

Replace direct `addLearningEntry` / `learnFromSentMessage` use with the canonical event function.
Ensure `Test My Voice` now persists correction truth when AI draft and final reply differ.

- [ ] **Step 3: Re-run the focused test**

Run: `npm test -- src/components/__tests__/TestVoiceScreen.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/TestVoiceScreen.tsx src/components/__tests__/TestVoiceScreen.test.tsx
git commit -m "feat: make test my voice use canonical learning events"
```

## Chunk 3: Align Coverage With Retrieval

### Task 5: Expose local retrieval truth from the actual draft source

**Files:**
- Create: `src/lib/retrieval-source.ts`
- Create: `src/lib/__tests__/retrieval-source.test.ts`
- Modify: `src/lib/advanced-training.ts`

- [ ] **Step 1: Write the failing tests**

Cover:
- local retrieval source reports intent counts from the few-shot index
- property filtering works or is explicitly unsupported and documented
- returned structure can feed recurring coverage rows

Run: `npm test -- src/lib/__tests__/retrieval-source.test.ts`
Expected: FAIL because retrieval adapter does not exist

- [ ] **Step 2: Add minimal read APIs to `fewShotIndexer`**

Add narrowly scoped methods such as:
- `getIntentCounts(propertyId?)`
- `getExampleCount()`

Do not expose raw mutable arrays if a summary API is enough.

- [ ] **Step 3: Implement retrieval adapter**

Current mode should return `local`.
Return coverage-friendly data from the few-shot index, not `aiTrainingService.responseIndex`.

- [ ] **Step 4: Re-run the focused test**

Run: `npm test -- src/lib/__tests__/retrieval-source.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/retrieval-source.ts src/lib/__tests__/retrieval-source.test.ts src/lib/advanced-training.ts
git commit -m "feat: expose retrieval-aligned coverage source"
```

### Task 6: Move the learning screen off the stale response index

**Files:**
- Modify: `src/components/AILearningScreen.tsx`
- Modify test: `src/components/__tests__/AILearningScreen.test.tsx`

- [ ] **Step 1: Write the failing test**

Cover:
- recurring coverage uses retrieval adapter output
- the screen no longer depends on `aiTrainingService.getResponseIndex()` for recurring coverage rows

Run: `npm test -- src/components/__tests__/AILearningScreen.test.tsx`
Expected: FAIL because the screen still reads the old index

- [ ] **Step 2: Implement the screen migration**

Keep existing UI structure.
Change only the data source and any text needed to avoid misleading claims.

- [ ] **Step 3: Re-run the focused test**

Run: `npm test -- src/components/__tests__/AILearningScreen.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/AILearningScreen.tsx src/components/__tests__/AILearningScreen.test.tsx
git commit -m "fix: align coverage screen with active retrieval source"
```

## Chunk 4: Add Proof UI

### Task 7: Show save receipts after learning writes

**Files:**
- Modify: `src/components/chat/useChatMessageActions.ts`
- Modify: `src/components/TestVoiceScreen.tsx`

- [ ] **Step 1: Write failing tests for receipt text**

Cover:
- edited reply shows correction summary
- independent reply shows example-save summary
- `Test My Voice` save shows example/correction summary

Run the narrowest relevant tests for the modified caller files.
Expected: FAIL because callers do not render canonical receipts yet

- [ ] **Step 2: Implement receipt rendering using `LearningReceipt.summary`**

Do not recompute summaries in callers.
Use the canonical module’s return value so wording and behavior stay consistent.

- [ ] **Step 3: Re-run the focused tests**

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/chat/useChatMessageActions.ts src/components/TestVoiceScreen.tsx
git commit -m "feat: show canonical learning save receipts"
```

### Task 8: Show proof on the next draft

**Files:**
- Modify: `src/lib/learning-events.ts`
- Modify: `src/components/chat/useChatDraftEngine.ts`
- Modify: `src/components/AIReasoningSection.tsx`
- Add or modify tests for draft proof rendering

- [ ] **Step 1: Write the failing tests**

Cover:
- generated draft can include proof metadata
- proof line renders when examples/corrections were used
- proof line hides cleanly when nothing was used

Run the narrowest relevant tests.
Expected: FAIL because draft proof metadata does not exist yet

- [ ] **Step 2: Implement proof metadata plumbing**

Local mode may initially report:
- count of few-shot examples used
- whether edit adjustments were applied

Keep this minimal and honest.
Do not invent semantic provenance you cannot prove.

- [ ] **Step 3: Re-run the focused tests**

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/learning-events.ts src/components/chat/useChatDraftEngine.ts src/components/AIReasoningSection.tsx
git commit -m "feat: surface learning proof on generated drafts"
```

## Chunk 5: Remove Dead Path

### Task 9: Delete or quarantine `useAIDraft.ts`

**Files:**
- Delete or move: `src/hooks/useAIDraft.ts`
- Delete or move: `src/hooks/__tests__/useAIDraft.test.ts`
- Test or verify imports: repo-wide search

- [ ] **Step 1: Write the failing safety check**

Run:

```bash
rg -n "useAIDraft" src
```

Expected:
- only legacy/test references remain before deletion

If live imports remain, stop and fix callers first.

- [ ] **Step 2: Delete or quarantine the dead path**

Preferred:
- delete file and tests if no live runtime imports remain

Fallback:
- move under a `legacy/` path and add a top-of-file warning that it is non-authoritative

- [ ] **Step 3: Re-run search and impacted tests**

Run:

```bash
rg -n "useAIDraft" src
```

Expected:
- no live runtime imports

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: remove legacy ai draft hook path"
```

## Final Verification

- [ ] **Step 1: Run focused client test suites**

Run the exact tests touched in this plan.

- [ ] **Step 2: Run project-level test command for the client surface**

Use the repo-standard command for RN/client tests.
If the repo has no single fast command, document the exact subset used.

- [ ] **Step 3: Manual verification checklist**

Verify in app:
- edited chat draft shows save receipt
- independent reply shows save receipt
- `Test My Voice` save shows receipt
- next generated draft shows proof line
- learning screen coverage still renders and is consistent with local retrieval state

- [ ] **Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "test: verify canonical learning pipeline end to end"
```

Plan complete and saved to `docs/superpowers/plans/2026-04-08-canonical-learning-pipeline.md`. Ready to execute?
