# Per-Property Pricing Over Flat Tiers

**Date:** 2026-03-12
**Status:** accepted

## Context
Initial pricing was flat tiers ($29/$79/$149). Adversarial investor review flagged that flat pricing doesn't scale with value delivered — a 1-property host and a 20-property manager would pay the same, leaving money on the table at scale and overcharging small users.

## Decision
Per-property pricing: $29 base + $15/property (Pro), $99 base + $20/property (Business). This aligns revenue with value — more properties = more AI drafts = more value = more revenue.

## Alternatives Considered
- **Flat tiers** ($29/$79/$149): Simple but doesn't scale. Rejected because enterprise users subsidize small users.
- **Per-message pricing**: Too unpredictable for users. Rejected because hosts need cost certainty.
- **Seat-based pricing**: Doesn't map to value delivered (properties, not people). Rejected.

## Consequences
- Revenue scales naturally with customer size
- Month 12 MRR projections more conservative (~$11K vs $22K) due to realistic churn modeling
- Requires usage tracking per property (already built via Hostaway account linking)
- Simpler upgrade path: "add a property" vs "jump to next tier"
