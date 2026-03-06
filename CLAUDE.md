# RentalVoice — AI Guest Messaging for Vacation Rental Hosts

## What This Is

Rental Voice is an Expo (React Native) mobile app + Hono backend for vacation rental hosts. It provides AI-powered guest communication with Hostaway PMS integration, multi-language support, sentiment analysis, and human-in-the-loop approval workflows. Trained on 23,000+ historical messages.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Mobile App** | Expo SDK 54, React Native 0.81, TypeScript 5.9 |
| **State** | Zustand 5 with AsyncStorage persistence |
| **Routing** | Expo Router (file-based, `src/app/`) |
| **Styling** | Design tokens (`src/lib/design-tokens.ts`) — inline styles + `StyleSheet.create` |
| **Font** | DM Sans (loaded in `_layout.tsx`) |
| **Backend** | Hono (TypeScript), runs on Bun |
| **Database** | Supabase (PostgreSQL + RLS) |
| **Payments** | Stripe (billing in commercial mode) |
| **Error Tracking** | Sentry |
| **OTA Updates** | expo-updates via EAS |
| **Testing** | Jest + jest-expo + @testing-library/react-native |
| **Linting** | ESLint (flat config, expo preset) |

## Project Structure

```
├── src/
│   ├── app/                    # Expo Router pages
│   │   ├── _layout.tsx         # Root layout (fonts, theme, providers)
│   │   ├── (tabs)/             # Tab navigator (Inbox, Calendar, Settings)
│   │   ├── chat/[id].tsx       # Chat detail screen
│   │   └── settings/           # Settings sub-screens
│   ├── components/             # UI components (screens + primitives)
│   │   ├── ui/                 # Reusable primitives: Avatar, Badge, Card, Skeleton, etc.
│   │   └── *.tsx               # Full-screen components (InboxDashboard, ChatScreen, etc.)
│   ├── hooks/                  # Custom hooks (useAIDraft, etc.)
│   └── lib/                    # Business logic & services
│       ├── store.ts            # Zustand store — ALL types defined here
│       ├── design-tokens.ts    # Colors, spacing, typography, elevation
│       ├── config.ts           # App mode: personal | commercial
│       ├── hostaway.ts         # Hostaway PMS API client
│       ├── api-client.ts       # Backend API client (commercial mode)
│       ├── ai-*.ts             # AI pipeline (drafts, learning, training, intelligence)
│       ├── pms/                # PMS adapter abstraction layer
│       └── *.ts                # Other services (sentiment, automation, notifications)
├── server/                     # Backend (commercial mode only)
│   ├── src/
│   │   ├── index.ts            # Hono app entry, route mounting
│   │   ├── routes/             # API handlers (one file per concern)
│   │   ├── services/           # AI proxy, Stripe billing
│   │   ├── middleware/         # Auth, rate-limit, draft-limit
│   │   ├── adapters/           # PMS adapters (Hostaway, Guesty, Lodgify)
│   │   ├── db/                 # Supabase client + generated types
│   │   └── lib/                # Encryption, env, shared types
│   └── supabase/migrations/    # SQL migration files
├── supabase/                   # Supabase config + migrations
├── landing/                    # Marketing landing page (static HTML/CSS/JS)
└── patches/                    # patch-package patches for dependencies
```

## Development Commands

```bash
# Mobile app
npm run start          # expo start (dev server)
npm run ios            # expo run:ios
npm run android        # expo run:android
npm run lint           # expo lint (ESLint)
npm run typecheck      # tsc --noEmit

# Backend (from server/)
bun run dev            # hot-reload dev server on :3001
bun run typecheck      # tsc --noEmit

# Tests
npx jest               # run all tests (src/__tests__)
npx jest --watch       # watch mode
```

## Dual-Mode Architecture

Controlled by `EXPO_PUBLIC_APP_MODE` environment variable:

- **`personal`** (default): Direct API calls to AI providers, local storage, no auth required. This is the daily-use mode.
- **`commercial`**: Server-proxied AI, Supabase auth, Stripe billing, multi-tenant. Activated only when `EXPO_PUBLIC_APP_MODE=commercial`.

Feature flags derived from mode are in `src/lib/config.ts`.

## Coding Conventions

### Styling (MANDATORY)

- **All colors, spacing, typography, radii, shadows** must come from `src/lib/design-tokens.ts`
- **No hardcoded colors** — `#FFFFFF`, `#000000`, etc. are banned in new code
- **No new `className=` usage** — NativeWind is legacy; use inline styles or `StyleSheet.create` with design tokens
- **DM Sans** font family — use `typography.fontFamily.*` tokens

### Components

- Use `src/components/ui/*` primitives before creating new base elements
- All screen components accept `onBack: () => void` as a minimum prop
- Props interfaces required — no `any` types
- Use `memo()` for list items, `useMemo`/`useCallback` for expensive computations
- No component definitions inside render bodies

### State Management

- Import types (`Conversation`, `Message`, `Guest`, `Property`, etc.) from `@/lib/store`
- Use individual selectors: `useAppStore((s) => s.field)` — never select entire store
- `conversation.status`: `'active' | 'archived' | 'urgent'`
- `conversation.workflowStatus`: `'inbox' | 'todo' | 'follow_up' | 'resolved' | 'archived'`

### Backend (server/)

- `camelCase` for functions, `PascalCase` for types/interfaces, `kebab-case` for filenames
- One route handler per file — no God files
- Zod schemas on ALL API inputs
- Every route wrapped in try/catch with typed error responses
- AES-256-GCM for stored API keys; Supabase RLS on every table

### File Naming

- `kebab-case.ts` for all source files
- Path alias: `@/` maps to `src/`

## AI Training Pipeline

```
Hostaway API → history-sync.ts → Fetch conversations (rate-limited, resumable)
  → ai-training-service.ts → 3-phase training:
    1. Smart sampling (up to 8K messages, stratified by property/intent/length)
    2. Style analysis in batches (formality, warmth, phrases, greetings)
    3. Response index (guest→host pairs indexed by intent + keyword)
  → ai-learning.ts → Style profile → generateStyleInstructions() → LLM prompt
  → ai-enhanced.ts → Draft generation with style + historical recall
  → advanced-training.ts → Deep training (5 specialized passes)
```

Edited drafts get priority: `ResponsePattern.priority = 'high'`, +15 score bonus in historical recall.

## Key API Routes (server)

All routes prefixed with `/api`:

| Route | Purpose |
|-------|---------|
| `/api/health` | Health check |
| `/api/ai/*` | AI draft generation proxy |
| `/api/auth/*` | Authentication |
| `/api/hostaway/*` | Hostaway PMS proxy |
| `/api/guesty/*` | Guesty PMS proxy |
| `/api/lodgify/*` | Lodgify PMS proxy |
| `/api/settings/*` | User settings CRUD |
| `/api/knowledge/*` | Property knowledge base |
| `/api/account/*` | Account management (includes DELETE for App Store compliance) |
| `/api/usage/*` | AI usage metering |
| `/api/billing/*` | Stripe subscription management |
| `/api/webhooks/*` | Incoming webhook handlers |

## Known Technical Debt

| Issue | Location |
|-------|----------|
| FlashList `estimatedItemSize` type error | `InboxDashboard.tsx`, `AutomationsScreen.tsx`, `IssueTrackerScreen.tsx` |
| `FlashList` used as type not value | `InboxDashboard.tsx` — use `typeof FlashList` |
| `unrs-resolver` native binding | IDE-only error, not runtime |

## Testing

- Test files live in `__tests__/` directories adjacent to source
- Pattern: `**/__tests__/**/*.test.{ts,tsx}`
- Module alias `@/` configured in jest.config.js via `moduleNameMapper`
- Component tests use `@testing-library/react-native`
- Pure logic tests use `ts-jest`

## EAS Build Profiles

| Profile | Distribution | Channel |
|---------|-------------|---------|
| `development` | Internal | development |
| `preview` | Internal | preview |
| `production` | App Store (auto-increment) | production |

## App Store Compliance

- Every navigable screen must be functional or hidden before submission
- Account deletion endpoint required: `DELETE /api/account`
- No "coming soon" placeholder screens
- LLM safeguards: content filtering on AI outputs
- Privacy policy at `rentalvoice.app/privacy`

## Behavioral Rules

### Do
- Read existing code before modifying it
- Use path-scoped rules in `.claude/rules/` for domain-specific guidance
- Use slash commands (`/add-screen`, `/debug-ai`, `/sync-check`, `/pre-submit`, `/review-pr`, `/curate`)
- Run `npm run typecheck` after any code changes
- Batch parallel tool calls in a single message when operations are independent
- Check existing patterns/decisions before implementing something new

### Do NOT
- Add features, refactor, or "improve" code beyond what was asked
- Add docstrings, comments, or type annotations to untouched code
- Create helpers or abstractions for one-time operations
- Add error handling for scenarios that can't happen
- Use backwards-compatibility shims — just change the code
- Hardcode colors, spacing, or typography values
- Use `className=` anywhere (NativeWind is legacy)
- Select the entire Zustand store
- Skip running typecheck after changes

## Claude Code Setup

### Slash Commands (`.claude/commands/`)
| Command | Purpose |
|---------|---------|
| `/add-screen` | Scaffold a new screen with routing + component |
| `/debug-ai` | Diagnose AI draft pipeline issues |
| `/sync-check` | Verify Hostaway PMS sync health |
| `/pre-submit` | Run App Store pre-submission checklist |
| `/review-pr` | Review changes against coding standards |
| `/curate` | Run codebase curator to sync docs with code |

### Path-Scoped Rules (`.claude/rules/`)
| Rule | Applies To |
|------|-----------|
| `frontend.md` | `src/**/*.{ts,tsx}` |
| `backend.md` | `server/**/*.ts` |
| `ai-pipeline.md` | `src/lib/ai-*.ts`, `advanced-training.ts`, `useAIDraft.ts` |
| `testing.md` | `**/__tests__/**/*.test.{ts,tsx}` |
| `landing.md` | `landing/**` |

### Agents (`.claude/agents/`)
- **codebase-curator**: Self-evolving agent that audits and syncs documentation with actual codebase state

### Plans Directory
Plan-mode outputs are saved to `./reports/` for version-controlled tracking.

## Session Protocol

Before ending a session, the assistant should update this file with new learnings discovered during the session. This includes:

- **Architectural decisions** made (and why)
- **New gotchas or bugs** discovered (add to Known Technical Debt)
- **New patterns** established (add to Coding Conventions)
- **Commands or workflows** that were non-obvious
- **Dependencies added or removed**

Keep updates concise — curate, don't append logs. Remove stale entries when they no longer apply.

## Session Learnings

<!-- Add learnings below this line. Newest first. -->

### 2026-03-06
- Set up comprehensive `.claude/` directory: commands, rules, agents, settings
- Installed ASO skills (15), SEO skills (12), context-engineering skills (4) from GitHub forks
- Created path-scoped rules for frontend, backend, AI pipeline, testing, landing page
- Created slash commands: `/add-screen`, `/debug-ai`, `/sync-check`, `/pre-submit`, `/review-pr`, `/curate`
- Created self-evolving `codebase-curator` agent for documentation drift prevention
- Configured `settings.json` with Allow/Ask permission split and `plansDirectory: ./reports`
- SessionEnd hook at `~/.claude/hooks/session-learnings.sh` timestamps CLAUDE.md on exit

## Skills

Read skills: hostaway-api, api-patterns, python-patterns, database-design
