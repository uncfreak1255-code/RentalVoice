# Learning Truth And Coverage Design

**Date:** 2026-03-09

**Owner:** Codex

## Goal

Turn AI Learning from a misleading import/training surface into a trustworthy operating dashboard that proves whether Rental Voice is learning enough from historical and daily host replies to cover recurring guest questions.

Primary product target:

- `75% of recurring guest-question categories should have usable learned draft coverage without manual rewrite`

This batch does not claim that the app has reached 75% yet. It makes that target measurable, visible, and actionable.

## Current State

The current app has four connected problems:

1. History import progress is internally inconsistent.
- The screen shows conversation progress in the headline and message progress in the detail line.
- Example from current screen:
  - `Fetching messages (1465/1465)...`
  - `22486 messages fetched`

2. AI Learning does not prove import became learning.
- The app can fetch a large history but still render empty or weak “What I Learned” states.
- That creates a trust gap between imported data volume and visible learned output.

3. The learning surface mixes distinct concepts.
- import status
- training status
- style controls
- background sync
- dashboard metrics
- historical importer controls

4. Output quality is not tied to a measurable coverage target.
- The system has host history, incremental learning, response indexing, style profiles, edit diff learning, conversation flows, and optional memory enrichment.
- None of that currently produces a simple answer to:
  - “What percentage of repeated guest questions can the app likely answer well right now?”

## Non-Goals

This batch will not:

- solve full founder/live account durability
- redesign every settings screen
- fully retune every prompt or every confidence rule
- enable commercial mode by default
- change current visible product truth away from personal-mode, Hostaway-first usage

## Product Principles

1. Import is not learning.
- Import means data arrived.
- Learning means the app analyzed host replies and indexed reusable patterns.

2. Learning is not quality.
- The app must show learned coverage separately from total data ingested.

3. Coverage is the correct launch proxy.
- For this product, repeated guest questions matter more than raw total messages.
- Launch quality should be framed around recurring intent coverage, not vanity counts.

4. The screen should answer one question fast.
- “Is the AI actually learning enough from my history to answer repeated guest questions in my style?”

## Current Technical Reality

### Import path

- History fetch is driven by [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/lib/history-sync.ts`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/lib/history-sync.ts)
- Sync status is stored in [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/lib/store.ts`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/lib/store.ts)
- Auto-import after connect runs through [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/lib/auto-import.ts`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/lib/auto-import.ts)

### Training path

- Auto-training and manual training run through [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/lib/ai-training-service.ts`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/lib/ai-training-service.ts)
- The training service currently:
  - collects host replies with previous guest context
  - samples for style
  - builds a style profile
  - indexes paired guest→host response patterns for recall

### Draft generation path

- Draft generation runs via [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/hooks/useAIDraft.ts`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/hooks/useAIDraft.ts)
- It uses:
  - local enhanced generation in [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/lib/ai-enhanced.ts`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/lib/ai-enhanced.ts)
  - style instructions and learning helpers in [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/lib/ai-learning.ts`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/lib/ai-learning.ts)
- The output stack already consumes:
  - host style profile
  - edit/rejection learning
  - conversation flows
  - property knowledge
  - optional semantic memory

The problem is not “no pipeline exists.” The problem is that the app does not prove the pipeline produced usable recurring-intent coverage.

## Proposed Architecture

Batch 1 introduces one canonical learning-truth layer.

### 1. Import and training truth model

Create one derived model for AI Learning that separates:

- `import`
  - conversations discovered
  - conversations processed
  - messages fetched
  - import phase
  - import completion
- `training`
  - host messages analyzed
  - patterns indexed
  - training phase
  - training completion
- `coverage`
  - recurring intent categories detected
  - covered recurring intent categories
  - coverage percent

This model becomes the source of truth for the screen.

### 2. Recurring intent coverage analysis

Add a recurring-intent coverage analyzer that works from imported history and training outputs.

Inputs:

- imported guest→host conversational pairs
- training response index
- existing detected-intent logic
- property knowledge availability where relevant

Outputs:

- recurring question categories
- volume per category
- whether each category is covered, weak, or uncovered
- overall recurring-intent coverage percent

### 3. AI Learning information architecture

Top of screen should be restructured into this order:

1. `Learning Status`
- importing / imported / training / ready
- one primary CTA:
  - `Import History`
  - `Resume Import`
  - `Review Coverage`

2. `Coverage Snapshot`
- recurring intents covered
- recurring intents total
- coverage percentage
- short summary:
  - `Strong`
  - `Improving`
  - `Needs Work`

3. `Top Repeated Guest Questions`
- top recurring categories by frequency
- label each:
  - `Covered`
  - `Weak`
  - `Missing`

4. `Style Controls`
- remain locked until enough training exists
- no longer compete visually with import truth

The lower historical importer section stays, but becomes secondary detail instead of the main explanatory surface.

## Coverage Definition

For this batch, recurring-question coverage is defined as:

- Look only at recurring guest-intent categories above a minimum volume threshold.
- A category counts as `covered` if:
  - it has enough paired guest→host examples in the response index, and
  - the system has learned enough training signal to treat it as reusable, and
  - the category is not blocked by obvious missing grounding where property knowledge is required

This is intentionally stricter than:

- messages imported
- total patterns indexed
- total approvals

### Initial threshold proposal

- recurring intent minimum volume: `>= 5` examples
- covered threshold: `>= 3` reusable paired examples plus relevant grounding check

This can be tuned later, but the first version must be explicit and testable.

## UX Behavior

### Idle or new state

- Show that import has not happened yet.
- CTA: `Import History`
- Explain that coverage appears after import and training complete.

### Importing state

- Show phase-specific copy:
  - `Fetching conversations`
  - `Fetching messages for conversation X of Y`
  - `Analyzing patterns`
- Do not mix units in one label.

### Training state

- Show:
  - host messages analyzed
  - patterns indexed
  - estimated next step

### Ready state

- Show:
  - recurring intent coverage %
  - covered vs uncovered categories
  - strongest learned categories
  - weak spots to improve next

## What Success Looks Like

After this batch, you should be able to open AI Learning and answer:

1. Did my message history import actually finish?
2. How many host replies were actually analyzed?
3. How many reusable response patterns were indexed?
4. What recurring guest-question categories are most common?
5. What percentage of those repeated categories are currently covered?
6. Are we close to the 75% launch target?

## Risks

1. Current intent detection may be too heuristic.
- That is acceptable for Batch 1 if the thresholds are transparent and tested.

2. Coverage can be overstated if index volume is treated as quality.
- Avoid this by using recurring categories and minimum evidence thresholds.

3. Large histories may cause expensive recomputation.
- Derived coverage should be memoized and computed from already-imported/trained structures.

4. The app may surface an uncomfortable truth.
- Coverage may be lower than expected.
- That is a product advantage if shown honestly and used to drive fixes.

## Design Decision

Batch 1 is approved with this scope:

- fix AI Learning runtime and importer truth issues
- verify imported history becomes analyzed learning
- add recurring-intent coverage measurement
- make 75% recurring-question coverage the explicit product target
