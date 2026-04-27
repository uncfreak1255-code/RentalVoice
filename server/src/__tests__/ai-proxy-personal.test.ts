import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

async function buildApp() {
  const { aiProxyRouter } = await import('../routes/ai-proxy-personal.js');
  const app = new Hono();
  app.route('/api/ai-proxy', aiProxyRouter);
  return app;
}

function mockProviderFetch() {
  const fetchMock = vi.fn(async (url: string | URL | Request) =>
    new Response(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: 'ok' }] } }],
        upstreamUrl: String(url),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  );
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe('personal AI proxy security', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    vi.doMock('../middleware/auth.js', () => ({
      requireAuth: async (
        c: { req: { header: (name: string) => string | undefined }; set: (key: string, value: string) => void; json: (body: unknown, status: number) => Response },
        next: () => Promise<void>
      ) => {
        if (c.req.header('Authorization') !== 'Bearer account-token') {
          return c.json({ message: 'Invalid or expired token', code: 'UNAUTHORIZED', status: 401 }, 401);
        }

        c.set('userId', 'account-user-123');
        c.set('userEmail', 'host@example.com');
        c.set('orgId', 'org-123');
        c.set('orgRole', 'owner');
        await next();
        return undefined;
      },
    }));
    mockProviderFetch();
  });

  it('fails closed when no proxy token or account token is provided', async () => {
    vi.stubEnv('GOOGLE_AI_API_KEY', 'google-key');
    const app = await buildApp();

    const res = await app.request('/api/ai-proxy/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'google',
        payload: { contents: [{ parts: [{ text: 'hello' }] }] },
      }),
    });

    expect(res.status).toBe(401);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('allows account JWT auth without exposing AI_PROXY_TOKEN to the app', async () => {
    vi.stubEnv('GOOGLE_AI_API_KEY', 'google-key');
    const app = await buildApp();

    const res = await app.request('/api/ai-proxy/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer account-token',
      },
      body: JSON.stringify({
        provider: 'google',
        payload: { contents: [{ parts: [{ text: 'hello' }] }] },
      }),
    });

    expect(res.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid tokens before the authorized rate-limit bucket is touched', async () => {
    vi.stubEnv('AI_PROXY_TOKEN', 'proxy-secret');
    vi.stubEnv('GOOGLE_AI_API_KEY', 'google-key');
    const app = await buildApp();

    for (let i = 0; i < 105; i += 1) {
      const res = await app.request('/api/ai-proxy/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer wrong-secret',
        },
        body: JSON.stringify({
          provider: 'google',
          payload: { contents: [{ parts: [{ text: 'hello' }] }] },
        }),
      });
      expect(res.status).toBe(401);
    }

    const authorizedRes = await app.request('/api/ai-proxy/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer proxy-secret',
      },
      body: JSON.stringify({
        provider: 'google',
        payload: { contents: [{ parts: [{ text: 'hello' }] }] },
      }),
    });

    expect(authorizedRes.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('uses GOOGLE_API_KEY as the legacy fallback for Google calls', async () => {
    const fetchMock = mockProviderFetch();
    vi.stubEnv('AI_PROXY_TOKEN', 'proxy-secret');
    vi.stubEnv('GOOGLE_API_KEY', 'legacy-google-key');
    const app = await buildApp();

    const res = await app.request('/api/ai-proxy/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer proxy-secret',
      },
      body: JSON.stringify({
        provider: 'google',
        model: 'gemini-test',
        payload: { contents: [{ parts: [{ text: 'hello' }] }] },
      }),
    });

    expect(res.status).toBe(200);
    expect(String(fetchMock.mock.calls[0][0])).toContain('key=legacy-google-key');
  });

  it('routes anthropic through the Claude SDK when USE_CLAUDE_SUBSCRIPTION=1 and synthesizes Anthropic-shape JSON', async () => {
    vi.stubEnv('AI_PROXY_TOKEN', 'proxy-secret');
    vi.stubEnv('USE_CLAUDE_SUBSCRIPTION', '1');
    vi.stubEnv('CLAUDE_SUBSCRIPTION_MODEL', 'claude-sonnet-4-6');

    const queryMock = vi.fn(async function* () {
      yield {
        type: 'result' as const,
        subtype: 'success' as const,
        result: 'Check-in is at 3pm.',
        stop_reason: 'end_turn' as const,
        usage: {
          input_tokens: 42,
          output_tokens: 7,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
        },
      };
    });
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({ query: queryMock }));

    const app = await buildApp();
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;

    const res = await app.request('/api/ai-proxy/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer proxy-secret',
      },
      body: JSON.stringify({
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        payload: {
          system: 'You are a vacation rental host assistant.',
          messages: [{ role: 'user', content: 'What time is checkin?' }],
          max_tokens: 200,
        },
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { content: { type: string; text: string }[]; usage: { input_tokens: number; output_tokens: number }; model: string };

    // Contract: client parsers read data.content?.[0]?.text — see src/lib/ai-enhanced.ts:1867.
    expect(body.content?.[0]?.text).toBe('Check-in is at 3pm.');
    expect(body.content[0].type).toBe('text');
    expect(body.usage.input_tokens).toBe(42);
    expect(body.usage.output_tokens).toBe(7);
    expect(body.model).toBe('claude-sonnet-4-6');

    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled(); // SDK path, not API key path
  });

  it('returns 502 when the SDK yields a non-success result', async () => {
    vi.stubEnv('AI_PROXY_TOKEN', 'proxy-secret');
    vi.stubEnv('USE_CLAUDE_SUBSCRIPTION', '1');

    const queryMock = vi.fn(async function* () {
      yield { type: 'result' as const, subtype: 'error_max_turns' as const };
    });
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({ query: queryMock }));

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const app = await buildApp();
      const res = await app.request('/api/ai-proxy/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer proxy-secret',
        },
        body: JSON.stringify({
          provider: 'anthropic',
          payload: { messages: [{ role: 'user', content: 'Hi' }] },
        }),
      });

      expect(res.status).toBe(502);
      const body = await res.json() as { type: string; error: { type: string } };
      expect(body.type).toBe('error');
      expect(body.error.type).toBe('api_error');
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('returns 502 and logs when the SDK throws', async () => {
    vi.stubEnv('AI_PROXY_TOKEN', 'proxy-secret');
    vi.stubEnv('USE_CLAUDE_SUBSCRIPTION', '1');

    const queryMock = vi.fn(async function* () {
      throw new Error('Claude Code session expired');
      yield { type: 'result' as const, subtype: 'success' as const };
    });
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({ query: queryMock }));

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const app = await buildApp();
      const res = await app.request('/api/ai-proxy/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer proxy-secret',
        },
        body: JSON.stringify({
          provider: 'anthropic',
          payload: { messages: [{ role: 'user', content: 'Hi' }] },
        }),
      });

      expect(res.status).toBe(502);
      const body = await res.json() as { type: string; error: { message: string } };
      expect(body.error.message).toContain('Claude Code session expired');
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('forwards only the latest user turn to the SDK and drops prior turns', async () => {
    vi.stubEnv('AI_PROXY_TOKEN', 'proxy-secret');
    vi.stubEnv('USE_CLAUDE_SUBSCRIPTION', '1');

    let capturedPrompt: unknown;
    const queryMock = vi.fn((args: { prompt: unknown }) => {
      capturedPrompt = args.prompt;
      return (async function* () {
        yield {
          type: 'result' as const,
          subtype: 'success' as const,
          result: 'ok',
          stop_reason: 'end_turn' as const,
          usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
        };
      })();
    });
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({ query: queryMock }));

    const app = await buildApp();
    const res = await app.request('/api/ai-proxy/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer proxy-secret',
      },
      body: JSON.stringify({
        provider: 'anthropic',
        payload: {
          messages: [
            { role: 'user', content: 'first turn (should be dropped)' },
            { role: 'assistant', content: 'mid reply (should be dropped)' },
            { role: 'user', content: 'latest turn (should be sent)' },
          ],
        },
      }),
    });

    expect(res.status).toBe(200);
    expect(capturedPrompt).toBe('latest turn (should be sent)');
  });

  it('returns 400 when the anthropic payload has no user message on the SDK path', async () => {
    vi.stubEnv('AI_PROXY_TOKEN', 'proxy-secret');
    vi.stubEnv('USE_CLAUDE_SUBSCRIPTION', '1');

    const queryMock = vi.fn();
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({ query: queryMock }));

    const app = await buildApp();
    const res = await app.request('/api/ai-proxy/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer proxy-secret',
      },
      body: JSON.stringify({
        provider: 'anthropic',
        payload: {
          messages: [{ role: 'assistant', content: 'no user turn here' }],
        },
      }),
    });

    expect(res.status).toBe(400);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('returns 504 when the SDK stalls past CLAUDE_SUBSCRIPTION_TIMEOUT_MS', async () => {
    vi.stubEnv('AI_PROXY_TOKEN', 'proxy-secret');
    vi.stubEnv('USE_CLAUDE_SUBSCRIPTION', '1');
    vi.stubEnv('CLAUDE_SUBSCRIPTION_TIMEOUT_MS', '50');

    const queryMock = vi.fn((args: { options?: { abortController?: AbortController } }) => {
      return (async function* () {
        // Hang until the wall-clock guard aborts. Mirrors what a stalled
        // SDK call (network hang, OAuth refresh deadlock) would look like.
        await new Promise<void>((_resolve, reject) => {
          const signal = args.options?.abortController?.signal;
          if (!signal) return; // safety: caller must wire abortController
          signal.addEventListener('abort', () => reject(new Error('aborted')));
        });
        yield { type: 'result' as const, subtype: 'success' as const };
      })();
    });
    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({ query: queryMock }));

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const app = await buildApp();
      const res = await app.request('/api/ai-proxy/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer proxy-secret',
        },
        body: JSON.stringify({
          provider: 'anthropic',
          payload: { messages: [{ role: 'user', content: 'Hi' }] },
        }),
      });

      expect(res.status).toBe(504);
      const body = await res.json() as { type: string; error: { type: string; message: string } };
      expect(body.type).toBe('error');
      expect(body.error.type).toBe('api_error');
      expect(body.error.message).toContain('timed out');
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('rate-limits unauthenticated test-key requests per client IP', async () => {
    vi.stubEnv('AI_PROXY_TOKEN', 'proxy-secret');
    const app = await buildApp();

    for (let i = 0; i < 1000; i += 1) {
      const res = await app.request('/api/ai-proxy/test-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '203.0.113.10',
        },
        body: JSON.stringify({ provider: 'google', key: 'candidate-key' }),
      });
      expect(res.status).toBe(200);
    }

    const limitedRes = await app.request('/api/ai-proxy/test-key', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '203.0.113.10',
      },
      body: JSON.stringify({ provider: 'google', key: 'candidate-key' }),
    });

    expect(limitedRes.status).toBe(429);

    const otherIpRes = await app.request('/api/ai-proxy/test-key', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '203.0.113.11',
      },
      body: JSON.stringify({ provider: 'google', key: 'candidate-key' }),
    });

    expect(otherIpRes.status).toBe(200);
  });
});
