---
name: deploy
description: Deploy Rental Voice app and server components
---

# Deploy — Rental Voice

## Canonical Source of Truth

Local workspace at `/Users/sawbeck/Projects/RentalVoice` is canonical. GitHub remote is behind local and should not be treated as canonical until controlled promotion.

## Pre-Deploy Checklist

1. Read `docs/status/current-state.md` and `docs/status/open-risks.md`
2. Confirm `server/.env` is pointed at test project (not live)
3. Confirm no uncommitted secrets or env files
4. Run `npx tsc --noEmit` in both root and `server/`
5. Run tests: `npx jest --passWithNoTests`
6. Verify protected baseline is current (see `docs/runbooks/protected-local-baseline.md`)

## Server Deploy (Hono on Railway/Vercel)

```bash
cd /Users/sawbeck/Projects/RentalVoice/server
npx tsc --noEmit
# Deploy via connected platform CLI or git push to deploy branch
```

## Mobile App (Expo/EAS)

```bash
cd /Users/sawbeck/Projects/RentalVoice
npx expo prebuild --clean
eas build --platform ios --profile preview
# or for production:
eas build --platform ios --profile production
eas submit --platform ios
```

## GitHub Promotion

Follow `/docs/runbooks/local-canonical-promotion.md` exactly. Never force push.

## Live Founder Environment

Only use `server/.env.live.local` for deliberate live validation. See `docs/runbooks/supabase-environment-workflow.md`.

## Rollback

Reference the latest protected baseline in `ops/manifests/`. Follow `docs/runbooks/protected-local-baseline.md`.
