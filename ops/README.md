# Ops safety commands (backup + rollback)

This folder contains the first production safety layer for RentalVoice:

- checkpoint creation (database backup + manifest)
- protected local baseline creation (checkpoint + verification + foundation manifest)
- checkpoint verification (checksum + remote object existence)
- fast rollback (kill switches + deploy rollback hooks)
- database restore from checkpoint
- restore drill for staging
- staged founder bootstrap tooling for the future real live environment

## Required environment variables

- `DATABASE_URL`: Postgres URL for backup/restore
- `SUPABASE_ENV_CLASS`: Environment classification (`test`, `staging`, `live`, etc.)
- `SUPABASE_PROJECT_REF`: Supabase project ref used by the current server environment
- `SUPABASE_PROJECT_LABEL`: Human-readable Supabase project label
- `BACKUP_BUCKET`: Optional S3 destination (example: `s3://my-bucket/rentalvoice/checkpoints`)
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`: Needed when `BACKUP_BUCKET` is set
- `BACKUP_ENCRYPTION_KEY`: Optional AES key for encrypted dumps

## Optional rollback variables

- `FEATURE_FLAG_WEBHOOK_URL`: Endpoint to set rollback-safe flags
- `FEATURE_FLAG_WEBHOOK_TOKEN`: Optional bearer token
- `PREVIOUS_SERVER_RELEASE_CMD`: Command that deploys previous server release
- `PREVIOUS_EXPO_UPDATE_CMD`: Command that points Expo updates to previous stable group

## Optional controlled migration variables

- `APPLY_DB_MIGRATIONS_CMD`: Command to apply schema migrations
- `DEPLOY_SERVER_RELEASE_CMD`: Command to deploy the new server release
- `LOCAL_LEARNING_IMPORT_CMD`: Command to run local-to-commercial learning import
- `POST_DEPLOY_SMOKE_CMD`: Command to run checkpoint smoke checks after deploy
- `AUTO_ROLLBACK_ON_FAILURE`: `true` (default) or `false`

## Commands

- `npm run ops:checkpoint`
- `npm run ops:checkpoint:verify -- --checkpoint-id <id>`
- `npm run ops:baseline:protect -- --checkpoint-id protected-local-baseline-<timestamp>`
- `npm run ops:rollback:fast -- --checkpoint-id <id>`
- `npm run ops:restore:db -- --checkpoint-id <id> --yes`
- `npm run ops:drill -- --checkpoint-id <id>`
- `npm run ops:migration:controlled -- --checkpoint-id <id>`
- `npm run ops:founder:bootstrap`

## Safe default workflow per release

1. Create checkpoint:
   - `npm run ops:checkpoint -- --checkpoint-id pre-release-<timestamp>`
2. Verify checkpoint:
   - `npm run ops:checkpoint:verify -- --checkpoint-id pre-release-<timestamp>`
3. Ship release.
4. If needed, run fast rollback:
   - `npm run ops:rollback:fast -- --checkpoint-id pre-release-<timestamp>`
5. Restore DB only if required:
   - `npm run ops:restore:db -- --checkpoint-id pre-release-<timestamp> --yes`

## Protect the current local app as canonical

Use this before any GitHub promotion, auth cutover, or founder bootstrap work:

- `npm run ops:baseline:protect -- --checkpoint-id protected-local-baseline-<timestamp>`

This does three things:

1. creates the database checkpoint
2. verifies the checkpoint
3. writes a protected baseline manifest at `ops/manifests/<checkpoint-id>.baseline.json`

The checkpoint manifest now also records:

- local workspace as canonical source
- git branch / dirty counts
- current app mode default
- linked Supabase project ref
- Expo / EAS project metadata
- known current-state environment truths

This is the rollback anchor while GitHub remains behind local.

## Controlled migration order (automated)

Run exact cutover order with rollback hook:

- `npm run ops:migration:controlled -- --checkpoint-id pre-commercial-cutover`

Execution order:

1. create checkpoint
2. verify checkpoint
3. apply DB migrations (`APPLY_DB_MIGRATIONS_CMD`, optional)
4. deploy server (`DEPLOY_SERVER_RELEASE_CMD`, optional)
5. run local-learning import (`LOCAL_LEARNING_IMPORT_CMD`, optional)
6. run post-deploy smoke (`POST_DEPLOY_SMOKE_CMD`, optional)

If any step fails and `AUTO_ROLLBACK_ON_FAILURE` is not set to `false`, fast rollback runs automatically.

## Future founder bootstrap (staged, not for current personal mode)

The founder app-auth account does not exist yet in either current Supabase project.

Use the staged bootstrap script only after a real live environment is chosen and the correct Supabase service-role credentials are configured:

- dry run:
  - `npm run ops:founder:bootstrap`
- execute intentionally:
  - `npm run ops:founder:bootstrap -- --execute --yes --password '<temporary-password>'`

The bootstrap script is idempotent and is designed to:

1. create or reuse the founder auth user
2. create the `users` row
3. create the organization and owner membership
4. create `org_settings`
5. create managed `ai_configs`
6. seed `org_entitlements`
7. emit the founder env vars that still need to be set

Keep this staged until the real live environment exists and personal-mode data is ready to migrate one-way into that founder account.
