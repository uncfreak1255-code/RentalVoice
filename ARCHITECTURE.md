# Rental Voice — Architecture Document

> **Single source of truth.** Every line of code must justify its place against this document.

---

## System Overview

Rental Voice is an Expo (React Native) mobile application for vacation rental hosts.
It provides AI-powered guest communication management with Hostaway PMS integration.

**Runtime:** Expo SDK 52 · React Native · TypeScript
**State:** Zustand with AsyncStorage persistence (`src/lib/store.ts`)
**Routing:** State-based screen switching in `src/app/index.tsx` (no file-based router)
**Styling:** Design tokens (`src/lib/design-tokens.ts`) — **mandatory for all new/modified UI**

---

## Layer Architecture

```
┌─────────────────────────────────────┐
│  src/app/                           │  Entry Layer
│  └── _layout.tsx  (fonts, theme)    │  - Font loading, nav theme
│  └── index.tsx    (screen router)   │  - State-based routing, 21 screens
├─────────────────────────────────────┤
│  src/components/                    │  Presentation Layer
│  ├── ui/          (primitives)      │  - Avatar, Badge, Card, Skeleton, SectionHeader
│  └── *.tsx        (screens)         │  - Full-screen components with onBack props
├─────────────────────────────────────┤
│  src/lib/                           │  Business Logic Layer
│  ├── store.ts     (state)           │  - Zustand store, all types
│  ├── hostaway.ts  (API)             │  - Hostaway PMS integration
│  ├── ai-*.ts      (AI pipeline)     │  - Draft generation, training, learning
│  ├── sentiment-analysis.ts          │  - Message & conversation sentiment
│  ├── design-tokens.ts               │  - Colors, spacing, typography, elevation
│  └── *.ts         (services)        │  - Automation, privacy, notifications
└─────────────────────────────────────┘
```

---

## Critical Rules

### 1. Styling Contract

| Rule | Detail |
|------|--------|
| **Design tokens only** | All colors, spacing, typography, radii, and shadows MUST come from `design-tokens.ts` |
| **No hardcoded colors** | `#FFFFFF`, `#000000`, `#14B8A6` etc. are banned in new code — use token references |
| **Dark mode default** | App uses dark mode exclusively — `colors.bg.DEFAULT` is `#0B0F19` |
| **Font family** | DM Sans loaded in `_layout.tsx` — use `typography.fontFamily.*` tokens |
| **NativeWind deprecation** | New components use inline styles with tokens. `className=` is legacy — do not add new instances |

### 2. Component Contract

| Rule | Detail |
|------|--------|
| **UI primitives first** | Use `src/components/ui/*` before creating new base elements |
| **Screen interface** | All screens take `onBack: () => void` as prop minimum |
| **Type-safe props** | Props interface required — no `any` types |
| **Memoization** | Use `memo()` for list items, `useMemo`/`useCallback` for expensive computations |
| **No inline components** | No component definitions inside render bodies |

### 3. Store Contract

| Rule | Detail |
|------|--------|
| **Types from store** | Import `Conversation`, `Message`, `Guest`, `Property` etc. from `@/lib/store` |
| **Selectors** | Use individual selectors: `useAppStore((s) => s.field)` — never select entire store |
| **Status values** | `conversation.status`: `'active' | 'archived' | 'urgent'` |
| **Workflow status** | `conversation.workflowStatus`: `'inbox' | 'todo' | 'follow_up' | 'resolved' | 'archived'` |
| **Sentiment** | Use `analyzeConversationSentiment(conversation)` → returns `ConversationSentiment` |

### 4. File Dependency Map

```
index.tsx
├── _layout.tsx (fonts, theme provider)
├── InboxDashboard.tsx
│   ├── ConversationItem.tsx
│   │   ├── ui/Avatar.tsx
│   │   ├── ui/Badge.tsx
│   │   └── sentiment-analysis.ts
│   ├── PropertySelector.tsx
│   ├── SortByDropdown.tsx
│   └── ui/Skeleton.tsx
├── ChatScreen.tsx
│   ├── MessageBubble.tsx
│   ├── MessageComposer.tsx
│   ├── ConfidenceMeter.tsx
│   ├── AIReasoningSection.tsx
│   ├── AIDraftActionsSheet.tsx
│   ├── ReservationSummaryBar.tsx
│   ├── ConversationSummaryDisplay.tsx
│   ├── ai-enhanced.ts
│   ├── ai-training-service.ts
│   └── edit-diff-analysis.ts
├── SettingsScreen.tsx
│   └── NotificationProvider.tsx (via hook)
├── [14 sub-screens] → all take onBack, navigate from SettingsScreen
└── OnboardingScreen.tsx
```

---

## Pre-existing Technical Debt (Do Not Regress)

| Issue | Location | Status |
|-------|----------|--------|
| FlashList `estimatedItemSize` type error | `InboxDashboard.tsx:774`, `AutomationsScreen.tsx:392`, `IssueTrackerScreen.tsx:293` | Pre-existing, `@shopify/flash-list` type mismatch |
| `FlashList` used as type not value | `InboxDashboard.tsx:216` | Use `typeof FlashList` |
| `documentDirectory` missing | `PrivacyComplianceScreen.tsx:222,279` | `expo-file-system` API change |
| `unrs-resolver` native binding | IDE-only error | npm optional dependency bug, not runtime |

---

## Conversion Status (UI Overhaul)

> Last audited: 2026-02-12 (session 4)
> **Status: ✅ COMPLETE** — All components converted to design tokens + `StyleSheet.create`. Zero `className` instances remaining.

### ✅ Fully Converted (0 className — all components)

| Component | Notes |
|-----------|-------|
| `_layout.tsx` | Theme colors, font loading |
| `ui/Avatar.tsx` | Full token usage |
| `ui/Badge.tsx` | Full token usage |
| `ui/Card.tsx` | Full token usage |
| `ui/Skeleton.tsx` | Full token usage |
| `ui/SectionHeader.tsx` | Full token usage |
| `ConversationItem.tsx` | Avatar, badges, typography |
| `PropertySelector.tsx` | Trigger + bottom sheet |
| `MessageBubble.tsx` | Full token usage, `mbStyles` StyleSheet |
| `MessageComposer.tsx` | Full token usage, `mcStyles` StyleSheet (45 styles) |
| `SettingsScreen.tsx` | Full token usage, `settingsStyles` StyleSheet |
| `ChatScreen.tsx` | Full token usage, design token inline styles |
| `AIReasoningSection.tsx` | Full token usage, `ars` StyleSheet |
| `ConfidenceMeter.tsx` | Full token usage, `cm` StyleSheet |
| `ConversationSummaryDisplay.tsx` | Full token usage, `cs` StyleSheet |
| `PrivacyAlertBanner.tsx` | Full token usage, `pa` StyleSheet |
| `SortByDropdown.tsx` | Full token usage, `sd` StyleSheet |
| `InboxDashboard.tsx` | Full token usage, inline styles |
| `CalendarScreen.tsx` | Full token usage, inline styles |
| `ModelPicker.tsx` | Full token usage |
| `Themed.tsx` | Design token defaults |
| `AILearningScreen.tsx` | Inline styles, design tokens |
| `PrivacyComplianceScreen.tsx` | Inline styles, design tokens |
| `KnowledgeCoverageDashboard.tsx` | Inline styles, design tokens |
| `SentimentTrendsDashboard.tsx` | Inline styles, design tokens |
| `AdvancedTrainingDashboard.tsx` | Inline styles, design tokens |
| `QuickReplyTemplatesScreen.tsx` | Inline styles, design tokens |
| `PropertyKnowledgeScreen.tsx` | Inline styles, design tokens |
| `AutomationsScreen.tsx` | Inline styles, design tokens |
| `AutoPilotSettingsScreen.tsx` | Inline styles, design tokens |
| `LanguageSettingsScreen.tsx` | Inline styles, design tokens |
| `IssueTrackerScreen.tsx` | Inline styles, design tokens |
| `AnalyticsDashboard.tsx` | Inline styles, design tokens |
| `AIProviderSettingsScreen.tsx` | Inline styles, design tokens |
| `UpsellsScreen.tsx` | Inline styles, design tokens |
| `GuestPortal.tsx` | Inline styles, design tokens |
| `PrivacySecurityScreen.tsx` | Inline styles, design tokens |
| `OnboardingScreen.tsx` | Inline styles, design tokens |
| `ApiSettingsScreen.tsx` | Inline styles, design tokens |
| `WebhookSetupScreen.tsx` | Inline styles, design tokens |
| `HelpCenterScreen.tsx` | Inline styles, design tokens |

---

## AI Training Pipeline

### Data Flow

```
Hostaway API
  │
  ├── history-sync.ts ──► Fetch conversations + messages (rate-limited, resumable)
  │
  ├── ai-training-service.ts ──► 3-phase training:
  │     1. Smart sampling (up to 8K messages, stratified by property/intent/length)
  │     2. Style analysis in batches (formality, warmth, phrases, greetings)
  │     3. Response index (all guest→host pairs indexed by intent + keyword)
  │
  ├── ai-learning.ts ──► Style profile → generateStyleInstructions() → LLM prompt
  │
  ├── ai-enhanced.ts ──► Draft generation:
  │     • Style instructions from profile
  │     • searchHistoricalResponses() for similar past Q&A (score ≥ 50 = use as basis)
  │     • incrementalTrainer.queueMessage() on approve/edit
  │
  └── advanced-training.ts ──► Deep training (5 specialized passes):
        • style_tone, intent_mapping, phrase_mining, contextual, edge_cases
        • Property lexicons, temporal weighting, few-shot indexing
```

### Training Optimizations (2026-02-12)

| Optimization | Detail |
|-------------|--------|
| **Edited draft priority** | `ResponsePattern.priority` = `'high'` for edited responses, +15 score bonus in historical recall |
| **Sampling cap** | `maxStyleSampleSize` bumped from 5K → 8K for richer style analysis |
| **Real data wiring** | `AdvancedTrainingDashboard` deep training now uses real store conversations instead of empty mock array |

---

## Commercial Backend Layer (Added 2026-02-14)

> Activated only when `EXPO_PUBLIC_APP_MODE=commercial`. Personal mode ignores this layer entirely.

### Architecture Extension

```
┌─────────────────────────────────────┐
│  src/app/                           │  Entry Layer (existing)
│  src/components/                    │  Presentation Layer (existing)
│  src/lib/                           │  Business Logic Layer (existing)
│  ├── config.ts     (mode flag)      │  - APP_MODE: personal | commercial
│  ├── api-client.ts (server calls)   │  - Auth tokens, typed REST client
├─────────────────────────────────────┤
│  server/                            │  Backend Layer (NEW)
│  ├── src/
│  │   ├── routes/     (API handlers) │  - Express/Hono route handlers
│  │   ├── services/   (business)     │  - AI proxy, billing, PMS adapters
│  │   ├── middleware/  (infra)       │  - Auth, rate-limit, validation
│  │   ├── db/         (data)         │  - Supabase client, schemas, RLS
│  │   ├── adapters/   (PMS)         │  - Hostaway, Guesty, Hospitable
│  │   └── lib/        (shared)       │  - Encryption, types, constants
│  └── supabase/
│      └── migrations/ (SQL)          │  - Schema files, RLS policies
└─────────────────────────────────────┘
```

### 5. Backend Contract

| Rule | Detail |
|------|--------|
| **Naming conventions** | `camelCase` for functions, `PascalCase` for types/interfaces, `kebab-case` for files |
| **File-per-concern** | One route handler per file. No God files. |
| **Types from one source** | Shared types in `server/src/lib/types.ts` — imported by routes & services |
| **Input validation** | Zod schemas on ALL API inputs — no trust of client data |
| **Error handling** | Every route wrapped in try/catch with typed error responses |
| **Environment variables** | ALL secrets in env vars — never in code or DB plaintext |
| **Key encryption** | AES-256-GCM for stored API keys — encryption key in env var |
| **RLS enforced** | Supabase Row-Level Security on every table — users see only their org's data |
| **Rate limiting** | Per-user, per-endpoint — 100 drafts/hour, 1000 API calls/hour |

### 6. PMS Adapter Contract

| Rule | Detail |
|------|--------|
| **Unified interface** | All adapters implement `PMSAdapter` interface (connect, getProperties, getConversations, sendMessage) |
| **Adapter isolation** | Each PMS adapter is a single file in `server/src/adapters/` |
| **No leaking** | PMS-specific types are internal to adapters — route handlers use unified types only |
| **OAuth preferred** | Use OAuth token flow where available — never store raw passwords |

### 7. App Store Submission Contract

| Rule | Detail |
|------|--------|
| **No "coming soon"** | Every navigable screen must be functional or hidden before submission |
| **Account deletion** | Required endpoint: `DELETE /api/account` — Apple enforces this |
| **Test credentials** | Demo account with sample data for Apple review team |
| **Screen recordings** | 30-second recordings of AI features for App Store Connect |
| **Privacy policy URL** | Hosted at `rentalvoice.app/privacy` — linked in app and App Store |
| **No Android references** | iOS App Store description must not mention any other platform |
| **LLM safeguards** | Content filtering on AI outputs — no explicit content passthrough |
| **No hidden features** | Every feature must be accessible during review |

