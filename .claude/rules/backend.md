---
globs: server/**/*.ts
---

# Backend Rules (server/)

## Code Style
- `camelCase` for functions, `PascalCase` for types/interfaces, `kebab-case` for filenames
- One route handler per file — no God files
- Runtime: Bun (not Node)

## API Safety
- Zod schemas on ALL API inputs — no unvalidated request bodies
- Every route wrapped in try/catch with typed error responses
- Rate limiting via `server/src/middleware/rate-limit.ts`
- Draft limiting via `server/src/middleware/draft-limit.ts`

## Security
- AES-256-GCM for stored API keys (`server/src/lib/encryption.ts`)
- Supabase RLS enabled on every table — no direct queries bypassing RLS
- Never log or expose API keys, tokens, or credentials
- Auth middleware on all non-public routes

## PMS Adapters
- All PMS integrations go through the adapter pattern in `server/src/adapters/`
- Base interface in `server/src/adapters/pms-adapter.ts`
- Currently supported: Hostaway, Guesty, Lodgify

## Database
- Migrations in `server/supabase/migrations/`
- Types generated in `server/src/db/database.types.ts`
- Client in `server/src/db/supabase.ts`
