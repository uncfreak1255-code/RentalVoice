/**
 * Billing Routes (Stripe)
 * 
 * 📁 server/src/routes/billing.ts
 * Purpose: Subscription management — checkout, portal, plan status
 * Depends on: middleware/auth.ts, db/supabase.ts, stripe SDK
 * Used by: Mobile app Settings > Billing, Landing page upgrade flow
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { getSupabaseAdmin } from '../db/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import type { AppEnv } from '../lib/env.js';
import type { PlanTier } from '../lib/types.js';

export const billingRouter = new Hono<AppEnv>();

billingRouter.use('*', requireAuth);

// ============================================================
// Stripe Config
// ============================================================

function getStripeKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('[Billing] STRIPE_SECRET_KEY is required');
  return key;
}

/** Map plan tiers to Stripe Price IDs (set via env vars) */
function getPriceId(plan: PlanTier): string | null {
  const map: Record<PlanTier, string | undefined> = {
    starter: undefined, // Free tier, no price ID
    professional: process.env.STRIPE_PRICE_PROFESSIONAL,
    business: process.env.STRIPE_PRICE_BUSINESS,
    enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
  };
  return map[plan] || null;
}

/** Reverse lookup: Stripe Price ID → PlanTier */
function planFromPriceId(priceId: string): PlanTier {
  if (priceId === process.env.STRIPE_PRICE_PROFESSIONAL) return 'professional';
  if (priceId === process.env.STRIPE_PRICE_BUSINESS) return 'business';
  if (priceId === process.env.STRIPE_PRICE_ENTERPRISE) return 'enterprise';
  return 'starter';
}

// ============================================================
// Stripe API helpers (direct fetch, no SDK dependency)
// ============================================================

async function stripeRequest<T>(
  path: string,
  method: 'GET' | 'POST',
  body?: Record<string, string>,
): Promise<T> {
  const key = getStripeKey();
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
// Validation Schemas
// ============================================================

const checkoutSchema = z.object({
  plan: z.enum(['professional', 'business', 'enterprise']),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

// ============================================================
// POST /checkout — Create Stripe Checkout Session
// ============================================================

billingRouter.post('/checkout', async (c) => {
  const userId = c.get('userId');
  const userEmail = c.get('userEmail');
  const body = await c.req.json();

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { message: 'Validation failed', code: 'VALIDATION_ERROR', status: 400, details: parsed.error.flatten().fieldErrors },
      400
    );
  }

  const { plan, successUrl, cancelUrl } = parsed.data;
  const priceId = getPriceId(plan);
  if (!priceId) {
    return c.json(
      { message: `No Stripe price configured for plan: ${plan}`, code: 'PRICE_NOT_CONFIGURED', status: 400 },
      400
    );
  }

  const supabase = getSupabaseAdmin();

  // Get or create Stripe customer
  const { data: user } = await supabase
    .from('users')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single();

  let customerId = user?.stripe_customer_id;

  if (!customerId) {
    // Create Stripe customer
    const customer = await stripeRequest<{ id: string }>('/customers', 'POST', {
      email: userEmail,
      'metadata[userId]': userId,
    });
    customerId = customer.id;

    // Save customer ID
    await supabase
      .from('users')
      .update({ stripe_customer_id: customerId })
      .eq('id', userId);
  }

  // Create Checkout Session
  const session = await stripeRequest<{ id: string; url: string }>('/checkout/sessions', 'POST', {
    customer: customerId,
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    'metadata[userId]': userId,
    'metadata[plan]': plan,
  });

  return c.json({
    sessionId: session.id,
    url: session.url,
  });
});

// ============================================================
// POST /portal — Create Stripe Billing Portal Session
// ============================================================

billingRouter.post('/portal', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();

  const returnUrl = z.string().url().safeParse(body?.returnUrl);
  if (!returnUrl.success) {
    return c.json(
      { message: 'returnUrl is required', code: 'VALIDATION_ERROR', status: 400 },
      400
    );
  }

  const supabase = getSupabaseAdmin();

  const { data: user } = await supabase
    .from('users')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single();

  if (!user?.stripe_customer_id) {
    return c.json(
      { message: 'No billing account found. Please subscribe to a plan first.', code: 'NO_CUSTOMER', status: 400 },
      400
    );
  }

  const session = await stripeRequest<{ url: string }>('/billing_portal/sessions', 'POST', {
    customer: user.stripe_customer_id,
    return_url: returnUrl.data,
  });

  return c.json({ url: session.url });
});

// ============================================================
// GET /status — Current billing status
// ============================================================

billingRouter.get('/status', async (c) => {
  const userId = c.get('userId');
  const supabase = getSupabaseAdmin();

  const { data: user } = await supabase
    .from('users')
    .select('plan, trial_ends_at, stripe_customer_id')
    .eq('id', userId)
    .single();

  if (!user) {
    return c.json(
      { message: 'User not found', code: 'NOT_FOUND', status: 404 },
      404
    );
  }

  const isTrialing = user.trial_ends_at
    ? new Date(user.trial_ends_at) > new Date()
    : false;

  const trialDaysLeft = user.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(user.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return c.json({
    plan: user.plan,
    isTrialing,
    trialDaysLeft,
    hasPaymentMethod: !!user.stripe_customer_id,
  });
});

export { planFromPriceId };
