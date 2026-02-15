---
description: Supabase CLI commands for Rental Voice project (ref gqnocsoouudbogwislsl)
---

# Supabase Workflow

> **IMPORTANT:** Always use `--dns-resolver https` flag — user's network doesn't support IPv6.

## Quick Reference

// turbo-all

1. **Check project status:**
```bash
cd /Users/sawbeck/Downloads/RentalVoice && supabase projects list --dns-resolver https
```

2. **Apply new migrations:**
```bash
cd /Users/sawbeck/Downloads/RentalVoice && supabase db push --dns-resolver https
```

3. **Regenerate TypeScript types after schema changes:**
```bash
cd /Users/sawbeck/Downloads/RentalVoice && supabase gen types typescript --linked --dns-resolver https > server/src/db/database.types.ts
```

4. **Create a new migration file:**
```bash
cd /Users/sawbeck/Downloads/RentalVoice && supabase migration new <migration_name>
```

5. **Check migration status:**
```bash
cd /Users/sawbeck/Downloads/RentalVoice && supabase migration list --dns-resolver https
```

## Project Details
- **Ref:** `gqnocsoouudbogwislsl`
- **URL:** `https://gqnocsoouudbogwislsl.supabase.co`
- **Region:** us-east-1
- **Dashboard:** https://supabase.com/dashboard/project/gqnocsoouudbogwislsl
- **Server .env:** `/Users/sawbeck/Downloads/RentalVoice/server/.env`
