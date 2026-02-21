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

export const hostawayRouter = new Hono<AppEnv>();

hostawayRouter.use('*', requireAuth);

// ============================================================
// Validation Schemas
// ============================================================

const connectSchema = z.object({
  accountId: z.string().min(1, 'Account ID is required'),
  apiKey: z.string().min(10, 'API Key is required'),
});

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

    const encryptedCreds = encrypt(apiKey);
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
// POST /sync — Manual sync: fetch properties from Hostaway
// ============================================================

hostawayRouter.post('/sync', async (c) => {
  const orgId = c.get('orgId');
  const supabase = getSupabaseAdmin();

  // 1. Get connection
  const { data: connection } = await supabase
    .from('pms_connections')
    .select('*')
    .eq('org_id', orgId)
    .eq('provider', 'hostaway')
    .single();

  if (!connection || connection.status !== 'active') {
    return c.json(
      { message: 'No active Hostaway connection found', code: 'NOT_CONNECTED', status: 400 },
      400
    );
  }

  // 2. Ensure we have a valid token (refresh if needed)
  let accessToken = connection.oauth_token;
  const tokenExpired = connection.token_expires_at
    ? new Date(connection.token_expires_at) < new Date()
    : true;

  if (!accessToken || tokenExpired) {
    const apiKey = decrypt(connection.encrypted_credentials);
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
      // Mark connection as error
      await supabase
        .from('pms_connections')
        .update({ status: 'error' })
        .eq('id', connection.id);

      return c.json(
        { message: 'Failed to refresh Hostaway token. Please reconnect.', code: 'TOKEN_REFRESH_FAILED', status: 401 },
        401
      );
    }

    const tokenData = await tokenResponse.json() as { access_token: string; expires_in?: number };
    accessToken = tokenData.access_token;

    // Save refreshed token
    await supabase
      .from('pms_connections')
      .update({
        oauth_token: accessToken,
        token_expires_at: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
          : null,
      })
      .eq('id', connection.id);
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
