/**
 * AI Proxy for Personal Mode
 *
 * Lightweight relay — the client builds the full intelligent prompt
 * (with voice learning, few-shot examples, grounding, etc.) and the server
 * routes it to one of:
 *   - Google Gemini API (with server-held GOOGLE_AI_API_KEY)
 *   - Anthropic Messages API (with server-held ANTHROPIC_API_KEY)
 *   - OpenAI Chat Completions (with server-held OPENAI_API_KEY)
 *   - Claude Agent SDK on the Anthropic path when USE_CLAUDE_SUBSCRIPTION=1,
 *     which uses the host machine's Claude Code OAuth login. The SDK helper
 *     synthesizes an Anthropic /v1/messages-shape response so existing
 *     clients (data.content?.[0]?.text) work unchanged.
 *
 * Auth: Supabase account JWT or server-side bearer token (AI_PROXY_TOKEN env var).
 * Generation requests fail closed when neither credential is present.
 */

import { createHash, timingSafeEqual } from 'crypto';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { Hono, type Context, type Next } from 'hono';
import type { AppEnv } from '../lib/env.js';
import { requireAuth } from '../middleware/auth.js';
import { aiRateLimit, apiRateLimit } from '../middleware/rate-limit.js';

const aiProxyRouter = new Hono<AppEnv>();

async function requireAiProxyAuth(c: Context<AppEnv>, next: Next): Promise<Response | void> {
  const token = process.env.AI_PROXY_TOKEN;
  const auth = c.req.header('Authorization');

  if (token && auth?.startsWith('Bearer ') && constantTimeBearerMatch(auth, token)) {
    const tokenHash = createHash('sha256').update(token).digest('hex').slice(0, 16);
    c.set('userId', `ai-proxy:${tokenHash}`);
    c.set('userEmail', '');
    c.set('orgId', 'personal-ai-proxy');
    c.set('orgRole', 'proxy');

    await next();
    return;
  }

  if (!auth?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  return requireAuth(c, next);
}

/**
 * Constant-time compare of an Authorization: Bearer header against the
 * configured AI_PROXY_TOKEN. Returns false rather than throwing on length
 * mismatch (Buffer-based timingSafeEqual requires equal lengths). Avoids
 * the timing side-channel of `auth === \`Bearer ${token}\``.
 */
function constantTimeBearerMatch(authHeader: string, token: string): boolean {
  const expected = Buffer.from(`Bearer ${token}`);
  const received = Buffer.from(authHeader);
  if (received.length !== expected.length) return false;
  try {
    return timingSafeEqual(received, expected);
  } catch {
    return false;
  }
}

/**
 * POST /api/ai-proxy/generate
 *
 * Body: { provider, model?, payload }. Payload shape matches the upstream
 * provider's expected request body. The server injects credentials and
 * forwards. Response is forwarded raw, except on the Claude Agent SDK path
 * where the SDK output is synthesized into an Anthropic-shape response.
 */
aiProxyRouter.post('/generate', requireAiProxyAuth, aiRateLimit, async (c) => {
  try {
    const body = await c.req.json() as {
      provider: 'google' | 'anthropic' | 'openai';
      model?: string;
      payload: Record<string, unknown>;
    };

    const { provider, model, payload } = body;

    if (!provider || !payload) {
      return c.json({ error: 'Missing provider or payload' }, 400);
    }

    let result: Response;

    switch (provider) {
      case 'google': {
        const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_API_KEY;
        if (!apiKey) {
          return c.json({ error: 'Google AI API key not configured on server' }, 500);
        }
        const modelId = model || 'gemini-2.0-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
        result = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        break;
      }

      case 'anthropic': {
        if (process.env.USE_CLAUDE_SUBSCRIPTION === '1') {
          result = await callAnthropicViaSubscription(payload as AnthropicPayload);
          break;
        }
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          return c.json({ error: 'Anthropic API key not configured on server' }, 500);
        }
        result = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(payload),
        });
        break;
      }

      case 'openai': {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          return c.json({ error: 'OpenAI API key not configured on server' }, 500);
        }
        result = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify(payload),
        });
        break;
      }

      default:
        return c.json({ error: `Unknown provider: ${provider}` }, 400);
    }

    // Forward the provider response directly to the client
    const responseBody = await result.text();
    return new Response(responseBody, {
      status: result.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[AI Proxy Personal] Error:', err);
    return c.json({ error: 'AI proxy request failed' }, 500);
  }
});

// ============================================================
// Claude Agent SDK (subscription) helper
// ============================================================

interface AnthropicPayload {
  system?: string;
  messages?: { role: 'user' | 'assistant'; content: string }[];
  max_tokens?: number;
  model?: string;
}

async function callAnthropicViaSubscription(payload: AnthropicPayload): Promise<Response> {
  const systemPrompt = payload.system ?? '';
  const messages = payload.messages ?? [];

  // The client already inlines conversation context into the prompts (see
  // src/lib/ai-service.ts buildConversationContext). Send only the latest user
  // turn through the SDK; do not replay assistant turns.
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  if (!lastUser) {
    return jsonResponse(400, {
      type: 'error',
      error: { type: 'invalid_request_error', message: 'No user message in payload' },
    });
  }

  const model = process.env.CLAUDE_SUBSCRIPTION_MODEL || payload.model || 'claude-sonnet-4-6';

  let resultText = '';
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheCreationInputTokens = 0;
  let cacheReadInputTokens = 0;
  let stopReason: string | null = 'end_turn';

  // Wall-clock guard: if the SDK stalls (network hang, OAuth refresh deadlock,
  // upstream slowdown), the for-await loop has no built-in timeout and would
  // pin a Hono request indefinitely. Abort + return 504 after SDK_TIMEOUT_MS.
  const timeoutMs = Number(process.env.CLAUDE_SUBSCRIPTION_TIMEOUT_MS) || 30_000;
  const abortController = new AbortController();
  const timeoutHandle = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    for await (const message of query({
      prompt: lastUser.content,
      options: {
        systemPrompt,
        model,
        maxTurns: 1,
        tools: [],          // pure text generation — no tool access at all
        permissionMode: 'default', // INVARIANT: keep paired with tools=[]. If a tool is ever added,
                            // RECONSIDER permissionMode — do NOT switch to 'bypassPermissions'
                            // (that requires allowDangerouslySkipPermissions:true and gives
                            // unrestricted host access on prompt-injection).
        abortController,
      },
    })) {
      if (message.type === 'result') {
        if (message.subtype === 'success') {
          resultText = message.result;
          inputTokens = message.usage.input_tokens;
          outputTokens = message.usage.output_tokens;
          cacheCreationInputTokens = message.usage.cache_creation_input_tokens;
          cacheReadInputTokens = message.usage.cache_read_input_tokens;
          stopReason = message.stop_reason;
        } else {
          return jsonResponse(502, {
            type: 'error',
            error: { type: 'api_error', message: `Claude SDK returned ${message.subtype}` },
          });
        }
      }
    }
  } catch (err) {
    if (abortController.signal.aborted) {
      console.error(`[AI Proxy Personal] Claude SDK timeout after ${timeoutMs}ms`);
      return jsonResponse(504, {
        type: 'error',
        error: { type: 'api_error', message: `Claude SDK timed out after ${timeoutMs}ms` },
      });
    }
    console.error('[AI Proxy Personal] Claude SDK error:', err);
    return jsonResponse(502, {
      type: 'error',
      error: { type: 'api_error', message: err instanceof Error ? err.message : 'SDK error' },
    });
  } finally {
    clearTimeout(timeoutHandle);
  }

  // Synthesize an Anthropic /v1/messages response shape so existing client
  // parsers (data.content?.[0]?.text) work unchanged.
  return jsonResponse(200, {
    id: `msg_subscription_${Date.now()}`,
    type: 'message',
    role: 'assistant',
    model,
    content: [{ type: 'text', text: resultText }],
    stop_reason: stopReason,
    stop_sequence: null,
    usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_creation_input_tokens: cacheCreationInputTokens,
      cache_read_input_tokens: cacheReadInputTokens,
    },
  });
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * POST /api/ai-proxy/test-key
 *
 * Validates a user-provided API key against the real provider.
 * Used by the Settings UI key-test feature.
 * This stays unauthenticated so the local settings flow works, but it is rate-limited.
 */
aiProxyRouter.post('/test-key', apiRateLimit, async (c) => {
  try {
    const body = await c.req.json() as {
      provider: 'google' | 'anthropic' | 'openai';
      key: string;
    };

    const { provider, key } = body;
    if (!provider || !key) {
      return c.json({ valid: false, error: 'Missing provider or key' }, 400);
    }

    let result: Response;

    switch (provider) {
      case 'google': {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;
        result = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Reply with just the word "ok"' }] }],
            generationConfig: { maxOutputTokens: 5 },
          }),
        });
        break;
      }
      case 'anthropic': {
        result = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-5-haiku-20241022',
            max_tokens: 5,
            messages: [{ role: 'user', content: 'Reply with just the word "ok"' }],
          }),
        });
        break;
      }
      case 'openai': {
        result = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            max_tokens: 5,
            messages: [{ role: 'user', content: 'Reply with just the word "ok"' }],
          }),
        });
        break;
      }
      default:
        return c.json({ valid: false, error: `Unknown provider: ${provider}` }, 400);
    }

    if (!result.ok) {
      const text = await result.text();
      let error = `Error: ${result.status}`;
      if (text.includes('API_KEY_INVALID') || text.includes('invalid_api_key') || text.includes('authentication_error')) {
        error = 'Invalid API key';
      }
      return c.json({ valid: false, error });
    }

    return c.json({ valid: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ valid: false, error: message }, 500);
  }
});

export { aiProxyRouter };
