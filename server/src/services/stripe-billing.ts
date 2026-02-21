/**
 * Stripe Billing Service — Metered Usage via Billing Meters
 * 
 * 📁 server/src/services/stripe-billing.ts
 * Purpose: Report overage AI draft usage to Stripe via Billing Meter Events
 * Depends on: db/supabase.ts, lib/types.ts
 * Used by: services/ai-proxy.ts (called after each AI draft generation)
 * 
 * How it works (Stripe 2025+ Billing Meters):
 * 1. After each AI draft, ai-proxy calls reportOverageIfNeeded()
 * 2. We check if the org's total drafts this month exceed the plan limit
 * 3. If yes AND the user is on a paid plan with overage pricing, we send
 *    a meter event to Stripe via POST /v1/billing/meter_events
 * 4. Stripe aggregates meter events and charges at the end of billing period
 * 
 * Stripe resources created:
 * - Billing Meter: "AI Draft Overages" (event_name: ai_draft_overage)
 * - Metered Price: $0.02/draft linked to the meter
 * - Env var: STRIPE_PRICE_OVERAGE_DRAFT
 */

import { getSupabaseAdmin } from '../db/supabase.js';
import { PLAN_LIMITS } from '../lib/types.js';
import type { PlanTier } from '../lib/types.js';

// ============================================================
// Stripe API helper (matches billing.ts pattern)
// ============================================================

async function stripeRequest<T>(
  path: string,
  method: 'GET' | 'POST',
  body?: Record<string, string>,
): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('[StripeBilling] STRIPE_SECRET_KEY not set');

  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body ? new URLSearchParams(body).toString() : undefined,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`[Stripe] API error ${response.status}: ${err}`);
  }

  return response.json() as Promise<T>;
}

// ============================================================
// Core: Report Overage via Stripe Billing Meter Events
// ============================================================

/** Stripe Billing Meter event name (must match meter config) */
const METER_EVENT_NAME = 'ai_draft_overage';

/**
 * Check if org is in overage territory and report to Stripe if so.
 * Called after every successful AI draft generation.
 * 
 * Uses Stripe Billing Meter Events API (2025+):
 *   POST /v1/billing/meter_events
 *   { event_name, payload: { stripe_customer_id, value } }
 * 
 * This is fire-and-forget — errors are logged but don't block the draft.
 */
export async function reportOverageIfNeeded(orgId: string, userId: string): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const currentMonth = new Date().toISOString().slice(0, 7);

    // Get user plan + Stripe customer ID
    const { data: user } = await supabase
      .from('users')
      .select('plan, stripe_customer_id')
      .eq('id', userId)
      .single();

    if (!user) return;

    const plan = (user.plan || 'starter') as PlanTier;
    const limits = PLAN_LIMITS[plan];

    // Skip if no overage cost (free tier) or no Stripe customer
    if (limits.overageDraftCost === 0) return;
    if (!user.stripe_customer_id) return;

    // Get total drafts this month
    const { data: usageRecords } = await supabase
      .from('ai_usage')
      .select('requests')
      .eq('org_id', orgId)
      .eq('month', currentMonth);

    const totalDrafts = usageRecords?.reduce((sum, r) => sum + r.requests, 0) || 0;

    // Only report if we're over the limit
    if (totalDrafts <= limits.maxDraftsPerMonth) return;

    // Send meter event to Stripe
    await stripeRequest('/billing/meter_events', 'POST', {
      event_name: METER_EVENT_NAME,
      'payload[stripe_customer_id]': user.stripe_customer_id,
      'payload[value]': '1',
    });

    console.log(
      `[StripeBilling] Reported 1 overage draft for org ${orgId} ` +
      `(${totalDrafts}/${limits.maxDraftsPerMonth}, customer ${user.stripe_customer_id})`
    );
  } catch (err) {
    // Never block AI generation on billing errors
    console.error('[StripeBilling] Error reporting overage:', err);
  }
}

// ============================================================
// Utility: Get current overage count for an org
// ============================================================

/**
 * Returns how many overage drafts this org has used this month.
 * Returns 0 if within plan limits.
 */
export async function getOverageCount(orgId: string, userId: string): Promise<number> {
  const supabase = getSupabaseAdmin();
  const currentMonth = new Date().toISOString().slice(0, 7);

  const { data: user } = await supabase
    .from('users')
    .select('plan')
    .eq('id', userId)
    .single();

  const plan = (user?.plan || 'starter') as PlanTier;
  const limits = PLAN_LIMITS[plan];

  const { data: usageRecords } = await supabase
    .from('ai_usage')
    .select('requests')
    .eq('org_id', orgId)
    .eq('month', currentMonth);

  const totalDrafts = usageRecords?.reduce((sum, r) => sum + r.requests, 0) || 0;
  return Math.max(0, totalDrafts - limits.maxDraftsPerMonth);
}
