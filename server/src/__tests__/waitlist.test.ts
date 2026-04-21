import { beforeEach, describe, expect, it, vi } from 'vitest';

type DbError = { code?: string; message?: string } | null;

let existingSignup: unknown = null;
let lookupError: DbError = null;
let insertError: DbError = null;
let insertedRows: Array<Record<string, string>> = [];

function makeInsertChain() {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.single = vi.fn(() => Promise.resolve({
    data: insertError ? null : { id: 'signup-id' },
    error: insertError,
  }));
  return chain;
}

function makeTableChain() {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(() => Promise.resolve({
    data: existingSignup,
    error: lookupError,
  }));
  chain.insert = vi.fn((row: Record<string, string>) => {
    insertedRows.push(row);
    return makeInsertChain();
  });
  return chain;
}

const mockSupabaseAdmin = {
  from: vi.fn(() => makeTableChain()),
};

vi.mock('../db/supabase.js', () => ({
  getSupabaseAdmin: () => mockSupabaseAdmin,
  getSupabaseAuthClient: vi.fn(),
  initializeDatabase: vi.fn(),
}));

process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

const { default: app } = await import('../index.js');

function resetMocks() {
  vi.clearAllMocks();
  existingSignup = null;
  lookupError = null;
  insertError = null;
  insertedRows = [];
}

function postWaitlist(body: unknown, ip: string) {
  return app.request('/api/waitlist', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://rentalvoice.app',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  });
}

describe('waitlist route', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('stores a normalized waitlist signup from the marketing origin', async () => {
    const res = await postWaitlist(
      { email: ' Host@Example.COM ', source: ' landing-hero ' },
      '203.0.113.10'
    );

    expect(res.status).toBe(201);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://rentalvoice.app');
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(mockSupabaseAdmin.from).toHaveBeenCalledWith('waitlist_signups');
    expect(insertedRows).toEqual([{ email: 'host@example.com', source: 'landing-hero' }]);
  });

  it('rejects malformed emails without writing to the database', async () => {
    const res = await postWaitlist(
      { email: 'not-an-email', source: 'landing' },
      '203.0.113.11'
    );

    expect(res.status).toBe(400);
    expect(insertedRows).toEqual([]);
  });

  it('returns 409 when the normalized email is already present', async () => {
    existingSignup = { id: 'existing-signup' };

    const res = await postWaitlist(
      { email: 'HOST@example.com', source: 'landing' },
      '203.0.113.12'
    );

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({ code: 'DUPLICATE_EMAIL' });
    expect(insertedRows).toEqual([]);
  });

  it('returns 409 if a unique constraint catches a duplicate race', async () => {
    insertError = { code: '23505', message: 'duplicate key value violates unique constraint' };

    const res = await postWaitlist(
      { email: 'host@example.com', source: 'landing' },
      '203.0.113.13'
    );

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({ code: 'DUPLICATE_EMAIL' });
  });

  it('does not expose waitlist CORS to app origins', async () => {
    const res = await app.request('/api/waitlist', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://app.rentalvoice.app',
        'Access-Control-Request-Method': 'POST',
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('rate-limits anonymous submissions by client IP', async () => {
    for (let index = 0; index < 5; index++) {
      const res = await postWaitlist(
        { email: `burst-${index}@example.com`, source: 'landing' },
        '203.0.113.14'
      );
      expect(res.status).toBe(201);
    }

    const limited = await postWaitlist(
      { email: 'burst-5@example.com', source: 'landing' },
      '203.0.113.14'
    );

    expect(limited.status).toBe(429);
    expect(insertedRows).toHaveLength(5);
  });
});
