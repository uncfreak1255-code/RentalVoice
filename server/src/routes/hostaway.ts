/**
 * Hostaway PMS Connection Routes
 * 
 * 📁 server/src/routes/hostaway.ts
 * Purpose: Connect, disconnect, sync, and check status of Hostaway PMS
 * Depends on: middleware/auth.ts, lib/encryption.ts, db/supabase.ts
 * Used by: Mobile app Settings > PMS Connection screen
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { getSupabaseAdmin } from '../db/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { encrypt, decrypt } from '../lib/encryption.js';
import type { AppEnv } from '../lib/env.js';
import {
  clearHostawayHistorySyncJobs,
  isHostawayHistorySyncRunning,
  markLatestHostawayHistorySyncJobStaleIfNeeded,
  startHostawayHistorySyncJob,
} from '../services/hostaway-history-sync.js';

export const hostawayRouter = new Hono<AppEnv>();

hostawayRouter.use('*', requireAuth);

// ============================================================
// Validation Schemas
// ============================================================

const connectSchema = z.object({
  accountId: z.string().min(1, 'Account ID is required'),
  apiKey: z.string().min(10, 'API Key is required'),
});

const sendMessageSchema = z.object({
  body: z.string().min(1, 'Message body is required').max(10000),
});

const startHistorySyncSchema = z.object({
  dateRangeMonths: z.number().int().min(1).max(60).optional(),
});

interface HostawayConnectionRow {
  id: string;
  account_id: string;
  encrypted_credentials: string;
  oauth_token: string | null;
  token_expires_at: string | null;
  status: string;
}

function mapHistorySyncJob(job: Record<string, unknown> | null) {
  if (!job) return null;

  const payload = (job.payload_json as Record<string, unknown> | null) || null;

  return {
    id: job.id,
    status: job.status,
    phase: job.phase,
    dateRangeMonths: job.date_range_months,
    processedConversations: job.processed_conversations,
    totalConversations: job.total_conversations,
    processedMessages: job.processed_messages,
    totalMessages: job.total_messages,
    lastError: job.last_error,
    startedAt: job.started_at,
    completedAt: job.completed_at,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
    payloadAvailable: !!payload && Object.keys(payload).length > 0,
    isRunningInMemory: typeof job.id === 'string' ? isHostawayHistorySyncRunning(job.id) : false,
  };
}

function extractHostawayApiKey(encryptedCredentials: string): string {
  const decrypted = decrypt(encryptedCredentials);
  try {
    const parsed = JSON.parse(decrypted) as { apiKey?: string };
    if (parsed.apiKey) return parsed.apiKey;
  } catch {
    // Backward compatibility: older records stored raw api key string, not JSON.
  }
  return decrypted;
}

async function getActiveHostawayConnection(orgId: string): Promise<HostawayConnectionRow | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('pms_connections')
    .select('id, account_id, encrypted_credentials, oauth_token, token_expires_at, status')
    .eq('org_id', orgId)
    .eq('provider', 'hostaway')
    .single();

  if (!data || data.status !== 'active') return null;
  return data as HostawayConnectionRow;
}

async function ensureHostawayAccessToken(connection: HostawayConnectionRow): Promise<string> {
  const supabase = getSupabaseAdmin();
  const tokenExpired = connection.token_expires_at
    ? new Date(connection.token_expires_at) < new Date()
    : true;

  if (connection.oauth_token && !tokenExpired) {
    return connection.oauth_token;
  }

  const apiKey = extractHostawayApiKey(connection.encrypted_credentials);
  const tokenResponse = await fetch('https://api.hostaway.com/v1/accessTokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: connection.account_id,
      client_secret: apiKey,
      scope: 'general',
    }),
  });

  if (!tokenResponse.ok) {
    await supabase
      .from('pms_connections')
      .update({ status: 'error' })
      .eq('id', connection.id);
    throw new Error('TOKEN_REFRESH_FAILED');
  }

  const tokenData = await tokenResponse.json() as { access_token: string; expires_in?: number };
  const tokenExpiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null;

  await supabase
    .from('pms_connections')
    .update({
      oauth_token: tokenData.access_token,
      token_expires_at: tokenExpiresAt,
      status: 'active',
    })
    .eq('id', connection.id);

  return tokenData.access_token;
}

// ============================================================
// POST / — Connect Hostaway account
// ============================================================

hostawayRouter.post('/', async (c) => {
  const orgId = c.get('orgId');
  const body = await c.req.json();

  const parsed = connectSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { message: 'Validation failed', code: 'VALIDATION_ERROR', status: 400, details: parsed.error.flatten().fieldErrors },
      400
    );
  }

  const { accountId, apiKey } = parsed.data;
  const supabase = getSupabaseAdmin();

  // 1. Test connection by requesting an OAuth2 token from Hostaway
  try {
    const tokenResponse = await fetch('https://api.hostaway.com/v1/accessTokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: accountId,
        client_secret: apiKey,
        scope: 'general',
      }),
    });

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text();
      console.error('[Hostaway] Token request failed:', tokenResponse.status, err);
      return c.json(
        { message: 'Invalid Hostaway credentials. Please check your Account ID and API Key.', code: 'HOSTAWAY_AUTH_FAILED', status: 401 },
        401
      );
    }

    const tokenData = await tokenResponse.json() as {
      access_token?: string;
      token_type?: string;
      expires_in?: number;
    };

    if (!tokenData.access_token) {
      return c.json(
        { message: 'Hostaway returned no access token.', code: 'HOSTAWAY_AUTH_FAILED', status: 401 },
        401
      );
    }

    // 2. Check for existing connection
    const { data: existing } = await supabase
      .from('pms_connections')
      .select('id')
      .eq('org_id', orgId)
      .eq('provider', 'hostaway')
      .single();

    const encryptedCreds = encrypt(JSON.stringify({ apiKey }));
    const tokenExpiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    if (existing) {
      // Update existing connection
      await supabase
        .from('pms_connections')
        .update({
          account_id: accountId,
          encrypted_credentials: encryptedCreds,
          oauth_token: tokenData.access_token,
          token_expires_at: tokenExpiresAt,
          status: 'active',
          connected_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      // Create new connection
      await supabase
        .from('pms_connections')
        .insert({
          org_id: orgId,
          provider: 'hostaway',
          account_id: accountId,
          encrypted_credentials: encryptedCreds,
          oauth_token: tokenData.access_token,
          token_expires_at: tokenExpiresAt,
          status: 'active',
        });
    }

    return c.json({
      status: 'connected',
      provider: 'hostaway',
      accountId,
      connectedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Hostaway] Connection error:', error);
    return c.json(
      { message: 'Failed to connect to Hostaway. Please try again.', code: 'CONNECTION_ERROR', status: 500 },
      500
    );
  }
});

// ============================================================
// GET / — Connection status
// ============================================================

hostawayRouter.get('/', async (c) => {
  const orgId = c.get('orgId');
  const supabase = getSupabaseAdmin();

  const { data: connection } = await supabase
    .from('pms_connections')
    .select('id, provider, account_id, status, connected_at, last_sync_at')
    .eq('org_id', orgId)
    .eq('provider', 'hostaway')
    .single();

  if (!connection) {
    return c.json({
      connected: false,
      provider: 'hostaway',
    });
  }

  return c.json({
    connected: connection.status === 'active',
    provider: connection.provider,
    accountId: connection.account_id,
    status: connection.status,
    connectedAt: connection.connected_at,
    lastSyncAt: connection.last_sync_at,
  });
});

// ============================================================
// DELETE / — Disconnect Hostaway
// ============================================================

hostawayRouter.delete('/', async (c) => {
  const orgId = c.get('orgId');
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('pms_connections')
    .delete()
    .eq('org_id', orgId)
    .eq('provider', 'hostaway');

  if (error) {
    console.error('[Hostaway] Disconnect error:', error);
    return c.json(
      { message: 'Failed to disconnect', code: 'DISCONNECT_ERROR', status: 500 },
      500
    );
  }

  return c.json({ status: 'disconnected', provider: 'hostaway' });
});

// ============================================================
// GET /listings — Fetch listings via server-managed Hostaway connection
// ============================================================

hostawayRouter.get('/listings', async (c) => {
  try {
    const orgId = c.get('orgId');
    const limit = Number(c.req.query('limit') || '100');
    const connection = await getActiveHostawayConnection(orgId);
    if (!connection) {
      return c.json(
        { message: 'No active Hostaway connection found', code: 'NOT_CONNECTED', status: 400 },
        400
      );
    }

    const accessToken = await ensureHostawayAccessToken(connection);
    const response = await fetch(`https://api.hostaway.com/v1/listings?limit=${limit}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[Hostaway] Listings fetch failed:', response.status, err);
      return c.json({ message: 'Failed to fetch listings', code: 'UPSTREAM_ERROR', status: 502 }, 502);
    }

    const data = await response.json() as { result?: unknown[] };
    return c.json({ result: data.result || [] });
  } catch (error) {
    console.error('[Hostaway] GET /listings error:', error);
    return c.json({ message: 'Failed to fetch listings', code: 'INTERNAL_ERROR', status: 500 }, 500);
  }
});

// ============================================================
// GET /listings/:listingId — Fetch single listing via server-managed connection
// ============================================================

hostawayRouter.get('/listings/:listingId', async (c) => {
  try {
    const orgId = c.get('orgId');
    const listingId = c.req.param('listingId');
    const connection = await getActiveHostawayConnection(orgId);
    if (!connection) {
      return c.json(
        { message: 'No active Hostaway connection found', code: 'NOT_CONNECTED', status: 400 },
        400
      );
    }

    const accessToken = await ensureHostawayAccessToken(connection);
    const response = await fetch(`https://api.hostaway.com/v1/listings/${listingId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return c.json({ result: null });
      }
      const err = await response.text();
      console.error('[Hostaway] Listing detail fetch failed:', response.status, err);
      return c.json({ message: 'Failed to fetch listing detail', code: 'UPSTREAM_ERROR', status: 502 }, 502);
    }

    const data = await response.json() as { result?: unknown };
    return c.json({ result: data.result || null });
  } catch (error) {
    console.error('[Hostaway] GET /listings/:listingId error:', error);
    return c.json({ message: 'Failed to fetch listing detail', code: 'INTERNAL_ERROR', status: 500 }, 500);
  }
});

// ============================================================
// GET /conversations — Fetch conversations via server-managed connection
// ============================================================

hostawayRouter.get('/conversations', async (c) => {
  try {
    const orgId = c.get('orgId');
    const limit = Number(c.req.query('limit') || '50');
    const offset = Number(c.req.query('offset') || '0');
    const connection = await getActiveHostawayConnection(orgId);
    if (!connection) {
      return c.json(
        { message: 'No active Hostaway connection found', code: 'NOT_CONNECTED', status: 400 },
        400
      );
    }

    const accessToken = await ensureHostawayAccessToken(connection);
    const response = await fetch(
      `https://api.hostaway.com/v1/conversations?limit=${limit}&offset=${offset}&includeResources=1`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error('[Hostaway] Conversations fetch failed:', response.status, err);
      return c.json({ message: 'Failed to fetch conversations', code: 'UPSTREAM_ERROR', status: 502 }, 502);
    }

    const data = await response.json() as { result?: unknown[] };
    return c.json({ result: data.result || [] });
  } catch (error) {
    console.error('[Hostaway] GET /conversations error:', error);
    return c.json({ message: 'Failed to fetch conversations', code: 'INTERNAL_ERROR', status: 500 }, 500);
  }
});

// ============================================================
// GET /conversations/:conversationId/messages
// ============================================================

hostawayRouter.get('/conversations/:conversationId/messages', async (c) => {
  try {
    const orgId = c.get('orgId');
    const conversationId = c.req.param('conversationId');
    const limit = Number(c.req.query('limit') || '100');
    const offset = Number(c.req.query('offset') || '0');
    const connection = await getActiveHostawayConnection(orgId);
    if (!connection) {
      return c.json(
        { message: 'No active Hostaway connection found', code: 'NOT_CONNECTED', status: 400 },
        400
      );
    }

    const accessToken = await ensureHostawayAccessToken(connection);
    const response = await fetch(
      `https://api.hostaway.com/v1/conversations/${conversationId}/messages?limit=${limit}&offset=${offset}&includeScheduledMessages=1`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error('[Hostaway] Messages fetch failed:', response.status, err);
      return c.json({ message: 'Failed to fetch messages', code: 'UPSTREAM_ERROR', status: 502 }, 502);
    }

    const data = await response.json() as { result?: unknown[] };
    return c.json({ result: data.result || [] });
  } catch (error) {
    console.error('[Hostaway] GET /conversations/:id/messages error:', error);
    return c.json({ message: 'Failed to fetch messages', code: 'INTERNAL_ERROR', status: 500 }, 500);
  }
});

// ============================================================
// POST /conversations/:conversationId/messages
// ============================================================

hostawayRouter.post('/conversations/:conversationId/messages', async (c) => {
  try {
    const orgId = c.get('orgId');
    const conversationId = c.req.param('conversationId');
    const body = await c.req.json();
    const parsed = sendMessageSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { message: 'Validation failed', code: 'VALIDATION_ERROR', status: 400, details: parsed.error.flatten() },
        400
      );
    }

    const connection = await getActiveHostawayConnection(orgId);
    if (!connection) {
      return c.json(
        { message: 'No active Hostaway connection found', code: 'NOT_CONNECTED', status: 400 },
        400
      );
    }

    const accessToken = await ensureHostawayAccessToken(connection);
    const response = await fetch(
      `https://api.hostaway.com/v1/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ body: parsed.data.body }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error('[Hostaway] Send message failed:', response.status, err);
      return c.json({ message: 'Failed to send message', code: 'UPSTREAM_ERROR', status: 502 }, 502);
    }

    const data = await response.json() as { result?: unknown };
    return c.json({ result: data.result || null });
  } catch (error) {
    console.error('[Hostaway] POST /conversations/:id/messages error:', error);
    return c.json({ message: 'Failed to send message', code: 'INTERNAL_ERROR', status: 500 }, 500);
  }
});

// ============================================================
// GET /reservations — Fetch reservations via server-managed connection
// ============================================================

hostawayRouter.get('/reservations', async (c) => {
  try {
    const orgId = c.get('orgId');
    const connection = await getActiveHostawayConnection(orgId);
    if (!connection) {
      return c.json(
        { message: 'No active Hostaway connection found', code: 'NOT_CONNECTED', status: 400 },
        400
      );
    }

    const params = new URLSearchParams();
    params.set('limit', c.req.query('limit') || '100');
    params.set('offset', c.req.query('offset') || '0');

    const arrivalStartDate = c.req.query('arrivalStartDate');
    const arrivalEndDate = c.req.query('arrivalEndDate');
    const listingId = c.req.query('listingId');
    const status = c.req.query('status');

    if (arrivalStartDate) params.set('arrivalStartDate', arrivalStartDate);
    if (arrivalEndDate) params.set('arrivalEndDate', arrivalEndDate);
    if (listingId) params.set('listingId', listingId);
    if (status) params.set('status', status);

    const accessToken = await ensureHostawayAccessToken(connection);
    const response = await fetch(
      `https://api.hostaway.com/v1/reservations?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error('[Hostaway] Reservations fetch failed:', response.status, err);
      return c.json({ message: 'Failed to fetch reservations', code: 'UPSTREAM_ERROR', status: 502 }, 502);
    }

    const data = await response.json() as { result?: unknown[] };
    return c.json({ result: data.result || [] });
  } catch (error) {
    console.error('[Hostaway] GET /reservations error:', error);
    return c.json({ message: 'Failed to fetch reservations', code: 'INTERNAL_ERROR', status: 500 }, 500);
  }
});

// ============================================================
// GET /reservations/:reservationId
// ============================================================

hostawayRouter.get('/reservations/:reservationId', async (c) => {
  try {
    const orgId = c.get('orgId');
    const reservationId = c.req.param('reservationId');
    const connection = await getActiveHostawayConnection(orgId);
    if (!connection) {
      return c.json(
        { message: 'No active Hostaway connection found', code: 'NOT_CONNECTED', status: 400 },
        400
      );
    }

    const accessToken = await ensureHostawayAccessToken(connection);
    const response = await fetch(
      `https://api.hostaway.com/v1/reservations/${reservationId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return c.json({ result: null });
      }
      const err = await response.text();
      console.error('[Hostaway] Reservation fetch failed:', response.status, err);
      return c.json({ message: 'Failed to fetch reservation', code: 'UPSTREAM_ERROR', status: 502 }, 502);
    }

    const data = await response.json() as { result?: unknown };
    return c.json({ result: data.result || null });
  } catch (error) {
    console.error('[Hostaway] GET /reservations/:id error:', error);
    return c.json({ message: 'Failed to fetch reservation', code: 'INTERNAL_ERROR', status: 500 }, 500);
  }
});

// ============================================================
// POST /history-sync/start — Start server-managed history sync
// ============================================================

hostawayRouter.post('/history-sync/start', async (c) => {
  try {
    const orgId = c.get('orgId');
    const userId = c.get('userId');
    const body = await c.req.json().catch(() => ({}));
    const parsed = startHistorySyncSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        { message: 'Validation failed', code: 'VALIDATION_ERROR', status: 400, details: parsed.error.flatten() },
        400
      );
    }

    const connection = await getActiveHostawayConnection(orgId);
    if (!connection) {
      return c.json(
        { message: 'No active Hostaway connection found', code: 'NOT_CONNECTED', status: 400 },
        400
      );
    }

    const job = await startHostawayHistorySyncJob(
      orgId,
      userId,
      parsed.data.dateRangeMonths ?? 24
    );

    return c.json({ job: mapHistorySyncJob(job as unknown as Record<string, unknown>) });
  } catch (error) {
    console.error('[Hostaway] POST /history-sync/start error:', error);
    return c.json({ message: 'Failed to start history sync', code: 'INTERNAL_ERROR', status: 500 }, 500);
  }
});

// ============================================================
// GET /history-sync/status — Get latest server-managed history sync job
// ============================================================

hostawayRouter.get('/history-sync/status', async (c) => {
  try {
    const orgId = c.get('orgId');
    const job = await markLatestHostawayHistorySyncJobStaleIfNeeded(orgId);
    return c.json({ job: mapHistorySyncJob(job as unknown as Record<string, unknown> | null) });
  } catch (error) {
    console.error('[Hostaway] GET /history-sync/status error:', error);
    return c.json({ message: 'Failed to fetch history sync status', code: 'INTERNAL_ERROR', status: 500 }, 500);
  }
});

// ============================================================
// GET /history-sync/result — Get completed history sync payload
// ============================================================

hostawayRouter.get('/history-sync/result', async (c) => {
  try {
    const orgId = c.get('orgId');
    const jobId = c.req.query('jobId');
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('hostaway_history_sync_jobs')
      .select('*')
      .eq('org_id', orgId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1);

    if (jobId) {
      query = query.eq('id', jobId);
    }

    const { data } = await query.maybeSingle();
    if (!data) {
      return c.json({ result: null, job: null });
    }

    return c.json({
      result: data.payload_json || null,
      job: mapHistorySyncJob(data as unknown as Record<string, unknown>),
    });
  } catch (error) {
    console.error('[Hostaway] GET /history-sync/result error:', error);
    return c.json({ message: 'Failed to fetch history sync result', code: 'INTERNAL_ERROR', status: 500 }, 500);
  }
});

// ============================================================
// DELETE /history-sync/status — Clear server-managed history sync jobs
// ============================================================

hostawayRouter.delete('/history-sync/status', async (c) => {
  try {
    const orgId = c.get('orgId');
    await clearHostawayHistorySyncJobs(orgId);
    return c.json({ status: 'cleared' });
  } catch (error) {
    console.error('[Hostaway] DELETE /history-sync/status error:', error);
    return c.json({ message: 'Failed to clear history sync jobs', code: 'INTERNAL_ERROR', status: 500 }, 500);
  }
});

// ============================================================
// POST /sync — Manual sync: fetch properties from Hostaway
// ============================================================

hostawayRouter.post('/sync', async (c) => {
  const orgId = c.get('orgId');
  const supabase = getSupabaseAdmin();

  const connection = await getActiveHostawayConnection(orgId);
  if (!connection) {
    return c.json(
      { message: 'No active Hostaway connection found', code: 'NOT_CONNECTED', status: 400 },
      400
    );
  }

  let accessToken = '';
  try {
    accessToken = await ensureHostawayAccessToken(connection);
  } catch {
    return c.json(
      { message: 'Failed to refresh Hostaway token. Please reconnect.', code: 'TOKEN_REFRESH_FAILED', status: 401 },
      401
    );
  }

  // 3. Fetch listings from Hostaway
  try {
    const listingsResponse = await fetch('https://api.hostaway.com/v1/listings', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!listingsResponse.ok) {
      const err = await listingsResponse.text();
      console.error('[Hostaway] Listings fetch failed:', listingsResponse.status, err);
      return c.json(
        { message: 'Failed to fetch properties from Hostaway', code: 'SYNC_FAILED', status: 502 },
        502
      );
    }

    const listingsData = await listingsResponse.json() as {
      status: string;
      result: {
        id: number;
        name: string;
        address: string;
        city: string;
        state: string;
        countryCode: string;
        bedrooms: number;
        bathrooms: number;
        personCapacity: number;
        thumbnailUrl: string | null;
      }[];
    };

    const properties = (listingsData.result || []).map((l) => ({
      externalId: String(l.id),
      name: l.name,
      address: [l.address, l.city, l.state].filter(Boolean).join(', '),
      imageUrl: l.thumbnailUrl || null,
      bedroomCount: l.bedrooms || 0,
      bathroomCount: l.bathrooms || 0,
      maxGuests: l.personCapacity || 0,
    }));

    // Update last sync time
    await supabase
      .from('pms_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', connection.id);

    return c.json({
      synced: true,
      propertyCount: properties.length,
      properties,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Hostaway] Sync error:', error);
    return c.json(
      { message: 'Sync failed due to a network error', code: 'SYNC_ERROR', status: 500 },
      500
    );
  }
});
