/**
 * AI Proxy for Personal Mode
 *
 * Lightweight "dumb proxy" — the client builds the full intelligent prompt
 * (with voice learning, few-shot examples, grounding, etc.), sends it here,
 * and the server just relays it to the LLM provider with the server-held API key.
 *
 * Auth: simple bearer token (AI_PROXY_TOKEN env var), NOT Supabase auth.
 * This keeps personal mode working without a full account system.
 *
 * For App Store / commercial mode, use the full ai-generate.ts routes instead.
 */

import { Hono } from 'hono';

const aiProxyRouter = new Hono();

/**
 * POST /api/ai-proxy/generate
 *
 * Accepts the same body format as the Gemini generateContent API.
 * Injects the server-held API key and forwards to Gemini.
 * Returns the raw Gemini response.
 */
aiProxyRouter.post('/generate', async (c) => {
  // Auth: accept either bearer token (legacy) or no auth (CORS-protected).
  // The client no longer holds API secrets — CORS + rate limiting protect this endpoint.
  const token = process.env.AI_PROXY_TOKEN;
  const auth = c.req.header('Authorization');
  if (token && auth && auth !== `Bearer ${token}`) {
    // If a token IS provided but doesn't match, reject (prevents misuse)
    return c.json({ error: 'Unauthorized' }, 401);
  }

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
        const apiKey = process.env.GOOGLE_AI_API_KEY;
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
    const message = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /api/ai-proxy/test-key
 *
 * Validates a user-provided API key against the real provider.
 * Used by the Settings UI key-test feature.
 */
aiProxyRouter.post('/test-key', async (c) => {
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
