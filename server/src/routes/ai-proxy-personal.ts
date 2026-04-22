/**
 * AI Proxy for Personal Mode
 *
 * Lightweight "dumb proxy" — the client builds the full intelligent prompt
 * (with voice learning, few-shot examples, grounding, etc.), sends it here,
 * and the server just relays it to the LLM provider with the server-held API key.
 *
 * Auth: Supabase account JWT or server-side bearer token (AI_PROXY_TOKEN env var).
 * Generation requests fail closed when neither credential is present.
 *
 * For App Store / commercial mode, use the full ai-generate.ts routes instead.
 */

import { createHash } from 'crypto';
import { Hono, type Context, type Next } from 'hono';
import type { AppEnv } from '../lib/env.js';
import { requireAuth } from '../middleware/auth.js';
import { aiRateLimit, apiRateLimit } from '../middleware/rate-limit.js';

const aiProxyRouter = new Hono<AppEnv>();

async function requireAiProxyAuth(c: Context<AppEnv>, next: Next): Promise<Response | void> {
  const token = process.env.AI_PROXY_TOKEN;
  const auth = c.req.header('Authorization');

  if (token && auth === `Bearer ${token}`) {
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
 * POST /api/ai-proxy/generate
 *
 * Accepts the same body format as the Gemini generateContent API.
 * Injects the server-held API key and forwards to Gemini.
 * Returns the raw Gemini response.
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
