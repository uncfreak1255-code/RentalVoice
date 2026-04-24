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
