# Founder + User App Parallel Execution Design

## Goal

Turn Rental Voice into a product Sawyer can use daily with one durable founder account while hardening the user-facing app in parallel toward App Store readiness.

## Decision

The correct flow is not "finish founder first, then start the user app." The correct flow is:

1. keep the default user-facing app path in `personal` mode
2. keep shipping user-app hardening work on `test`
3. build the app-side founder account lane on top of the already-bootstrapped live founder backend
4. once the founder path is stable, use the founder account as the persistent live canary account
5. only then promote validated patterns into the broader user app
6. evolve the default architecture toward `Rental Voice account -> Connect Hostaway -> Sync and learn` once the canary path is proven

This avoids blocking all product progress on founder auth, while also avoiding the mistake of treating the current local-only personal path as the forever account.

## Why this is the right architecture

### Rejected approach 1: founder first, user app later

This would delay reliability, inbox quality, draft quality, escalation accuracy, and App Store readiness until founder auth is done. That is too serial and slows learning.

### Rejected approach 2: user app only, founder later

This would keep improving a product path that still loses important learning state on reset. That is unsafe for Sawyer’s real usage and blocks the permanent canary account.

### Chosen approach: parallel lanes with one integration point

Run the founder-account lane and the user-app hardening lane at the same time. They converge when founder session recovery and learning migration are stable enough for Sawyer to use the founder account daily.

## Lane model

### Lane A: Founder account and durability lane

Purpose:
- establish durable app identity as the long-term architecture
- make the live founder account usable from the app as the first canary path
- stop founder identity from depending on fragile local flags
- migrate learning into the founder-backed path

This lane owns:
- account-first auth architecture (`Rental Voice account -> Connect Hostaway`)
- app-side founder login/recovery
- founder session restore after app reset
- personal-to-founder learning migration
- durable storage contract for founder learning
- founder-specific validation of `/api/auth/me`, billing, entitlements, founder diagnostics

### Lane B: User app hardening lane

Purpose:
- keep improving the default user-facing experience for real future users while founder durability work is underway

This lane owns:
- composer/send reliability
- inbox/unread trust
- escalation correctness
- AI learning truth surfaces
- draft quality for recurring guest intents
- property knowledge polish
- onboarding and PMS connection quality
- design and usability work needed for App Store readiness

This lane continues to use the linked `test` project and the current personal-mode default path.

### Lane C: Release and App Store lane

Purpose:
- convert the hardened product into a submission-ready app once Lane A and Lane B hit their gates

This lane owns:
- App Store review readiness
- privacy copy and data handling truth
- metadata/screenshots/release notes
- production QA matrix
- support flows and fallback states
- release/promotion runbooks

Lane C should not lead implementation. It follows validated work from Lane A and Lane B.

## Critical dependency rules

### What can run in parallel now

- Lane A founder app-path work
- Lane B user-app reliability, learning quality, and design hardening
- Lane C planning and release-readiness documentation only

### What must not run in parallel with destructive overlap

- any task that rewrites learning persistence contracts and any task that simultaneously changes migration payload shape
- any task that changes current onboarding routing and any task that changes session restore behavior without a shared design
- any task that touches the live founder account and any task that treats live as disposable test state

## Canary model

### Current state

- backend founder account exists in `Rental Voice Live`
- app-side founder path does not exist yet
- current daily app path is still Hostaway-first `personal`
- the future durable default should be Rental Voice account first, Hostaway connect second

### Target state

- Sawyer logs into the founder path intentionally
- founder session restores reliably after app restarts
- founder learning is durable
- Sawyer tests real product improvements there first as the live canary account
- only validated patterns get promoted into the broader user app flow

## Success gates

### Gate A: founder canary ready

All must be true:
- founder sign-in works from the app
- founder session survives app resets
- founder learning migration runs successfully
- founder-backed learning is durable
- the durable identity model is reusable for future non-founder users
- founder diagnostics and entitlements validate in-app

### Gate B: user app quality ready

All must be true:
- core chat flow is reliable
- importer/training truth is internally consistent
- recurring guest-intent draft coverage is measurable and improving toward the 75% target
- escalation and issue handling are trustworthy
- onboarding and settings are not structurally broken

### Gate C: App Store ready

All must be true:
- no known P0/P1 user-flow bugs remain
- privacy and security copy match real data behavior
- login/recovery and empty/reset states are understandable
- review metadata, screenshots, support policy, and release notes are prepared

## Agent split

### Agent 1: Founder path agent

Single responsibility:
- founder login/recovery, session persistence, learning migration, live founder validation

### Agent 2: Learning quality agent

Single responsibility:
- training truth, recurring-intent coverage, retrieval/memory quality, draft quality for repeated guest questions

### Agent 3: User experience agent

Single responsibility:
- inbox, chat, settings, onboarding, escalation layout and flow quality

### Agent 4: Release agent

Single responsibility:
- App Store readiness docs, privacy truth, QA matrix, release gating, screenshots/metadata prep

## Work assignment rule

No agent should own both:
- live founder state changes
- default user-path routing changes

No agent should touch `live` unless the task explicitly requires live validation.

Default work happens on `test`.

## Immediate execution order

1. Start Lane A implementation: founder app-side entry/recovery and migration design
2. Start Lane B implementation: user-app hardening backlog execution against the current roadmap
3. Use automation to keep generating the next safe user-app enhancement slice
4. Reassess weekly against Gate A and Gate B
5. Once Gate A is met, move Sawyer onto the founder app path as the live canary account
6. After that, start release gating for App Store submission
