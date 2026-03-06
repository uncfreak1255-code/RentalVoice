# Protected local baseline

This runbook defines the current source of truth for Rental Voice while commercialization remains staged.

## Current contract

- Canonical source: local workspace at `/Users/sawbeck/Projects/RentalVoice`
- Current user-facing mode: `personal`
- Current onboarding/login UX: Hostaway Account ID + API key
- GitHub remote: behind local, not canonical
- Current Supabase projects:
  - `gqnocsoouudbogwislsl`: linked project with test/smoke app users
  - `cqbzsntmlwpsaxwnoath`: separate project with no app auth users
- Real founder/live app-auth environment: not chosen yet
- Current local server env should explicitly declare:
  - `SUPABASE_ENV_CLASS=test`
  - `SUPABASE_PROJECT_REF=gqnocsoouudbogwislsl`
  - `SUPABASE_PROJECT_LABEL=Rental Voice`

## Create the protected baseline

Run:

```bash
npm run ops:baseline:protect -- --checkpoint-id protected-local-baseline-<timestamp>
```

Artifacts created:

- database dump in `ops/checkpoints/`
- checkpoint manifest in `ops/manifests/<checkpoint-id>.json`
- protected baseline manifest in `ops/manifests/<checkpoint-id>.baseline.json`

## What the baseline protects

- current Hostaway-first personal-mode UX
- device-local PMS behavior in personal mode
- current local learning data as the source for later founder migration
- current local workspace as the rollback anchor until GitHub promotion is done

## What this runbook forbids

- making commercial mode the default app path
- assuming either current Supabase project is the future founder/live environment
- treating the Supabase dashboard GitHub login as the app founder identity

## Before any risky change

1. create a new protected baseline
2. verify the manifest and checkpoint
3. confirm `currentAppMode` remains `personal`
4. confirm no visible email/password auth was introduced into the current app path
5. confirm the baseline manifest still labels the linked project as non-live/test
