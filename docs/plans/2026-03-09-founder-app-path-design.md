# Founder App Path Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a durable account-backed founder path to the existing Rental Voice app without breaking the current Hostaway-first personal-mode flow.

**Architecture:** Keep the default visible entry path Hostaway-first for now, but add an intentional founder-only account path on top of a general durable identity contract. The founder path is the first canary of the future architecture: `Sign in to Rental Voice -> Connect Hostaway -> Sync and learn`.

**Tech Stack:** Expo Router, Zustand, Expo SecureStore, Supabase auth/API, Hostaway integration, Hono backend, Jest.

---

## 1. Current Observed App Entry Reality

Grounded in current code:

- `/Users/sawbeck/Projects/RentalVoice/src/app/index.tsx`
  - boot currently restores Hostaway credentials with `restoreConnection()`
  - app routing depends on `getAppEntryDestination()`
  - `setOnboarded(true)` is still used to recover the visible session when stored Hostaway credentials exist
- `/Users/sawbeck/Projects/RentalVoice/src/lib/session-gate.ts`
  - entry logic knows only two routes: `/(tabs)` or `/onboarding`
  - route decision is driven by `isOnboarded`, `isDemoMode`, and Hostaway restore state
- `/Users/sawbeck/Projects/RentalVoice/src/lib/secure-storage.ts`
  - secure storage currently persists Hostaway account/API credentials, access token state, stable account metadata, and migration flags
  - there is no durable Rental Voice account session model in secure storage yet
- `/Users/sawbeck/Projects/RentalVoice/src/app/_layout.tsx`
  - root stack currently contains `index`, `onboarding`, `(tabs)`, `chat/[id]`, and `settings`
  - no founder-specific route exists yet
- `/Users/sawbeck/Projects/RentalVoice/src/app/onboarding.tsx`
  - onboarding completes directly into `/(tabs)`
- `/Users/sawbeck/Projects/RentalVoice/src/app/(tabs)/index.tsx`
  - tab inbox still gates rendering on `settings.isOnboarded` and demo mode
- `/Users/sawbeck/Projects/RentalVoice/src/lib/commercial-migration.ts`
  - local learning snapshot/export already exists
  - founder-targeted payload metadata already exists
- `/Users/sawbeck/Projects/RentalVoice/server/src/routes/migration.ts`
  - authenticated migration import/status routes already exist server-side

Conclusion:
- the app can restore a Hostaway connection
- the app cannot yet restore a durable Rental Voice account session
- the migration base exists, but the founder app path does not

## 2. Product Decision

### Keep
- current default visible onboarding/auth flow: Hostaway Account ID + API key
- current user-facing mode: `personal`
- current app shell and tabs for normal use

### Add
- a private founder entry inside Settings
- a durable Rental Voice account session contract
- a founder session restore path that does not depend on `settings.isOnboarded`
- a founder learning migration flow that uses the existing authenticated migration routes

### Do not do in v1
- do not make email/password or magic-link auth the default first screen
- do not rewrite the entire onboarding flow yet
- do not create a second app
- do not expose founder access in the public onboarding UI yet

## 3. Founder Entry Model

### Location
Add a visible Settings row:
- section label: `Founder`
- row label when signed out: `Founder Access`
- row label when signed in: `Founder Account Active`

### Why Settings first
- does not disturb the current user path
- keeps founder access intentional
- gives Sawyer one stable place to test the permanent account path daily

### Founder Access screen v1
Screen should show:
- founder account session status
- founder email
- environment truth (`test` default app, `live` founder backend available)
- learning migration status
- actions:
  - `Sign In`
  - `Restore Session`
  - `Migrate Learning`
  - `Open Founder Diagnostics`
  - `Sign Out Founder Access`

## 4. Durable Identity Contract

### New mental model
Identity and PMS connection must be separated.

#### Durable identity
A Rental Voice account session identifies the user.

#### PMS connection
Hostaway credentials connect the PMS account to the already-authenticated Rental Voice account.

### Future target architecture
1. `Sign in to Rental Voice`
2. `Connect Hostaway`
3. `Sync and learn`

### v1 founder canary contract
For founder only:
- founder auth session is the durable identity
- existing Hostaway-first personal flow remains available and unchanged for default users
- founder flow can still reuse current Hostaway connection surfaces after founder session establishment

## 5. Session Model

### Problems to solve
- current session restore is centered on Hostaway restore, not app auth
- `settings.isOnboarded` is too fragile to be the recovery source of truth
- app/container reset can still make an existing user look new

### Required v1 founder session state
Persist in secure storage:
- founder auth access token / refresh token or equivalent Supabase session material
- founder user id
- founder org id
- founder email
- founder session last validated at
- founder migration completion state

### Boot order target
At app boot:
1. load cold/local state as today
2. check for founder auth session first
3. if founder session exists and is valid, route to founder-aware app entry
4. otherwise run the current Hostaway/personal restore path
5. only fall back to `/onboarding` when neither founder session nor personal restore is valid

### Routing target
Current routes:
- `index`
- `onboarding`
- `(tabs)`

Add:
- `/founder-access`
- optional internal founder session state under `/(tabs)/settings`

`session-gate.ts` should evolve from:
- `personal restore only`

to:
- `founder session -> personal restore -> onboarding fallback`

## 6. Learning Migration Contract

### Existing useful base
From `/Users/sawbeck/Projects/RentalVoice/src/lib/commercial-migration.ts`, current local migration payload already includes:
- host style profiles
- AI learning progress
- learning entries
- draft outcomes
- reply deltas
- calibration entries
- conversation flows
- stable account metadata

### v1 migration requirement
Migration must move durable learning value from the local personal store into the founder-backed account without destroying the local source until verification succeeds.

### Migration phases
1. inspect local snapshot counts before sending
2. authenticate as founder
3. send founder-targeted migration snapshot
4. verify server snapshot/status response
5. mark founder migration as complete only after verification
6. keep local data intact until founder-backed recovery is proven

### Do not do
- do not auto-delete local learning artifacts immediately after upload
- do not assume a successful POST equals durable usable learning without verification

## 7. Required App Surfaces

### Settings
Add founder entry and founder session badge.

### Founder Access screen
Owns sign-in, restore, migration, diagnostics launch, and sign-out.

### App boot
Must detect founder session before using personal-mode onboarding state.

### AI Learning
Must be able to report whether learning is:
- local-only personal
- migrated to founder account
- verified durable

## 8. Verification Requirements

### Unit tests
- founder session present -> correct route
- founder session invalid -> graceful fallback
- no founder session + valid personal restore -> current personal path preserved
- migration success only marks completion after status verification
- migration failure leaves local state untouched

### Integration/manual checks
- sign in to founder account from the app
- kill and relaunch app -> founder session restores
- clear local onboarding flag -> founder session still restores
- run learning migration -> founder migration state becomes verified
- founder diagnostics, billing, entitlements, and `/api/auth/me` succeed from app session

## 9. File Map For Implementation

### App routing/session
- `/Users/sawbeck/Projects/RentalVoice/src/app/index.tsx`
- `/Users/sawbeck/Projects/RentalVoice/src/app/_layout.tsx`
- `/Users/sawbeck/Projects/RentalVoice/src/app/onboarding.tsx`
- `/Users/sawbeck/Projects/RentalVoice/src/app/(tabs)/index.tsx`
- `/Users/sawbeck/Projects/RentalVoice/src/lib/session-gate.ts`
- `/Users/sawbeck/Projects/RentalVoice/src/lib/secure-storage.ts`
- `/Users/sawbeck/Projects/RentalVoice/src/lib/store.ts`

### Founder screen/settings
- `/Users/sawbeck/Projects/RentalVoice/src/components/SettingsScreen.tsx`
- create `/Users/sawbeck/Projects/RentalVoice/src/app/founder-access.tsx`
- create `/Users/sawbeck/Projects/RentalVoice/src/components/FounderAccessScreen.tsx`

### Migration
- `/Users/sawbeck/Projects/RentalVoice/src/lib/commercial-migration.ts`
- `/Users/sawbeck/Projects/RentalVoice/server/src/routes/migration.ts`
- `/Users/sawbeck/Projects/RentalVoice/src/lib/api-client.ts`

## 10. Non-Negotiable Constraints

- keep the default user-facing app path in `personal` mode
- keep Hostaway-first onboarding as the visible default path
- do not recreate or mutate live founder backend state casually
- do not couple founder session restore to `settings.isOnboarded`
- do not treat Hostaway credentials as the durable identity model

## 11. Definition Of Ready For Implementation

Implementation can start when:
- route model is accepted: founder access only through Settings in v1
- durable identity contract is accepted: Rental Voice account first, Hostaway second
- migration rule is accepted: upload + verify before marking complete, no immediate destructive cleanup
- live founder backend remains read/validate-only unless a task explicitly requires live mutation
