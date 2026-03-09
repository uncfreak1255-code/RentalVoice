# Ops toolkit

Operational scripts for checkpointing, rollback, migration, drills, and staged founder/bootstrap workflows.

## Environment expectations

Required for backup/restore tooling:

- `DATABASE_URL`: Postgres URL for backup/restore
- `pg_dump`
- `pg_restore`
- `shasum`

Founder/live tooling additionally depends on:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ENV_CLASS`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_PROJECT_LABEL`

## Core commands

- create checkpoint:
  - `npm run ops:checkpoint -- --checkpoint-id <id>`
- verify checkpoint:
  - `npm run ops:checkpoint:verify -- --checkpoint-id <id>`
- create protected baseline:
  - `npm run ops:baseline:protect -- --checkpoint-id <id>`
- fast rollback:
  - `npm run ops:rollback:fast -- --checkpoint-id <id>`
- restore DB manually:
  - `npm run ops:restore:db -- --checkpoint-id <id>`
- restore drill:
  - `npm run ops:drill -- --checkpoint-id <id>`

## Controlled commercial migration

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

## Founder bootstrap (staged, not default current app UX)

The real founder backend account now exists, but current app UX still does not use founder auth as the default visible login path.

Current Supabase founder truth:

- linked local default `test` project: `gqnocsoouudbogwislsl`
- forbidden non-live founder targets: `gqnocsoouudbogwislsl`, `cqbzsntmlwpsaxwnoath`
- dedicated live founder target: `zsitbuwzxtsgfqzhtged` (`Rental Voice Live`)
- real founder backend account exists for `sawyerbeck25@gmail.com`

Use founder ops commands deliberately:

- generate live-readiness checklist:
  - `npm run ops:founder:checklist`
- generate founder bootstrap packet:
  - `npm run ops:founder:packet`
- validate live environment:
  - `npm run ops:founder:preflight`
- validate non-live rehearsal environment:
  - `npm run ops:founder:preflight:rehearsal`
- dry run bootstrap:
  - `npm run ops:founder:bootstrap`

Do not rerun founder bootstrap execute casually. Treat the live founder account as persistent canary data.

## Baseline note for this machine

- Homebrew `libpq` is installed and provides `pg_dump`
- the `protected-local-baseline-20260309-founder-live-execute` checkpoint was created using a temporary Supabase CLI login credential for the linked test database immediately before founder bootstrap execute
