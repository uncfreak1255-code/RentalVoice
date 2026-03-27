import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mockSingle = vi.fn();
const mockInsert = vi.fn();
const mockStartHostawayHistorySyncJob = vi.fn();

function makeChain() {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.single = mockSingle;
  chain.insert = mockInsert;
  return chain;
}

const mockSupabaseAdmin = {
  from: vi.fn(() => makeChain()),
};

vi.mock('../db/supabase.js', () => ({
  getSupabaseAdmin: () => mockSupabaseAdmin,
}));

vi.mock('../middleware/auth.js', () => ({
  requireAuth: async (c: { set: (key: string, value: string) => void }, next: () => Promise<void>) => {
    c.set('orgId', 'org-123');
    c.set('userId', 'user-123');
    c.set('userEmail', 'host@example.com');
    c.set('orgRole', 'owner');
    await next();
  },
}));

vi.mock('../lib/encryption.js', () => ({
  encrypt: (value: string) => `encrypted:${value}`,
  decrypt: (value: string) => value.replace(/^encrypted:/, ''),
}));

vi.mock('../services/hostaway-history-sync.js', () => ({
  clearHostawayHistorySyncJobs: vi.fn(),
  isHostawayHistorySyncRunning: vi.fn(() => false),
  markLatestHostawayHistorySyncJobStaleIfNeeded: vi.fn(),
  startHostawayHistorySyncJob: mockStartHostawayHistorySyncJob,
}));

const { hostawayRouter } = await import('../routes/hostaway.js');

function buildApp() {
  const app = new Hono();
  app.route('/api/hostaway', hostawayRouter);
  return app;
}

describe('POST /api/hostaway', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockResolvedValue({ data: null, error: null });
    mockInsert.mockResolvedValue({ data: null, error: null });
    mockStartHostawayHistorySyncJob.mockResolvedValue({
      id: 'job-123',
      status: 'queued',
      phase: 'idle',
      date_range_months: 24,
      processed_conversations: 0,
      total_conversations: 0,
      processed_messages: 0,
      total_messages: 0,
      last_error: null,
      started_at: null,
      completed_at: null,
      created_at: '2026-03-27T00:00:00.000Z',
      updated_at: '2026-03-27T00:00:00.000Z',
      payload_json: {},
    });

    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ access_token: 'hostaway-token', expires_in: 3600 }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    ) as unknown as typeof fetch;
  });

  it('starts a history sync job after successful Hostaway connect', async () => {
    const app = buildApp();

    const res = await app.request('/api/hostaway', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({ accountId: '51916', apiKey: 'secret-key-123' }),
    });

    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.historySyncJob).toBeTruthy();
    expect(json.historySyncJob.id).toBe('job-123');
    expect(mockStartHostawayHistorySyncJob).toHaveBeenCalledWith('org-123', 'user-123', 24);
  });
});
