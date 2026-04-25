# Personal-use pivot — Claude Agent SDK swap

Date: 2026-04-25
Status: proposed, awaiting review
Branch: `claude/review-rental-voice-architecture-NvmTA`
Save point: tag `savepoint/pre-claude-sdk-swap-2026-04-25` at commit `7233049`

## Goal

Stop publishing Rental Voice to the App Store and turn it into a single-user personal tool. Instead of a hosted server with a paid Anthropic API key, route AI drafts through the owner's Claude Pro/Max subscription using the Claude Agent SDK.

Out of scope for this plan: deletion of multi-tenant code (billing, entitlements, waitlist, dual-PMS adapters, Supabase auth). Those happen in a follow-up branch *after* the swap is validated.

## Context

The repo already runs in `personal` mode (`src/lib/config.ts:14`). Even in personal mode the mobile app routes AI through the server's "dumb proxy" at `POST /api/ai-proxy/generate` (`server/src/routes/ai-proxy-personal.ts`). The proxy currently relays to Google/Anthropic/OpenAI using server-held API keys. The owner has a Claude Pro/Max subscription, no paid API key, and Claude Code is logged in on the machine that will run the server.

Claude Pro/Max subscription doesn't issue an API key. The Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) inherits Claude Code's OAuth login from whichever machine it runs on. So the AI call must originate on a machine where `claude` is logged in. The mobile app can't call it directly — the server must run locally on the owner's machine and the phone must reach it (Tailscale recommended).

Client-side prompt assembly stays untouched: `src/lib/ai-service.ts:398-439` already builds full system + user prompts including conversation context. The server is a relay; we only swap what it relays *through*.

## Architectural shape after this change

```
iPhone (Expo app)
  │  Bearer AI_PROXY_TOKEN
  │  Anthropic-shaped payload
  ▼
Tailscale → laptop/Mac mini
  │
  ▼
Hono server (bun run)
  │  routes/ai-proxy-personal.ts
  ▼
@anthropic-ai/claude-agent-sdk query()
  │  inherits Claude Code OAuth
  ▼
Claude Sonnet 4.6 (subscription)
```

## Decisions taken

| Decision | Choice |
|---|---|
| Target model | `claude-sonnet-4-6` |
| Auth path | Claude Code subscription via Agent SDK |
| Server location | Owner's local machine (laptop now, Mac mini later) |
| Network | Tailscale MagicDNS |
| Mobile auth | Static `AI_PROXY_TOKEN` in `expo-secure-store` |
| Save point | Tag `savepoint/pre-claude-sdk-swap-2026-04-25` (push to origin) |
| Rollback | Single env var: `USE_CLAUDE_SUBSCRIPTION=0` reverts to API-key path without code change |

## Phases

### Phase 0 — Preflight (5 min, no code)

- Confirm `claude` is logged in on the host machine: `claude --version` then verify `~/.claude/` has a session.
- Confirm Bun ≥ 1.3.9 and Node 18+.
- Tailscale running, MagicDNS name in hand.
- Push savepoint tag: `git push origin savepoint/pre-claude-sdk-swap-2026-04-25`.

### Phase 1 — Server: add Agent SDK behind a flag

Single-file change in `server/src/routes/ai-proxy-personal.ts` plus one dependency.

1. `cd server && bun add @anthropic-ai/claude-agent-sdk`.
2. Edit `routes/ai-proxy-personal.ts`:
   - Import `query` from the SDK.
   - In the existing `case 'anthropic':` branch, branch on `process.env.USE_CLAUDE_SUBSCRIPTION === '1'`. If set, call new `callAnthropicViaSubscription(payload)`. Otherwise existing fetch stays untouched.
   - Helper invokes `query()` with `{ systemPrompt, model, maxTurns: 1, allowedTools: [], permissionMode: 'bypassPermissions' }` — pure text generation, no tool loops.
   - Helper extracts the last user message from the Anthropic-shaped payload (history is already baked into the system prompt by the client).
   - Helper synthesizes an Anthropic `/v1/messages`-shaped response: `{ id, type: 'message', role: 'assistant', model, content: [{type: 'text', text}], stop_reason, usage: { input_tokens, output_tokens } }`. The client doesn't know the difference.
3. Server `.env`:
   ```
   USE_CLAUDE_SUBSCRIPTION=1
   CLAUDE_SUBSCRIPTION_MODEL=claude-sonnet-4-6
   AI_PROXY_TOKEN=<openssl rand -hex 32>
   ```
4. Smoke test from terminal with curl (Anthropic-shaped payload). Expect a draft back.

Risk gate: if SDK invocation fails (auth, Bun-vs-Node compat, model id), fix here. Don't proceed to client until curl works.

### Phase 2 — Client: route Anthropic instead of Gemini

Touches four call sites:
- `src/lib/ai-service.ts:13, 444-473`
- `src/lib/ai-enhanced.ts:95, callViaProxy invocations`
- `src/lib/smart-templates.ts:345, 485`
- `src/lib/conversation-summary.ts:371`

Change each to:
- Send `provider: 'anthropic'` and `model: 'claude-sonnet-4-6'`.
- Send Anthropic-shaped payload `{ system, messages: [{role, content}], max_tokens }` instead of Gemini-shaped `{ systemInstruction, contents, generationConfig }`.
- Parse the response from `data.content[0].text` instead of `data.candidates[0].content.parts[0].text`.

Estimate ~30 LOC per call site. The system prompt builder and conversation-context builder are unchanged.

Also:
- `src/lib/api-client.ts` — under a flag `EXPO_PUBLIC_USE_LOCAL_PROXY_TOKEN=1`, `getAuthHeaders()` returns the static `AI_PROXY_TOKEN` from `expo-secure-store` instead of attempting Supabase JWT refresh.
- `.env` (or `app.json` extra): `EXPO_PUBLIC_API_BASE_URL=http://<tailscale-name>:3001`.

### Phase 3 — Validate on real conversations

1. Run app in Expo dev client on phone.
2. Pick 3 real Hostaway conversations with different intents (question, check-in, complaint).
3. For each: generate a draft, capture latency, content, confidence score, voice match feel.
4. Generate the same draft 3x to spot variance.
5. Toggle `USE_CLAUDE_SUBSCRIPTION=0` (still need a valid `ANTHROPIC_API_KEY` to compare, OR fall back to `provider: 'google'` for the comparison) and A/B.
6. Decision gate:
   - Sonnet 4.6 ≥ Gemini quality → proceed to commit.
   - Sonnet 4.6 < Gemini quality → keep flag off, no rollback needed, investigate prompt mismatches.

### Phase 4 — Commit and queue follow-up

1. Commit on `claude/review-rental-voice-architecture-NvmTA` with a tight message.
2. Open a PR for the swap alone — don't bundle the deletion work.
3. New branch `claude/personal-only-pruning` for the multi-tenant deletion work (separate plan, separate PR).

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| SDK depends on `claude` CLI on PATH; Bun spawns may not inherit the right env | Fallback: run server with `node --import tsx src/index.ts` instead of Bun. Tested before Phase 2. |
| Subscription terms — programmatic batch use | Personal use, dozens of drafts/day, well within interactive subscription scope. Re-check Anthropic's usage policy at apply time. |
| Server availability when laptop sleeps | Move to always-on box (Mac mini, Raspberry Pi, etc.) once validated. Tailscale stays the same. |
| Rate limit on subscription | Sonnet 4.6 subscription rate limits are generous for single-user message drafting. Mitigate with the existing `aiRateLimit` middleware (already wired). |
| Sonnet 4.6 voice quality drift vs Gemini | Phase 3 A/B is the gate. If worse, root-cause is almost certainly prompt formatting differences (Gemini-shaped → Anthropic-shaped), not model capability. |
| Response shape synthesis bug breaks client parsing | Phase 1 curl test catches this before client touches it. |

## Open questions for codex review

These are the things I'd most like a second pair of eyes on:

1. **SDK API correctness.** Is `query({ prompt, options: { systemPrompt, model, maxTurns: 1, allowedTools: [], permissionMode: 'bypassPermissions' } })` the right invocation for a single-shot text completion with no tool use? Specifically:
   - Does `maxTurns: 1` plus `allowedTools: []` actually prevent the SDK from attempting any tool calls?
   - Is `'bypassPermissions'` the right `permissionMode` value, or should it be `'plan'` or `'default'` for this use?
   - Are we losing prompt caching (which the raw Anthropic API supports via `cache_control`) by going through the SDK? If so, is there an SDK option to enable it?
2. **Response shape fidelity.** The synthesized response object — does it match `https://api.anthropic.com/v1/messages` closely enough that no client code needs to change beyond what Phase 2 already touches? Anything missing (`stop_sequence`, `id` format, `usage` cache fields)?
3. **Bun compatibility.** Does `@anthropic-ai/claude-agent-sdk` work cleanly under Bun's Node-compat layer, or are there known issues that force a Node runtime?
4. **Multi-turn handling.** The plan flattens conversation history into the system/user prompt on the client side and sends only the last user message to the SDK. Is that strictly equivalent to passing a full `messages: [...]` array, or does Sonnet 4.6 weight prior assistant turns differently when they're in the message array vs. embedded in the prompt?
5. **Auth plumbing edge cases.** If Claude Code's OAuth token expires or gets invalidated (e.g., user logs out elsewhere), how does the SDK surface that? Does our error path (`502 + api_error`) cover it, or do we need a specific re-auth UX?
6. **Architectural sanity.** Is keeping the Hono server as a thin local relay the right shape, or would it be cleaner to skip the server entirely and bundle a small Node helper into the app via `expo-modules`? (Spoiler: I think the relay is right because of Tailscale + simplicity, but worth challenging.)
7. **Anything the plan misses.** The deletion phase (Phase 4 follow-up) is sketched but not detailed — flag any multi-tenant surface that would surprise us when it's removed.

## Success criteria

- Server starts with `USE_CLAUDE_SUBSCRIPTION=1` and a curl with an Anthropic-shaped payload returns a Sonnet 4.6-generated draft.
- App on phone over Tailscale generates drafts at ≥ Gemini quality on 3 real conversations.
- Toggling `USE_CLAUDE_SUBSCRIPTION=0` reverts to API-key path with no code change.
- Single `git reset --hard savepoint/pre-claude-sdk-swap-2026-04-25` reverses everything.
