# User App Hardening Queue

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep moving the default personal-mode Rental Voice app toward trustworthiness and App Store readiness while the durable identity/founder lane is built separately.

**Architecture:** Each slice must be independent, user-facing, and safe to build on the `test` Supabase environment without mutating live founder state. The queue stays ordered by trust impact first, then App Store readiness impact, then design polish.

**Tech Stack:** Expo React Native, Zustand, Hostaway integration, Jest, ESLint.

---

## Queue Rules

- Default user-facing path remains Hostaway-first personal mode.
- No slice in this queue may change live founder auth/session behavior.
- No slice may rely on unverified AI claims.
- Prefer one trust problem family per batch.
- Every implementation slice must ship with tests and a brief manual verification checklist.

## Priority 0: Trust and correctness

### Slice U1: AI Learning importer truth and runtime stability
**Why now:** current screenshots showed contradictory progress units and a runtime `<Text>` rendering error.

**Files:**
- `/Users/sawbeck/Projects/RentalVoice/src/components/AILearningScreen.tsx`
- `/Users/sawbeck/Projects/RentalVoice/src/lib/ai-learning.ts`
- matching tests under `/Users/sawbeck/Projects/RentalVoice/src/components/__tests__/` and `/Users/sawbeck/Projects/RentalVoice/src/lib/__tests__/`

**Must do:**
- separate conversation progress from message progress
- remove contradictory counts
- fix the current runtime render error
- surface import/recovery action above the fold

**Verification:**
- focused Jest suites for idle/importing/completed states
- manual device check with real imported history

**Parallel safety:** safe in parallel with founder design/docs only; not safe in parallel with any broad AI Learning redesign touching the same screen

### Slice U2: Chat send/edit reliability live validation and cleanup
**Why now:** chat reliability is still a core trust blocker even after targeted fixes.

**Files:**
- `/Users/sawbeck/Projects/RentalVoice/src/components/MessageComposer.tsx`
- `/Users/sawbeck/Projects/RentalVoice/src/components/ChatScreen.tsx`
- `/Users/sawbeck/Projects/RentalVoice/src/components/AIDraftActionsSheet.tsx`
- matching tests under `/Users/sawbeck/Projects/RentalVoice/src/components/__tests__/`

**Must do:**
- manual send remains visible while typing
- edit -> clear -> send path is stable
- approve/reject/regenerate paths do not regress learning updates
- keyboard and footer behavior are reliable on device

**Verification:**
- focused Jest suites
- device smoke pass on real threads

**Parallel safety:** not safe with any other ChatScreen layout refactor

### Slice U3: Escalation and issue correctness
**Why now:** issue banners that overfire or overlap content are immediate trust failures.

**Files:**
- `/Users/sawbeck/Projects/RentalVoice/src/components/ChatScreen.tsx`
- `/Users/sawbeck/Projects/RentalVoice/src/components/IssueTriageCard.tsx`
- `/Users/sawbeck/Projects/RentalVoice/src/lib/issue-triage.ts`

**Must do:**
- fix banner layout overlap
- tighten trigger logic
- verify issue category/severity mapping against real threads

**Verification:**
- triage unit tests
- targeted manual pass on refund/access/cleanliness threads

**Parallel safety:** not safe with other ChatScreen work

## Priority 1: Recovery and onboarding quality

### Slice U4: Onboarding and reconnect recovery
**Why now:** onboarding architecture improved, but reconnect/recovery still needs full trust and usability polish.

**Files:**
- `/Users/sawbeck/Projects/RentalVoice/src/components/OnboardingScreen.tsx`
- `/Users/sawbeck/Projects/RentalVoice/src/components/ApiSettingsScreen.tsx`
- `/Users/sawbeck/Projects/RentalVoice/src/app/index.tsx`
- `/Users/sawbeck/Projects/RentalVoice/src/lib/session-gate.ts`

**Must do:**
- explicit recovery state after reconnect
- specific error states for invalid credentials or partial restore
- make sync/rebuild state understandable
- ensure CTA remains visible on small devices and with keyboard

**Verification:**
- component tests for onboarding states
- simulator pass on a small phone profile

**Parallel safety:** not safe with founder session-routing implementation

### Slice U5: Inbox trust and list quality
**Why now:** blank/incorrect inbox states undermine the whole product quickly.

**Files:**
- `/Users/sawbeck/Projects/RentalVoice/src/components/InboxDashboard.tsx`
- `/Users/sawbeck/Projects/RentalVoice/src/lib/inbox-trust.ts`
- `/Users/sawbeck/Projects/RentalVoice/src/components/ConversationItem.tsx`

**Must do:**
- no unexpected blank inbox after navigation
- unread filter/count remain trustworthy
- briefing stays subordinate to the actual list
- loading/offline/recovery states are polished

**Verification:**
- inbox recovery tests
- manual navigation smoke pass

**Parallel safety:** safe with release docs; not safe with broad inbox redesign

## Priority 2: AI learning quality

### Slice U6: Recurring-intent coverage measurement
**Why now:** imported message volume must translate into measurable useful-draft coverage.

**Files:**
- `/Users/sawbeck/Projects/RentalVoice/src/lib/ai-learning.ts`
- `/Users/sawbeck/Projects/RentalVoice/src/lib/ai-training-service.ts`
- `/Users/sawbeck/Projects/RentalVoice/src/components/AILearningScreen.tsx`

**Must do:**
- measure recurring guest intents from imported history
- compute covered vs weak vs missing categories
- make 75% usable-draft target visible as a real metric, not a claim

**Verification:**
- unit tests on coverage calculations
- plausibility pass on real imported history

**Parallel safety:** not safe with U1 if both edit AILearningScreen heavily; do U1 first

### Slice U7: Draft quality for high-volume intents
**Why now:** repeated guest asks should be the easiest reliable win.

**Target intent families:**
- wifi
- parking
- check-in
- check-out
- early check-in
- late checkout
- house rules
- gratitude/closure

**Files:**
- `/Users/sawbeck/Projects/RentalVoice/src/lib/smart-replies.ts`
- `/Users/sawbeck/Projects/RentalVoice/src/lib/ai-enhanced.ts`
- `/Users/sawbeck/Projects/RentalVoice/src/lib/advanced-training.ts`
- `/Users/sawbeck/Projects/RentalVoice/src/lib/ai-training-service.ts`

**Must do:**
- reduce generic hospitality filler
- ground drafts in property and timing context
- improve guest ask extraction
- measure edit distance/approval quality where possible

**Verification:**
- targeted unit tests and regression scenarios
- founder/user manual review set from real thread samples

**Parallel safety:** safe after U6 defines the measurement contract

## Priority 3: Design and premium product finish

### Slice U8: Property Knowledge polish
**Files:**
- `/Users/sawbeck/Projects/RentalVoice/src/components/PropertyKnowledgeScreen.tsx`
- `/Users/sawbeck/Projects/RentalVoice/src/components/KnowledgeCoverageDashboard.tsx`
- `/Users/sawbeck/Projects/RentalVoice/src/lib/knowledge-coverage.ts`

**Must do:**
- remove dead space
- fix top collapsed region
- make coverage scoring complete and explainable
- add inline templates/examples

### Slice U9: Settings and staged-surface truth pass
**Files:**
- `/Users/sawbeck/Projects/RentalVoice/src/components/SettingsScreen.tsx`
- `/Users/sawbeck/Projects/RentalVoice/src/components/BillingScreen.tsx`
- `/Users/sawbeck/Projects/RentalVoice/src/components/FounderDiagnosticsScreen.tsx`

**Must do:**
- gate or hide unfinished staged/commercial surfaces
- separate safe disconnect from destructive delete
- ensure copy matches current entitlement reality

## Priority 4: Release-facing cleanup

### Slice U10: Privacy/support truth sweep
**Files:**
- `/Users/sawbeck/Projects/RentalVoice/src/components/PrivacySecurityScreen.tsx`
- `/Users/sawbeck/Projects/RentalVoice/src/components/HelpCenterScreen.tsx`
- `/Users/sawbeck/Projects/RentalVoice/src/components/NotificationSettingsScreen.tsx`

**Must do:**
- remove claims stronger than the actual system supports
- align export/delete/help copy with real behavior
- prepare for App Store privacy disclosures

## Queue owner map

- Durable identity / founder lane: separate, do not mix with this queue
- User app hardening automation: choose the highest safe slice from this queue only
- Any slice touching `ChatScreen.tsx` should run alone
- Any slice touching `AILearningScreen.tsx` should run alone

## Definition of queue success

- no P0 trust bugs remain in the default user path
- app behavior is internally consistent and recoverable
- repeated guest questions trend toward the 75% usable-draft target
- public-facing copy matches actual product behavior
