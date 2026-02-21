/**
 * Guesty PMS Connection Routes
 * 
 * 📁 server/src/routes/guesty.ts
 * Purpose: Connect, disconnect, sync, and check status of Guesty PMS
 * Depends on: middleware/auth.ts, lib/encryption.ts, db/supabase.ts
 * Used by: Mobile app Settings > PMS Connection screen
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { getSupabaseAdmin } from '../db/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { encrypt, decrypt } from '../lib/encryption.js';
import { guestyAdapter } from '../adapters/guesty-adapter.js';
import type { AppEnv } from '../lib/env.js';

export const guestyRouter = new Hono<AppEnv>();

guestyRouter.use('*', requireAuth);

// ============================================================
// Validation Schemas
// ============================================================

const connectSchema = z.object({
  apiToken: z.string().min(10, 'Guesty API token is required'),
});

// ============================================================
// POST / — Connect Guesty account
// ============================================================

guestyRouter.post('/', async (c) => {
  const orgId = c.get('orgId');
  const body = await c.req.json();

  const parsed = connectSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { message: 'Validation failed', code: 'VALIDATION_ERROR', status: 400, details: parsed.error.flatten().fieldErrors },
      400
    );
  }

  const { apiToken } = parsed.data;
  const supabase = getSupabaseAdmin();

  // 1. Test connection via Guesty adapter
  try {
    const isValid = await guestyAdapter.testConnection({ accountId: '', apiKey: apiToken });

    if (!isValid) {
      return c.json(
        { message: 'Invalid Guesty API token. Please check your token and try again.', code: 'GUESTY_AUTH_FAILED', status: 401 },
        401
      );
    }

    // 2. Check for existing connection
    const { data: existing } = await supabase
      .from('pms_connections')
      .select('id')
      .eq('org_id', orgId)
      .eq('provider', 'guesty')
      .single();

    const encryptedCreds = encrypt(JSON.stringify({ apiKey: apiToken }));

    if (existing) {
      await supabase
        .from('pms_connections')
        .update({
          encrypted_credentials: encryptedCreds,
          status: 'connected',
          last_synced_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await supabase.from('pms_connections').insert({
        org_id: orgId,
        provider: 'guesty',
        account_id: 'guesty-api',
        encrypted_credentials: encryptedCreds,
        status: 'connected',
      });
    }

    console.log(`[Guesty] Connected org ${orgId}`);
    return c.json({ message: 'Guesty connected successfully', status: 'connected' });
  } catch (err) {
    console.error('[Guesty] Connection error:', err);
    const message = err instanceof Error ? err.message : 'Connection failed';
    return c.json({ message, code: 'GUESTY_ERROR', status: 500 }, 500);
  }
});

// ============================================================
// GET /status — Check Guesty connection status
// ============================================================

guestyRouter.get('/status', async (c) => {
  const orgId = c.get('orgId');
  const supabase = getSupabaseAdmin();

  const { data: connection } = await supabase
    .from('pms_connections')
    .select('status, last_synced_at, account_id')
    .eq('org_id', orgId)
    .eq('provider', 'guesty')
    .single();

  if (!connection) {
    return c.json({ connected: false, provider: 'guesty' });
  }

  return c.json({
    connected: connection.status === 'connected',
    provider: 'guesty',
    status: connection.status,
    lastSyncedAt: connection.last_synced_at,
  });
});

// ============================================================
// POST /sync — Sync properties from Guesty
// ============================================================

guestyRouter.post('/sync', async (c) => {
  const orgId = c.get('orgId');
  const supabase = getSupabaseAdmin();

  // 1. Get connection
  const { data: connection } = await supabase
    .from('pms_connections')
    .select('encrypted_credentials')
    .eq('org_id', orgId)
    .eq('provider', 'guesty')
    .eq('status', 'connected')
    .single();

  if (!connection) {
    return c.json({ message: 'No active Guesty connection', code: 'NOT_CONNECTED', status: 400 }, 400);
  }

  try {
    const creds = JSON.parse(decrypt(connection.encrypted_credentials)) as { apiKey: string };
    const properties = await guestyAdapter.getProperties({ accountId: '', apiKey: creds.apiKey });

    // Update last synced timestamp
    await supabase
      .from('pms_connections')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('org_id', orgId)
      .eq('provider', 'guesty');

    console.log(`[Guesty] Synced ${properties.length} properties for org ${orgId}`);
    return c.json({ properties, count: properties.length });
  } catch (err) {
    console.error('[Guesty] Sync error:', err);
    const message = err instanceof Error ? err.message : 'Sync failed';
    return c.json({ message, code: 'SYNC_ERROR', status: 500 }, 500);
  }
});

// ============================================================
// DELETE / — Disconnect Guesty
// ============================================================

guestyRouter.delete('/', async (c) => {
  const orgId = c.get('orgId');
  const supabase = getSupabaseAdmin();

  await supabase
    .from('pms_connections')
    .update({ status: 'disconnected' })
    .eq('org_id', orgId)
    .eq('provider', 'guesty');

  console.log(`[Guesty] Disconnected org ${orgId}`);
  return c.json({ message: 'Guesty disconnected', status: 'disconnected' });
});
