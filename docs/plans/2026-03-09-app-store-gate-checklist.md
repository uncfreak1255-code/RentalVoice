# App Store Gate Checklist

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Define the pass/fail gates Rental Voice must meet before an App Store submission is attempted.

**Architecture:** Treat App Store readiness as a release gate, not a design preference. No submission should happen until product trust, durable identity/data behavior, privacy truth, and release operations each meet explicit pass criteria.

**Tech Stack:** Expo/EAS, React Native, Supabase, Hostaway integration, App Store Connect.

---

## Gate 1: Core Product Reliability

All must be true:
- onboarding/reconnect path is usable on small devices
- inbox does not unexpectedly blank or mis-sort unread trust
- chat send/edit/approve/reject flows are stable on device
- escalation and issue surfaces are trustworthy and non-overlapping
- settings does not expose misleading staged/commercial surfaces by default

Evidence required:
- focused Jest coverage for touched surfaces
- manual smoke checklist on current iPhone simulator/device targets
- no open P0/P1 reliability bug accepted as “known for launch”

## Gate 2: Durable Identity and Recovery

All must be true:
- durable Rental Voice account identity exists at least for founder canary
- session recovery does not depend on fragile local onboarding flags
- learning/progress survives app restarts for the canary path
- disconnect and delete-all-data are clearly separated
- reset/recovery states are understandable to the user

Evidence required:
- founder sign-in and restore verification
- migration verification notes
- recovery test coverage

## Gate 3: AI Learning Truth and Quality

All must be true:
- import/training/style/accuracy are distinct in UI and metrics
- no contradictory progress or training numbers remain
- recurring-intent coverage is measurable
- repeated guest-question categories trend toward the 75% usable-draft target
- founder/user-specific output is not dominated by generic filler

Evidence required:
- AI Learning tests
- recurring-intent coverage report
- manual scenario review set for top repeated intents

## Gate 4: Privacy, Security, and Policy Truth

All must be true:
- privacy/security copy is literally true
- App Store privacy questionnaire answers are grounded in current data handling
- account deletion path is real and documented
- export/help/support copy matches actual behavior
- no unsupported claim such as end-to-end encryption remains in product copy unless substantiated

Evidence required:
- privacy data map
- support/deletion URL plan
- final copy review checklist

## Gate 5: Release Operations

All must be true:
- build pipeline is green for release target
- metadata, screenshots, subtitle, keywords, and release notes are prepared
- support URL, privacy policy URL, and account deletion URL are ready
- release rollback plan is documented
- canonical repo and promotion path are clean

Evidence required:
- EAS build/submission dry run notes
- release checklist signoff
- rollback anchor reference

## Gate 6: Route-by-Route Acceptance

Every shipped route must be classified:
- ship now
- gate behind feature flag
- founder-only/internal
- remove from public build

No route should ship as an obvious stub or internal prototype.

## Launch blockers

Submission is blocked by any of:
- known data-loss path in default or founder canary flow
- known broken chat send flow
- contradictory AI Learning metrics or broken AI Learning runtime
- misleading privacy/security claims
- unfinished recovery states after login/reconnect/reset
- no founder/user durable identity path for real recovery testing

## Final signoff order

1. Product trust signoff
2. Durable identity/recovery signoff
3. AI learning truth/quality signoff
4. Privacy/policy signoff
5. Release operations signoff
