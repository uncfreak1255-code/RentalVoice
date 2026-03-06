# Personal to founder migration

This runbook defines the one-way migration from the current personal-mode learning data into the future founder app-auth account.

## Source

- source of truth: current personal local data in the app
- source mode: `personal`
- source identity: Hostaway-scoped local account data

## Destination

- destination mode: `commercial`
- destination identity: future founder app-auth account for `sawyerbeck25@gmail.com`

## Existing implementation base

Rental Voice already has a local-learning snapshot/import pattern:

- local snapshot builder in `/Users/sawbeck/Projects/RentalVoice/src/lib/commercial-migration.ts`
- server import route in `/Users/sawbeck/Projects/RentalVoice/server/src/routes/migration.ts`

The founder migration now uses the same base contract with extra metadata:

- `migrationContractVersion: founder_account_v1`
- `migrationIntent: personal_local_to_founder_account`
- `migrationTargetType: future_founder_app_auth`
- `targetFounderEmail: sawyerbeck25@gmail.com`
- `preservePropertyScope: true`
- `idempotencyKey: <stable-account-id>:<snapshot-id>`

## Included data

- host style profiles
- learning entries / edit patterns
- draft outcomes
- reply deltas
- calibration entries
- conversation flows
- local learning progress metadata

## Safety properties

- one-way import only
- idempotent by stable account id + snapshot id
- checkpointed before cutover
- current personal data remains untouched

## Required order later

1. create a protected baseline
2. create the real founder app-auth account in the chosen live environment
3. authenticate as the founder account
4. build the founder migration snapshot from the current personal local data
5. import into the backend
6. verify status via `/api/migration/local-learning/status`
7. keep the snapshot id and baseline id together for rollback/handoff

## Environment safety gate

`ops/migration/run-controlled-commercial-migration.sh` is intended for the eventual live cutover path.

It now refuses to run unless:

- `SUPABASE_ENV_CLASS=live`
- or `ALLOW_NONLIVE_SUPABASE=true` is set intentionally for a rehearsal

This prevents running founder/commercial cutover steps against the current test-only linked project by accident.
