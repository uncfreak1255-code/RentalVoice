---
description: Supabase CLI workflow for the currently linked Rental Voice project
---

# Rental Voice Supabase Workflow

Use this workflow when working with the currently linked Supabase project for Rental Voice.

## Current linked project

- Project ref: `gqnocsoouudbogwislsl`
- URL: `https://gqnocsoouudbogwislsl.supabase.co`
- Region: `us-east-1`
- Server env file: `/Users/sawbeck/Projects/RentalVoice/server/.env`

## Network note

Use `--dns-resolver https` with the Supabase CLI on this machine if the normal network path has IPv6 resolution issues.

## Common commands

Project list:

```bash
cd /Users/sawbeck/Projects/RentalVoice
supabase projects list --dns-resolver https
```

Push linked migrations:

```bash
cd /Users/sawbeck/Projects/RentalVoice
supabase db push --dns-resolver https
```

List migrations:

```bash
cd /Users/sawbeck/Projects/RentalVoice
supabase migration list --dns-resolver https
```

Create a migration:

```bash
cd /Users/sawbeck/Projects/RentalVoice
supabase migration new <migration_name>
```

Generate types:

```bash
cd /Users/sawbeck/Projects/RentalVoice
supabase gen types typescript --linked --dns-resolver https > server/src/db/database.types.ts
```

## Boundary

This workflow is for the currently linked project only.

It does not mean that this project is the future founder/live app-auth environment.
