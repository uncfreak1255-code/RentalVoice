import { Hono } from 'hono';
import { z } from 'zod';
import { getSupabaseAdmin } from '../db/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import type { AppEnv } from '../lib/env.js';
import type { PlanTier } from '../lib/types.js';
import {
  getEffectivePlan,
  getEntitlementSource,
  getForbiddenFounderProjectRefReason,
  getFounderPlanOverride,
  isFounderAccount,
  shouldBypassBillingForFounder,
} from '../lib/founder-access.js';

export const analyticsRouter = new Hono<AppEnv>();

analyticsRouter.use('*', requireAuth);

const analyticsEventSchema = z.object({
  eventName: z.enum([
    'billing_screen_viewed',
    'billing_checkout_started',
    'billing_portal_opened',
    'billing_memory_addon_enabled',
    'billing_memory_addon_disabled',
    'billing_returned',
  ]),
  category: z.literal('billing'),
  source: z.string().max(100).optional(),
  properties: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  occurredAt: z.string().datetime().optional(),
});

analyticsRouter.post('/events', async (c) => {
  try {
    const parsed = analyticsEventSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json(
        { message: 'Validation failed', code: 'VALIDATION_ERROR', status: 400, details: parsed.error.flatten() },
        400
      );
    }

    const supabase = getSupabaseAdmin();
    const orgId = c.get('orgId');
    const userId = c.get('userId');

    await supabase.from('product_events').insert({
      org_id: orgId,
      user_id: userId,
      category: parsed.data.category,
      event_name: parsed.data.eventName,
      source: parsed.data.source || null,
      properties: parsed.data.properties || {},
      client_occurred_at: parsed.data.occurredAt || null,
    });

    return c.json({ success: true });
  } catch (err) {
    console.error('[Analytics] Event ingest error:', err);
    return c.json({ message: 'Failed to store event', code: 'INTERNAL_ERROR', status: 500 }, 500);
  }
});

analyticsRouter.get('/founder-diagnostics', async (c) => {
  try {
    const userId = c.get('userId');
    const userEmail = c.get('userEmail');
    const orgId = c.get('orgId');

    if (!isFounderAccount(userId, userEmail)) {
      return c.json({ message: 'Founder access required', code: 'FORBIDDEN', status: 403 }, 403);
    }

    const supabase = getSupabaseAdmin();
    const currentMonth = new Date().toISOString().slice(0, 7);

    const [{ data: user }, { data: membership }, { data: entitlements }, { data: memoryUsage }, { data: aiUsage }, { data: pmsConnection }, { data: aiConfig }, { data: recentEvents }] = await Promise.all([
      supabase
        .from('users')
        .select('id, email, name, plan, trial_ends_at, stripe_customer_id')
        .eq('id', userId)
        .single(),
      supabase
        .from('org_members')
        .select('role, organizations(id, name)')
        .eq('user_id', userId)
        .single(),
      supabase
        .from('org_entitlements')
        .select('*')
        .eq('org_id', orgId)
        .single(),
      supabase
        .from('supermemory_usage_monthly')
        .select('memory_reads, memory_writes')
        .eq('org_id', orgId)
        .eq('period_month', currentMonth)
        .single(),
      supabase
        .from('ai_usage')
        .select('provider, requests, tokens_in, tokens_out, cost_usd')
        .eq('org_id', orgId)
        .eq('month', currentMonth),
      supabase
        .from('pms_connections')
        .select('provider, status, account_id, last_sync_at')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('ai_configs')
        .select('mode')
        .eq('org_id', orgId)
        .maybeSingle(),
      supabase
        .from('product_events')
        .select('event_name, source, properties, created_at')
        .eq('org_id', orgId)
        .eq('category', 'billing')
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    const basePlan = (user?.plan || 'starter') as PlanTier;
    const effectivePlan = getEffectivePlan(basePlan, userId, userEmail);
    const founderBypass = shouldBypassBillingForFounder(userId, userEmail);
    const envClass = process.env.SUPABASE_ENV_CLASS || 'unset';
    const projectRef = process.env.SUPABASE_PROJECT_REF || 'unknown';
    const projectLabel = process.env.SUPABASE_PROJECT_LABEL || 'unknown';
    const forbiddenProjectRefReason = getForbiddenFounderProjectRefReason(projectRef);
    const founderEmailsConfigured = !!process.env.FOUNDER_EMAILS;
    const founderPlanConfigured = !!process.env.FOUNDER_PLAN_OVERRIDE;
    const founderBypassConfigured = !!process.env.FOUNDER_BILLING_BYPASS;
    const founderBootstrapReady =
      envClass === 'live' &&
      !forbiddenProjectRefReason &&
      founderEmailsConfigured &&
      founderPlanConfigured &&
      founderBypassConfigured;
    const migrationReady =
      founderBootstrapReady &&
      !!orgId &&
      !!entitlements &&
      aiConfig?.mode === 'managed';
    const totalDrafts = aiUsage?.reduce((sum, row) => sum + row.requests, 0) || 0;
    const totalTokens = aiUsage?.reduce((sum, row) => sum + row.tokens_in + row.tokens_out, 0) || 0;
    const totalCost = aiUsage?.reduce((sum, row) => sum + Number(row.cost_usd), 0) || 0;

    return c.json({
      founderAccess: true,
      billingBypass: founderBypass,
      founder: {
        isFounderMatch: true,
        billingBypass: founderBypass,
        planOverride: getFounderPlanOverride(),
        entitlementSource: getEntitlementSource(basePlan, userId, userEmail),
      },
      user: {
        id: user?.id || userId,
        email: user?.email || userEmail,
        name: user?.name || null,
        basePlan,
        effectivePlan,
        trialEndsAt: user?.trial_ends_at || null,
        hasStripeCustomer: !!user?.stripe_customer_id,
      },
      organization: {
        id: (membership as { organizations?: { id?: string; name?: string } } | null)?.organizations?.id || orgId,
        name: (membership as { organizations?: { id?: string; name?: string } } | null)?.organizations?.name || null,
        role: (membership as { role?: string } | null)?.role || null,
      },
      environment: {
        envClass,
        projectRef,
        projectLabel,
        isForbiddenProjectRef: !!forbiddenProjectRefReason,
        forbiddenProjectRefReason,
      },
      readiness: {
        founderBootstrapReady,
        founderBootstrapReason: founderBootstrapReady
          ? 'live_environment_configured'
          : envClass !== 'live'
            ? 'environment_not_live'
            : forbiddenProjectRefReason
              ? forbiddenProjectRefReason
              : !(founderEmailsConfigured && founderPlanConfigured && founderBypassConfigured)
                ? 'founder_env_incomplete'
                : 'unknown',
        migrationReady,
        migrationReason: migrationReady
          ? 'founder_environment_ready'
          : !founderBootstrapReady
            ? 'founder_bootstrap_not_ready'
            : !orgId
              ? 'organization_missing'
              : !entitlements
                ? 'entitlements_missing'
                : aiConfig?.mode !== 'managed'
                  ? 'ai_mode_not_managed'
                  : 'unknown',
        founderEnvConfigured: founderEmailsConfigured && founderPlanConfigured && founderBypassConfigured,
        liveReadinessChecklistPresent: true,
      },
      ai: {
        mode: aiConfig?.mode || null,
        usageMonth: currentMonth,
        totalDrafts,
        totalTokens,
        totalCostUsd: Math.round(totalCost * 100) / 100,
      },
      memory: {
        mode: entitlements?.supermemory_mode || 'off',
        enabled: entitlements?.supermemory_enabled || false,
        addonActive: entitlements?.supermemory_addon_active || false,
        readLimitMonthly: entitlements?.supermemory_read_limit_monthly || 0,
        writeLimitMonthly: entitlements?.supermemory_write_limit_monthly || 0,
        readsUsed: memoryUsage?.memory_reads || 0,
        writesUsed: memoryUsage?.memory_writes || 0,
      },
      pms: {
        provider: pmsConnection?.provider || null,
        status: pmsConnection?.status || null,
        accountId: pmsConnection?.account_id || null,
        lastSyncAt: pmsConnection?.last_sync_at || null,
      },
      recentBillingEvents: recentEvents || [],
    });
  } catch (err) {
    console.error('[Analytics] Founder diagnostics error:', err);
    return c.json({ message: 'Failed to load founder diagnostics', code: 'INTERNAL_ERROR', status: 500 }, 500);
  }
});
