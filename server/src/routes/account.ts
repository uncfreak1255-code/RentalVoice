/**
 * Account Routes — Profile updates + DELETE (App Store requirement)
 * 
 * 📁 server/src/routes/account.ts
 * Purpose: Account management including mandatory deletion endpoint
 * Depends on: db/supabase, middleware/auth
 * Note: DELETE /api/account is required by Apple App Store
 */

import { Hono } from 'hono';
import { getSupabaseAdmin } from '../db/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import type { AppEnv } from '../lib/env.js';

export const accountRouter = new Hono<AppEnv>();

accountRouter.use('*', requireAuth);

// ============================================================
// DELETE /api/account — Delete account (App Store required)
// ============================================================

accountRouter.delete('/', async (c) => {
  try {
    const userId = c.get('userId');
    const orgId = c.get('orgId');
    const supabase = getSupabaseAdmin();

    // Delete in order: dependent data → org → user
    // RLS cascades handle most of this, but be explicit for safety

    // 1. Delete org-scoped data
    await Promise.all([
      supabase.from('ai_usage').delete().eq('org_id', orgId),
      supabase.from('edit_patterns').delete().eq('org_id', orgId),
      supabase.from('host_style_profiles').delete().eq('org_id', orgId),
      supabase.from('property_knowledge').delete().eq('org_id', orgId),
      supabase.from('org_settings').delete().eq('org_id', orgId),
      supabase.from('ai_configs').delete().eq('org_id', orgId),
      supabase.from('pms_connections').delete().eq('org_id', orgId),
    ]);

    // 2. Delete membership + org
    await supabase.from('org_members').delete().eq('org_id', orgId);
    await supabase.from('organizations').delete().eq('id', orgId);

    // 3. Delete user record
    await supabase.from('users').delete().eq('id', userId);

    // 4. Delete Supabase auth user (removes from auth.users)
    await supabase.auth.admin.deleteUser(userId);

    return c.json({ message: 'Account deleted successfully' });
  } catch (err) {
    console.error('[Account] Delete error:', err);
    return c.json({ message: 'Account deletion failed', code: 'INTERNAL_ERROR', status: 500 }, 500);
  }
});

// ============================================================
// PUT /api/account — Update profile
// ============================================================

accountRouter.put('/', async (c) => {
  try {
    const userId = c.get('userId');
    const { name } = await c.req.json();

    if (!name || typeof name !== 'string' || name.length < 1) {
      return c.json({ message: 'Name is required', code: 'VALIDATION_ERROR', status: 400 }, 400);
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('users')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      return c.json({ message: 'Failed to update profile', code: 'DB_ERROR', status: 500 }, 500);
    }

    return c.json({ message: 'Profile updated' });
  } catch (err) {
    console.error('[Account] Update error:', err);
    return c.json({ message: 'Failed to update profile', code: 'INTERNAL_ERROR', status: 500 }, 500);
  }
});
