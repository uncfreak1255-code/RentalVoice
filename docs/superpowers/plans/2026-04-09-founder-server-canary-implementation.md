# Founder Server Canary Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the founder account lane real end-to-end and route authenticated founder drafts through the existing server-canonical voice system without changing the default Hostaway-first personal path for everyone else.

**Architecture:** Reuse what already exists instead of inventing a second architecture. The server already has passwordless auth routes, migration routes, voice-grounding, and readiness services; this batch wires the app to those systems through the existing Settings -> Founder Access canary lane, verifies migration before marking it complete, and enables managed drafts when a verified founder session exists even while global `APP_MODE` remains `personal`.

**Tech Stack:** Expo Router, React Native, Zustand, Hono, Supabase Auth, Jest, Vitest

---

## Scope Guard

This batch is intentionally narrower than the March account-first plan.

It does:
- make Founder Access usable from the app
- make founder session restore trustworthy
- verify local-to-founder migration from the UI
- make authenticated founder drafts use the managed server voice path

It does not:
- flip the default public onboarding flow to account-first
- change global `APP_MODE` from `personal`
- roll out managed drafts to all users
- unlock autopilot before readiness
- treat the live founder account as disposable test state

## File Structure

### Founder auth and restore ownership

- Create: `src/components/__tests__/FounderAccessScreen.test.tsx`
- Create: `src/lib/__tests__/founder-session-restore.test.ts`
- Modify: `src/components/FounderAccessScreen.tsx`
- Modify: `src/lib/api-client.ts`
- Modify: `src/lib/store.ts`
- Modify: `src/lib/auto-provision.ts`
- Modify: `src/lib/secure-storage.ts`

Responsibility:
- wire the existing passwordless auth endpoints into the app
- persist founder session state with explicit validation timestamps
- refresh or clear stale founder sessions instead of blindly trusting local storage

### Founder migration ownership

- Modify: `src/components/FounderAccessScreen.tsx`
- Modify: `src/lib/commercial-migration.ts`
- Modify: `src/lib/__tests__/commercial-migration.test.ts`
- Modify: `server/src/routes/migration.ts`

Responsibility:
- run founder migration intentionally from the app
- mark migration complete only after server verification succeeds
- expose enough status detail to show the user what was actually imported

### Founder managed-draft ownership

- Create: `src/lib/__tests__/managed-draft-gating.test.ts`
- Modify: `src/lib/managed-draft-gating.ts`
- Modify: `src/components/chat/useChatDraftEngine.ts`
- Modify: `src/components/chat/__tests__/ChatScreen.test.tsx`

Responsibility:
- activate the existing server-canonical draft path when a verified founder session exists
- keep unauthenticated users on the current local personal path
- surface readiness truth and keep autopilot locked until the server says it is safe

### Status and documentation ownership

- Modify: `docs/status/current-state.md`
- Modify: `docs/status/next-batch.md`
- Modify: `docs/status/open-risks.md`

Responsibility:
- remove stale claims after this batch lands
- record that founder canary auth and founder-managed drafts are now real
- leave the broader public account-first cutover as the remaining next step

## Execution Order

Work in this order:

1. Founder auth UI and verified session restore
2. Founder migration verification loop
3. Founder-managed draft cutover
4. Live canary validation and status-doc cleanup

Do not change global onboarding or public routing in this batch.

## Chunk 1: Founder Auth Is Real

### Task 1: Wire Founder Access to the existing passwordless auth endpoints

**Files:**
- Create: `src/components/__tests__/FounderAccessScreen.test.tsx`
- Modify: `src/components/FounderAccessScreen.tsx`
- Modify: `src/lib/api-client.ts`
- Modify: `src/lib/store.ts`

- [ ] **Step 1: Write the failing Founder Access screen tests**

```tsx
it('requests an email code and verifies it into an active founder session', async () => {
  mockRequestEmailCode.mockResolvedValue({ success: true });
  mockVerifyEmailCode.mockResolvedValue({
    token: 'token-1',
    refreshToken: 'refresh-1',
    user: { id: 'user-1', email: 'sawyerbeck25@gmail.com', name: 'Sawyer', plan: 'enterprise', trialEndsAt: null, createdAt: '2026-01-01T00:00:00.000Z' },
  });
  mockGetCurrentUser.mockResolvedValue({
    user: { id: 'user-1', email: 'sawyerbeck25@gmail.com', name: 'Sawyer', plan: 'enterprise', trialEndsAt: null, createdAt: '2026-01-01T00:00:00.000Z' },
    organization: { id: 'org-1', role: 'owner', name: 'Rental Voice' },
  });

  render(<FounderAccessScreen onBack={jest.fn()} />);
  fireEvent.changeText(screen.getByPlaceholderText('Email'), 'sawyerbeck25@gmail.com');
  fireEvent.press(screen.getByText('Send Code'));
  fireEvent.changeText(screen.getByPlaceholderText('6-digit code'), '123456');
  fireEvent.press(screen.getByText('Verify Code'));

  await waitFor(() => expect(mockSetFounderSession).toHaveBeenCalled());
});
```

- [ ] **Step 2: Run the focused screen test and verify it fails**

Run: `npx jest src/components/__tests__/FounderAccessScreen.test.tsx --runInBand`
Expected: FAIL because the screen still shows placeholder alerts instead of a real auth flow.

- [ ] **Step 3: Replace the placeholder Founder Access alerts with a real code-entry flow**

Implementation notes:
- keep the screen inside Settings; do not move it into public onboarding
- add a minimal two-step UI: email request, then code verify
- call existing client methods already present in `src/lib/api-client.ts`:
  - `requestEmailCode(email)`
  - `verifyEmailCode(email, code)`
  - `getCurrentUser()`
- after successful verify:
  - persist `accountSession`
  - set `founderSession` with `userId`, `orgId`, `email`, `accessToken`, `refreshToken`, `validatedAt`, `migrationState`
- do not introduce passwords

- [ ] **Step 4: Re-run the focused screen test**

Run: `npx jest src/components/__tests__/FounderAccessScreen.test.tsx --runInBand`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/FounderAccessScreen.tsx src/components/__tests__/FounderAccessScreen.test.tsx src/lib/api-client.ts src/lib/store.ts
git commit -m "feat: wire founder access to passwordless auth"
```

### Task 2: Make founder session restore trustworthy instead of local-storage theater

**Files:**
- Create: `src/lib/__tests__/founder-session-restore.test.ts`
- Modify: `src/lib/store.ts`
- Modify: `src/lib/auto-provision.ts`
- Modify: `src/lib/secure-storage.ts`
- Modify: `src/app/index.tsx`

- [ ] **Step 1: Write the failing restore tests**

```ts
it('refreshes a near-expired founder token before treating the session as valid', async () => {
  mockLoadFounderSession.mockResolvedValue(expiringFounderSession);
  mockEnsureFreshToken.mockResolvedValue(true);
  mockGetCurrentUser.mockResolvedValue(validCurrentUser);

  const restored = await restoreFounderSession();
  expect(restored?.orgId).toBe('org-1');
});

it('clears an invalid founder session instead of unlocking the app with stale storage', async () => {
  mockLoadFounderSession.mockResolvedValue(expiredFounderSession);
  mockEnsureFreshToken.mockResolvedValue(false);

  const restored = await restoreFounderSession();
  expect(restored).toBeNull();
  expect(mockClearFounderSessionFromStorage).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the restore tests and verify they fail**

Run: `npx jest src/lib/__tests__/founder-session-restore.test.ts --runInBand`
Expected: FAIL because `restoreFounderSession()` currently just loads storage and trusts it.

- [ ] **Step 3: Implement restore validation**

Implementation notes:
- `restoreFounderSession()` should:
  - load the stored founder session
  - call `ensureFreshToken()` before accepting it
  - call `/api/auth/me` to confirm the session still resolves to a user and org
  - clear stored founder state if refresh or validation fails
- keep `founderSession` distinct from the broader `accountSession`
- do not route based on `settings.isOnboarded` when a founder session is valid

- [ ] **Step 4: Update app boot to use validated founder restore as the canary gate**

Implementation notes:
- keep the existing founder-first boot order in `src/app/index.tsx`
- do not fall back to silent success if validation fails
- if founder validation fails, continue with current Hostaway restore path

- [ ] **Step 5: Re-run the restore tests**

Run: `npx jest src/lib/__tests__/founder-session-restore.test.ts --runInBand`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/store.ts src/lib/auto-provision.ts src/lib/secure-storage.ts src/app/index.tsx src/lib/__tests__/founder-session-restore.test.ts
git commit -m "feat: validate founder session restore at boot"
```

## Chunk 2: Verified Migration, Not Wishful Migration

### Task 3: Make "Migrate Learning" perform a verified import

**Files:**
- Modify: `src/components/FounderAccessScreen.tsx`
- Modify: `src/lib/commercial-migration.ts`
- Modify: `src/lib/__tests__/commercial-migration.test.ts`
- Modify: `server/src/routes/migration.ts`

- [ ] **Step 1: Extend the migration tests around verification**

```ts
it('does not mark founder migration complete until server status confirms the snapshot', async () => {
  mockImportLocalLearningSnapshot.mockResolvedValue({ snapshotId: 'snap-1' });
  mockGetLocalLearningMigrationStatus
    .mockResolvedValueOnce({ hasSnapshot: false, latestSnapshot: null, serverTotals: { hostStyleProfiles: 0, editPatterns: 0 } })
    .mockResolvedValueOnce({ hasSnapshot: true, latestSnapshot: { id: 'snap-1', importedByUserId: 'user-1' }, serverTotals: { hostStyleProfiles: 4, editPatterns: 12 } });

  const result = await migrateFounderLearningWithVerification(founderSession, 'snap-1');
  expect(result.status).toBe('verified');
});
```

- [ ] **Step 2: Run the migration test and verify it fails**

Run: `npx jest src/lib/__tests__/commercial-migration.test.ts --runInBand`
Expected: FAIL because the current migration helpers stop at import or skip user-facing verification.

- [ ] **Step 3: Add a founder-specific verified migration helper**

Implementation notes:
- keep `buildFounderLearningMigrationSnapshot()` as the payload builder
- add a higher-level helper that:
  - sets UI state to `in_progress`
  - uploads the snapshot
  - checks `/api/migration/local-learning/status`
  - only returns `verified` when `latestSnapshot.id` and `importedByUserId` match the current founder user
- leave local data intact after verification; destructive cleanup is out of scope

- [ ] **Step 4: Tighten the server status response only if verification needs more proof**

Implementation notes:
- only touch `server/src/routes/migration.ts` if the current response shape is insufficient
- prefer returning explicit `verifiedForUser` or clearer imported counts instead of inventing a new route
- do not expand this into a broad migration rewrite

- [ ] **Step 5: Wire the Founder Access button to the verified migration helper**

Implementation notes:
- replace the current informational alert
- show status and imported counts after verification
- set `migrationState` to:
  - `in_progress` while import is running
  - `completed` only after verification
  - `failed` on any error path

- [ ] **Step 6: Re-run the migration test**

Run: `npx jest src/lib/__tests__/commercial-migration.test.ts --runInBand`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/FounderAccessScreen.tsx src/lib/commercial-migration.ts src/lib/__tests__/commercial-migration.test.ts server/src/routes/migration.ts
git commit -m "feat: verify founder learning migration before completion"
```

## Chunk 3: Founder Drafts Use The Scalable Brain

### Task 4: Add a runtime gate for founder-managed drafts

**Files:**
- Create: `src/lib/__tests__/managed-draft-gating.test.ts`
- Modify: `src/lib/managed-draft-gating.ts`

- [ ] **Step 1: Write the failing gating tests**

```ts
it('enables managed drafts for a verified founder session even when app mode is personal', () => {
  expect(
    shouldUseManagedDrafts({
      serverProxiedAI: false,
      hasFounderSession: true,
    }),
  ).toBe(true);
});

it('keeps unauthenticated personal users on the local path', () => {
  expect(
    shouldUseManagedDrafts({
      serverProxiedAI: false,
      hasFounderSession: false,
    }),
  ).toBe(false);
});
```

- [ ] **Step 2: Run the gating tests and verify they fail**

Run: `npx jest src/lib/__tests__/managed-draft-gating.test.ts --runInBand`
Expected: FAIL because current gating is effectively `features.serverProxiedAI` only.

- [ ] **Step 3: Add the runtime helper**

Implementation notes:
- add `shouldUseManagedDrafts({ serverProxiedAI, hasFounderSession })`
- keep `canGenerateDraft()` and `canAutoSend()` focused on readiness, not runtime selection
- do not flip any global feature flag in `src/lib/config.ts`

- [ ] **Step 4: Re-run the gating tests**

Run: `npx jest src/lib/__tests__/managed-draft-gating.test.ts --runInBand`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/managed-draft-gating.ts src/lib/__tests__/managed-draft-gating.test.ts
git commit -m "feat: add founder managed-draft runtime gate"
```

### Task 5: Route authenticated founder drafts through the managed server path

**Files:**
- Modify: `src/components/chat/useChatDraftEngine.ts`
- Modify: `src/components/chat/__tests__/ChatScreen.test.tsx`
- Modify: `docs/status/current-state.md`
- Modify: `docs/status/next-batch.md`
- Modify: `docs/status/open-risks.md`

- [ ] **Step 1: Add the failing chat draft tests**

```tsx
it('uses server draft generation when founder session exists in personal mode', async () => {
  mockUseAppStoreState.founderSession = validFounderSession;
  mockFeatures.serverProxiedAI = false;
  mockGenerateAIDraftViaServer.mockResolvedValue(serverDraft);

  render(<ChatScreen conversationId="1" onBack={jest.fn()} />);

  await waitFor(() => expect(mockGenerateAIDraftViaServer).toHaveBeenCalled());
});
```

- [ ] **Step 2: Run the chat draft test and verify it fails**

Run: `npx jest src/components/chat/__tests__/ChatScreen.test.tsx --runInBand`
Expected: FAIL because the draft engine still keys managed generation off `features.serverProxiedAI`.

- [ ] **Step 3: Update the draft engine to use the runtime gate**

Implementation notes:
- when `shouldUseManagedDrafts()` is true:
  - fetch voice readiness from `/api/ai/voice-readiness`
  - generate drafts through `generateAIDraftViaServer()`
  - store readiness in Zustand for UI use
- when false:
  - keep current local `generateEnhancedAIResponse()` behavior
- keep autopilot disabled unless server readiness says `autopilotEligible === true`
- add a clear composer notice when founder-managed drafts are active but readiness is still `learning`

- [ ] **Step 4: Re-run the chat draft tests**

Run: `npx jest src/components/chat/__tests__/ChatScreen.test.tsx --runInBand`
Expected: PASS

- [ ] **Step 5: Update status docs after implementation**

Implementation notes:
- `current-state.md`: record that founder canary auth and founder-managed drafts exist
- `next-batch.md`: move the next approved batch forward to public account-first cutover or cold-start onboarding gates
- `open-risks.md`: remove founder auth as "not app-ready yet" only if real in-app sign-in and restore are verified; keep public cutover risk open

- [ ] **Step 6: Commit**

```bash
git add src/components/chat/useChatDraftEngine.ts src/components/chat/__tests__/ChatScreen.test.tsx docs/status/current-state.md docs/status/next-batch.md docs/status/open-risks.md
git commit -m "feat: use server voice drafts for founder canary"
```

## Chunk 4: Acceptance Gate

### Task 6: Run the founder canary verification pass

**Files:**
- No code changes unless a failing verification exposes a real defect

- [ ] **Step 1: Run focused Jest suites**

Run:

```bash
npx jest \
  src/components/__tests__/FounderAccessScreen.test.tsx \
  src/lib/__tests__/founder-session-restore.test.ts \
  src/lib/__tests__/commercial-migration.test.ts \
  src/lib/__tests__/managed-draft-gating.test.ts \
  src/components/chat/__tests__/ChatScreen.test.tsx \
  --runInBand
```

Expected: PASS

- [ ] **Step 2: Run server verification only if `server/src/routes/migration.ts` changed**

Run:

```bash
cd server && bunx vitest run src/__tests__/auth-passwordless.test.ts src/__tests__/voice-readiness.test.ts
```

Expected: PASS

- [ ] **Step 3: Manual founder canary check with real environment**

Manual checklist:
- request email code from Founder Access
- verify code and confirm founder session becomes active
- kill and relaunch app; founder session restores without `isOnboarded`
- run `Migrate Learning`; verify state becomes `Completed` only after status check succeeds
- open a real conversation while founder session is active and confirm draft generation hits the managed path
- confirm readiness is visible and autopilot remains off unless `autopilotEligible` is true

- [ ] **Step 4: Live eval blocker check**

Run only if a fresh Google AI key is available:

```bash
cd server && printenv GOOGLE_API_KEY | wc -c
```

Expected: non-zero output

If zero:
- stop calling this batch "top quality"
- ship the implementation, but leave real founder eval as still blocked in `open-risks.md`

## Definition of Done

This batch is done when all are true:

- Founder Access is a real in-app auth flow, not an alert placeholder
- founder session restore refreshes or clears stale tokens instead of trusting storage blindly
- founder migration can be run from the UI and only marks complete after verification
- authenticated founder sessions use managed server drafts even though default app mode remains `personal`
- unauthenticated default users still experience the current Hostaway-first personal flow unchanged
- autopilot stays gated by server readiness
- status docs reflect the new truth

## Non-Negotiable Constraints

- do not flip `APP_MODE` globally
- do not move public onboarding to account-first in this batch
- do not destroy or recreate the live founder account
- do not claim server-canonical quality without a fresh Google AI key and real founder validation

Plan complete and saved to `docs/superpowers/plans/2026-04-09-founder-server-canary-implementation.md`. Ready to execute.
