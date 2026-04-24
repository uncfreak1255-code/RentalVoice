# TODOs — Rental Voice

Last updated: 2026-04-22

## Active

- [ ] Wire `autoProvisionIdentity` into `setStableAccountId` store setter so Hostaway-first users get a Rental Voice session as soon as the stable ID is resolved (belt-and-suspenders with the lazy trigger added in PR #55).
- [ ] Add `AI_PROXY_TOKEN` secret to production server env once PR #55 lands.
- [ ] Backfill `landing/index.html` `data-waitlist-endpoint` attribute once PR #53 ships the `/api/waitlist` route in production.
- [ ] Reconcile `server/src/middleware/rate-limit.ts` between #53 and #55 when merging. #55 now exposes a `keyGenerator?` option that #53's `waitlistRateLimit` already uses — merge is trivial, but verify no double-refactor.
- [ ] Verify auto-provision reliability on cold-start offline path — if it fails silently, AI drafts still 401 until next launch.

## Parked

- [ ] Multi-PMS support (Guesty, etc.) — parked until product-market fit proven.
- [ ] Stripe LLM Token Billing (private preview) — investigate when building the in-app upgrade flow.
- [ ] Honeypot / Turnstile on landing waitlist form — 5/hr IP rate-limit is fine for honest traffic; revisit when spam starts.
- [ ] Split PR #53's `server/package-lock.json` churn (rolldown/vite dev-dep bumps) into a separate chore PR before merge, or accept the broader surface area.

## Recently done

See `CHANGELOG` and `docs/status/current-state.md`.
