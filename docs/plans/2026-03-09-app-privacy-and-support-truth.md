# App Privacy And Support Truth

**Goal:** Document the current truthful privacy, security, export, deletion, and support posture that the app and App Store metadata are allowed to claim.

---

## 1. Current Truth Model

Current product reality is mixed:
- the default visible app path is still personal-mode and Hostaway-first
- local app state still holds significant conversation and learning data
- a live founder backend account now exists, but the app-side durable founder path is not yet the public default
- future durable identity target is `Rental Voice account -> Connect Hostaway -> Sync and learn`

This means product copy must not imply a fully cloud-account-backed, fully recoverable system for every user yet.

## 2. Claims That Are Safe Now

Safe if phrased carefully:
- credentials are stored securely on device
- data may be used to generate AI reply improvements and learning signals
- users can disconnect the PMS connection
- there is a backend account deletion route available
- data can be encrypted in transit and protected at rest where supported by the current platform/provider stack

## 3. Claims That Are Not Safe Yet

Do not claim until verified end to end:
- `End-to-End Encryption`
- `your data stays on your device` as a universal statement
- `nothing is stored remotely`
- `full export of all your data` unless export covers the real scope
- `your learning always follows you across devices` for normal users
- `exactly like you` or similar strong AI-copy guarantees

## 4. Privacy Disclosure Inputs To Prepare

App Store privacy questionnaire will need truthful answers about at least:
- contact info
- user content / messages
- diagnostics / crash data
- analytics / product interaction data
- identifiers / account ids
- possible sensitive data depending on guest message content

These answers must be grounded in the shipped build, not future architecture.

## 5. Support Surface Requirements

Before submission, the product/support stack must have:
- privacy policy URL
- support URL
- account deletion URL/instructions
- help center copy that matches the real product
- recovery guidance for reconnect/reset situations

## 6. Copy Review Checklist

Before any App Store or in-app copy ships, verify:
- does the sentence match current data flow, not planned data flow?
- does it overstate encryption or storage locality?
- does it imply durable account recovery not available to the visible user path?
- does it imply AI quality or automation trust beyond measured reality?

## 7. Current Highest-Risk Copy Areas

Review first:
- `/Users/sawbeck/Projects/RentalVoice/src/components/PrivacySecurityScreen.tsx`
- `/Users/sawbeck/Projects/RentalVoice/src/components/HelpCenterScreen.tsx`
- `/Users/sawbeck/Projects/RentalVoice/src/components/SettingsScreen.tsx`
- `/Users/sawbeck/Projects/RentalVoice/src/components/AILearningScreen.tsx`
- any onboarding/reconnect helper copy

## 8. Required Outcome

By release time:
- every privacy/security/help statement in the app is literally defensible
- App Store metadata and the in-app product tell the same truth
- recovery and deletion are understandable to a non-technical user
