# Rental Voice current state

Last updated: 2026-04-26

## Strategic direction

**Personal-use tool, single user.** As of 2026-04-26, Rental Voice is no longer a public-distribution product. It runs on the owner's own infrastructure, serves the owner's own Hostaway listings, and routes AI drafts through the owner's Claude Pro/Max subscription via the Claude Agent SDK.

The pivot decision is recorded in PR #59 and supersedes everything that previously described commercial mode, App Store distribution, public account-first onboarding, and multi-tenant infrastructure as the target state. Those paths are deprecated pending deletion in a follow-up branch.

## Canonical source of truth

- Canonical repo truth: GitHub `main` / `origin/main`
- Primary local sync checkout: `/Users/sawbeck/Projects/RentalVoice`
- Local `main` should normally be fast-forwarded to `origin/main` before new feature work starts
- Feature work happens on isolated branches or worktrees and becomes canonical only after merge

## Current product truth

- User-facing mode: `personal` (single-user, owner-only)
- Visible onboarding/auth flow: Hostaway Account ID + API key (unchanged for now; multi-tenant deletion will simplify this further)
- AI draft path: client builds prompt → server `ai-proxy-personal.ts` routes to upstream provider
- AI provider on the Anthropic path: Claude Agent SDK with the host machine's Claude Code OAuth login (when `USE_CLAUDE_SUBSCRIPTION=1`); falls back to Anthropic API key when the flag is off
- Network: phone reaches the owner's local server over Tailscale; ATS exception is set per-tailnet via the `Rental Voice (Dev)` build variant; `RENTAL_VOICE_TAILNET_DOMAIN` and `EXPO_PUBLIC_API_BASE_URL` are EAS secrets, not committed

## Deprecated, pending deletion

The following infrastructure was built for the public-product direction and is scheduled for removal in a separate PR after the SDK swap is validated on real conversations:

- Server-managed billing routes
- Server-managed entitlements routes
- Founder-canary multi-tenancy abstractions (the live project at `zsitbuwzxtsgfqzhtged` itself stays as personal-user state; the multi-tenant code wrapping it goes away)
- Waitlist capture endpoint and landing page form
- Dual-PMS adapters (anything not Hostaway-personal)
- Server-managed Hostaway routes (`useChatDraftEngine.ts:76`, `managed-draft-gating.ts`, `api-client.ts:255` `generateAIDraftViaServer`, `ai-keys.ts:243`, `/api/ai-proxy/test-key`)
- Commercial-mode flag and the `commercial` value of `RENTAL_VOICE_MODE`
- App Store / TestFlight submission tooling

The deletion plan lives at `docs/plans/2026-04-26-multi-tenant-deletion.md`.

## Supabase truth

- Linked project for normal local dev: `gqnocsoouudbogwislsl` ("Rental Voice", `test`)
- Personal-user backend account: `zsitbuwzxtsgfqzhtged` ("Rental Voice Live") — previously framed as a founder canary, now persistent personal state for `sawyerbeck25@gmail.com`
- Forbidden bootstrap targets remain forbidden: `gqnocsoouudbogwislsl`, `cqbzsntmlwpsaxwnoath`
- Do not casually rerun bootstrap against `zsitbuwzxtsgfqzhtged` — it holds real working data
- `/Users/sawbeck/Projects/RentalVoice/server/.env` stays pointed at `test` for normal dev
- `/Users/sawbeck/Projects/RentalVoice/server/.env.live.local` is the local-only personal-account env file

## Voice pipeline (unchanged)

All 6 pipeline bugs from the 2026-03-12 audit remain resolved (truncation removed, quality threshold enforced, temporal weights integrated, calibration bucketing fixed, server confidence pattern verified, MultiPass results consumed). Voice accuracy still gates the agent/automation work that was parked behind it.

Semantic voice matching (`voice_examples` table + `match_voice_examples` RPC + 1,154 imported examples) is live in the live project. The promptfoo eval suite was blocked on a Google AI key; with the Anthropic path now running on the subscription, the Google key only matters for legacy Gemini eval comparisons.

## Operating discipline

Before risky work:

1. Refresh or reference the protected baseline
2. Use `test` for iteration; reach for the live project only for deliberate personal-account work
3. Do not relink `server/.env` away from `test`
4. Do not casually rerun bootstrap against the live personal account
5. For non-trivial implementation, work in an isolated worktree and run `/Users/sawbeck/bin/guardrail-preflight`

## Protected baselines

- `protected-local-baseline-20260305`
- `protected-local-baseline-20260306-head-d052d2b`
- `protected-local-baseline-20260306-head-34fb528`
- `protected-local-baseline-20260309-founder-live-execute`

## Codex Desktop git safety

- Root `/Users/sawbeck/Projects/RentalVoice` is the sync/recovery checkout
- Non-trivial edits happen in isolated worktrees under `/Users/sawbeck/.codex/worktrees/`
- See `docs/runbooks/codex-desktop-workflow.md` for full operator detail
