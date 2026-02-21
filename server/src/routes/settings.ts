/**
 * Settings Routes — Organization settings CRUD
 * 
 * 📁 server/src/routes/settings.ts
 * Purpose: Read and update org settings, AI config
 * Depends on: db/supabase, middleware/auth, lib/types, lib/encryption
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { getSupabaseAdmin } from '../db/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { encrypt } from '../lib/encryption.js';
import type { AppEnv } from '../lib/env.js';

export const settingsRouter = new Hono<AppEnv>();

// All settings routes require auth
settingsRouter.use('*', requireAuth);

// ============================================================
// GET /api/settings — Full org settings
// ============================================================

settingsRouter.get('/', async (c) => {
  try {
    const orgId = c.get('orgId');
    const supabase = getSupabaseAdmin();

    const [settingsResult, aiConfigResult] = await Promise.all([
      supabase.from('org_settings').select('*').eq('org_id', orgId).single(),
      supabase.from('ai_configs').select('*').eq('org_id', orgId).single(),
    ]);

    return c.json({
      settings: settingsResult.data || {},
      aiConfig: aiConfigResult.data ? {
        mode: aiConfigResult.data.mode,
        provider: aiConfigResult.data.provider,
        model: aiConfigResult.data.model,
        hasApiKey: !!aiConfigResult.data.encrypted_api_key,
      } : null,
    });
  } catch (err) {
    console.error('[Settings] Get error:', err);
    return c.json({ message: 'Failed to fetch settings', code: 'INTERNAL_ERROR', status: 500 }, 500);
  }
});

// ============================================================
// PUT /api/settings — Update org settings
// ============================================================

const updateSettingsSchema = z.object({
  defaultLanguage: z.string().min(2).max(5).optional(),
  responseLanguageMode: z.enum(['match_guest', 'always_default', 'auto']).optional(),
  autopilotEnabled: z.boolean().optional(),
  autopilotThreshold: z.number().min(50).max(100).optional(),
});

settingsRouter.put('/', async (c) => {
  try {
    const orgId = c.get('orgId');
    const body = await c.req.json();
    const parsed = updateSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        { message: parsed.error.errors[0].message, code: 'VALIDATION_ERROR', status: 400 },
        400
      );
    }

    const supabase = getSupabaseAdmin();
    const updates: Record<string, unknown> = {};

    if (parsed.data.defaultLanguage) updates.default_language = parsed.data.defaultLanguage;
    if (parsed.data.responseLanguageMode) updates.response_language_mode = parsed.data.responseLanguageMode;
    if (parsed.data.autopilotEnabled !== undefined) updates.autopilot_enabled = parsed.data.autopilotEnabled;
    if (parsed.data.autopilotThreshold) updates.autopilot_threshold = parsed.data.autopilotThreshold;

    const { error } = await supabase
      .from('org_settings')
      .update(updates)
      .eq('org_id', orgId);

    if (error) {
      return c.json({ message: 'Failed to update settings', code: 'DB_ERROR', status: 500 }, 500);
    }

    return c.json({ message: 'Settings updated' });
  } catch (err) {
    console.error('[Settings] Update error:', err);
    return c.json({ message: 'Failed to update settings', code: 'INTERNAL_ERROR', status: 500 }, 500);
  }
});

// ============================================================
// PUT /api/settings/ai — Update AI configuration
// ============================================================

const updateAIConfigSchema = z.object({
  mode: z.enum(['managed', 'byok']),
  provider: z.enum(['openai', 'anthropic', 'google']).optional(),
  apiKey: z.string().optional(), // Will be encrypted before storage
  model: z.string().optional(),
});

settingsRouter.put('/ai', async (c) => {
  try {
    const orgId = c.get('orgId');
    const body = await c.req.json();
    const parsed = updateAIConfigSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        { message: parsed.error.errors[0].message, code: 'VALIDATION_ERROR', status: 400 },
        400
      );
    }

    const { mode, provider, apiKey, model } = parsed.data;

    // BYOK requires provider + apiKey
    if (mode === 'byok' && (!provider || !apiKey)) {
      return c.json(
        { message: 'BYOK mode requires provider and apiKey', code: 'VALIDATION_ERROR', status: 400 },
        400
      );
    }

    const supabase = getSupabaseAdmin();
    const updates: Record<string, unknown> = { mode };

    if (provider) updates.provider = provider;
    if (model) updates.model = model;
    if (apiKey) updates.encrypted_api_key = encrypt(apiKey);
    if (mode === 'managed') {
      updates.encrypted_api_key = null;
      updates.provider = null;
      updates.model = null;
    }

    const { error } = await supabase
      .from('ai_configs')
      .upsert({ org_id: orgId, ...updates }, { onConflict: 'org_id' });

    if (error) {
      return c.json({ message: 'Failed to update AI config', code: 'DB_ERROR', status: 500 }, 500);
    }

    return c.json({ message: 'AI configuration updated', mode });
  } catch (err) {
    console.error('[Settings] AI config error:', err);
    return c.json({ message: 'Failed to update AI config', code: 'INTERNAL_ERROR', status: 500 }, 500);
  }
});
