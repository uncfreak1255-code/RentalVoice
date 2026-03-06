---
globs: src/**/*.tsx, src/**/*.ts
---

# Frontend Rules (src/)

## Styling
- ALL colors, spacing, typography, radii, shadows from `src/lib/design-tokens.ts`
- NO hardcoded colors (`#fff`, `#000`, `rgb(...)`, etc.)
- NO `className=` — NativeWind is legacy
- Use `StyleSheet.create` with design tokens or inline styles
- Font: DM Sans via `typography.fontFamily.*` tokens

## Components
- Screen components MUST accept `onBack: () => void`
- Props interfaces required — no `any` types
- Use `memo()` for list items rendered in FlatList/FlashList
- Use `useMemo`/`useCallback` for expensive computations
- No component definitions inside render bodies
- Prefer `src/components/ui/*` primitives (Avatar, Badge, Card, Skeleton, etc.)

## State
- Import types from `@/lib/store` (Conversation, Message, Guest, Property, etc.)
- Individual selectors: `useAppStore((s) => s.field)` — NEVER select entire store
- `conversation.status`: `'active' | 'archived' | 'urgent'`
- `conversation.workflowStatus`: `'inbox' | 'todo' | 'follow_up' | 'resolved' | 'archived'`

## Files
- `kebab-case.ts` for all files
- Path alias: `@/` maps to `src/`
