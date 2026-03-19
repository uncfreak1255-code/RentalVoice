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
  // Auth check
  const token = process.env.AI_PROXY_TOKEN;
  if (!token) {
    console.error('[AI Proxy Personal] AI_PROXY_TOKEN not set');
    return c.json({ error: 'Proxy not configured' }, 500);
  }

  const auth = c.req.header('Authorization');
  if (!auth || auth !== `Bearer ${token}`) {
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

export { aiProxyRouter };
