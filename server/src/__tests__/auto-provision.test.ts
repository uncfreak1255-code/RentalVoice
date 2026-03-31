/**
 * Auto-Provision Endpoint Tests
 *
 * server/src/__tests__/auto-provision.test.ts
 * Purpose: Unit tests for POST /api/auth/auto-provision
 * Tests: new user creation, re-provision (existing user), validation errors, rate limiting
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------- Mocks ----------

const mockCreateUser = vi.fn();
const mockDeleteUser = vi.fn();
const mockGetUser = vi.fn();
const mockListUsers = vi.fn();
const mockUpdateUserById = vi.fn();
const mockAuthClientSignIn = vi.fn();

// Track per-table mock results via a queue
let fromCallResults: Array<{ data: unknown; error: unknown }> = [];
let fromCallIndex = 0;

function makeChain() {
  const chain: Record<string, unknown> = {};
  const resolve = () => {
    const result = fromCallResults[fromCallIndex] ?? { data: null, error: null };
    fromCallIndex++;
    return Promise.resolve(result);
  };
  // Each method returns chain for chaining, except single which resolves
  chain.insert = vi.fn(() => chain);
  chain.delete = vi.fn(() => chain);
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.single = vi.fn(() => resolve());
  // insert without .select().single() — just resolves directly via .then
  // For insert-only calls (like users, org_members, org_settings, ai_configs),
  // the code does: await supabase.from('users').insert({...})
  // That returns the chain, which then awaits as undefined — that's fine since
  // the code destructures { error } from it.
  // Actually, looking at the code, the insert calls DO use the chain:
  // .insert({...}) for users/org_members/settings/ai_configs
  // .insert({...}).select('id').single() for organizations
  // The non-chained inserts await the result of .insert() directly.
  // Since .insert() returns the chain object (not a promise), we need it to
  // also be thenable. Let's make insert return something that resolves.
  chain.insert = vi.fn((..._args: unknown[]) => {
    const innerChain: Record<string, unknown> = {};
    innerChain.select = vi.fn(() => innerChain);
    innerChain.single = vi.fn(() => resolve());
    // Make insert result awaitable for simple insert calls
    innerChain.then = (onFulfilled: (v: unknown) => unknown) => {
      const result = fromCallResults[fromCallIndex] ?? { data: null, error: null };
      fromCallIndex++;
      return Promise.resolve(result).then(onFulfilled);
    };
    return innerChain;
  });
  chain.then = (onFulfilled: (v: unknown) => unknown) => {
    const result = fromCallResults[fromCallIndex] ?? { data: null, error: null };
    fromCallIndex++;
    return Promise.resolve(result).then(onFulfilled);
  };
  return chain;
}

const mockSupabaseAdmin = {
  from: vi.fn(() => makeChain()),
  auth: {
    getUser: mockGetUser,
    admin: {
      createUser: mockCreateUser,
      deleteUser: mockDeleteUser,
      listUsers: mockListUsers,
      updateUserById: mockUpdateUserById,
    },
  },
};

const mockSupabaseAuthClient = {
  auth: {
    signInWithPassword: mockAuthClientSignIn,
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
  shouldBypassBillingForFounder: () => false,
  getFounderPlanOverride: () => 'free',
  getEntitlementSource: () => 'plan',
  getForbiddenFounderProjectRefReason: () => null,
}));

// Set required env vars before importing app
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.AUTO_PROVISION_SECRET = 'test-secret-123';

// Import app AFTER mocks are set up
const { default: app } = await import('../index.js');

// Also import rate limiter to reset between tests
const { autoProvisionRateLimit } = await import('../routes/auth.js');

// ---------- Helpers ----------

function postAutoProvision(body: unknown) {
  return app.request('/api/auth/auto-provision', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-rv-internal-provision': 'internal-test-token',
    },
    body: JSON.stringify(body),
  });
}

function resetMocks() {
  vi.clearAllMocks();
  autoProvisionRateLimit.clear();
  fromCallResults = [];
  fromCallIndex = 0;
}

// ---------- Tests ----------

describe('POST /api/auth/auto-provision', () => {
  beforeEach(() => {
    resetMocks();
    delete process.env.ENABLE_INTERNAL_AUTO_PROVISION;
    delete process.env.AUTO_PROVISION_INTERNAL_TOKEN;
  });

  it('is disabled by default even with a well-formed request', async () => {
    const res = await app.request('/api/auth/auto-provision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hostawayAccountId: 'HA-12345',
        stableAccountId: 'stable-abc',
      }),
    });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.code).toBe('AUTO_PROVISION_DISABLED');
  });

  it('rejects requests that do not present the internal provisioning header', async () => {
    process.env.ENABLE_INTERNAL_AUTO_PROVISION = 'true';
    process.env.AUTO_PROVISION_INTERNAL_TOKEN = 'internal-test-token';

    const res = await app.request('/api/auth/auto-provision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hostawayAccountId: 'HA-12345',
        stableAccountId: 'stable-abc',
      }),
    });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.code).toBe('AUTO_PROVISION_FORBIDDEN');
  });

  // ------- New user creation -------
  it('creates new user when stableAccountId is unknown', async () => {
    process.env.ENABLE_INTERNAL_AUTO_PROVISION = 'true';
    process.env.AUTO_PROVISION_INTERNAL_TOKEN = 'internal-test-token';

    // listUsers returns no matching user
    mockListUsers.mockResolvedValueOnce({
      data: { users: [] },
      error: null,
    });

    // Admin create user succeeds
    const fakeUserId = 'uuid-new-user-1234';
    mockCreateUser.mockResolvedValueOnce({
      data: { user: { id: fakeUserId } },
      error: null,
    });

    const fakeOrgId = 'uuid-org-5678';
    // Queue of from() call results in order:
    // 1. users insert
    // 2. organizations insert -> select -> single
    // 3. org_members insert
    // 4. org_settings insert
    // 5. ai_configs insert
    fromCallResults = [
      { data: null, error: null },                    // users insert
      { data: { id: fakeOrgId }, error: null },        // organizations insert.select.single
      { data: null, error: null },                    // org_members insert
      { data: null, error: null },                    // org_settings insert
      { data: null, error: null },                    // ai_configs insert
    ];

    // Final sign-in after creation
    mockAuthClientSignIn.mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
        },
        user: { id: fakeUserId },
      },
      error: null,
    });

    const res = await postAutoProvision({
      hostawayAccountId: 'HA-12345',
      stableAccountId: 'stable-abc',
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.isNew).toBe(true);
    expect(json.userId).toBe(fakeUserId);
    expect(json.email).toBe('hostaway-stable-abc@rv.internal');
    expect(json.accessToken).toBe('new-access-token');
    expect(json.refreshToken).toBe('new-refresh-token');
    expect(json.orgId).toBe(fakeOrgId);

    // Verify admin createUser was called with deterministic email
    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'hostaway-stable-abc@rv.internal',
        email_confirm: true,
      })
    );
  });

  // ------- Re-provision (existing user) -------
  it('returns existing session when stableAccountId is known', async () => {
    process.env.ENABLE_INTERNAL_AUTO_PROVISION = 'true';
    process.env.AUTO_PROVISION_INTERNAL_TOKEN = 'internal-test-token';

    const existingUserId = 'uuid-existing-user';
    const existingOrgId = 'uuid-existing-org';

    // listUsers returns matching user
    mockListUsers.mockResolvedValueOnce({
      data: { users: [{ id: existingUserId, email: 'hostaway-stable-existing@rv.internal' }] },
      error: null,
    });

    // updateUserById succeeds (reset password)
    mockUpdateUserById.mockResolvedValueOnce({
      data: { user: { id: existingUserId } },
      error: null,
    });

    // Sign-in succeeds after password reset
    mockAuthClientSignIn.mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'existing-access-token',
          refresh_token: 'existing-refresh-token',
        },
        user: { id: existingUserId },
      },
      error: null,
    });

    // org_members lookup: from('org_members').select().eq().single()
    fromCallResults = [
      { data: { org_id: existingOrgId }, error: null },
    ];

    const res = await postAutoProvision({
      hostawayAccountId: 'HA-99999',
      stableAccountId: 'stable-existing',
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.isNew).toBe(false);
    expect(json.userId).toBe(existingUserId);
    expect(json.orgId).toBe(existingOrgId);
    expect(json.accessToken).toBe('existing-access-token');
    expect(json.refreshToken).toBe('existing-refresh-token');
    expect(json.email).toBe('hostaway-stable-existing@rv.internal');

    // createUser should NOT have been called
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  // ------- Validation errors -------
  it('rejects request with missing stableAccountId (400)', async () => {
    process.env.ENABLE_INTERNAL_AUTO_PROVISION = 'true';
    process.env.AUTO_PROVISION_INTERNAL_TOKEN = 'internal-test-token';

    const res = await postAutoProvision({
      hostawayAccountId: 'HA-12345',
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe('VALIDATION_ERROR');
  });

  it('rejects request with missing hostawayAccountId (400)', async () => {
    process.env.ENABLE_INTERNAL_AUTO_PROVISION = 'true';
    process.env.AUTO_PROVISION_INTERNAL_TOKEN = 'internal-test-token';

    const res = await postAutoProvision({
      stableAccountId: 'stable-abc',
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe('VALIDATION_ERROR');
  });

  it('rejects request with empty body (400)', async () => {
    process.env.ENABLE_INTERNAL_AUTO_PROVISION = 'true';
    process.env.AUTO_PROVISION_INTERNAL_TOKEN = 'internal-test-token';

    const res = await postAutoProvision({});

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe('VALIDATION_ERROR');
  });

  // ------- Rate limiting -------
  it('rate-limits after 5 requests from same IP', async () => {
    process.env.ENABLE_INTERNAL_AUTO_PROVISION = 'true';
    process.env.AUTO_PROVISION_INTERNAL_TOKEN = 'internal-test-token';

    // Pre-fill the rate limiter for 'unknown' IP (default when no x-forwarded-for header)
    autoProvisionRateLimit.set('unknown', Array.from({ length: 5 }, () => Date.now()));

    const res = await postAutoProvision({
      hostawayAccountId: 'HA-12345',
      stableAccountId: 'stable-abc',
    });

    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.code).toBe('RATE_LIMITED');
  });
});

// ---------- Account Deletion Tests ----------

describe('DELETE /api/auth/account-data', () => {
  beforeEach(() => {
    resetMocks();
  });

  function deleteAccountData(token: string) {
    return app.request('/api/auth/account-data', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
  }

  it('deletes all data and auth user on success', async () => {
    const fakeUserId = 'uuid-delete-user';
    const fakeOrgId = 'uuid-delete-org';

    // requireAuth: auth.getUser
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: fakeUserId, email: 'test@rv.internal' } },
      error: null,
    });

    // Queue of from() call results:
    // 1. requireAuth: org_members select -> single
    // 2-6. Five learning table deletes (delete().eq() -> then)
    // 7. organizations delete (delete().eq() -> then)
    fromCallResults = [
      { data: { org_id: fakeOrgId, role: 'owner' }, error: null }, // org_members lookup (requireAuth)
      { data: null, error: null }, // learning_profiles delete
      { data: null, error: null }, // few_shot_examples delete
      { data: null, error: null }, // host_style_profiles delete
      { data: null, error: null }, // edit_patterns delete
      { data: null, error: null }, // learning_migration_snapshots delete
      { data: null, error: null }, // organizations delete
    ];

    // auth.admin.deleteUser succeeds
    mockDeleteUser.mockResolvedValueOnce({ data: null, error: null });

    const res = await deleteAccountData('valid-token');

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.deleted).toBe(true);
    expect(json.tablesCleared).toEqual([
      'learning_profiles',
      'few_shot_examples',
      'host_style_profiles',
      'edit_patterns',
      'learning_migration_snapshots',
      'organizations',
      'auth_user',
    ]);

    // deleteUser called with the right userId
    expect(mockDeleteUser).toHaveBeenCalledWith(fakeUserId);
  });

  it('returns 401 without Authorization header', async () => {
    const res = await app.request('/api/auth/account-data', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.code).toBe('UNAUTHORIZED');
  });

  it('does not delete auth user when a table delete fails (partial failure)', async () => {
    const fakeUserId = 'uuid-partial-user';
    const fakeOrgId = 'uuid-partial-org';

    // requireAuth: auth.getUser
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: fakeUserId, email: 'test@rv.internal' } },
      error: null,
    });

    // Queue: requireAuth org_members, then 2 successful deletes, then failure on 3rd
    fromCallResults = [
      { data: { org_id: fakeOrgId, role: 'owner' }, error: null },    // org_members (requireAuth)
      { data: null, error: null },                                      // learning_profiles OK
      { data: null, error: null },                                      // few_shot_examples OK
      { data: null, error: { message: 'permission denied' } },         // host_style_profiles FAIL
    ];

    const res = await deleteAccountData('valid-token');

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.code).toBe('PARTIAL_FAILURE');
    expect(json.tablesCleared).toEqual(['learning_profiles', 'few_shot_examples']);

    // Auth user must NOT be deleted
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });
});
