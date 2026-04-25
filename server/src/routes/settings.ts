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
        mode: 'managed',
        provider: aiConfigResult.data.provider,
        model: aiConfigResult.data.model,
        hasApiKey: false,
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
        { message: parsed.error.issues[0].message, code: 'VALIDATION_ERROR', status: 400 },
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
  mode: z.string().optional(),
  provider: z.string().optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
}).passthrough();

settingsRouter.put('/ai', async (c) => {
  try {
    const orgId = c.get('orgId');
    const body = await c.req.json();
    const parsed = updateAIConfigSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        { message: parsed.error.issues[0].message, code: 'VALIDATION_ERROR', status: 400 },
        400
      );
    }

    const supabase = getSupabaseAdmin();
    const updates: Record<string, unknown> = {
      mode: 'managed',
      encrypted_api_key: null,
      provider: null,
      model: null,
    };

    const { error } = await supabase
      .from('ai_configs')
      .upsert({ org_id: orgId, ...updates }, { onConflict: 'org_id' });

    if (error) {
      return c.json({ message: 'Failed to update AI config', code: 'DB_ERROR', status: 500 }, 500);
    }

    return c.json({ message: 'AI configuration updated', mode: 'managed' });
  } catch (err) {
    console.error('[Settings] AI config error:', err);
    return c.json({ message: 'Failed to update AI config', code: 'INTERNAL_ERROR', status: 500 }, 500);
  }
});
