# Personal Mode as Default Until Intentional Cutover

**Date:** 2026-03-12
**Status:** accepted

## Context
The app has two modes: `personal` (device-first, Hostaway API key onboarding) and `commercial` (server-managed, Supabase auth). Both code paths exist. The founder (Sawyer) is the only user and daily-drives personal mode.

## Decision
Keep `personal` as the default app mode. Do not switch to `commercial` until:
1. Voice accuracy reaches 80%+ (currently ~45%)
2. Learning data is durably synced to Supabase
3. Billing/entitlements are wired and tested

## Alternatives Considered
- **Switch to commercial now**: Would require auth migration, risk breaking daily workflow, and introduce bugs in a flow that has zero users. Rejected.
- **Run both modes simultaneously**: Doubles testing surface for no benefit when there's one user. Rejected.

## Consequences
- Learning data remains at risk of device/container reset until sync is built
- Simpler development — only one mode to keep working
- Commercial mode code stays staged and tested in isolation
- Cutover becomes a deliberate milestone, not an accidental side effect
