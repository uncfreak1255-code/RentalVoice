# Server-Canonical Voice System - Design Spec

**Date:** 2026-03-27
**Status:** Approved
**Author:** Codex

## Problem

Rental Voice currently has two reply engines:

1. A stronger local/personal engine in the mobile app that uses rich voice grounding, local training, and local history-derived examples.
2. A weaker managed/server engine that future users must rely on, but which currently generates from a generic host prompt plus a lightweight edit-based style profile.

This split breaks the product thesis. The app claims "sound exactly like me," but the scalable path for new users does not use the same grounding stack as the founder/personal path.

The current product also still treats Hostaway credentials as the visible first-step identity flow, even though durable voice learning, cross-device recovery, billing, and future team usage require a real Rental Voice account identity.

## Decisions

### Product decisions

- Rental Voice account/login becomes the first step.
- Hostaway connection becomes the second step.
- Server becomes the canonical reply brain.
- Drafts are allowed immediately during learning, with lower/confidence-conservative messaging.
- Autopilot remains locked until the server voice model reaches a minimum readiness threshold.
- Existing local learning is migrated into the server-backed account through a temporary bridge.
- Evaluations split into founder canary and cold-start new-host gates.

### Auth decision

- Primary auth UX: passwordless email code.
- Fallback in the same email: magic link.
- Passwords are not introduced in this phase.

Reason: mobile deep links fail often enough that magic-link-only is brittle. Email-code-first keeps the system passwordless without making onboarding depend on link handoff behavior.

## Goals

1. One canonical reply engine for founder and future users.
2. Durable account-backed voice learning.
3. Immediate post-connect history sync and server-side training.
4. No autopilot before server-side voice trust is proven.
5. An evaluation system that measures both founder fidelity and new-user onboarding quality.

## Non-Goals

- Shipping team collaboration or multi-seat org controls.
- Replacing Hostaway as the PMS source.
- Preserving local reply generation as a long-term first-class runtime.
- Launching more agent/autopilot behavior before server voice quality is trusted.

## Current State

### Canonical drift today

- `src/lib/ai-enhanced.ts` contains the strongest voice prompt construction, historical grounding, and local learning hooks.
- `server/src/services/ai-proxy.ts` currently generates from a much thinner prompt and only lightweight edit-derived style preferences.
- `src/lib/semantic-voice-index.ts` and `server/src/routes/voice.ts` provide durable semantic voice storage/query, but this is not the canonical basis for all reply generation.
- `src/components/OnboardingScreen.tsx` and `src/lib/auto-import.ts` auto-train in local/personal mode, but managed/server onboarding does not immediately start the equivalent account-backed import/train flow.
- `docs/status/open-risks.md` already names durable identity and durable account-backed learning as top unresolved risks.

### What this means

The product has one engine that is more faithful and another that is more scalable. That is not a tuning issue. It is a product architecture mismatch.

## Target User Flow

### New user

1. Open app.
2. See a short explainer screen:
   - connect your PMS
   - we learn from your past messages
   - drafts work right away
   - autopilot unlocks only after your voice model is good enough
3. Enter email.
4. Receive one-time code plus magic link.
5. Verify account.
6. Land on Hostaway connect.
7. Submit Hostaway credentials.
8. Server stores PMS connection and immediately starts history sync.
9. App enters `learning` state and allows drafts.
10. Server imports voice examples, updates style profiles, and computes readiness.
11. Autopilot remains unavailable until readiness threshold is met.

### Existing local user

1. Open updated app.
2. Sign in with Rental Voice account.
3. App uploads one-time local learning snapshot to server account.
4. User connects Hostaway if not already connected.
5. Server starts history sync and merges imported local learning with server-side history-derived voice data.
6. After migration completes, server becomes the primary reply engine.
7. Local stores remain cache only until cleanup/removal.

## System Architecture

### Core rule

All production draft generation should route through the server once the user has a Rental Voice account session.

Local logic may remain temporarily for:

- migration upload
- offline cache
- founder/dev diagnostics

It does not remain the canonical runtime for draft generation.

### Architecture overview

```text
Rental Voice account
  -> verified account session
  -> Hostaway connection
  -> immediate server history sync
  -> durable voice import + style/profile update
  -> server draft generation with real voice grounding
  -> readiness state
     -> drafts: on during learning
     -> autopilot: off until trained
```

### Canonical reply path

Server generation becomes the only production path and must assemble prompt context from:

1. Property-scoped style profile
2. Org/global style fallback
3. Semantic `voice_examples` matches
4. Historical imported examples
5. Edit patterns and draft outcomes
6. Conversation history and property knowledge
7. Guest-specific grounding where available

The current `server/src/services/ai-proxy.ts` prompt must be upgraded from generic host instructions to a real voice-grounded prompt builder that inherits the useful grounding concepts currently trapped in `src/lib/ai-enhanced.ts`.

## Account and Session Model

### Required change

Hostaway connection is not identity. Rental Voice account is identity.

Server-backed voice artifacts must belong to the Rental Voice account/org, not to whatever device happened to train first.

### Auth shape

Extend `server/src/routes/auth.ts` and mobile auth client flows to support:

- `requestEmailCode(email)`
- `verifyEmailCode(email, code)`
- `consumeMagicLink(token)` or equivalent deep-link verification path

Session storage remains device-secure storage on mobile.

### Session states

- `anonymous`
- `pending_email_verification`
- `authenticated_no_pms`
- `authenticated_syncing_history`
- `authenticated_learning`
- `authenticated_ready`

These states should be explicit app state, not inferred loosely from unrelated settings.

## Hostaway Connect and Training Flow

### Required change

On successful managed Hostaway connect, the server must immediately start history sync. The user should not need to discover a second screen to make the core product work.

### Target behavior

`server/src/routes/hostaway.ts`
- `POST /api/hostaway`
  - validates and stores credentials
  - returns connection success
  - triggers history sync job immediately

The trigger can be:

- synchronous "start job now" after successful connect, or
- enqueue background job transactionally after connect

But it must happen as part of the primary onboarding flow.

### Output of sync/training

The sync pipeline should produce:

- imported guest/host message pairs in `voice_examples`
- property-scoped or org-scoped style profile updates
- history sync progress/status
- server-side readiness metrics

## Voice Grounding Model

### Canonical sources

#### 1. `voice_examples`

Use `server/src/routes/voice.ts` retrieval semantics as the primary source of "how this host responded to similar guest messages before."

These examples should drive:

- phrasing similarity
- detail mirroring
- tone matching
- scenario matching

#### 2. style profiles

Style profiles remain useful, but only as the higher-level voice summary.

They should be:

- property-scoped first
- org/global fallback second
- updated from both imported history and ongoing outcomes

The current managed path incorrectly reduces style to lightweight edit-derived preferences. That is not enough for a voice product.

#### 3. edit patterns and outcomes

`edit_patterns`, `approved`, `edited`, `rejected`, and independent replies should continue shaping style, but they are secondary refinement signals, not the primary voice memory.

#### 4. imported history

Historical Hostaway imports are not a bootstrap convenience. They are the main initial training corpus for new users.

### Prompt construction requirements

Server prompt construction must include:

- identity framing as the host, not as a generic AI assistant
- matched real host examples when available
- property-specific grounding
- consistency rules across the conversation
- banned/generic phrasing suppression
- learning-state-aware confidence and safety rules

The local prompt in `src/lib/ai-enhanced.ts` is the baseline to port conceptually. It should not remain the only place where strong voice instructions exist.

## Readiness and Gating

### Drafts during learning

Drafts are available immediately after account verification and Hostaway connect.

UI should show a clear learning state, for example:

- `Learning your voice from past messages`
- `Drafts are live now and will improve as import finishes`

### Autopilot lock

Autopilot is disabled until server-side readiness returns true.

Readiness must be server-calculated, not guessed on the client.

Minimum readiness should consider:

- imported host-written example count
- style profile sample depth
- semantic retrieval availability
- quality/eval threshold
- degraded/fallback state

Autopilot must not unlock just because "some samples exist."

### Suggested readiness contract

Add a server readiness shape similar to:

```ts
interface VoiceReadiness {
  state: 'untrained' | 'learning' | 'ready' | 'degraded';
  importedExamples: number;
  styleSamples: number;
  semanticReady: boolean;
  autopilotEligible: boolean;
  reason: string;
}
```

## Migration Bridge

### Why this exists

The app already has real local learning data. Throwing it away would reset the founder and any existing local users back to a weaker baseline.

### Bridge behavior

Use the existing local-learning snapshot concept as the bridge:

- host style profiles
- learning progress
- learning entries
- draft outcomes
- reply deltas
- calibration entries
- conversation flows

This data uploads once after account creation/sign-in and becomes server-backed state.

### Merge rules

- server history-derived voice examples win for direct scenario grounding
- imported local edit/outcome data refines style
- property-specific server profiles override generic global profiles when both exist
- local store becomes cache only after successful server import acknowledgement

### Cleanup rule

Do not remove local fallback code until:

- migration upload is stable
- server generation is canonical
- founder canary and cold-start evals are in place

## Evaluation Split

### Gate 1: founder canary

Purpose: verify that the migrated server-canonical engine still sounds like Sawyer.

Measures:

- founder voice fidelity
- scenario consistency
- regressions from local-to-server migration

### Gate 2: cold-start new host

Purpose: verify that a fresh user who signs up, connects Hostaway, and imports history gets usable voice quality quickly enough.

Measures:

- time to first usable draft
- quality before training completes
- quality after initial import completes
- autopilot unlock criteria

### Why split is mandatory

Sawyer-only evals are necessary but insufficient. They measure canary fidelity, not whether onboarding produces a product for other hosts.

## Success Criteria

### Product

- All authenticated production drafts route through the server engine.
- New managed users start server history sync immediately after Hostaway connect.
- Users can generate drafts during learning.
- Autopilot stays locked until server readiness is true.
- Existing local users can migrate their learned data into the account-backed path.

### Technical

- `server/src/services/ai-proxy.ts` (or successor) uses real voice grounding, not only generic style prefs.
- Managed generation consumes property-aware style/profile data and semantic `voice_examples`.
- Managed onboarding starts sync/training automatically.
- App state explicitly reflects account, sync, and readiness states.

### Evaluation

- Founder canary gate exists and is rerunnable.
- Cold-start new-host gate exists and is rerunnable.
- Autopilot unlock logic is tied to server readiness, not only draft confidence.

## File Map

### Primary server files

- `server/src/routes/auth.ts`
- `server/src/routes/hostaway.ts`
- `server/src/routes/voice.ts`
- `server/src/routes/ai-generate.ts`
- `server/src/services/ai-proxy.ts`

### Primary mobile files

- `src/app/index.tsx`
- `src/components/OnboardingScreen.tsx`
- `src/components/ApiSettingsScreen.tsx`
- `src/hooks/useAIDraft.ts`
- `src/lib/api-client.ts`
- `src/lib/commercial-migration.ts`

### Supporting learning/runtime files

- `src/lib/ai-enhanced.ts`
- `src/lib/semantic-voice-index.ts`
- `src/lib/auto-import.ts`
- `src/lib/ai-training-service.ts`

## Implementation Phases

### Phase 1 - account-first auth and onboarding state

- add passwordless email-code auth
- add explainer -> auth -> Hostaway connect flow
- make account/session state explicit

### Phase 2 - managed connect starts sync immediately

- trigger server history sync on successful Hostaway connect
- expose progress and learning state to the app

### Phase 3 - server-canonical voice grounding

- upgrade managed prompt construction
- wire semantic `voice_examples` into managed generation
- honor property-scoped style profiles first
- add degraded/learning-aware readiness contract

### Phase 4 - migration bridge

- upload local learning snapshot after account sign-in
- merge local signals into server-backed profile state
- demote local runtime generation to fallback/cache only

### Phase 5 - evaluation and autopilot gate

- split founder vs cold-start eval suites
- tie autopilot availability to server readiness
- remove remaining assumptions that founder-only performance proves product readiness

## Risks

### 1. auth friction

Passwordless can still fail if email delivery is weak. The email-code-first plus magic-link fallback design reduces this risk compared with magic-link-only mobile auth.

### 2. migration inconsistency

Local and server learning signals may disagree. This is acceptable if direct historical examples remain primary and imported local signals act as secondary refinement.

### 3. premature autopilot unlock

If readiness is implemented as a weak heuristic, users will receive auto-sent drafts before the server engine is trustworthy. This must be treated as a product safety issue, not just a tuning problem.

### 4. hidden dual-stack persistence

If local generation remains active in too many authenticated paths, the repo will keep lying about which engine is canonical. This needs explicit routing ownership.

## Out of Scope for This Spec

- Billing/pricing changes beyond what readiness requires
- Team/shared inbox architecture
- New PMS providers
- Marketing copy or App Store positioning changes

## Bottom Line

Rental Voice should stop acting like a local AI drafting tool with a server sidecar and become an account-backed voice system where:

- identity belongs to Rental Voice
- Hostaway is the message source
- the server owns learning and reply generation
- drafts are available during learning
- autopilot is locked until trust is earned

Anything else keeps the product split between "the version that sounds right" and "the version that scales."
