/**
 * Webhook Routes
 * 
 * 📁 server/src/routes/webhooks.ts
 * Purpose: Handle incoming webhooks from Stripe (subscription events)
 * Depends on: db/supabase.ts
 * Used by: Stripe webhook endpoint configuration
 * 
 * NOTE: This route does NOT use auth middleware — webhooks are
 * authenticated via Stripe signature verification.
 */

import { Hono } from 'hono';
import { getSupabaseAdmin } from '../db/supabase.js';
import { createHmac, timingSafeEqual } from 'crypto';

export const webhooksRouter = new Hono();

// ============================================================
// Stripe Signature Verification
// ============================================================

interface StripeEvent {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
}

function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const parts = signature.split(',');
  const timestampPart = parts.find((p) => p.startsWith('t='));
  const sigPart = parts.find((p) => p.startsWith('v1='));

  if (!timestampPart || !sigPart) return false;

  const timestamp = timestampPart.slice(2);
  const expectedSig = sigPart.slice(3);

  // Check timestamp is within 5 minutes
  const timestampNum = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestampNum) > 300) return false;

  // Compute expected signature
  const signedPayload = `${timestamp}.${payload}`;
  const computed = createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  // Timing-safe comparison
  try {
    return timingSafeEqual(
      Buffer.from(computed, 'hex'),
      Buffer.from(expectedSig, 'hex'),
    );
  } catch {
    return false;
  }
}

// ============================================================
// POST /stripe — Stripe Webhook Handler
// ============================================================

webhooksRouter.post('/stripe', async (c) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[Webhooks] STRIPE_WEBHOOK_SECRET not configured');
    return c.json({ received: false, error: 'Webhook secret not configured' }, 500);
  }

  // Get raw body and signature
  const rawBody = await c.req.text();
  const signature = c.req.header('stripe-signature');

  if (!signature) {
    return c.json({ received: false, error: 'Missing stripe-signature header' }, 400);
  }

  // Verify signature
  if (!verifyStripeSignature(rawBody, signature, webhookSecret)) {
    console.warn('[Webhooks] Invalid Stripe signature');
    return c.json({ received: false, error: 'Invalid signature' }, 401);
  }

  // Parse event
  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return c.json({ received: false, error: 'Invalid JSON' }, 400);
  }

  console.log(`[Webhooks] Stripe event: ${event.type} (${event.id})`);

  const supabase = getSupabaseAdmin();

  // Handle events
  switch (event.type) {
    // ── Checkout completed → upgrade plan ──
    case 'checkout.session.completed': {
      const session = event.data.object as {
        customer: string;
        metadata?: { userId?: string; plan?: string };
        subscription?: string;
      };

      const userId = session.metadata?.userId;
      const plan = session.metadata?.plan;

      if (userId && plan) {
        await supabase
          .from('users')
          .update({
            plan,
            stripe_customer_id: session.customer,
            trial_ends_at: null, // End trial on paid conversion
          })
          .eq('id', userId);

        console.log(`[Webhooks] User ${userId} upgraded to ${plan}`);
      }
      break;
    }

    // ── Subscription updated (plan change, renewal) ──
    case 'customer.subscription.updated': {
      const subscription = event.data.object as {
        customer: string;
        status: string;
        items?: { data: { price: { id: string } }[] };
      };

      if (subscription.status === 'active' && subscription.items?.data?.[0]) {
        const priceId = subscription.items.data[0].price.id;
        const plan = planFromPriceId(priceId);

        await supabase
          .from('users')
          .update({ plan })
          .eq('stripe_customer_id', subscription.customer as string);

        console.log(`[Webhooks] Subscription updated for customer ${subscription.customer} → ${plan}`);
      }
      break;
    }

    // ── Subscription cancelled or unpaid ──
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as {
        customer: string;
      };

      // Downgrade to starter (free)
      await supabase
        .from('users')
        .update({ plan: 'starter' })
        .eq('stripe_customer_id', subscription.customer as string);

      console.log(`[Webhooks] Subscription cancelled for customer ${subscription.customer} → starter`);
      break;
    }

    // ── Invoice payment failed ──
    case 'invoice.payment_failed': {
      const invoice = event.data.object as {
        customer: string;
        attempt_count: number;
      };

      console.warn(`[Webhooks] Payment failed for customer ${invoice.customer}, attempt ${invoice.attempt_count}`);
      // Note: Stripe handles dunning automatically. We log for monitoring.
      // Add email notification here if needed.
      break;
    }

    default:
      console.log(`[Webhooks] Unhandled event type: ${event.type}`);
  }

  // Always return 200 to acknowledge receipt
  return c.json({ received: true });
});

// ============================================================
// Helper: Price ID → Plan mapping (imported from billing)
// ============================================================

function planFromPriceId(priceId: string): string {
  if (priceId === process.env.STRIPE_PRICE_PROFESSIONAL) return 'professional';
  if (priceId === process.env.STRIPE_PRICE_BUSINESS) return 'business';
  if (priceId === process.env.STRIPE_PRICE_ENTERPRISE) return 'enterprise';
  return 'starter';
}
