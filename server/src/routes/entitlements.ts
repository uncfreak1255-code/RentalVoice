/**
 * Entitlements Routes
 *
 * Purpose: Server-side source of truth for plan + Supermemory entitlements
 */

import { Hono } from 'hono';
import { getSupabaseAdmin } from '../db/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { PLAN_LIMITS } from '../lib/types.js';
import type { PlanTier } from '../lib/types.js';
import type { AppEnv } from '../lib/env.js';
import { getEffectivePlan, isFounderAccount } from '../lib/founder-access.js';

export const entitlementsRouter = new Hono<AppEnv>();

entitlementsRouter.use('*', requireAuth);

entitlementsRouter.get('/current', async (c) => {
  try {
    const orgId = c.get('orgId');
    const userId = c.get('userId');
    const userEmail = c.get('userEmail');
    const supabase = getSupabaseAdmin();
    const currentMonth = new Date().toISOString().slice(0, 7);

    const { data: user } = await supabase
      .from('users')
      .select('plan, trial_ends_at')
      .eq('id', userId)
      .single();

    const basePlan = (user?.plan || 'starter') as PlanTier;
    const plan = getEffectivePlan(basePlan, userId, userEmail);
    const planLimits = PLAN_LIMITS[plan];

    const { data: rawEntitlements } = await supabase
      .from('org_entitlements')
      .select('*')
      .eq('org_id', orgId)
      .single();

    const { data: usage } = await supabase
      .from('supermemory_usage_monthly')
      .select('memory_reads, memory_writes')
      .eq('org_id', orgId)
      .eq('period_month', currentMonth)
      .single();

    const trialEndsAt = rawEntitlements?.supermemory_trial_ends_at || null;
    const trialActive = trialEndsAt ? new Date(trialEndsAt) > new Date() : false;
    const addonActive = rawEntitlements?.supermemory_addon_active === true;

    const supermemoryEnabledByPlan = planLimits.supermemoryIncluded;
    const supermemoryEnabled = supermemoryEnabledByPlan || addonActive || trialActive;

    const writeLimit = supermemoryEnabled
      ? (rawEntitlements?.supermemory_write_limit_monthly ?? planLimits.supermemoryWriteLimitMonthly)
      : 0;
    const readLimit = supermemoryEnabled
      ? (rawEntitlements?.supermemory_read_limit_monthly ?? planLimits.supermemoryReadLimitMonthly)
      : 0;

    const readsUsed = usage?.memory_reads || 0;
    const writesUsed = usage?.memory_writes || 0;
    const overReads = readLimit > 0 && readsUsed >= readLimit;
    const overWrites = writeLimit > 0 && writesUsed >= writeLimit;

    const mode: 'off' | 'full' | 'degraded' = !supermemoryEnabled
      ? 'off'
      : (overReads || overWrites ? 'degraded' : 'full');

    return c.json({
      plan,
      basePlan,
      founderAccess: isFounderAccount(userId, userEmail),
      entitlements: {
        supermemoryEnabled: supermemoryEnabled && mode !== 'off',
        supermemoryMode: mode,
        supermemoryTrialEndsAt: trialEndsAt,
        supermemoryWriteLimitMonthly: writeLimit,
        supermemoryReadLimitMonthly: readLimit,
        supermemoryWriteRemaining: Math.max(0, writeLimit - writesUsed),
        supermemoryReadRemaining: Math.max(0, readLimit - readsUsed),
        supermemoryRetentionDays: rawEntitlements?.supermemory_retention_days ?? planLimits.supermemoryRetentionDays,
        supermemoryTopK: rawEntitlements?.supermemory_top_k ?? planLimits.supermemoryTopK,
        supermemoryCrossProperty: rawEntitlements?.supermemory_cross_property ?? planLimits.supermemoryCrossProperty,
        supermemoryTeamShared: rawEntitlements?.supermemory_team_shared ?? planLimits.supermemoryTeamShared,
        supermemoryAddonActive: addonActive,
      },
      usage: {
        month: currentMonth,
        memoryReads: readsUsed,
        memoryWrites: writesUsed,
      },
      trial: {
        isTrialActive: trialActive,
        trialEndsAt,
      },
    });
  } catch (err) {
    console.error('[Entitlements] Error:', err);
    return c.json({ message: 'Failed to fetch entitlements', code: 'INTERNAL_ERROR', status: 500 }, 500);
  }
});
