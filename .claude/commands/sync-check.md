---
description: Verify Hostaway PMS sync health and diagnose issues
model: sonnet
---

Check the health of Hostaway PMS synchronization. Investigate:

1. Read `src/lib/hostaway.ts` and `src/lib/history-sync.ts` to understand the current sync flow.

2. Check for common issues:
   - OAuth token refresh patterns in `hostaway.ts`
   - Rate limiting compliance (Hostaway API limits)
   - Resumable sync state in `history-sync.ts`
   - PMS adapter abstraction in `src/lib/pms/`

3. If the user reports a specific error, trace it through:
   - `src/lib/pms/hostaway-adapter.ts` — Adapter layer
   - `src/lib/pms/pms-provider.ts` — Provider abstraction
   - `src/lib/hostaway-utils.ts` — Utility functions
   - `server/src/routes/hostaway.ts` — Server proxy (commercial mode)

4. Check the store for sync-related state: `src/lib/store.ts`

5. Suggest fixes with proper error handling. Ensure rate limiting is respected.
