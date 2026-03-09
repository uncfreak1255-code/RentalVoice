# Protected local baseline

This runbook defines the current source of truth for Rental Voice while commercialization remains staged.

## Current contract

- Canonical source: local workspace at `/Users/sawbeck/Projects/RentalVoice`
- Current user-facing mode: `personal`
- Current onboarding/login UX: Hostaway Account ID + API key
- GitHub remote: behind local, not canonical
- Current Supabase projects:
  - `gqnocsoouudbogwislsl`: linked `test` project with test/smoke app users
  - `cqbzsntmlwpsaxwnoath`: legacy non-live project with no app auth users
  - `zsitbuwzxtsgfqzhtged`: dedicated `live` founder target with Rental Voice schema applied
- Current local server env should explicitly declare:
  - `SUPABASE_ENV_CLASS=test`
  - `SUPABASE_PROJECT_REF=gqnocsoouudbogwislsl`
  - `SUPABASE_PROJECT_LABEL=Rental Voice`
- Live founder env should stay in the local-only file:
  - `/Users/sawbeck/Projects/RentalVoice/server/.env.live.local`

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
- current linked `test` environment as the safe default runtime
- current local workspace as the rollback anchor until GitHub promotion is done

## What this runbook forbids

- making commercial mode the default app path
- treating the linked `test` project as the founder/live environment
- treating the Supabase dashboard GitHub login as the app founder identity
- using `Rental Voice Live` as a casual development sandbox

## Before any risky change

1. create a new protected baseline
2. verify the manifest and checkpoint
3. confirm `currentAppMode` remains `personal`
4. confirm no visible email/password auth was introduced into the default app path
5. confirm the baseline manifest still labels the linked project as non-live/test

## Live-founder execution note

- as of `2026-03-09`, fresh baseline creation is blocked on this machine because `pg_dump` is not installed
- existing protected baselines are planning anchors only
- do not execute founder bootstrap live until PostgreSQL client tooling is installed and a fresh baseline is created immediately before the execute step
