# Architecture Decision Records (ADRs)

Non-obvious decisions and their reasoning. Each file captures WHY a choice was made so future sessions understand context without re-deriving it.

## Format

```
YYYY-MM-DD-short-title.md
```

Each file:
```markdown
# [Title]

**Date:** YYYY-MM-DD
**Status:** accepted | superseded by [link] | deprecated

## Context
What prompted this decision?

## Decision
What we chose and why.

## Alternatives Considered
What we rejected and why.

## Consequences
What follows from this decision — both good and bad.
```

## Index

- [2026-03-12-per-property-pricing](./2026-03-12-per-property-pricing.md) — Per-property pricing over flat tiers
- [2026-03-12-hostaway-only](./2026-03-12-hostaway-only.md) — Hostaway-only until PMF proven
- [2026-03-12-personal-mode-first](./2026-03-12-personal-mode-first.md) — Personal mode as default until intentional cutover
