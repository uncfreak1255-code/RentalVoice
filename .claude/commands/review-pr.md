---
description: Review code changes for RentalVoice coding standards
model: sonnet
---

Review the current staged/unstaged changes against RentalVoice coding standards:

1. Run `git diff` and `git diff --cached` to see all changes.

2. Check each changed file against these rules:

   **Styling**:
   - No hardcoded colors (`#FFFFFF`, `#000`, `rgb(...)` etc.) — must use design tokens
   - No `className=` usage — NativeWind is legacy
   - Font family must use `typography.fontFamily.*` tokens
   - All spacing/radii/shadows from design tokens

   **Components**:
   - Screen components accept `onBack: () => void`
   - Props interfaces defined — no `any` types
   - `memo()` on list items, `useMemo`/`useCallback` for expensive ops
   - No component definitions inside render bodies
   - Using `@/components/ui/*` primitives where applicable

   **State**:
   - Individual Zustand selectors: `useAppStore((s) => s.field)` — not entire store
   - Types imported from `@/lib/store`

   **Backend**:
   - Zod schemas on API inputs
   - try/catch with typed error responses
   - One handler per route file

   **General**:
   - `kebab-case.ts` file names
   - No over-engineering or unnecessary abstractions
   - No security vulnerabilities (injection, XSS, exposed secrets)

3. Report issues grouped by severity (blocking, warning, suggestion).
