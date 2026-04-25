# Personal-use pivot — Claude Agent SDK swap

Date: 2026-04-25
Status: revised after codex review (2026-04-25 14:30)
Branch: `claude/review-rental-voice-architecture-NvmTA`
Save point: tag `savepoint/pre-claude-sdk-swap-2026-04-25` at commit `7233049`

## Codex review absorbed

A repo-truth review by codex flagged five things; all are reflected below.

1. **Subscription-policy boundary.** Anthropic's policy restricts third-party products that *offer* `claude.ai` login or subscription rate limits to other users. This is single-user, owner-on-own-subscription, no other users — the canonical Claude Code use case. We are not redistributing access. Still: do not invite a second user, do not deploy this to a hosted service that fronts the subscription. If that ever changes, this whole plan is void; revert to API-key path.
2. **Phase 1 is not "route-only".** The SDK does not return Anthropic Messages-API JSON. It streams SDK message objects ending in a `result`. Callers like `ai-enhanced.ts:1867` parse `data.content?.[0]?.text`. The diff *does* synthesize a faithful Anthropic-shaped response — but Phase 1 is "route + translate", not "route". Reframed below.
3. **Server runtime conflict.** SDK 0.2.79 needs Node 18+ and peer `zod ^4`. `server/package.json` pins `zod ^3.23.0` and runs on Bun. Root `package.json` is already on `zod 4.1.11`. Two runtime decisions, not one diff.
4. **Five client call sites, not four.** Confirmed: `ai-service.ts:462`, `ai-enhanced.ts:106` (callViaProxy with already-Anthropic-shaped payloads at 1848+), `conversation-summary.ts:371`, `smart-templates.ts:345`, `smart-templates.ts:485`.
5. **Multi-tenant deletion misses.** Add to the follow-up deletion branch: `useChatDraftEngine.ts:76` (managed-draft gating), `managed-draft-gating.ts:3`, `api-client.ts:255` (`generateAIDraftViaServer`), `ai-keys.ts:243` (key-test surfaces), and `/api/ai-proxy/test-key`.

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

### Phase 1 — Server: add Agent SDK behind a flag (route + translate)

Not a single-file change. Touches three things: dependency, runtime, and the proxy file.

**1a. Resolve runtime conflict.** Pick one:
- **Path A (preferred): bump server zod 3 → 4.** Run `cd server && bun add zod@^4`. Then `bun run typecheck` and `bunx vitest run` to surface breaks. Server zod usage is small (route input validation in `ai-proxy-personal.ts` and a few siblings); zod 3→4 has well-documented breaking changes but a narrow blast radius here.
- **Path B (fallback): isolate the SDK to a Node-runtime sidecar.** Run a tiny Node process (just `query()` invocation) that the Hono server proxies to over a Unix socket. More moving parts; only do this if Path A causes test breakage we don't want to fix now.

**1b. Install the SDK.** `bun add @anthropic-ai/claude-agent-sdk@^0.2.79` (matching the version codex confirmed in the broader ecosystem).

**1c. Edit `server/src/routes/ai-proxy-personal.ts`:**
- Import `query` from the SDK.
- In the existing `case 'anthropic':` branch, gate on `process.env.USE_CLAUDE_SUBSCRIPTION === '1'`. If set, call new `callAnthropicViaSubscription(payload)`. Otherwise the existing `fetch` to the Anthropic API stays untouched.
- Helper invokes `query({ prompt, options: { systemPrompt, model, maxTurns: 1, allowedTools: [], permissionMode: 'bypassPermissions' } })` — single-shot text generation, no tool loops, no preview session APIs.
- Helper iterates the SDK message stream, accumulating `text` from `assistant` blocks and capturing `usage` from the terminal `result` message.
- **Helper translates SDK output back to Anthropic Messages-API JSON shape**: `{ id, type: 'message', role: 'assistant', model, content: [{type: 'text', text}], stop_reason, usage: { input_tokens, output_tokens } }`. Verified against `ai-enhanced.ts:1867` which reads `data.content?.[0]?.text`.

**1d. Server `.env`:**
```
USE_CLAUDE_SUBSCRIPTION=1
CLAUDE_SUBSCRIPTION_MODEL=claude-sonnet-4-6
AI_PROXY_TOKEN=<openssl rand -hex 32>
```

**1e. Tests.** Add to `server/src/__tests__/ai-proxy-personal.test.ts` (already exists, already passes per codex): one test that mocks the SDK `query()` async iterator and asserts the synthesized response matches what `data.content?.[0]?.text` consumers expect.

**1f. Smoke test.** `curl` with an Anthropic-shaped payload. Expect a draft back.

**Risk gate:** if zod bump breaks anything in `server/`, fall back to Path B before proceeding to Phase 2.

### Phase 2 — Client: route Anthropic instead of Gemini

Five call sites (codex correction). Treatment varies by what shape they already send:

| File:line | Current shape | Work |
|---|---|---|
| `ai-enhanced.ts:106` (callViaProxy at 1858, payload at 1848) | Already Anthropic-shaped (`system`, `messages`, `max_tokens`, `temperature`); reads `data.content?.[0]?.text` | **Default-change only**: switch the default `CLAUDE_MODEL` constant at `ai-enhanced.ts:94` from `claude-3-5-haiku-20241022` to `claude-sonnet-4-6`. |
| `smart-templates.ts:345` | OpenAI-shaped (per codex) | Re-shape to Anthropic, switch parser. |
| `smart-templates.ts:485` | OpenAI-shaped (per codex) | Re-shape to Anthropic, switch parser. |
| `ai-service.ts:462` | Gemini-shaped (`systemInstruction`, `contents`, `generationConfig`); reads `data.candidates[0].content.parts[0].text` | Re-shape to Anthropic, switch parser. |
| `conversation-summary.ts:371` | Gemini-shaped | Re-shape to Anthropic, switch parser. |

Verify each against the actual file before editing — codex said the smart-templates sites are OpenAI-shaped; my Phase 1 audit didn't read them, so confirm before swapping.

Estimate: ~30 LOC for the four reshape-and-default sites; ~3 LOC for `ai-enhanced.ts`. The system prompt builder and conversation-context builder are unchanged.

Also:
- `src/lib/api-client.ts` — `getAuthHeaders()` (around line 121) currently tries founder session / lazy auto-provision. Under a flag `EXPO_PUBLIC_USE_LOCAL_PROXY_TOKEN=1`, short-circuit *before* those branches and return the static `AI_PROXY_TOKEN` read from `expo-secure-store`. The local-token branch must win, otherwise founder auth races us.
- `.env` (or `app.json` extra): `EXPO_PUBLIC_API_BASE_URL=http://<tailscale-name>:3001`. Default in `src/lib/config.ts:24` is `https://api.rentalvoice.app` — without this override, real-device requests will hit the public domain, not your laptop.

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
| **Subscription policy violation** | Single-user, owner-on-own-subscription only. Never expose this server beyond the owner's Tailnet. Never let a second human use it. Document in any future README that this branch is non-distributable. |
| zod 3→4 server bump breaks tests | Path B fallback (Node sidecar). Decide at Phase 1a. |
| SDK depends on `claude` CLI on PATH; Bun spawns may not inherit the right env | Run server with `node --import tsx src/index.ts` instead of Bun. Already part of Path B. |
| Server availability when laptop sleeps | Move to always-on box (Mac mini, Raspberry Pi) once validated. Tailscale stays the same. |
| Subscription rate limits | Generous for single-user drafting. Existing `aiRateLimit` middleware stays wired. |
| Sonnet 4.6 voice quality drift vs Gemini | Phase 3 A/B is the gate. Likely root-cause if observed: prompt-shape differences, not model capability. |
| Response shape synthesis bug breaks client parsing | Phase 1 unit test (1e) plus curl smoke test before any client edits. |

## Codex answers folded in

- **SDK API correctness.** Use stable `query({ prompt, options })` and collect text from streamed messages, terminating on the `result` message. Do not use the preview `createSession`/`send`/`stream` V2 path — explicitly unstable.
- **Multi-turn handling.** Phase 1 stays stateless. Conversation context is already inlined into prompts client-side. SDK `continue: true` would conflate unrelated guests on a shared local server; `resume` would require explicit per-conversation session storage. Not worth it for this swap.
- **Response shape fidelity.** Synthesized `{ content: [{type, text}], usage: {input_tokens, output_tokens}, ... }` matches `data.content?.[0]?.text` consumers. Unit test in 1e locks this contract.
- **Subscription policy.** Single-user-on-own-subscription is permitted. Distribution (offering subscription-backed access to other humans) is not. This branch must never be deployed publicly. If that changes, revert to API-key path.

## Remaining open questions for the next reviewer

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
