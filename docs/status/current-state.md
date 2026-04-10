# Rental Voice current state

Last updated: 2026-04-10

## Canonical source of truth

- Canonical repo truth: GitHub `main` / `origin/main`
- Primary local sync checkout: `/Users/sawbeck/Projects/RentalVoice`
- Local `main` should normally be fast-forwarded to `origin/main` before new feature work starts
- Current pushed canonical HEAD should be checked with `git rev-parse --short origin/main`
- Feature work should happen on isolated branches or worktrees and becomes canonical only after merge

## Current product truth

- Current user-facing mode: `personal`
- Current visible onboarding/auth flow: Hostaway Account ID + API key
- Target durable identity architecture: Rental Voice account first, Hostaway connection second
- Current visible UX must remain Hostaway-first until an explicit cutover
- Commercial mode remains staged and non-default
- Founder canary auth now exists inside the app without changing the default public flow
- Verified founder sessions can now use managed server drafts in chat while the app still runs in personal mode by default

## Current Supabase truth

- Linked project in local server env:
  - `SUPABASE_PROJECT_LABEL="Rental Voice"`
  - `SUPABASE_PROJECT_REF=gqnocsoouudbogwislsl`
  - `SUPABASE_ENV_CLASS=test`
- Known non-live / forbidden founder bootstrap targets:
  - `gqnocsoouudbogwislsl`
  - `cqbzsntmlwpsaxwnoath`
- Dedicated live founder project:
  - `SUPABASE_PROJECT_LABEL="Rental Voice Live"`
  - `SUPABASE_PROJECT_REF=zsitbuwzxtsgfqzhtged`
  - Rental Voice schema is applied there
  - local live env file exists at `/Users/sawbeck/Projects/RentalVoice/server/.env.live.local`
- Normal development must continue on the linked `test` project unless the task explicitly requires controlled live validation

## Founder/auth truth

- The live founder backend account now exists for `sawyerbeck25@gmail.com`
- Founder bootstrap execute completed successfully on `2026-03-09`
- Validated live founder state:
  - auth sign-in succeeded with the stored local founder password
  - `users` row exists
  - owner membership exists
  - `org_settings` row exists
  - `org_entitlements` row exists with `plan_tier=enterprise`
- Current founder backend identifiers:
  - founder user id: `502b3aa7-0793-458f-881d-3929a859ab6b`
  - founder org id: `600c7934-8e01-425f-a60c-14c5e7b5c36c`
- Founder Access screen now supports:
  - passwordless email-code sign-in
  - secure founder session restore with live validation
  - verified personal-to-founder learning migration
  - explicit founder sign-out
- Founder auth is now app-ready as a canary path, not as the default visible login path
- Future durable user path should be: `Sign in to Rental Voice` -> `Connect Hostaway` -> `Sync and learn`

## Safety / rollback truth

- Protected baseline rollback anchors currently available:
  - `protected-local-baseline-20260305`
  - `protected-local-baseline-20260306-head-d052d2b`
  - `protected-local-baseline-20260306-head-34fb528`
  - `protected-local-baseline-20260309-founder-live-execute`
- Founder readiness artifacts currently available:
  - `founder-live-readiness-20260309T230538Z`
  - `founder-bootstrap-packet-20260309T230538Z`
  - `founder-bootstrap-20260309T230555Z`
  - `founder-bootstrap-20260309T233411Z`
- `pg_dump` is now available locally via Homebrew `libpq`
- The founder bootstrap execute step now has a fresh protected baseline immediately before it

## Implemented commercialization foundation

- Billing, entitlements, analytics, and founder diagnostics routes exist server-side
- Founder diagnostics surface environment truth and readiness state
- Server-managed Hostaway paths for staged commercial flows exist
- Local-to-commercial / personal-to-founder migration base exists
- Founder canary migration now verifies the imported snapshot before marking the app-side state complete
- Founder-managed draft generation now routes through the server runtime gate when a verified founder session exists
- Founder bootstrap, live preflight, rehearsal preflight, and live-readiness checklist tooling exist
- Founder bootstrap packet generator exists
- Dedicated live founder project exists and now contains the real founder backend account

## Voice pipeline bug resolution (2026-03-14)

All 6 pipeline bugs from the 2026-03-12 audit are now resolved:

- Few-shot truncation removed (was 800/1200 chars, now full examples)
- Minimum quality threshold added to few-shot selection (score >= 30)
- Temporal weights integrated into few-shot scoring
- Calibration bucketing confirmed already fixed (41-69% approved = underconfident)
- Server confidence confirmed correct (returns null, client scores)
- MultiPass results confirmed consumed (phrases injected into prompts, confidence adjustment applied)

## Instant Voice Match (2026-03-16)

Semantic voice matching implemented on branch `feat/instant-voice-match`:

- **Database:** `voice_examples` table with pgvector HNSW index, dedup index, RLS policy, `match_voice_examples` RPC — applied to both Test and Live Supabase
- **Server:** Gemini embedding service (`server/src/services/embedding.ts`), voice routes (`/api/voice/query`, `/api/voice/import`, `/api/voice/learn`) in `server/src/routes/voice.ts`
- **Client:** `src/lib/semantic-voice-index.ts` — query, learn, local LRU cache, offline fallback to FewShotIndexer
- **Integration:** `buildSystemPromptWithEditLearning()` tries semantic first, falls back to keyword. `learnFromSentMessage()` dual-writes to both indexes.
- **Bulk import:** 1,154 voice examples imported to Live from 6 months of Hostaway conversations via `server/scripts/direct-bulk-import-voice.ts`
- **Pending:** Evaluation blocked on expired Google AI API key. Need fresh key before promptfoo eval or semantic query will work.

## Sync banner fix (2026-03-16)

- Fixed stuck "Background sync is running" banner (3+ days) — `onError` callback in `auto-import.ts` now clears `isSyncing` flag and shows "Sync paused" with error message
- OTA update deployed to phone

## Current engineering rule

Before risky work:

1. refresh or reference the protected baseline
2. preserve personal-mode UX
3. keep `/Users/sawbeck/Projects/RentalVoice/server/.env` pointed at `test`
4. use `/Users/sawbeck/Projects/RentalVoice/server/.env.live.local` only for deliberate live-founder validation or promotion work
5. do not recreate or overwrite the live founder account casually
6. do not treat live as a casual development sandbox
