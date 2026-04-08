# Canonical Learning Pipeline - Design Spec

**Date:** 2026-04-08
**Status:** Approved direction for implementation planning
**Author:** Codex

## Problem

Rental Voice currently looks like it learns from host behavior, but the write path is split across multiple stores and multiple runtimes:

- normal chat writes UI learning entries, local edit patterns, local few-shot examples, local incremental training state, and optional semantic sync
- `Test My Voice` saves the final host-written answer but drops the AI-vs-user correction delta
- the coverage screen reads `aiTrainingService.responseIndex`, which is not the same retrieval source the active chat draft engine uses
- the server-managed draft path reads `voice_examples` and `edit_patterns` from Supabase, while the current personal-mode path reads local AsyncStorage and local few-shot state
- a dead `useAIDraft.ts` hook still exists with a different learning path, which invites future drift

This is not a tuning problem. It is an ownership problem. The product has no single canonical learning write path and no single trustworthy learning-read surface.

## Goals

1. Every learning-producing action writes through one canonical function.
2. That function writes both kinds of truth:
   - response example truth
   - correction truth
3. Coverage reads the same retrieval source the next draft uses.
4. The app shows proof that learning was saved and proof that learning influenced the next draft.
5. Dead learning code is removed or quarantined so future fixes land in one place.

## Non-Goals

- rewriting the entire reply engine around server-canonical generation in this batch
- replacing existing data stores with a brand-new event database
- redesigning all AI learning UI
- changing current product-mode truth that `personal` remains the user-facing default path

## Current Observed Breakpoints

### 1. `Test My Voice` saves examples, not corrections

`Test My Voice` currently persists the host-written response but does not persist the comparison delta between AI draft and user rewrite. It can learn “this reply is good” but not “the draft was too long / too cold / missing a greeting.”

### 2. Edit learning is split-brain

Local edits are saved into AsyncStorage-backed edit-pattern data. Managed/server drafts read `edit_patterns` from Supabase. The client already has server feedback APIs, but they are not the canonical write path for all learning actions.

### 3. Coverage is disconnected from retrieval

The learning screen measures coverage from `aiTrainingService.responseIndex`, while the active personal-mode draft engine retrieves through local few-shot state plus local edit adjustments, and the managed/server path retrieves through server voice grounding. That makes the coverage UI capable of lying.

### 4. Dead hook drift

The old `useAIDraft.ts` hook contains a different learning path than the active chat code. Even unused code matters here because future fixes can land in the wrong file and silently miss the real product path.

## Approaches Considered

### Approach A: Thin canonical orchestrator over existing stores

Add one canonical learning entry point in the mobile app that:

- accepts a normalized learning event
- writes local truth immediately
- performs best-effort server sync when account/founder session is present
- returns a learning receipt for UI proof

Pros:

- fastest path to a real closed loop
- preserves current personal-mode behavior
- uses existing server endpoints instead of inventing new infrastructure

Cons:

- still bridges across old storage systems for now
- server and local truth stay dual-written during the transition

### Approach B: Full server-canonical learning event pipeline now

Move all learning writes to the server immediately and demote local writes to cache-only.

Pros:

- strongest long-term architecture
- one durable source of truth

Cons:

- conflicts with current repo truth that daily user-facing app path remains `personal`
- bigger auth/offline/session dependency surface
- too much scope for this fix batch

### Approach C: Patch each surface separately

Fix chat, `Test My Voice`, coverage, and proof UI independently without adding a canonical function.

Pros:

- smallest changes per file

Cons:

- guarantees future drift
- repeats the exact failure mode that created this problem

### Recommendation

Choose **Approach A** now.

It is the smallest change that actually changes the architecture. Anything weaker keeps the fake loop alive. Anything bigger drags identity and server-canonical migration into the wrong batch.

## Design Decisions

### 1. One canonical entry point: `recordLearningEvent()`

Create a dedicated module that owns all learning writes for active product surfaces.

Input shape:

```ts
type LearningEvent =
  | {
      type: 'host_written';
      source: 'chat_manual' | 'test_my_voice';
      guestMessage: string;
      finalReply: string;
      propertyId?: string;
      guestIntent?: string;
    }
  | {
      type: 'ai_approved';
      source: 'chat_approve';
      guestMessage: string;
      finalReply: string;
      aiDraft: string;
      propertyId?: string;
      guestIntent?: string;
      confidence?: number;
    }
  | {
      type: 'ai_edited';
      source: 'chat_edit' | 'test_my_voice';
      guestMessage: string;
      finalReply: string;
      aiDraft: string;
      propertyId?: string;
      guestIntent?: string;
      confidence?: number;
    };
```

Output shape:

```ts
type LearningReceipt = {
  storedLocalExample: boolean;
  storedLocalCorrection: boolean;
  queuedIncrementalTraining: boolean;
  syncedServerExample: boolean;
  syncedServerCorrection: boolean;
  updatedOutcomeMetrics: boolean;
  summary: string;
};
```

The function must be the only place that decides which stores to update.

### 2. Canonical writes include both truths

For every event:

- response example truth:
  - local few-shot example
  - incremental trainer queue
  - semantic `voice_examples` sync when session exists
- correction truth:
  - local edit pattern when an AI draft existed and the final reply differs
  - local draft outcome metrics
  - server outcome / edit feedback when session exists

`Test My Voice` stops being special-case storage. It becomes another learning event source.

### 3. Coverage follows retrieval mode

Introduce a retrieval-source adapter with two responsibilities:

- expose which retrieval mode is currently authoritative for the next draft
- expose coverage stats for that same mode

In this batch:

- current daily use remains `personal`, so coverage should read from local few-shot retrieval truth
- when/if the app later becomes server-canonical for daily use, the same adapter can switch coverage to server truth

The coverage screen must never read from a different index than the draft engine.

### 4. Proof becomes first-class product output

After a learning write, the caller receives a `LearningReceipt` and uses it in the UI.

Examples:

- after edit: `Saved correction pattern: shorter, warmer, added greeting`
- after independent manual reply: `Saved as a new host-written example`
- after `Test My Voice`: `Saved example and correction pattern`

On the next generated draft, show a compact proof line:

- `Using 2 similar examples and 1 recent correction`

This is not extra polish. It is required trust infrastructure.

### 5. Dead hook is removed or quarantined

`useAIDraft.ts` must no longer look like a valid active path.

Preferred order:

1. verify no runtime imports remain
2. delete it and its direct tests if safe
3. if deletion is risky, move it under a clear legacy path and mark it as non-authoritative

The repo should present one live learning path, not two.

## File Structure

### Canonical learning ownership

- Create: `src/lib/learning-events.ts`
- Create: `src/lib/__tests__/learning-events.test.ts`

Responsibility:

- normalize learning events
- write local example truth
- write local correction truth
- perform best-effort server sync
- return a learning receipt for UI callers

### Retrieval/coverage ownership

- Create: `src/lib/retrieval-source.ts`
- Create: `src/lib/__tests__/retrieval-source.test.ts`
- Modify: `src/lib/advanced-training.ts`
- Modify: `src/components/AILearningScreen.tsx`

Responsibility:

- expose the active retrieval mode
- expose coverage counts from that same retrieval mode
- remove coverage dependence on the wrong index

### Caller cleanup ownership

- Modify: `src/components/chat/useChatMessageActions.ts`
- Modify: `src/components/TestVoiceScreen.tsx`
- Delete or quarantine: `src/hooks/useAIDraft.ts`
- Delete or quarantine: `src/hooks/__tests__/useAIDraft.test.ts`

Responsibility:

- route all learning-producing actions through the canonical function
- remove dead learning-path duplication

### Proof UI ownership

- Modify: `src/components/chat/useChatDraftEngine.ts`
- Modify: `src/components/chat/useChatMessageActions.ts`
- Modify: `src/components/TestVoiceScreen.tsx`
- Modify: `src/components/AIReasoningSection.tsx` or the current draft proof surface

Responsibility:

- show save receipts after learning writes
- show retrieval proof on next draft

## Data Flow

### Edited AI draft in chat

1. User edits draft.
2. Chat calls `recordLearningEvent({ type: 'ai_edited', ... })`.
3. Canonical function writes:
   - local few-shot example
   - local edit pattern
   - local draft outcome
   - incremental training queue
   - best-effort semantic/server sync
4. Caller displays returned summary.
5. Next draft queries retrieval adapter and shows proof.

### `Test My Voice`

1. User compares AI draft against their rewrite.
2. If they save, screen calls `recordLearningEvent({ type: 'ai_edited', source: 'test_my_voice', ... })`.
3. Canonical function writes both example truth and correction truth.
4. Screen shows returned summary.

### Coverage screen

1. Screen asks retrieval adapter for current coverage source.
2. Adapter returns rows computed from the same retrieval layer the current draft engine uses.
3. Screen renders coverage without cross-index drift.

## Testing Strategy

- unit test canonical event handling for `host_written`, `ai_approved`, and `ai_edited`
- unit test that `Test My Voice` events store correction truth when AI/user responses differ
- unit test retrieval adapter coverage against local few-shot intent counts
- unit test that deleted/quarantined hook has no remaining runtime imports
- UI test that save receipt text appears after edit/save
- UI test that next draft proof line appears when learning proof exists

## Rollout Notes

- keep server sync best-effort and non-blocking in this batch
- do not block message sends on learning writes
- do not make server truth authoritative for daily use in this batch
- document that current user-facing mode remains `personal`

## Success Criteria

1. Every learning-producing action flows through one canonical function.
2. `Test My Voice` stores correction truth, not just example truth.
3. Coverage reads from the same retrieval source the next draft uses.
4. Dead hook path is gone or clearly quarantined.
5. Users can see both:
   - what was saved
   - what was used on the next draft
