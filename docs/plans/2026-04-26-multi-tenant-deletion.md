# Multi-tenant deletion plan

Date: 2026-04-26
Status: planned (not yet executed)
Triggered by: PR #59 (personal-pivot decision, 2026-04-26)
Prerequisite: PR #59 must merge AND the SDK swap must be validated on at least 3 real Hostaway conversations before this plan runs.

## Goal

Remove every code path that exists to support a public, multi-tenant Rental Voice product. Keep the personal-mode flow fully functional.

This is a deletion-only PR. No new behavior, no refactoring of personal-mode code, no abstraction extraction. Just deletion. The smaller and more obviously-deletes-only the diff is, the easier the safety review.

## Scope

### Server routes to delete

```
server/src/routes/billing.ts
server/src/routes/entitlements.ts
server/src/routes/waitlist.ts
server/src/routes/migration.ts                  (commercial migration only — verify no personal callers)
server/src/routes/founder-diagnostics.ts        (the multi-tenant view; replace with a personal health check if anything reaches it)
server/src/routes/managed-draft-runtime.ts      (server-managed Hostaway path)
```

And remove the `/api/ai-proxy/test-key` handler from `server/src/routes/ai-proxy-personal.ts`. Personal mode does not need a key-test surface — the owner sets `AI_PROXY_TOKEN` directly.

### Server middleware / glue

```
server/src/middleware/entitlements.ts
server/src/middleware/billing.ts                (if it exists separately from entitlements)
server/scripts/bootstrap-founder-account.ts     (founder bootstrap is no longer relevant; the live project is just "the user's account")
```

### Server registrations

In `server/src/index.ts`: drop the `app.route()` calls for every deleted router above. Confirm by running the server with `DEBUG=routes` (or grepping `app.route`) that the personal-mode routes are still registered.

### Mobile client — managed-draft + multi-tenant surfaces

```
src/hooks/useChatDraftEngine.ts:76               managed-draft gating block — delete
src/lib/managed-draft-gating.ts                  whole file — delete
src/lib/api-client.ts:255                         generateAIDraftViaServer — delete
src/lib/ai-keys.ts:243                            key-test surface — delete the test-key call
src/lib/commercial-migration.ts                  whole file — delete
src/components/CommercialUpgradeScreen.tsx       (if it exists) — delete
```

### Mobile client — auth / onboarding cleanup

`src/lib/api-client.ts:setLocalProxyToken` and `clearLocalProxyToken` stay (they're the personal-mode token-paste surface). But the founder-canary auth path can simplify:

- Remove the multi-tenant branches in `getAuthHeaders()` that try Supabase JWT before falling back. Personal mode runs through the local-proxy-token path; the Supabase founder-session restore is no longer load-bearing.
- Decide: keep `loadFounderSession` for backup recovery, or delete and force re-paste of `AI_PROXY_TOKEN`. Recommendation: keep it for now. One less destructive change in this PR.

### Config flag

`src/lib/config.ts`:
- Remove the `commercial` value of `RENTAL_VOICE_MODE`
- Remove `features.commercialOnboarding`
- Keep `features.publicAccountFirstOnboarding` for now since onboarding tests reference it; default it off and note that the whole feature flag system can be simplified in a later pass

### Landing page

```
landing/index.html                               waitlist form section — delete (or replace with a static "this is a personal tool" page)
landing/script.js                                waitlist endpoint logic — delete
```

Keep the file structure but replace the form with a one-line page that explains the project is a personal tool. Or delete the landing/ directory entirely. Recommendation: delete entirely — the landing page exists to convert visitors to waitlist signups, and that's no longer happening.

### Supabase migrations

`server/supabase/migrations/`:
- `008_waitlist_signups.sql` — drop the table in a NEW migration (do not edit historical migrations). The deletion migration is `009_drop_waitlist_signups.sql` in the same dir. Same for the `supabase/migrations/` mirror at the repo root.
- Billing/entitlements tables — same pattern: write a `00X_drop_billing_entitlements.sql` migration; do not touch the historical `add_*` migrations.

Run on `test` first. Apply to the live project only after the personal-mode code is fully deployed and the dropped tables are no longer referenced.

### App Store / TestFlight / EAS

- `eas.json` `submit.production.ios.ascAppId` — leave alone for now (deleting the listing is a separate manual decision in App Store Connect, not a code change)
- Any TestFlight-specific scripts in `scripts/` — list them in the PR and delete

### Status / runbook docs

- `docs/runbooks/founder-bootstrap-*.md` — archive to `docs/runbooks/archive/` (keep history, signal that the path is dead)
- `docs/plans/2026-03-09-app-store-readiness-roadmap.md` — archive
- `docs/plans/2026-03-28-pricing-strategy.md` — archive
- `docs/plans/2026-03-09-founder-app-path-design.md` — archive

### Tests

For every deleted source file, delete its test file. For tests that exercise both deleted and surviving code (e.g., `src/app/__tests__/onboarding.test.tsx` references the `publicAccountFirstOnboarding` flag), adjust to test only the surviving paths.

Run after deletion:
- `npx jest` (mobile) — all green, expect a smaller test count
- `bun --cwd server run typecheck` — clean
- `bunx vitest run` (server tests) — all green, expect a smaller test count

## Order of operations (single PR, multiple commits)

```
1. Delete server route files + drop registrations in server/src/index.ts
2. Delete client managed-draft / multi-tenant surfaces
3. Delete commercial-mode flag and feature switches
4. Delete landing/ waitlist form
5. Write Supabase drop migrations (do not run yet)
6. Delete tests for deleted code
7. Archive obsolete docs
8. Run typecheck + tests; fix any orphaned imports
9. Smoke test: dev variant build, generate one draft on the SDK path, confirm green
10. Open PR; merge after green CI
```

## Out of scope for this plan

- Deleting the live Supabase project itself. Keep `zsitbuwzxtsgfqzhtged` running; it holds personal-user data.
- Sending the waitlist signups any kind of communication. That's a comms decision tracked in `open-risks.md`.
- Removing the App Store Connect listing. Manual decision, not a code change.
- Refactoring the surviving personal-mode code for "elegance." Surgical deletion only; "clean up while we're here" creates exactly the kind of mixed-intent PR that's hard to review.

## Risks

1. **Deleted server route is still called by client.** Mitigation: greppable removal — every deleted route's path is checked against `src/lib/api-client.ts` and friends. CI typecheck catches imports.
2. **Migration drops a table the personal flow still queries.** Mitigation: each drop migration ships with a grep-evidence comment showing zero personal-mode callers. Run on `test` first.
3. **Hidden coupling we don't see.** Mitigation: split the PR into the commits listed above. Each commit is independently revertable.

## Rollback

`git revert <pr-merge-sha>`. The deletion is mechanical; the revert restores everything. If a Supabase migration has been run on live, write a re-add migration rather than trying to roll back the schema.
