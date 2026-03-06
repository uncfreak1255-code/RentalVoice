# Founder live readiness

This runbook defines the non-destructive checklist artifact for the future live founder environment.

## Purpose

Before the founder app-auth account is created, Rental Voice should be able to produce one manifest that answers:

- which environment is currently configured
- whether it is live or non-live
- whether the configured project ref is forbidden
- whether the required founder env keys are present
- which commands should be run next

## Generate the checklist

```bash
npm run ops:founder:checklist
```

This writes a manifest to `ops/manifests/founder-live-readiness-<timestamp>.json`.

## What the checklist contains

- founder target email
- current Supabase environment metadata
- required env contract for a future live founder environment
- forbidden project refs
- current founder env values, if present
- readiness summary booleans
- bootstrap commands
- post-bootstrap validation endpoints
- migration prerequisites

## Expected current result

Right now, this checklist should show:

- `SUPABASE_ENV_CLASS=test`
- project ref `gqnocsoouudbogwislsl`
- `readyForFounderBootstrapExecute=false`

That is the correct result because the current linked project is still a non-live test environment.
