/**
 * Lodgify PMS Connection Routes
 * 
 * 📁 server/src/routes/lodgify.ts
 * Purpose: Connect, disconnect, sync, and check status of Lodgify PMS
 * Depends on: middleware/auth.ts, lib/encryption.ts, db/supabase.ts
 * Used by: Mobile app Settings > PMS Connection screen
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { getSupabaseAdmin } from '../db/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { encrypt, decrypt } from '../lib/encryption.js';
import { lodgifyAdapter } from '../adapters/lodgify-adapter.js';
import type { AppEnv } from '../lib/env.js';

export const lodgifyRouter = new Hono<AppEnv>();

lodgifyRouter.use('*', requireAuth);

// ============================================================
// Validation Schemas
// ============================================================

const connectSchema = z.object({
  apiKey: z.string().min(10, 'Lodgify API key is required'),
});

// ============================================================
// POST / — Connect Lodgify account
// ============================================================

lodgifyRouter.post('/', async (c) => {
  const orgId = c.get('orgId');
  const body = await c.req.json();

  const parsed = connectSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { message: 'Validation failed', code: 'VALIDATION_ERROR', status: 400, details: parsed.error.flatten().fieldErrors },
      400
    );
  }

  const { apiKey } = parsed.data;
  const supabase = getSupabaseAdmin();

  // 1. Test connection via Lodgify adapter
  try {
    const isValid = await lodgifyAdapter.testConnection({ accountId: '', apiKey });

    if (!isValid) {
      return c.json(
        { message: 'Invalid Lodgify API key. Please check your key and try again.', code: 'LODGIFY_AUTH_FAILED', status: 401 },
        401
      );
    }

    // 2. Check for existing connection
    const { data: existing } = await supabase
      .from('pms_connections')
      .select('id')
      .eq('org_id', orgId)
      .eq('provider', 'lodgify')
      .single();

    const encryptedCreds = encrypt(JSON.stringify({ apiKey }));

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
        provider: 'lodgify',
        account_id: 'lodgify-api',
        encrypted_credentials: encryptedCreds,
        status: 'connected',
      });
    }

    console.log(`[Lodgify] Connected org ${orgId}`);
    return c.json({ message: 'Lodgify connected successfully', status: 'connected' });
  } catch (err) {
    console.error('[Lodgify] Connection error:', err);
    const message = err instanceof Error ? err.message : 'Connection failed';
    return c.json({ message, code: 'LODGIFY_ERROR', status: 500 }, 500);
  }
});

// ============================================================
// GET /status — Check Lodgify connection status
// ============================================================

lodgifyRouter.get('/status', async (c) => {
  const orgId = c.get('orgId');
  const supabase = getSupabaseAdmin();

  const { data: connection } = await supabase
    .from('pms_connections')
    .select('status, last_synced_at, account_id')
    .eq('org_id', orgId)
    .eq('provider', 'lodgify')
    .single();

  if (!connection) {
    return c.json({ connected: false, provider: 'lodgify' });
  }

  return c.json({
    connected: connection.status === 'connected',
    provider: 'lodgify',
    status: connection.status,
    lastSyncedAt: connection.last_synced_at,
  });
});

// ============================================================
// POST /sync — Sync properties from Lodgify
// ============================================================

lodgifyRouter.post('/sync', async (c) => {
  const orgId = c.get('orgId');
  const supabase = getSupabaseAdmin();

  // 1. Get connection
  const { data: connection } = await supabase
    .from('pms_connections')
    .select('encrypted_credentials')
    .eq('org_id', orgId)
    .eq('provider', 'lodgify')
    .eq('status', 'connected')
    .single();

  if (!connection) {
    return c.json({ message: 'No active Lodgify connection', code: 'NOT_CONNECTED', status: 400 }, 400);
  }

  try {
    const creds = JSON.parse(decrypt(connection.encrypted_credentials)) as { apiKey: string };
    const properties = await lodgifyAdapter.getProperties({ accountId: '', apiKey: creds.apiKey });

    // Update last synced timestamp
    await supabase
      .from('pms_connections')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('org_id', orgId)
      .eq('provider', 'lodgify');

    console.log(`[Lodgify] Synced ${properties.length} properties for org ${orgId}`);
    return c.json({ properties, count: properties.length });
  } catch (err) {
    console.error('[Lodgify] Sync error:', err);
    const message = err instanceof Error ? err.message : 'Sync failed';
    return c.json({ message, code: 'SYNC_ERROR', status: 500 }, 500);
  }
});

// ============================================================
// DELETE / — Disconnect Lodgify
// ============================================================

lodgifyRouter.delete('/', async (c) => {
  const orgId = c.get('orgId');
  const supabase = getSupabaseAdmin();

  await supabase
    .from('pms_connections')
    .update({ status: 'disconnected' })
    .eq('org_id', orgId)
    .eq('provider', 'lodgify');

  console.log(`[Lodgify] Disconnected org ${orgId}`);
  return c.json({ message: 'Lodgify disconnected', status: 'disconnected' });
});
