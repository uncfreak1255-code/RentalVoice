/**
 * Usage Routes — AI usage tracking and billing info
 * 
 * 📁 server/src/routes/usage.ts
 * Purpose: Retrieve usage metrics for the current billing period
 * Depends on: db/supabase, middleware/auth, lib/types
 */

import { Hono } from 'hono';
import { getSupabaseAdmin } from '../db/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { PLAN_LIMITS } from '../lib/types.js';
import type { PlanTier } from '../lib/types.js';
import type { AppEnv } from '../lib/env.js';

export const usageRouter = new Hono<AppEnv>();

usageRouter.use('*', requireAuth);

// ============================================================
// GET /api/usage — Current month usage
// ============================================================

usageRouter.get('/', async (c) => {
  try {
    const orgId = c.get('orgId');
    const userId = c.get('userId');
    const supabase = getSupabaseAdmin();

    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    // Fetch usage for current month
    const { data: usageRecords } = await supabase
      .from('ai_usage')
      .select('*')
      .eq('org_id', orgId)
      .eq('month', currentMonth);

    // Fetch user plan
    const { data: user } = await supabase
      .from('users')
      .select('plan, trial_ends_at')
      .eq('id', userId)
      .single();

    const plan = (user?.plan || 'starter') as PlanTier;
    const limits = PLAN_LIMITS[plan];

    // Aggregate across providers
    const totalRequests = usageRecords?.reduce((sum, r) => sum + r.requests, 0) || 0;
    const totalTokensIn = usageRecords?.reduce((sum, r) => sum + r.tokens_in, 0) || 0;
    const totalTokensOut = usageRecords?.reduce((sum, r) => sum + r.tokens_out, 0) || 0;
    const totalCost = usageRecords?.reduce((sum, r) => sum + Number(r.cost_usd), 0) || 0;

    // Check trial status
    const isTrialActive = user?.trial_ends_at && new Date(user.trial_ends_at) > new Date();

    return c.json({
      month: currentMonth,
      plan,
      isTrialActive,
      trialEndsAt: user?.trial_ends_at,
      usage: {
        draftsUsed: totalRequests,
        draftsLimit: limits.maxDraftsPerMonth,
        draftsRemaining: Math.max(0, limits.maxDraftsPerMonth - totalRequests),
        tokensIn: totalTokensIn,
        tokensOut: totalTokensOut,
        estimatedCost: Math.round(totalCost * 100) / 100,
      },
      limits: {
        maxProperties: limits.maxProperties,
        maxDraftsPerMonth: limits.maxDraftsPerMonth,
        managedAI: limits.managedAI,
        teamMembers: limits.teamMembers,
        autopilot: limits.autopilot,
        aiModel: limits.aiModel,
        overageDraftCost: limits.overageDraftCost,
        extraPropertyCost: limits.extraPropertyCost,
        styleLearning: limits.styleLearning,
      },
      byProvider: usageRecords?.map((r) => ({
        provider: r.provider,
        requests: r.requests,
        tokensIn: r.tokens_in,
        tokensOut: r.tokens_out,
        cost: Number(r.cost_usd),
      })) || [],
    });
  } catch (err) {
    console.error('[Usage] Error:', err);
    return c.json({ message: 'Failed to fetch usage', code: 'INTERNAL_ERROR', status: 500 }, 500);
  }
});

// ============================================================
// GET /api/usage/history — Last 6 months
// ============================================================

usageRouter.get('/history', async (c) => {
  try {
    const orgId = c.get('orgId');
    const supabase = getSupabaseAdmin();

    // Get last 6 months
    const months: string[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push(d.toISOString().slice(0, 7));
    }

    const { data } = await supabase
      .from('ai_usage')
      .select('*')
      .eq('org_id', orgId)
      .in('month', months)
      .order('month', { ascending: false });

    // Group by month
    const grouped = months.map((month) => {
      const records = data?.filter((r) => r.month === month) || [];
      return {
        month,
        totalRequests: records.reduce((s, r) => s + r.requests, 0),
        totalTokens: records.reduce((s, r) => s + r.tokens_in + r.tokens_out, 0),
        totalCost: Math.round(records.reduce((s, r) => s + Number(r.cost_usd), 0) * 100) / 100,
      };
    });

    return c.json({ history: grouped });
  } catch (err) {
    console.error('[Usage] History error:', err);
    return c.json({ message: 'Failed to fetch history', code: 'INTERNAL_ERROR', status: 500 }, 500);
  }
});
