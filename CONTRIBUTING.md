# Contributing to Rental Voice

This is the one true contributor path for a clean machine. You do not need `AGENTS.md`, `.agents/`, or the runbooks to get the app running.

## Verified Toolchain

Verified locally on 2026-04-19:

- macOS with Xcode 26.4.1 and iOS Simulator
- Node `22.22.0`
- npm `10.9.4`
- Bun `1.3.9`
- Maestro `2.2.0`

Root package manager: `npm`

Server package manager/runtime: `bun`

## 1. Install Dependencies

From the repo root:

```bash
npm install
cd server
cp .env.example .env
bun install
cd ..
```

`server/.env.example` is the baseline environment file. Copy it as-is first, then replace placeholders only if you are doing backend work.

## 2. Build the iOS Dev Client Once

On a clean machine, install the native dev client first:

```bash
npm run ios
```

That step can take several minutes because Xcode builds and installs the app into the simulator.

## 3. Start the Deterministic Demo Path

Use the demo-first path unless your task explicitly needs real Hostaway credentials:

```bash
npm run start:demo
```

Then press `i` in the Expo terminal if the simulator does not open automatically.

This path always starts at onboarding first. It does not auto-restore saved Hostaway credentials, so contributors can exercise the same path on a machine with old local state.

From onboarding:

1. Tap `Try Demo`
2. Wait for the inbox to load

## 4. Smoke Test It with Maestro

Run the deterministic onboarding flow:

```bash
npm run maestro:demo
```

Keep `npm run start:demo` running in one terminal and run `npm run maestro:demo` from a second terminal. The wrapper deep-links the booted simulator into the local dev client with Expo's developer-menu onboarding popup disabled, then runs the demo flow. If Expo is using a non-default port, run `EXPO_DEV_CLIENT_PORT=<port> npm run maestro:demo`.

## 5. Optional Local Server Work

The demo path above does not require backend secrets.

If your task touches `server/`, copy `server/.env.example` to `server/.env` and replace placeholder values before starting the backend. The environment file includes:

- Supabase URL, anon key, and service-role key
- `ENCRYPTION_KEY`
- AI provider keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`)
- optional Langfuse keys
- optional Stripe keys
- founder-only overrides
- `AUTO_PROVISION_SECRET`
- `PORT=3001`

Start the backend:

```bash
npm --prefix server run dev
```

If you need the app to hit the local server instead of the hosted API:

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:3001 npm run start
```

## 6. What Is Not Supported Right Now

`npm run web` is intentionally disabled. The current Expo web target white-screens before first render, so the supported contributor target is iOS Simulator until that path is fixed.

## 7. Deeper Repo Docs

Only read these if your task needs repo operations beyond basic setup:

- [README.md](./README.md)
- [docs/status/current-state.md](./docs/status/current-state.md)
- [docs/runbooks/codex-desktop-workflow.md](./docs/runbooks/codex-desktop-workflow.md)
