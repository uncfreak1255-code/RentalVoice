# Founder bootstrap

This runbook is for the future founder app-auth account only.

## Current truth

- `sawyerbeck25@gmail.com` is not present as an app-auth user in either current Supabase project.
- Supabase dashboard login via GitHub/passkey is unrelated to app-user auth.
- The founder account must be created intentionally in the future chosen live environment.

## Goal

Create a real founder app-auth account and org while leaving the current personal-mode app untouched.

## Dry run

```bash
npm run ops:founder:bootstrap
```

This writes a manifest describing what would be created and which founder env vars still need to be configured.
The dry run can execute in non-live environments, but the manifest should record the environment class and project ref so it is obvious when the rehearsal is happening in test or smoke only.

## Execute later in the chosen live environment

```bash
npm run ops:founder:bootstrap -- --execute --yes --password '<temporary-password>'
```

Execution is blocked unless:

- `SUPABASE_ENV_CLASS=live`
- or `ALLOW_NONLIVE_SUPABASE=true` is set intentionally for a rehearsal

## What the bootstrap creates

1. auth user for `sawyerbeck25@gmail.com`
2. `users` row with base plan `starter`
3. organization
4. owner membership in `org_members`
5. default `org_settings`
6. managed `ai_configs`
7. `org_entitlements` seeded for the founder effective plan

## Founder env contract

The script emits the values that still need to be set on the server:

- `FOUNDER_EMAILS`
- `FOUNDER_PLAN_OVERRIDE`
- `FOUNDER_BILLING_BYPASS`

Those env vars are what activate:

- founder effective plan
- founder diagnostics access
- founder billing bypass

Recommended environment metadata to set alongside them:

- `SUPABASE_ENV_CLASS`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_PROJECT_LABEL`

## Validation after bootstrap

Verify these endpoints with the founder session:

- `GET /api/auth/me`
- `GET /api/billing/status`
- `GET /api/entitlements/current`
- `GET /api/analytics/founder-diagnostics`
