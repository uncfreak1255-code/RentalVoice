# Server-Canonical Voice Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Rental Voice to an account-first, server-canonical reply system where managed onboarding immediately starts history sync and durable voice training, drafts are available during learning, and autopilot stays locked until the server voice model is ready.

**Architecture:** Replace the current split-brain runtime with one canonical managed path. The server owns identity, sync, voice retrieval, style grounding, readiness, and draft generation; the mobile app becomes a stateful client that authenticates the user, connects Hostaway, shows learning progress, uploads one-time legacy learning data, and defers production draft generation to the server.

**Tech Stack:** Expo Router, React Native, Zustand, Hono, Supabase Auth, Supabase Postgres, Hostaway API, Jest, Vitest, Promptfoo

---

## File Structure

### Server auth and onboarding ownership

- Create: `server/src/__tests__/auth-passwordless.test.ts`
- Create: `server/src/services/passwordless-auth.ts`
- Modify: `server/src/routes/auth.ts`
- Modify: `server/src/index.ts`

Responsibility:
- replace password-based onboarding with passwordless email-code-first auth
- keep token issuance and session semantics consistent with existing mobile client storage

### Server history sync and voice import ownership

- Create: `server/src/__tests__/hostaway-connect-sync.test.ts`
- Create: `server/src/services/voice-import.ts`
- Modify: `server/src/routes/hostaway.ts`
- Modify: `server/src/services/hostaway-history-sync.ts`
- Modify: `server/src/routes/voice.ts`

Responsibility:
- trigger history sync immediately after managed Hostaway connect
- convert synced conversations/messages into guest->host training pairs
- import durable voice examples without relying on a manual screen

### Server canonical prompt and readiness ownership

- Create: `server/src/__tests__/ai-proxy.voice-grounding.test.ts`
- Create: `server/src/__tests__/voice-readiness.test.ts`
- Create: `server/src/services/voice-grounding.ts`
- Create: `server/src/services/voice-readiness.ts`
- Modify: `server/src/services/ai-proxy.ts`
- Modify: `server/src/routes/ai-generate.ts`

Responsibility:
- make managed generation use property-aware style data, semantic matches, outcomes, and imported history
- expose a readiness contract the app can trust
- lock autopilot behind server readiness

### Mobile auth/session/onboarding ownership

- Create: `src/components/AuthExplainerScreen.tsx`
- Create: `src/components/PasswordlessAuthScreen.tsx`
- Create: `src/components/VoiceLearningBanner.tsx`
- Create: `src/lib/account-session.ts`
- Create: `src/lib/__tests__/account-session.test.ts`
- Modify: `src/lib/api-client.ts`
- Modify: `src/lib/store.ts`
- Modify: `src/app/index.tsx`
- Modify: `src/app/onboarding.tsx`
- Modify: `src/components/OnboardingScreen.tsx`
- Modify: `src/components/__tests__/OnboardingScreen.test.tsx`

Responsibility:
- make account/login first
- make Hostaway connect second
- expose explicit session and readiness states to the app
- show “learning your voice” status after connect

### Mobile draft/autopilot gate ownership

- Modify: `src/hooks/useAIDraft.ts`
- Modify: `src/hooks/__tests__/useAIDraft.test.ts`
- Modify: `src/components/ChatScreen.tsx`

Responsibility:
- allow drafts during learning
- suppress autopilot until server readiness says it is safe
- remove assumptions that local profile sample count alone is enough

### Migration bridge ownership

- Create: `src/lib/__tests__/commercial-migration.test.ts`
- Modify: `src/lib/commercial-migration.ts`
- Modify: `src/app/index.tsx`
- Modify: `server/src/routes/migration.ts`

Responsibility:
- upload one-time legacy local learning into the authenticated server account
- merge local signals into server-backed style state
- demote local learning from source of truth to temporary cache

### Evaluation ownership

- Create: `evals/promptfooconfig-founder.yaml`
- Create: `evals/promptfooconfig-cold-start.yaml`
- Create: `evals/test-cases-cold-start.yaml`
- Modify: `evals/run-overnight.sh`
- Modify: `docs/status/open-risks.md`

Responsibility:
- split founder canary evaluation from cold-start new-host evaluation
- make the gating model reflect the actual product path

## Execution Order

Work in this order:

1. Passwordless auth and explicit account session state
2. Account-first onboarding flow
3. Managed Hostaway connect auto-starts history sync
4. History sync writes durable voice data
5. Managed generation consumes real voice grounding
6. Readiness contract gates drafts/autopilot correctly
7. Migration bridge uploads legacy local learning
8. Evaluation split and documentation cleanup

Do not start autopilot or agent enhancements before Chunk 4 and Chunk 5 are merged and verified.

## Chunk 1: Passwordless Account Foundation

### Task 1: Add passwordless auth endpoints on the server

**Files:**
- Create: `server/src/__tests__/auth-passwordless.test.ts`
- Create: `server/src/services/passwordless-auth.ts`
- Modify: `server/src/routes/auth.ts`

- [ ] **Step 1: Write the failing server tests**

```ts
it('requests an email code for a new or existing user', async () => {
  const res = await app.request('/api/auth/request-code', {
    method: 'POST',
    body: JSON.stringify({ email: 'host@example.com', name: 'Host' }),
    headers: { 'Content-Type': 'application/json' },
  });
  expect(res.status).toBe(200);
});

it('verifies an emailed code and returns session tokens', async () => {
  const res = await app.request('/api/auth/verify-code', {
    method: 'POST',
    body: JSON.stringify({ email: 'host@example.com', code: '123456' }),
    headers: { 'Content-Type': 'application/json' },
  });
  expect(res.status).toBe(200);
});
```

- [ ] **Step 2: Run the server test to verify it fails**

Run: `cd server && bunx vitest run src/__tests__/auth-passwordless.test.ts`
Expected: FAIL because `/api/auth/request-code` and `/api/auth/verify-code` do not exist yet.

- [ ] **Step 3: Add minimal passwordless auth service**

```ts
export async function requestEmailCode(email: string, name?: string) {
  // create user/org on first request, then request OTP
}

export async function verifyEmailCode(email: string, code: string) {
  // verify OTP, fetch/create user profile, return tokens
}
```

- [ ] **Step 4: Add `/api/auth/request-code`, `/api/auth/verify-code`, and optional `/api/auth/consume-link` routes**

Implementation notes:
- keep existing `signup`/`login` temporarily for compatibility, but stop wiring onboarding to them
- continue returning the same `token` / `refreshToken` / `user` shape expected by `src/lib/api-client.ts`
- use Supabase Auth OTP primitives instead of inventing your own code store

- [ ] **Step 5: Re-run the server auth test**

Run: `cd server && bunx vitest run src/__tests__/auth-passwordless.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/auth.ts server/src/services/passwordless-auth.ts server/src/__tests__/auth-passwordless.test.ts
git commit -m "feat: add passwordless auth routes"
```

### Task 2: Add mobile account-session helpers and API bindings

**Files:**
- Create: `src/lib/account-session.ts`
- Create: `src/lib/__tests__/account-session.test.ts`
- Modify: `src/lib/api-client.ts`
- Modify: `src/lib/store.ts`

- [ ] **Step 1: Write the failing client tests for account session restore/clear**

```ts
it('restores a stored account session', async () => {
  await persistAccountSession(mockSession);
  const restored = await restoreAccountSession();
  expect(restored?.user.email).toBe('host@example.com');
});

it('clears the stored account session', async () => {
  await persistAccountSession(mockSession);
  await clearAccountSession();
  await expect(restoreAccountSession()).resolves.toBeNull();
});
```

- [ ] **Step 2: Run the client test to verify it fails**

Run: `npx jest src/lib/__tests__/account-session.test.ts --runInBand`
Expected: FAIL because the helper does not exist yet.

- [ ] **Step 3: Add the minimal account-session helper**

```ts
export interface AccountSession {
  token: string;
  refreshToken: string;
  user: { id: string; email: string; name: string; plan: string };
}
```

Implementation notes:
- keep device-secure storage semantics consistent with the current token handling in `src/lib/api-client.ts`
- add store state for `accountSession`, `accountSessionLoading`, and `voiceReadiness`
- do not overload `founderSession` with this new responsibility

- [ ] **Step 4: Add new API client methods**

Add:
- `requestEmailCode(email, name?)`
- `verifyEmailCode(email, code)`
- `consumeMagicLink(token)`

Reuse the same token persistence helpers already in `src/lib/api-client.ts`.

- [ ] **Step 5: Re-run the client test**

Run: `npx jest src/lib/__tests__/account-session.test.ts --runInBand`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/account-session.ts src/lib/__tests__/account-session.test.ts src/lib/api-client.ts src/lib/store.ts
git commit -m "feat: add mobile account session state"
```

## Chunk 2: Account-First Onboarding

### Task 3: Add explainer and passwordless auth screens

**Files:**
- Create: `src/components/AuthExplainerScreen.tsx`
- Create: `src/components/PasswordlessAuthScreen.tsx`
- Modify: `src/app/onboarding.tsx`
- Modify: `src/components/__tests__/OnboardingScreen.test.tsx`

- [ ] **Step 1: Write the failing onboarding tests**

```tsx
it('shows the explainer before Hostaway connect in managed mode', () => {
  const { getByText } = render(<OnboardingRoute />);
  expect(getByText(/we learn from your past messages/i)).toBeTruthy();
});

it('moves from explainer to email-code auth before connect', async () => {
  // press continue and expect email entry UI
});
```

- [ ] **Step 2: Run the onboarding test to verify it fails**

Run: `npx jest src/components/__tests__/OnboardingScreen.test.tsx --runInBand`
Expected: FAIL because the new explainer/auth screens are not wired.

- [ ] **Step 3: Add the explainer screen**

Content requirements:
- connect your PMS
- we learn from your past replies
- drafts work immediately
- autopilot unlocks only after your voice model is ready

- [ ] **Step 4: Add the passwordless auth screen**

Behavior requirements:
- enter email
- request code
- enter 6-digit code
- optional “open email link instead” fallback copy

- [ ] **Step 5: Update `src/app/onboarding.tsx` to orchestrate `explainer -> auth -> Hostaway connect`**

Keep the route count small. Do not create a second parallel onboarding router unless the existing route becomes unmanageable.

- [ ] **Step 6: Re-run the onboarding test**

Run: `npx jest src/components/__tests__/OnboardingScreen.test.tsx --runInBand`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/AuthExplainerScreen.tsx src/components/PasswordlessAuthScreen.tsx src/app/onboarding.tsx src/components/__tests__/OnboardingScreen.test.tsx
git commit -m "feat: add account-first onboarding flow"
```

### Task 4: Make app entry route on account session first, not Hostaway restore first

**Files:**
- Modify: `src/app/index.tsx`
- Modify: `src/lib/store.ts`
- Test: `src/lib/__tests__/session-gate.test.ts`

- [ ] **Step 1: Add failing session-gate tests for account-first entry**

```ts
it('routes anonymous users to onboarding', () => { /* ... */ });
it('routes authenticated users without PMS to onboarding connect step', () => { /* ... */ });
it('routes authenticated users with learning state to tabs', () => { /* ... */ });
```

- [ ] **Step 2: Run the session-gate tests to verify they fail**

Run: `npx jest src/lib/__tests__/session-gate.test.ts --runInBand`
Expected: FAIL because current entry still assumes Hostaway restore first.

- [ ] **Step 3: Refactor `src/app/index.tsx` boot flow**

Implementation notes:
- restore account session first
- derive onboarding destination from account session + Hostaway connect state + voice readiness
- stop using Hostaway credentials as the primary identity indicator
- keep legacy migration hooks behind authenticated-session checks

- [ ] **Step 4: Re-run the session-gate tests**

Run: `npx jest src/lib/__tests__/session-gate.test.ts --runInBand`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/index.tsx src/lib/store.ts src/lib/__tests__/session-gate.test.ts
git commit -m "refactor: make app entry account-first"
```

## Chunk 3: Managed Hostaway Connect Starts History Sync

### Task 5: Start server-managed history sync immediately after Hostaway connect

**Files:**
- Create: `server/src/__tests__/hostaway-connect-sync.test.ts`
- Modify: `server/src/routes/hostaway.ts`
- Modify: `src/lib/api-client.ts`

- [ ] **Step 1: Write the failing server test**

```ts
it('starts a history sync job after successful Hostaway connect', async () => {
  const res = await app.request('/api/hostaway', {
    method: 'POST',
    body: JSON.stringify({ accountId: '51916', apiKey: 'secret-key' }),
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test' },
  });
  const json = await res.json();
  expect(json.historySyncJob).toBeTruthy();
});
```

- [ ] **Step 2: Run the server test to verify it fails**

Run: `cd server && bunx vitest run src/__tests__/hostaway-connect-sync.test.ts`
Expected: FAIL because `POST /api/hostaway` currently returns connection success only.

- [ ] **Step 3: Update `POST /api/hostaway` to start a sync job**

Implementation notes:
- after credentials are validated/stored, call `startHostawayHistorySyncJob`
- return the mapped job in the response
- do not block on job completion

- [ ] **Step 4: Update the mobile API client response type**

Add `historySyncJob?: HostawayHistorySyncJob` to `connectHostaway()`.

- [ ] **Step 5: Re-run the server test**

Run: `cd server && bunx vitest run src/__tests__/hostaway-connect-sync.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/hostaway.ts server/src/__tests__/hostaway-connect-sync.test.ts src/lib/api-client.ts
git commit -m "feat: start history sync on managed Hostaway connect"
```

### Task 6: Surface managed learning state in onboarding instead of hiding it in AI Learning

**Files:**
- Create: `src/components/VoiceLearningBanner.tsx`
- Modify: `src/components/OnboardingScreen.tsx`
- Modify: `src/components/__tests__/OnboardingScreen.test.tsx`

- [ ] **Step 1: Write the failing onboarding-state test**

```tsx
it('shows learning state after managed Hostaway connect succeeds', async () => {
  // mock connectHostaway to return historySyncJob
  // expect learning banner copy to render
});
```

- [ ] **Step 2: Run the onboarding test to verify it fails**

Run: `npx jest src/components/__tests__/OnboardingScreen.test.tsx --runInBand`
Expected: FAIL because managed onboarding does not show sync/learning state.

- [ ] **Step 3: Add a focused `VoiceLearningBanner` component**

States:
- syncing history
- importing voice examples
- learning your voice
- ready

- [ ] **Step 4: Update `OnboardingScreen` managed path**

Implementation notes:
- on successful `connectHostaway`, store returned `historySyncJob`
- poll `getHostawayHistorySyncStatusViaServer()`
- show learning banner immediately instead of silently finishing and dumping the user into tabs with no explanation

- [ ] **Step 5: Re-run the onboarding test**

Run: `npx jest src/components/__tests__/OnboardingScreen.test.tsx --runInBand`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/VoiceLearningBanner.tsx src/components/OnboardingScreen.tsx src/components/__tests__/OnboardingScreen.test.tsx
git commit -m "feat: expose managed learning state in onboarding"
```

## Chunk 4: Durable Voice Import and Canonical Server Grounding

### Task 7: Convert synced Hostaway payloads into durable `voice_examples`

**Files:**
- Create: `server/src/services/voice-import.ts`
- Modify: `server/src/services/hostaway-history-sync.ts`
- Modify: `server/src/routes/voice.ts`
- Test: `server/src/__tests__/voice-routes.test.ts`

- [ ] **Step 1: Add a failing test for importable guest->host pair extraction**

```ts
it('builds voice examples from consecutive guest/host message pairs', async () => {
  const examples = buildVoiceExamplesFromHistory(mockConversations, mockMessages);
  expect(examples[0]).toMatchObject({
    guestMessage: expect.any(String),
    hostResponse: expect.any(String),
    originType: 'historical',
  });
});
```

- [ ] **Step 2: Run the voice test to verify it fails**

Run: `cd server && bunx vitest run src/__tests__/voice-routes.test.ts`
Expected: FAIL because no reusable history->voice importer exists.

- [ ] **Step 3: Extract reusable import logic**

Implementation notes:
- move pair-building logic out of `server/scripts/bulk-import-voice.ts` into `server/src/services/voice-import.ts`
- make it callable from both the script and the sync pipeline
- preserve dedup semantics used by `voice_examples`

- [ ] **Step 4: Hook history-sync completion into automatic voice import**

Implementation notes:
- after `hostaway-history-sync.ts` stores payload, derive importable examples
- write/import them through shared service logic
- keep the raw payload for diagnostics, but stop treating it as the final useful output

- [ ] **Step 5: Re-run the server voice test**

Run: `cd server && bunx vitest run src/__tests__/voice-routes.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/src/services/voice-import.ts server/src/services/hostaway-history-sync.ts server/src/routes/voice.ts server/src/__tests__/voice-routes.test.ts server/scripts/bulk-import-voice.ts
git commit -m "feat: import synced history into voice examples"
```

### Task 8: Add server voice-grounding helper and make managed generation use it

**Files:**
- Create: `server/src/services/voice-grounding.ts`
- Create: `server/src/__tests__/ai-proxy.voice-grounding.test.ts`
- Modify: `server/src/services/ai-proxy.ts`

- [ ] **Step 1: Write the failing managed-generation test**

```ts
it('builds managed prompts from style profile plus semantic voice examples', async () => {
  const prompt = await buildManagedVoicePrompt({
    orgId: 'org-1',
    propertyId: 'prop-1',
    guestMessage: 'Can we check in early?',
  });
  expect(prompt).toContain('real host reply examples');
  expect(prompt).toContain('property');
});
```

- [ ] **Step 2: Run the server prompt test to verify it fails**

Run: `cd server && bunx vitest run src/__tests__/ai-proxy.voice-grounding.test.ts`
Expected: FAIL because `ai-proxy.ts` currently uses a generic prompt builder.

- [ ] **Step 3: Add `voice-grounding.ts`**

Responsibilities:
- fetch property-specific style profile first
- fall back to org/global style profile
- query top semantic `voice_examples`
- fetch recent edit patterns / draft outcomes if needed
- return a normalized grounding object for prompt construction

- [ ] **Step 4: Refactor `ai-proxy.ts` to use the new grounding helper**

Implementation notes:
- keep provider-calling logic in `ai-proxy.ts`
- move prompt-shaping logic out of `ai-proxy.ts`
- make managed prompt identity host-centric, not “AI assistant helping a host”

- [ ] **Step 5: Re-run the server prompt test**

Run: `cd server && bunx vitest run src/__tests__/ai-proxy.voice-grounding.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/src/services/voice-grounding.ts server/src/services/ai-proxy.ts server/src/__tests__/ai-proxy.voice-grounding.test.ts
git commit -m "feat: ground managed drafts in real voice data"
```

## Chunk 5: Readiness, Draft Gate, and Autopilot Lock

### Task 9: Add server readiness contract

**Files:**
- Create: `server/src/services/voice-readiness.ts`
- Create: `server/src/__tests__/voice-readiness.test.ts`
- Modify: `server/src/routes/ai-generate.ts`

- [ ] **Step 1: Write the failing readiness test**

```ts
it('marks autopilot ineligible while examples are still below threshold', async () => {
  const readiness = getVoiceReadiness({
    importedExamples: 40,
    styleSamples: 12,
    semanticReady: true,
  });
  expect(readiness.autopilotEligible).toBe(false);
  expect(readiness.state).toBe('learning');
});
```

- [ ] **Step 2: Run the server readiness test to verify it fails**

Run: `cd server && bunx vitest run src/__tests__/voice-readiness.test.ts`
Expected: FAIL because no readiness helper exists.

- [ ] **Step 3: Implement `voice-readiness.ts` and expose a route**

Add a route such as:
- `GET /api/ai/voice-readiness`

Requirements:
- state: `untrained | learning | ready | degraded`
- imported examples count
- style sample count
- semantic readiness
- autopilot eligibility
- human-readable reason

- [ ] **Step 4: Re-run the server readiness test**

Run: `cd server && bunx vitest run src/__tests__/voice-readiness.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/services/voice-readiness.ts server/src/routes/ai-generate.ts server/src/__tests__/voice-readiness.test.ts
git commit -m "feat: add managed voice readiness contract"
```

### Task 10: Make mobile drafts rely on server readiness, not local sample count

**Files:**
- Modify: `src/hooks/useAIDraft.ts`
- Modify: `src/hooks/__tests__/useAIDraft.test.ts`
- Modify: `src/components/ChatScreen.tsx`
- Modify: `src/lib/api-client.ts`

- [ ] **Step 1: Write the failing hook test**

```ts
it('allows managed drafts while learning but disables autopilot until ready', () => {
  const readiness = { state: 'learning', autopilotEligible: false };
  expect(canGenerateDraft(readiness)).toBe(true);
  expect(canAutoSend(readiness)).toBe(false);
});
```

- [ ] **Step 2: Run the hook test to verify it fails**

Run: `npx jest src/hooks/__tests__/useAIDraft.test.ts --runInBand`
Expected: FAIL because current logic still keys autopilot off local style sample count.

- [ ] **Step 3: Refactor draft gating**

Implementation notes:
- fetch/store `voiceReadiness` in mobile state
- allow drafts whenever the server session and PMS connection exist
- block autopilot unless `voiceReadiness.autopilotEligible === true`
- remove managed-path dependence on local `hostStyleProfiles['global']` for safety gating

- [ ] **Step 4: Re-run the hook test**

Run: `npx jest src/hooks/__tests__/useAIDraft.test.ts --runInBand`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAIDraft.ts src/hooks/__tests__/useAIDraft.test.ts src/components/ChatScreen.tsx src/lib/api-client.ts
git commit -m "refactor: gate autopilot on server voice readiness"
```

## Chunk 6: Legacy Migration Bridge and Eval Split

### Task 11: Tie legacy local-learning import to authenticated account migration

**Files:**
- Create: `src/lib/__tests__/commercial-migration.test.ts`
- Modify: `src/lib/commercial-migration.ts`
- Modify: `src/app/index.tsx`
- Modify: `server/src/routes/migration.ts`

- [ ] **Step 1: Write the failing migration bridge test**

```ts
it('uploads local learning snapshot once after account authentication', async () => {
  const result = await migrateLocalLearningToCommercial('snapshot-1');
  expect(result.imported.hostStyleProfiles).toBeGreaterThanOrEqual(0);
});
```

- [ ] **Step 2: Run the migration test to verify it fails**

Run: `npx jest src/lib/__tests__/commercial-migration.test.ts --runInBand`
Expected: FAIL because the bridge is not tied to the new account-first session flow.

- [ ] **Step 3: Update bridge ownership**

Implementation notes:
- run migration after authenticated account session restore, not merely after app mode check
- extend server snapshot import so it can merge imported style/outcome signals without overwriting newly learned durable history blindly
- mark migration completion against account identity, not only the old stable Account ID heuristic

- [ ] **Step 4: Re-run the migration test**

Run: `npx jest src/lib/__tests__/commercial-migration.test.ts --runInBand`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/commercial-migration.ts src/lib/__tests__/commercial-migration.test.ts src/app/index.tsx server/src/routes/migration.ts
git commit -m "feat: bridge legacy local learning into account-backed voice state"
```

### Task 12: Split founder and cold-start eval gates

**Files:**
- Create: `evals/promptfooconfig-founder.yaml`
- Create: `evals/promptfooconfig-cold-start.yaml`
- Create: `evals/test-cases-cold-start.yaml`
- Modify: `evals/run-overnight.sh`
- Modify: `docs/status/open-risks.md`

- [ ] **Step 1: Write the eval config files**

Founder config:
- keep Sawyer canary cases
- use founder account assumptions explicitly

Cold-start config:
- simulate new account -> Hostaway import -> early learning state -> post-import state
- remove Sawyer-specific hardcoding from the cold-start suite

- [ ] **Step 2: Dry-run config validation**

Run:
```bash
GOOGLE_API_KEY=test promptfoo eval --config evals/promptfooconfig-founder.yaml --max-concurrency 1
GOOGLE_API_KEY=test promptfoo eval --config evals/promptfooconfig-cold-start.yaml --max-concurrency 1
```

Expected:
- config parses
- test run may fail on fake key, but config and suite loading should succeed

- [ ] **Step 3: Update overnight runner**

Requirements:
- founder run and cold-start run produce separate result artifacts
- result names make it impossible to confuse founder performance with onboarding performance

- [ ] **Step 4: Update risk/status docs**

Add:
- server-canonical voice path is the only real eval target
- Sawyer-only evals are not sufficient proof of onboarding quality

- [ ] **Step 5: Commit**

```bash
git add evals/promptfooconfig-founder.yaml evals/promptfooconfig-cold-start.yaml evals/test-cases-cold-start.yaml evals/run-overnight.sh docs/status/open-risks.md
git commit -m "test: split founder and cold-start voice eval gates"
```

## Final Verification

- [ ] **Step 1: Run targeted server tests**

```bash
cd server && bunx vitest run \
  src/__tests__/auth-passwordless.test.ts \
  src/__tests__/hostaway-connect-sync.test.ts \
  src/__tests__/voice-routes.test.ts \
  src/__tests__/ai-proxy.voice-grounding.test.ts \
  src/__tests__/voice-readiness.test.ts
```

Expected: all targeted server tests PASS

- [ ] **Step 2: Run targeted mobile tests**

```bash
npx jest \
  src/components/__tests__/OnboardingScreen.test.tsx \
  src/lib/__tests__/session-gate.test.ts \
  src/lib/__tests__/account-session.test.ts \
  src/lib/__tests__/commercial-migration.test.ts \
  src/hooks/__tests__/useAIDraft.test.ts \
  --runInBand
```

Expected: all targeted mobile tests PASS

- [ ] **Step 3: Run repo quality gates**

```bash
npm run lint
npm run typecheck
cd server && npm run build
```

Expected:
- lint exits 0
- root typecheck exits 0
- server build exits 0

- [ ] **Step 4: Run guarded repo checks if `.guardrails.json` is present in the working branch**

```bash
/Users/sawbeck/bin/guardrail-preflight
/Users/sawbeck/bin/guardrail-merge-check
```

Expected: both pass

## Notes for the Implementer

- Do not keep the current managed `ai-proxy.ts` prompt as the final product. That is the entire point of the change.
- Do not treat local `hostStyleProfiles['global']` as the long-term safety gate for autopilot.
- Do not let managed onboarding end before history sync is started and the user is told the model is learning.
- Do not use founder-only evals to claim onboarding quality is fixed.
- Keep commits scoped by task. If a commit touches auth, onboarding, voice grounding, and evals together, the scope is already sloppy.

Plan complete and saved to `docs/superpowers/plans/2026-03-27-server-canonical-voice-implementation.md`. Ready to execute?
