# Founder + User App Parallel Execution Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Sawyer’s founder account usable and durable while the user-facing app keeps improving in parallel toward App Store readiness.

**Architecture:** Use three coordinated lanes: Founder Path, User App Hardening, and Release Readiness. Keep normal development on the linked `test` environment, keep `live` limited to founder validation, and converge only after founder session recovery and durable learning migration are stable.

**Tech Stack:** Expo React Native, TypeScript, Supabase, Hostaway integration, local ops tooling, Jest, ESLint.

---

### Task 1: Lock the coordination docs

**Files:**
- Create: `/Users/sawbeck/Projects/RentalVoice/docs/plans/2026-03-09-founder-user-parallel-execution-design.md`
- Create: `/Users/sawbeck/Projects/RentalVoice/docs/plans/2026-03-09-founder-user-parallel-execution.md`
- Modify: `/Users/sawbeck/Projects/RentalVoice/docs/status/current-state.md`
- Modify: `/Users/sawbeck/Projects/RentalVoice/docs/status/next-batch.md`
- Modify: `/Users/sawbeck/Projects/RentalVoice/docs/status/open-risks.md`

**Steps:**
1. Verify founder bootstrap state and current status docs.
2. Write the design doc describing Lane A, B, and C.
3. Write this implementation plan.
4. Confirm the status docs point future agents to the founder app-path lane next.
5. Commit docs as one checkpoint.

### Task 2: Founder path design and scope freeze

**Files:**
- Create: `/Users/sawbeck/Projects/RentalVoice/docs/plans/2026-03-09-founder-app-path-design.md`
- Modify: `/Users/sawbeck/Projects/RentalVoice/docs/status/next-batch.md`

**Steps:**
1. Audit current app boot/session/onboarding flow.
2. Define exactly how founder sign-in is reached without replacing the default personal path.
3. Define founder session restore logic after app resets.
4. Define how founder mode is detected and surfaced internally.
5. Freeze the initial founder app-path scope before coding.

### Task 3: Founder session recovery implementation

**Files:**
- Modify: `/Users/sawbeck/Projects/RentalVoice/src/app/`
- Modify: `/Users/sawbeck/Projects/RentalVoice/src/lib/secure-storage.ts`
- Modify: `/Users/sawbeck/Projects/RentalVoice/src/lib/store.ts`
- Modify: `/Users/sawbeck/Projects/RentalVoice/src/lib/session-gate.ts`
- Test: `/Users/sawbeck/Projects/RentalVoice/src/**/__tests__/*session*`

**Steps:**
1. Write failing tests for founder session boot and recovery.
2. Implement minimal founder session restore logic.
3. Verify app resets do not silently drop the founder identity.
4. Add clear fallback behavior when founder session is missing or invalid.
5. Commit the founder session slice.

### Task 4: Founder learning migration contract

**Files:**
- Modify: `/Users/sawbeck/Projects/RentalVoice/src/lib/commercial-migration.ts`
- Modify: `/Users/sawbeck/Projects/RentalVoice/server/src/routes/migration.ts`
- Modify: `/Users/sawbeck/Projects/RentalVoice/src/lib/store.ts`
- Test: `/Users/sawbeck/Projects/RentalVoice/src/lib/__tests__/`
- Test: `/Users/sawbeck/Projects/RentalVoice/server/src/**/__tests__/`

**Steps:**
1. Inventory the exact local learning artifacts that still need migration.
2. Write failing tests for snapshot/export/import behavior.
3. Implement the smallest migration payload that preserves durable learning value.
4. Validate import into the founder account on non-live rehearsal first if needed.
5. Commit the migration slice.

### Task 5: Founder canary validation

**Files:**
- Modify: `/Users/sawbeck/Projects/RentalVoice/docs/status/current-state.md`
- Modify: `/Users/sawbeck/Projects/RentalVoice/docs/status/open-risks.md`
- Create or update local verification notes under `/Users/sawbeck/Projects/RentalVoice/docs/plans/`

**Steps:**
1. Verify founder login from the app.
2. Verify `/api/auth/me`, billing, entitlements, and founder diagnostics from the founder session.
3. Verify founder state survives app restart/reset scenarios.
4. Record any founder-only defects before daily canary use.
5. Commit the validation checkpoint.

### Task 6: User app hardening backlog freeze

**Files:**
- Modify: `/Users/sawbeck/Projects/RentalVoice/docs/plans/2026-03-09-app-store-readiness-roadmap.md`
- Create: `/Users/sawbeck/Projects/RentalVoice/docs/plans/2026-03-09-user-app-hardening-queue.md`

**Steps:**
1. Re-rank all known user-facing defects by trust and App Store impact.
2. Split work into independent slices safe for parallel agents.
3. Mark blockers vs independent tasks.
4. Define the single highest-value next slice at all times.
5. Commit the hardening queue.

### Task 7: User app hardening execution lanes

**Files:**
- Modify only the exact files needed per slice in `/Users/sawbeck/Projects/RentalVoice/src/`
- Test: matching Jest suites

**Steps:**
1. Assign one slice per branch or worktree.
2. Keep each batch focused on one problem family.
3. Require tests and visual verification per slice.
4. Merge only after branch review and status update.
5. Repeat until Gate B is met.

### Task 8: Learning quality lane

**Files:**
- Modify: `/Users/sawbeck/Projects/RentalVoice/src/lib/ai-learning.ts`
- Modify: `/Users/sawbeck/Projects/RentalVoice/src/lib/ai-training-service.ts`
- Modify: `/Users/sawbeck/Projects/RentalVoice/src/components/AILearningScreen.tsx`
- Modify: `/Users/sawbeck/Projects/RentalVoice/src/lib/smart-replies.ts`
- Test: learning and smart-reply suites

**Steps:**
1. Measure recurring guest-intent coverage from imported history.
2. Prioritize top repeated categories.
3. Improve retrieval, learned examples, and draft generation for those categories.
4. Track progress toward the 75% usable coverage target.
5. Commit each learning-quality improvement slice separately.

### Task 9: Release readiness lane

**Files:**
- Modify: `/Users/sawbeck/Projects/RentalVoice/docs/plans/2026-03-09-app-store-readiness-roadmap.md`
- Create: `/Users/sawbeck/Projects/RentalVoice/docs/plans/2026-03-09-app-store-gate-checklist.md`
- Create: `/Users/sawbeck/Projects/RentalVoice/docs/plans/2026-03-09-app-privacy-and-support-truth.md`

**Steps:**
1. Turn the roadmap into a release checklist.
2. Document actual privacy/data handling behavior.
3. Define screenshot/metadata/support requirements.
4. Define launch blockers with pass/fail gates.
5. Commit the release-readiness docs.

### Task 10: Automation support lane

**Files:**
- No repo code required unless automation memory docs are explicitly requested

**Steps:**
1. Create one automation for the user-app hardening lane.
2. Keep it planning/triage focused, not autonomous live-state mutation.
3. Require a single next slice, exact files, risks, and handoff in every run.
4. Use the roadmap and status docs as source-of-truth inputs.
5. Review automation output before approving implementation work.

### Task 11: Branch discipline

**Files:**
- No product files

**Steps:**
1. Keep the old salvage worktree untouched until useful pieces are extracted or intentionally deleted.
2. Use named `codex/` branches for each new slice.
3. Keep the canonical repo clean before risky operations.
4. Commit in logical checkpoints.
5. Never treat chat context as source of truth over repo state.

### Task 12: Program review cadence

**Files:**
- Modify: `/Users/sawbeck/Projects/RentalVoice/docs/status/current-state.md`
- Modify: `/Users/sawbeck/Projects/RentalVoice/docs/status/next-batch.md`
- Modify: `/Users/sawbeck/Projects/RentalVoice/docs/status/open-risks.md`

**Steps:**
1. Review Gate A and Gate B progress at least weekly.
2. Update status docs whenever reality changes.
3. Re-rank the next highest-value lane.
4. Keep founder/live rules explicit.
5. Commit status updates as their own checkpoint.
