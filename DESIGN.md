# Rental Voice Design System

## Language

Apple-native iOS feel. Light liquid-glass surfaces, subtle haptics, airy spacing, oversized headings. Prioritize legibility over density. Humor lives in the copy, not the chrome.

## Tokens

Single source of truth: `src/lib/design-tokens.ts`. Exports `colors`, `typography`, `spacing`, `radius`, `elevation`, `animation`. Everything visual reads from this module — no inline hex, no ad-hoc rem values.

## Components

- **`PremiumPressable`**: a Reanimated `AnimatedPressable` wrapper. **Do not use inside flex layouts** — it causes layout collapse on certain screens. Use plain `Pressable` + `Haptics.impactAsync(ImpactFeedbackStyle.Light)` for those cases.
- **`MessageComposer`**: the draft panel is behind a "Why this?" press — the composer starts collapsed and expands on intent.
- **`ConversationItem`**: inline tags (`Inquiry`, etc.) are conditional on the conversation state, not always rendered.
- **Section group headers**: Apple-style breathing room — top padding at `spacing.6`, muted caption, all-caps tracking.

## Patterns

- **Cold-start cost**: avoid `await` on onboarding resolve paths — every extra promise adds a visible spinner. The SAW-8 work (merged PR #52) removed a wasted `restoreAccountSession()` on the Hostaway-first path. Don't reintroduce it.
- **List screens**: sticky header + compact nav + Apple-style group headers. Reference: Property Knowledge redesign.
- **Feedback**: haptics on every tap that changes state. Visual feedback under 100ms or the thing feels broken.
- **Text**: DM Sans for body, system stack for fallbacks. No ALL CAPS except in section-group captions.

## Simulator / dev tips

- Navigation via deep links works: `exp+rental-voice:///settings`
- Tap automation requires assistive access
- See `docs/runbooks/` for the iOS Simulator workflow

## Reference

- Skill with broader design principles: `.claude/skills/frontend-app-design/SKILL.md`
- Brand guidelines (if needed in Anthropic-facing assets): global `brand-guidelines` skill
- Visual review tooling: `.claude/skills/review-app/SKILL.md`
