import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateUser = vi.fn();
const mockSignInWithOtp = vi.fn();
const mockVerifyOtp = vi.fn();
const mockExchangeCodeForSession = vi.fn();

let fromCallResults: Array<{ data: unknown; error: unknown }> = [];
let fromCallIndex = 0;

function resolveNext() {
  const result = fromCallResults[fromCallIndex] ?? { data: null, error: null };
  fromCallIndex++;
  return Promise.resolve(result);
}

function makeChain() {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.single = vi.fn(() => resolveNext());
  chain.insert = vi.fn(() => {
    const insertChain: Record<string, unknown> = {};
    insertChain.select = vi.fn(() => insertChain);
    insertChain.single = vi.fn(() => resolveNext());
    insertChain.then = (onFulfilled: (value: unknown) => unknown) => resolveNext().then(onFulfilled);
    return insertChain;
  });
  chain.then = (onFulfilled: (value: unknown) => unknown) => resolveNext().then(onFulfilled);
  return chain;
}

const mockSupabaseAdmin = {
  from: vi.fn(() => makeChain()),
  auth: {
    admin: {
      createUser: mockCreateUser,
    },
  },
};

const mockSupabaseAuthClient = {
  auth: {
    signInWithOtp: mockSignInWithOtp,
    verifyOtp: mockVerifyOtp,
    exchangeCodeForSession: mockExchangeCodeForSession,
  },
};

vi.mock('../db/supabase.js', () => ({
  getSupabaseAdmin: () => mockSupabaseAdmin,
  getSupabaseAuthClient: () => mockSupabaseAuthClient,
  initializeDatabase: vi.fn(),
}));

vi.mock('../lib/founder-access.js', () => ({
  isFounderAccount: () => false,
  getEffectivePlan: (plan: string) => plan,
}));

process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

const { default: app } = await import('../index.js');

function resetMocks() {
  vi.clearAllMocks();
  fromCallResults = [];
  fromCallIndex = 0;
}

describe('passwordless auth routes', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('requests an email code for a new or existing user', async () => {
    mockSignInWithOtp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: null,
    });

    const res = await app.request('/api/auth/request-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'host@example.com', name: 'Host' }),
    });

    expect(res.status).toBe(200);
    expect(mockSignInWithOtp).toHaveBeenCalledWith({
      email: 'host@example.com',
      options: {
        shouldCreateUser: true,
        data: { name: 'Host' },
      },
    });
  });

  it('verifies an emailed code and returns session tokens', async () => {
    mockVerifyOtp.mockResolvedValueOnce({
      data: {
        user: {
          id: 'user-123',
          email: 'host@example.com',
          created_at: '2026-03-27T00:00:00.000Z',
          user_metadata: { name: 'Host' },
        },
        session: {
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          user: { id: 'user-123' },
        },
      },
      error: null,
    });

    fromCallResults = [
      { data: null, error: { code: 'PGRST116' } }, // users select -> missing
      { data: null, error: null }, // users insert
      { data: null, error: { code: 'PGRST116' } }, // org_members select -> missing
      { data: { id: 'org-123' }, error: null }, // organizations insert.select.single
      { data: null, error: null }, // org_members insert
      { data: null, error: null }, // org_settings insert
      { data: null, error: null }, // ai_configs insert
      {
        data: {
          id: 'user-123',
          email: 'host@example.com',
          name: 'Host',
          created_at: '2026-03-27T00:00:00.000Z',
          plan: 'starter',
          trial_ends_at: '2026-04-03T00:00:00.000Z',
        },
        error: null,
      }, // users select -> hydrated profile
    ];

    const res = await app.request('/api/auth/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'host@example.com', code: '123456' }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.token).toBe('access-token');
    expect(json.refreshToken).toBe('refresh-token');
    expect(json.user.email).toBe('host@example.com');
    expect(json.user.name).toBe('Host');
    expect(json.user.plan).toBe('starter');
    expect(mockVerifyOtp).toHaveBeenCalledWith({
      email: 'host@example.com',
      token: '123456',
      type: 'email',
    });
  });
});
