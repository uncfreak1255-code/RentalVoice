/**
 * Draft Limit Middleware
 * 
 * 📁 server/src/middleware/draft-limit.ts
 * Purpose: Enforce monthly AI draft limits per plan tier
 * Depends on: db/supabase, lib/types (PLAN_LIMITS, PlanTier)
 * Used by: routes/ai-generate.ts (before generating drafts)
 * 
 * Behavior:
 * - Starter (free): Hard cap at 100 drafts/mo — returns 403
 * - Professional: Soft cap at 1,000 drafts/mo — allows overage at $0.02/draft
 * - Business: Soft cap at 5,000 drafts/mo — allows overage at $0.01/draft
 * - Enterprise: No limit
 */

import type { Context, Next } from 'hono';
import { getSupabaseAdmin } from '../db/supabase.js';
import { PLAN_LIMITS } from '../lib/types.js';
import type { PlanTier } from '../lib/types.js';
import { getEffectivePlan, isFounderAccount } from '../lib/founder-access.js';

/**
 * Middleware to check if the org has remaining AI drafts for this month.
 * Must run AFTER requireAuth (needs userId and orgId on context).
 */
export async function checkDraftLimit(c: Context, next: Next): Promise<Response | void> {
  try {
    const userId = c.get('userId') as string;
    const userEmail = c.get('userEmail') as string;
    const orgId = c.get('orgId') as string;
    const supabase = getSupabaseAdmin();
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    // Fetch user plan
    const { data: user } = await supabase
      .from('users')
      .select('plan, trial_ends_at')
      .eq('id', userId)
      .single();

    const basePlan = (user?.plan || 'starter') as PlanTier;
    const plan = getEffectivePlan(basePlan, userId, userEmail);
    const limits = PLAN_LIMITS[plan];

    // Enterprise / unlimited = skip check
    if (limits.maxDraftsPerMonth === Infinity) {
      await next();
      return;
    }

    // Fetch current month usage
    const { data: usageRecords } = await supabase
      .from('ai_usage')
      .select('requests')
      .eq('org_id', orgId)
      .eq('month', currentMonth);

    const totalDrafts = usageRecords?.reduce((sum, r) => sum + r.requests, 0) || 0;
    const remaining = Math.max(0, limits.maxDraftsPerMonth - totalDrafts);
    const isOverLimit = totalDrafts >= limits.maxDraftsPerMonth;

    // Set headers so the mobile app can display remaining
    c.header('X-Drafts-Used', totalDrafts.toString());
    c.header('X-Drafts-Limit', limits.maxDraftsPerMonth.toString());
    c.header('X-Drafts-Remaining', remaining.toString());
    c.header('X-Founder-Access', isFounderAccount(userId, userEmail) ? 'true' : 'false');

    if (isOverLimit) {
      // Free tier: hard cap — block the request
      if (limits.overageDraftCost === 0) {
        return c.json(
          {
            message: 'Monthly draft limit reached. Upgrade to Professional for 1,000 drafts/mo.',
            code: 'DRAFT_LIMIT_EXCEEDED',
            status: 403,
            details: {
              draftsUsed: totalDrafts,
              draftsLimit: limits.maxDraftsPerMonth,
              plan,
              upgradeUrl: '/settings', // deep link in app
            },
          },
          403
        );
      }

      // Paid tiers: require client acknowledgment before allowing overage
      const acknowledged = c.req.header('X-Overage-Acknowledged') === 'true';
      if (!acknowledged) {
        return c.json(
          {
            message: `Monthly draft limit reached. This draft will cost $${limits.overageDraftCost} as overage.`,
            code: 'OVERAGE_CONFIRMATION_REQUIRED',
            status: 402,
            details: {
              draftsUsed: totalDrafts,
              draftsLimit: limits.maxDraftsPerMonth,
              overageCost: limits.overageDraftCost,
              plan,
            },
          },
          402
        );
      }

      c.set('isOverage', true);
      c.set('overageCost', limits.overageDraftCost);
      console.log(`[Draft Limit] Org ${orgId} is in overage — ${totalDrafts}/${limits.maxDraftsPerMonth} drafts at $${limits.overageDraftCost}/extra`);
    }

    await next();
  } catch (err) {
    // Don't block AI generation on limit check failures — log and continue
    console.error('[Draft Limit] Error checking limit, allowing request:', err);
    await next();
  }
}
