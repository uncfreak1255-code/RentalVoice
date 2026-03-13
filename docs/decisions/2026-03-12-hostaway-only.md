# Hostaway-Only Until PMF Proven

**Date:** 2026-03-12
**Status:** accepted

## Context
Multi-PMS support (Guesty, Lodgify, etc.) is a frequent feature request and obvious growth lever. Architecture could support it — the Hostaway integration is behind an adapter pattern.

## Decision
Stay Hostaway-only until product-market fit is proven with paying users. Multi-PMS adapters are a Phase 3+ concern.

## Alternatives Considered
- **Build Guesty adapter now**: Doubles addressable market but splits engineering focus before core voice quality is proven. Rejected.
- **Abstract PMS layer first**: Clean architecture but YAGNI — we don't know what other PMS APIs look like in practice. Rejected.

## Consequences
- Addressable market limited to Hostaway users (~50K properties)
- Engineering focus stays on voice accuracy (the actual differentiator)
- When we do add PMSes, the adapter pattern in `src/lib/hostaway/` provides the template
- Risk: if Hostaway ships competitive AI messaging, we have single-vendor dependency
