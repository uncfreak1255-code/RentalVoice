---
description: Start the development server + simulator for live editing, testing, and OTA updates
---

# Rental Voice Development Workflow

Use this workflow only for active development sessions.

Read first:

- `/Users/sawbeck/Projects/RentalVoice/AGENTS.md`
- `/Users/sawbeck/Projects/RentalVoice/CLAUDE.md`

## Quick Start (Run Every Session)

// turbo-all

1. Confirm the task does not require a new protected baseline first.

2. Start the Expo dev server:
```bash
cd /Users/sawbeck/Projects/RentalVoice && npx expo start
```
This runs the Metro bundler. The user's phone connects via the dev build, and the simulator connects locally. Code changes hot-reload on BOTH.

3. If the iOS Simulator isn't running the app, press `i` in the Metro terminal to launch it.

4. Verify the app loads on the simulator. Use Maestro to take a screenshot:
```bash
maestro test /Users/sawbeck/Projects/RentalVoice/.maestro/onboarding_demo_mode.yaml
```

## When the User Reports a Bug or UI Issue

1. **Look at it yourself first**: Run the relevant Maestro flow or take a manual screenshot:
```bash
xcrun simctl io booted screenshot /tmp/current_ui.png
```

2. **Fix the code** — changes hot-reload instantly on both simulator and the user's phone.

3. **Verify the fix** on the simulator using Maestro or another screenshot.

4. **Commit and push** when the fix is confirmed good.

Before pushing, use the release workflow:

- `/Users/sawbeck/Projects/RentalVoice/.agents/workflows/release.md`

## Push OTA Update (When User Isn't at Computer)

If the user needs to see changes on their phone but isn't connected to the dev server:

```bash
cd /Users/sawbeck/Projects/RentalVoice && npx eas update --channel development --message "description of changes"
```

This pushes a JS bundle update. Next time they open the app, it downloads the update.

> **Note**: EAS CLI must be logged in first: `npx eas login`

## First-Time Setup (Only Once)

If the simulator doesn't have the dev build:
```bash
cd /Users/sawbeck/Projects/RentalVoice && npx expo run:ios
```
This builds the native app for the simulator (~5-10 min). Only needed once unless native dependencies change.

If the user needs a fresh dev build on their PHONE:
```bash
cd /Users/sawbeck/Projects/RentalVoice && npx eas build --profile development --platform ios
```
Then they install it via the link EAS provides.

## Running Maestro E2E Tests

Run all flows:
```bash
maestro test /Users/sawbeck/Projects/RentalVoice/.maestro/
```

Run a single flow:
```bash
maestro test /Users/sawbeck/Projects/RentalVoice/.maestro/onboarding_demo_mode.yaml
```

Available flows:
- `onboarding_demo_mode.yaml` — Full demo onboarding
- `tab_navigation.yaml` — Tab switching
- `inbox_navigation.yaml` — Filters + search
- `inbox_open_conversation.yaml` — Open a chat
- `chat_compose_message.yaml` — Type a message
- `settings_navigation.yaml` — Settings sub-screens
- `calendar_view.yaml` — Calendar scrolling
