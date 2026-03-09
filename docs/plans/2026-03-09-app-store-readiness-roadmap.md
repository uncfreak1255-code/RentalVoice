# Rental Voice App Store Readiness Roadmap

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Take Rental Voice from its current personal-mode, Hostaway-first prototype state to a trustworthy, policy-compliant, launchable iOS app with durable AI learning, reliable messaging, and clear App Store submission gates.

**Architecture:** Keep the current visible product in `personal` mode while fixing trust and durability first. Treat launch readiness as five parallel workstreams: product correctness, AI learning quality, durable identity/data, policy/privacy truth, and release engineering. Use staged founder/commercial infrastructure only when it directly strengthens the personal-mode launch path and never as a shortcut around current data-loss problems.

**Tech Stack:** Expo Router, React Native 0.81 / Expo 54, Zustand local store + cold storage, Hostaway PMS integration, TypeScript backend with Hono + Supabase, EAS build/submit, Sentry.

---

## 1. Current State Snapshot

### Product truth

- Current visible app mode is `personal`, not commercial.
- Current onboarding is Hostaway Account ID + API Secret Key.
- Founder/live app-auth environment is not selected yet.
- Current linked Supabase project is explicitly `test` and blocked for founder bootstrap.

### Launch reality

- EAS production config and App Store Connect app ID already exist in [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/eas.json`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/eas.json) and [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/app.json`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/app.json).
- This does not mean the product is launch ready.
- The app still has correctness, durability, UX, policy, and testing gaps that would fail a serious internal release review.

### Core repo facts used for this roadmap

- Founder bootstrap is blocked by design in [`/Users/sawbeck/Projects/RentalVoice/docs/status/current-state.md`](/Users/sawbeck/Projects/RentalVoice/docs/status/current-state.md), [`/Users/sawbeck/Projects/RentalVoice/docs/status/next-batch.md`](/Users/sawbeck/Projects/RentalVoice/docs/status/next-batch.md), and [`/Users/sawbeck/Projects/RentalVoice/ops/lib/require-env-class.sh`](/Users/sawbeck/Projects/RentalVoice/ops/lib/require-env-class.sh).
- Account deletion server route exists in [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/server/src/routes/account.ts`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/server/src/routes/account.ts).
- Auth routes exist server-side in [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/server/src/routes/auth.ts`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/server/src/routes/auth.ts) but are not the current visible app path.
- AI learning, sync, and conversation durability are still heavily local-state driven in [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/lib/store.ts`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/lib/store.ts), [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/lib/cold-storage.ts`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/lib/cold-storage.ts), and [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/AILearningScreen.tsx`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/AILearningScreen.tsx).

## 2. Observed Critical Findings

These are grounded in current code, current screenshots, and already observed product behavior.

### P0 trust and data integrity

1. AI learning durability is not strong enough.
- `resetStore()` clears conversations, learning, draft outcomes, profiles, and sync state in [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/lib/store.ts`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/lib/store.ts).
- Boot recovery historically depended on local onboarding state.
- A device/app container reset can make an existing user appear new and can wipe local learning state.

2. AI Learning importer status is internally inconsistent.
- The sync headline uses conversations as progress units:
  - `Fetching messages (${processedConversations}/${totalConversations})`
- The detail line uses messages as progress units:
  - `${processedMessages} messages fetched`
- Both are rendered in [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/AILearningScreen.tsx:1692`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/AILearningScreen.tsx:1692) and [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/AILearningScreen.tsx:1709`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/AILearningScreen.tsx:1709).
- This is why `1465/1465` can coexist with `1928 messages fetched`.

3. The AI Learning screen has a runtime rendering error.
- Screenshot shows `Text strings must be rendered within a <Text>`.
- Until fixed, the screen cannot be treated as stable or trustworthy.

4. Current privacy language over-claims reality.
- `End-to-End Encryption` and `your data stays on your device` are stated in [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/PrivacySecurityScreen.tsx`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/PrivacySecurityScreen.tsx).
- Help center says data is encrypted at rest/in transit and export/delete are available in [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/HelpCenterScreen.tsx`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/HelpCenterScreen.tsx).
- Some of this is directionally true, but the copy is stronger than the current system guarantees and export is partial, not full.

5. Test depth is too shallow for the feature surface.
- Component tests exist for only a small fraction of screens.
- There is no visible end-to-end test suite for critical user paths.
- Repo-wide typecheck is currently blocked by server issues.

### P1 product correctness

6. Chat/composer reliability was already a known blocker and still requires full live validation.
- `MessageComposer` has targeted fixes and tests, but launch readiness requires device validation of keyboard, send, edit, regenerate, approve, and manual-send flows.

7. Escalation and issue surfacing remain high-risk.
- Escalation UI exists in [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/ChatScreen.tsx`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/ChatScreen.tsx), but prior observed behavior showed overlap and suspected over-triggering.

8. Onboarding architecture is being corrected, but the whole reconnect/import/recovery flow still needs a full usability pass.

9. Settings is broad but not yet disciplined enough for launch.
- Many settings routes exist.
- Several are staged/commercial or diagnostic surfaces that should not feel half-live or misleading in a public App Store build.

### P1 AI quality

10. AI learning metrics still need full unification and narrative cleanup.
- There is now a metrics helper in [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/lib/ai-learning.ts`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/lib/ai-learning.ts), but the screen still mixes sync state, training state, and style control state in a confusing hierarchy.

11. Founder voice specificity is still not production-grade.
- The current learning stack includes local style profiles, edit diffs, conversation flows, advanced training, and Supermemory hooks.
- That does not yet equal reliable, high-specificity drafting for multiple real users.

12. Memory / RAG / retrieval architecture is present but not launch-governed.
- Local advanced training and guest memory live in [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/lib/advanced-training.ts`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/lib/advanced-training.ts) and [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/lib/ai-enhanced.ts`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/lib/ai-enhanced.ts).
- Commercial/server memory entitlements live in server billing/entitlement routes.
- There is not yet one clean launch story for what memory exists, where it lives, how it is retrieved, and how users can trust or control it.

## 3. Surface-by-Surface Product Audit

### A. Entry and onboarding

**Files**
- [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/app/index.tsx`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/app/index.tsx)
- [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/app/onboarding.tsx`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/app/onboarding.tsx)
- [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/OnboardingScreen.tsx`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/OnboardingScreen.tsx)
- [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/ApiSettingsScreen.tsx`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/ApiSettingsScreen.tsx)

**What must be true before launch**
- Setup is outside tab chrome.
- Reconnect is obvious and recoverable.
- Primary CTA is always visible with keyboard/safe area.
- Help for Hostaway credentials is actionable.
- Connect first, sync after.
- Errors are specific, recoverable, and never silent.

**Open work**
- Finish live validation across small phones and keyboard states.
- Add explicit recovery state when credentials exist but learning/history are still rebuilding.
- Add import/sync observability entry point from onboarding success state.
- Add empty-state copy that explains what is being restored and what is not.

### B. Inbox and list management

**Files**
- [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/InboxDashboard.tsx`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/InboxDashboard.tsx)
- [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/ConversationItem.tsx`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/ConversationItem.tsx)

**What must be true before launch**
- Conversation list loads consistently.
- Refresh and sync state are visible but not noisy.
- Daily Briefing, issue chips, and trust indicators are subordinate to the core list.
- Empty, loading, offline, and reconnect states are polished.

**Open work**
- Validate sync banner and first-load states after real reconnect.
- Audit list performance with large histories.
- Normalize issue, urgency, and reservation badges so they do not feel random.

### C. Chat and sending

**Files**
- [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/ChatScreen.tsx`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/ChatScreen.tsx)
- [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/MessageComposer.tsx`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/MessageComposer.tsx)
- [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/AIDraftActionsSheet.tsx`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/AIDraftActionsSheet.tsx)

**What must be true before launch**
- Manual send is always available.
- Edited-draft send path is stable.
- Approve, reject, regenerate, auto-send, and manual-send flows update learning correctly.
- Reservation context and escalation banners do not overlap content.
- Guest ask extraction and timing grounding are consistently correct.

**Open work**
- Full device regression pass.
- Add end-to-end tests for send and edit/approve/reject flows.
- Tighten escalation trigger logic and banner layout.
- Add per-thread debug/eval logging for incorrect drafts.

### D. AI learning, style, training, memory

**Files**
- [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/AILearningScreen.tsx`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/AILearningScreen.tsx)
- [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/lib/ai-learning.ts`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/lib/ai-learning.ts)
- [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/lib/advanced-training.ts`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/lib/advanced-training.ts)
- [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/lib/ai-enhanced.ts`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/lib/ai-enhanced.ts)
- [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/lib/supermemory-service.ts`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/lib/supermemory-service.ts)

**What must be true before launch**
- Import, sync, training, style profile, and accuracy are separate concepts in the UI.
- Progress numbers never contradict each other.
- The learning model produces user-specific outputs, not generic hospitality filler.
- Cross-property and per-property learning boundaries are explicit.
- Memory usage is controllable, explainable, and consistent with plan/product truth.

**Open work**
- Fix the current importer unit mismatch.
- Fix the runtime render error.
- Surface import action above the fold.
- Create a formal evaluation harness:
  - approval rate by scenario
  - edit distance by intent
  - specificity score
  - policy safety score
  - hallucination / unsupported claim checks
- Add per-user and per-property training set isolation tests.
- Define one canonical memory architecture for launch:
  - local-only memory in personal mode
  - what is remote in future managed mode
  - what the UI is allowed to claim

### E. Property knowledge and RAG grounding

**Files**
- [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/PropertyKnowledgeScreen.tsx`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/PropertyKnowledgeScreen.tsx)
- [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/KnowledgeCoverageDashboard.tsx`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/KnowledgeCoverageDashboard.tsx)
- [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/lib/knowledge-coverage.ts`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/lib/knowledge-coverage.ts)

**What must be true before launch**
- Knowledge entry is fast, structured, and obviously valuable.
- Coverage scoring is accurate and explainable.
- The UI feels premium, not like a long form dump.
- Retrieval grounding is observable in the draft quality.

**Open work**
- Reduce dead space and fix top-panel/collapse behavior.
- Complete currently mocked metrics in `knowledge-coverage.ts`.
- Add regression tests around coverage calculations and category completeness.
- Add inline examples/templates so users can improve weak fields quickly.

### F. Settings, diagnostics, billing, and staged commercial surfaces

**Files**
- [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/SettingsScreen.tsx`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/SettingsScreen.tsx)
- [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/BillingScreen.tsx`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/BillingScreen.tsx)
- [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/FounderDiagnosticsScreen.tsx`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/FounderDiagnosticsScreen.tsx)

**What must be true before launch**
- Public/personal users only see truthful, supported surfaces.
- Staged commercial and founder tools are hidden, gated, or clearly diagnostic.
- Disconnect is safe and distinct from delete-all-data.
- Plan/billing copy matches actual entitlements and backend behavior.

**Open work**
- Remove or gate any settings that imply unfinished managed/commercial functionality.
- Separate safe disconnect from destructive wipe everywhere.
- Review every billing and “memory add-on” claim for current launch scope.

### G. Privacy, security, analytics, notifications

**Files**
- [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/PrivacySecurityScreen.tsx`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/PrivacySecurityScreen.tsx)
- [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/HelpCenterScreen.tsx`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/HelpCenterScreen.tsx)
- [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/NotificationSettingsScreen.tsx`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/NotificationSettingsScreen.tsx)
- [`/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/AnalyticsDashboard.tsx`](/Users/sawbeck/.codex/worktrees/a377/RentalVoice/src/components/AnalyticsDashboard.tsx)

**What must be true before launch**
- All privacy/security copy is literally true.
- Export and deletion capabilities match user expectations and App Store disclosures.
- Analytics consent is explicit and documented.
- Push permissions are justified and configurable.
- Privacy policy, terms, support URL, and account deletion URL are ready for App Store metadata.

**Open work**
- Replace inflated claims like `End-to-End Encryption` unless fully substantiated.
- Make export more complete or label it clearly as summary export.
- Create formal app privacy data map for App Store Connect.
- Add retention/deletion policy documentation for personal mode and future managed mode.

### H. Calendar, review response, upsells, automations, webhook, language, sentiment, issue tracker

**Files**
- All `src/app/settings/*.tsx` and their matching components.

**What must be true before launch**
- Every route in the shipped build is either polished, truthful, and useful, or removed.
- No screen should feel like an internal prototype, stub, or commercial preview.

**Open work**
- Do a route-by-route acceptance review.
- For each route, choose exactly one action:
  - ship now
  - gate behind feature flag
  - hide from launch build
  - remove until production quality exists

## 4. Architecture Workstreams

### Workstream 1: Trust and product correctness

**Priority:** P0

**Scope**
- chat send reliability
- sync/import truth
- crash-free AI Learning
- escalation correctness
- reconnect/recovery UX

**Definition of done**
- No launch-blocking send, sync, or restore bugs remain.
- All core states are validated on device.

### Workstream 2: Durable identity and user data

**Priority:** P0

**Scope**
- safe disconnect vs destructive delete
- boot-time recovery even when local state is damaged
- durable learning persistence strategy
- founder/live environment prep without violating current gates
- migration path from local learning to future account-backed state

**Definition of done**
- A user cannot silently become “new” without a clear recovery path.
- Learning/history durability is no longer dependent on a single local container.

### Workstream 3: AI learning, RAG, and memory quality

**Priority:** P0/P1

**Scope**
- evaluation framework
- founder-quality drafting
- multi-user separation
- per-property style handling
- knowledge-grounded response generation
- memory architecture and UI truth

**Definition of done**
- The product can explain what it learned and demonstrate quality improvements with evidence.
- The app supports multiple distinct users without voice bleed.

### Workstream 4: App Store policy, privacy, accessibility, design

**Priority:** P1

**Scope**
- privacy claims
- account deletion flow
- export path
- App Privacy data mapping
- accessibility pass
- dynamic type
- safe areas
- dark/light contrast
- human-interface polish

**Definition of done**
- The shipped build passes internal review against Apple’s App Store Review Guidelines on performance, design, privacy, and account management.

### Workstream 5: Release engineering and operational readiness

**Priority:** P1

**Scope**
- repo-wide typecheck
- CI coverage
- e2e smoke flows
- TestFlight instrumentation
- crash/perf monitoring
- rollback and baseline discipline
- metadata/screenshots/support links

**Definition of done**
- A release candidate can be built, tested, rolled back, and submitted repeatably.

## 5. Roadmap by Phase

### Phase 0: Stop the trust leaks

**Target outcome**
- The app stops lying, crashing, and silently losing state.

**Batches**
1. Fix AI Learning runtime render error and import CTA visibility.
2. Fix importer progress model so units are consistent and explainable.
3. Finish composer/chat live validation and patch any remaining send/edit regressions.
4. Fix escalation banner layout and trigger false positives.
5. Replace over-claimed privacy/help copy with verified statements only.

### Phase 1: Make existing users durable

**Target outcome**
- Existing users can recover, reconnect, and keep their learning state.

**Batches**
1. Split disconnect from delete-all-data.
2. Add stronger boot recovery and reconnect recovery.
3. Add explicit rebuild/retrain states after reconnect.
4. Design and implement a durable persistence contract for learning data.
5. Prepare, but do not misuse, founder/live environment bootstrap flow.

### Phase 2: Make AI learning actually defensible

**Target outcome**
- AI learning is measurable, specific, and trustworthy for real users.

**Batches**
1. Build draft-quality evaluation dataset from real founder threads.
2. Add metrics for specificity, completeness, tone fit, and correction rate.
3. Harden per-user, per-property, and returning-guest memory boundaries.
4. Simplify AI Learning information architecture around:
   - import
   - train
   - review performance
   - adjust style
5. Tighten retrieval and memory prompt assembly.

### Phase 3: Polish every shipped surface

**Target outcome**
- The launch build feels intentional and premium, not wide but unfinished.

**Batches**
1. Route-by-route acceptance pass for every settings screen.
2. Property Knowledge redesign/polish.
3. Inbox/list visual refinement.
4. Empty/loading/error/offline states across all tabs.
5. Remove or hide unfinished routes from launch build.

### Phase 4: Build launch-grade compliance and QA

**Target outcome**
- The app can survive TestFlight, internal QA, and App Review.

**Batches**
1. Accessibility audit and fixes.
2. Privacy disclosures, support URLs, delete-account support page.
3. Notification permission rationales and fallbacks.
4. CI stabilization:
   - lint
   - typecheck
   - unit tests
   - smoke tests
5. Device matrix QA:
   - small iPhone
   - large iPhone
   - offline
   - cold launch
   - reconnect
   - long history import

### Phase 5: Release candidate and submission

**Target outcome**
- One controlled, reviewable release candidate.

**Batches**
1. Build protected baseline.
2. Cut a launch branch from canonical local state.
3. Run pre-release safety gate.
4. Ship TestFlight RC.
5. Fix RC findings only.
6. Submit to App Store with production metadata and support artifacts.

## 6. Detailed Work Breakdown

### P0 engineering backlog

1. AI Learning importer truth
- unify conversation count vs message count
- show exact stage model
- expose import action above the fold
- show when training starts after fetch completes

2. AI Learning stability
- fix current runtime text-render error
- add component test coverage around importer states
- add regression tests for empty, syncing, paused, resumed, completed states

3. Durable user state
- separate `disconnect credentials` from `erase local data`
- preserve recoverable user identity when secure credentials still exist
- build explicit local snapshot/rebuild path

4. Chat/core messaging
- full end-to-end send validation
- escalation correctness
- learn-from-edit correctness
- no hidden buttons or keyboard collisions

5. Privacy truth
- review every support/privacy/security claim
- align in-app wording with actual architecture
- ensure app privacy disclosures match real collection/storage/remote processing

### P1 engineering backlog

1. AI quality and evaluation
- build an evaluation harness for core guest intents
- add benchmark set and pass/fail thresholds
- compare generated vs edited/final replies

2. Knowledge and retrieval
- validate knowledge completeness scoring
- define retrieval precedence:
  - property facts
  - recent thread context
  - host style profile
  - reusable memory/examples

3. Release quality
- repo-wide typecheck green
- e2e smoke flow for:
  - onboarding
  - inbox refresh
  - open thread
  - send message
  - AI Learning import

4. Route governance
- classify each route:
  - launch
  - hide
  - flag
  - defer

## 7. App Store Readiness Checklist

This roadmap should be considered incomplete until all items below are explicitly green.

### Product
- No P0 bugs open in onboarding, inbox, chat, AI learning, or reconnect flow.
- No misleading metrics or false confidence claims.
- No screen in the shipped build feels prototype-only.

### Data
- User learning/history durability is documented and tested.
- Export/delete behavior is consistent with UI copy.
- Account deletion works end-to-end for the live auth path.

### Policy and privacy
- Privacy policy and terms are live.
- Support URL is live.
- Account deletion support URL is live if required in App Store metadata.
- App Privacy answers are mapped from real behavior, not guesses.

### QA
- Unit tests cover all core state reducers and high-risk screens.
- Smoke tests cover critical flows.
- Manual QA matrix completed on physical device and simulator.
- Crash-free sessions and import runs are verified in TestFlight.

### Release ops
- Protected baseline refreshed.
- Rollback path verified.
- Pre-release safety gate executed.
- Launch metadata, screenshots, and review notes prepared.

## 8. What an Apple-Level Internal Review Would Reject Today

1. A user can lose apparent identity and learning state too easily.
2. AI Learning exposes contradictory progress metrics.
3. Privacy/security language is stronger than the implementation proves.
4. The test surface is too small relative to the feature surface.
5. Too many routes/settings exist without a disciplined launch/no-launch decision.

## 9. Recommended Immediate Execution Order

### Batch 1
- Fix AI Learning screen runtime error.
- Fix importer progress model and copy.
- Add top-level import/recovery CTA.

### Batch 2
- Finish durable disconnect/recovery redesign.
- Add explicit rebuild/retrain recovery states.

### Batch 3
- Full chat/composer/escalation live validation and fixes.

### Batch 4
- Privacy/help/security copy truth pass.
- Export/delete/account-management audit.

### Batch 5
- Route-by-route launch governance pass.
- Hide or gate unfinished settings/features.

### Batch 6
- Evaluation harness for draft quality and multi-user learning separation.

### Batch 7
- Accessibility, performance, TestFlight, release hardening.

## 10. Commands and Validation Gates

### Required recurring validation

```bash
npm run lint
npm run typecheck
npx jest --runInBand
```

### Release safety

```bash
npm run ops:baseline:protect -- --checkpoint-id protected-local-baseline-<timestamp>
npm run ops:founder:checklist
npm run ops:founder:packet
npm run ops:founder:preflight
```

### Notes
- Founder bootstrap remains blocked until a distinct live environment exists.
- Personal mode remains the current shipped truth until intentional cutover.

## 11. Official External Launch Gates To Check During Submission

- Apple App Store Review Guidelines: performance, design, privacy, account management, and honesty in claims.
- Apple account deletion expectation for apps with account creation.
- Apple App Privacy disclosures in App Store Connect.

Use official Apple documentation during final submission prep, not memory.
